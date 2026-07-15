import {
  GameSlug,
  SudokuDifficulty,
  SudokuStatus,
  MissionType,
  AchievementCode,
} from '@prisma/client';

import { prisma, type TxClient } from '@/lib/db';
import { AppError } from '@/lib/api';
import { env } from '@/lib/env';
import { dayBounds, secondsBetween } from '@/lib/utils';
import { randomNonce, signSudoku, verifySudoku } from '@/lib/crypto';
import {
  generatePuzzle,
  validateSubmission,
  isWellFormedGrid,
  type Difficulty,
  type Grid,
} from '@/lib/sudoku';
import { spendEnergy } from './energy.service';
import { getPetForUser } from '@/services/pet/pet.service';
import { canPlayGames } from '@/services/pet/decay';
import { awardRandomPuzzlePiece, type PieceAwardResult } from '@/services/collection/collection.service';
import { trackMissionProgress } from '@/services/mission/mission.service';
import { trackAchievement } from '@/services/achievement/achievement.service';

/**
 * Sudoku — the puzzle-piece mini-game.
 *
 * The security shape mirrors the Phaser games: energy and a daily attempt are spent
 * when the puzzle is *issued*, the solution lives only on the server, and the solve
 * request carries an HMAC-signed nonce proving it refers to a puzzle we handed out.
 * A win draws one random monster puzzle piece; the ninth piece of a monster hatches
 * it. The client never receives the answer key, so "read your own traffic" reveals
 * nothing a player didn't already have to solve.
 */

const SESSION_TTL_MINUTES = 60;

function gridToString(grid: Grid): string {
  return grid.join('');
}

function stringToGrid(value: string): Grid {
  return value.split('').map(Number);
}

async function sudokuGame() {
  const game = await prisma.game.findUnique({
    where: { slug: GameSlug.SUDOKU },
    include: { configuration: true },
  });
  if (!game || !game.isActive || !game.configuration?.isActive) {
    throw new AppError('NOT_FOUND', 'Sudoku is not available right now.');
  }
  return game;
}

// --- Start ------------------------------------------------------------------

export interface StartSudokuResult {
  gameId: string;
  difficulty: SudokuDifficulty;
  /** 81-char string, '0' for blanks. The solution is NOT included. */
  puzzle: string;
  signature: string;
  expiresAt: number;
  energy: number;
  attemptsRemaining: number;
}

export async function startSudoku(
  userId: string,
  difficulty: SudokuDifficulty,
): Promise<StartSudokuResult> {
  const game = await sudokuGame();
  const config = game.configuration!;

  // A sick pet blocks mini games, Sudoku included — consistent with the rest.
  const pet = await getPetForUser(userId);
  if (!pet) throw new AppError('CONFLICT', 'Adopt a pet before playing.');
  if (!canPlayGames(pet.healthState)) {
    throw new AppError('PET_SICK', `${pet.name} is too sick to play. Give them medicine first.`);
  }

  const now = new Date();
  const today = dayBounds(now, env.DEFAULT_TIMEZONE);

  const puzzle = generatePuzzle(difficulty as Difficulty);
  const nonce = randomNonce();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MINUTES * 60_000);

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.gameAttempt.upsert({
      where: { userId_gameId_day: { userId, gameId: game.id, day: today.start } },
      create: { userId, gameId: game.id, day: today.start, attempts: 0 },
      update: {},
    });

    if (attempt.attempts >= config.dailyAttemptLimit) {
      throw new AppError(
        'LIMIT_REACHED',
        `You've used all ${config.dailyAttemptLimit} Sudoku puzzles for today. Come back tomorrow.`,
      );
    }

    const energy = await spendEnergy(tx, userId, config.energyCost);

    const bumped = await tx.gameAttempt.updateMany({
      where: { id: attempt.id, attempts: attempt.attempts },
      data: { attempts: { increment: 1 } },
    });
    if (bumped.count === 0) {
      throw new AppError('CONFLICT', 'Another puzzle is starting. Please try again.');
    }

    // One active puzzle at a time: abandon any earlier unfinished one so a player can't
    // stockpile signed sessions.
    await tx.sudokuGame.updateMany({
      where: { userId, status: SudokuStatus.ACTIVE },
      data: { status: SudokuStatus.ABANDONED },
    });

    const created = await tx.sudokuGame.create({
      data: {
        userId,
        difficulty,
        status: SudokuStatus.ACTIVE,
        puzzle: gridToString(puzzle.puzzle),
        solution: gridToString(puzzle.solution),
        seed: puzzle.seed,
        nonce,
        signature: '', // set below, needs the row id
        expiresAt,
      },
    });

    const signature = signSudoku({ gameId: created.id, userId, nonce, seed: puzzle.seed });
    await tx.sudokuGame.update({ where: { id: created.id }, data: { signature } });

    return {
      gameId: created.id,
      difficulty,
      puzzle: created.puzzle,
      signature,
      expiresAt: expiresAt.getTime(),
      energy: energy.current,
      attemptsRemaining: Math.max(0, config.dailyAttemptLimit - (attempt.attempts + 1)),
    };
  });
}

// --- Submit -----------------------------------------------------------------

export interface SubmitSudokuResult {
  solved: boolean;
  /** Cells the player filled that contradict the solution (their own progress only). */
  wrongCells: number[];
  emptyCells: number;
  durationSeconds: number;
  /** Present only on a solve. */
  award?: PieceAwardResult;
}

export async function submitSudoku(input: {
  userId: string;
  gameId: string;
  signature: string;
  grid: number[];
}): Promise<SubmitSudokuResult> {
  if (!isWellFormedGrid(input.grid)) {
    throw new AppError('VALIDATION_ERROR', 'That is not a valid Sudoku grid.');
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const game = await tx.sudokuGame.findUnique({ where: { id: input.gameId } });
    if (!game) throw new AppError('INVALID_SESSION', 'That puzzle does not exist.');
    if (game.userId !== input.userId) {
      throw new AppError('FORBIDDEN', 'That puzzle does not belong to you.');
    }

    // Already solved: return the recorded award rather than granting a second piece.
    // This is what makes a double-tapped "Submit" harmless.
    if (game.status === SudokuStatus.SOLVED) {
      return {
        solved: true,
        wrongCells: [],
        emptyCells: 0,
        durationSeconds: game.durationSeconds ?? 0,
        award: game.awardedMonsterId ? await replayAward(tx, game) : undefined,
      };
    }

    if (game.status !== SudokuStatus.ACTIVE) {
      throw new AppError('INVALID_SESSION', 'This puzzle is no longer active. Start a new one.');
    }

    // Signature proves this solve refers to a puzzle we issued.
    const signatureValid = verifySudoku(
      { gameId: game.id, userId: game.userId, nonce: game.nonce, seed: game.seed },
      input.signature,
    );
    if (!signatureValid) {
      throw new AppError('INVALID_SESSION', 'This puzzle could not be verified.');
    }

    if (game.expiresAt < now) {
      await tx.sudokuGame.update({ where: { id: game.id }, data: { status: SudokuStatus.EXPIRED } });
      throw new AppError('EXPIRED', 'This puzzle expired. Start a new one.');
    }

    const solution = stringToGrid(game.solution);
    const result = validateSubmission(input.grid, solution);
    const durationSeconds = Math.floor(secondsBetween(game.startedAt, now));

    if (!result.isCorrect) {
      // Not solved yet — record the mistake count but leave the game ACTIVE so the
      // player keeps working. wrongCells covers only cells THEY filled, so this helps
      // rather than leaking the answer key.
      await tx.sudokuGame.update({
        where: { id: game.id },
        data: { mistakes: { increment: result.wrongCells.length > 0 ? 1 : 0 } },
      });

      return {
        solved: false,
        wrongCells: result.wrongCells,
        emptyCells: result.emptyCells,
        durationSeconds,
      };
    }

    // Solved. Close the game with a conditional write so two concurrent solves can't
    // both award a piece.
    const closed = await tx.sudokuGame.updateMany({
      where: { id: game.id, status: SudokuStatus.ACTIVE },
      data: { status: SudokuStatus.SOLVED, solvedAt: now, durationSeconds },
    });
    if (closed.count === 0) {
      throw new AppError('CONFLICT', 'This puzzle was already submitted.');
    }

    const award = await awardRandomPuzzlePiece(tx, input.userId);

    await tx.sudokuGame.update({
      where: { id: game.id },
      data: {
        awardedMonsterId: award.monster.id || null,
        awardedPieceIndex: award.pieceIndex,
        completedMonster: award.completedMonster,
      },
    });

    // Sudoku counts toward the same mission objectives as the arcade games.
    await trackMissionProgress(tx, input.userId, MissionType.PLAY_MINI_GAME, 1, {
      gameSlug: GameSlug.SUDOKU,
    });
    await trackMissionProgress(tx, input.userId, MissionType.PLAY_GAME_COUNT, 1, {
      gameSlug: GameSlug.SUDOKU,
    });
    await trackAchievement(tx, input.userId, AchievementCode.PLAY_100_GAMES, 1);

    return {
      solved: true,
      wrongCells: [],
      emptyCells: 0,
      durationSeconds,
      award,
    };
  });
}

/** Re-materialise the award payload for an already-solved game (idempotent replay). */
async function replayAward(tx: TxClient, game: { awardedMonsterId: string | null; awardedPieceIndex: number | null; completedMonster: boolean; userId: string }): Promise<PieceAwardResult | undefined> {
  if (!game.awardedMonsterId) return undefined;
  const monster = await tx.monster.findUnique({ where: { id: game.awardedMonsterId } });
  if (!monster) return undefined;

  const ownedPieces = await tx.userPuzzlePiece.count({
    where: { userId: game.userId, monsterId: monster.id },
  });

  return {
    monster,
    pieceIndex: game.awardedPieceIndex ?? 0,
    ownedPieces,
    completedMonster: game.completedMonster,
  };
}

// --- Read (resume) ----------------------------------------------------------

export interface ActiveSudokuState {
  hasActive: boolean;
  gameId?: string;
  difficulty?: SudokuDifficulty;
  puzzle?: string;
  signature?: string;
  expiresAt?: number;
  startedAt?: number;
}

export async function getActiveSudoku(userId: string): Promise<ActiveSudokuState> {
  const game = await prisma.sudokuGame.findFirst({
    where: { userId, status: SudokuStatus.ACTIVE, expiresAt: { gt: new Date() } },
    orderBy: { startedAt: 'desc' },
  });

  if (!game) return { hasActive: false };

  // Note: `solution` is intentionally never selected into the returned shape.
  return {
    hasActive: true,
    gameId: game.id,
    difficulty: game.difficulty,
    puzzle: game.puzzle,
    signature: game.signature,
    expiresAt: game.expiresAt.getTime(),
    startedAt: game.startedAt.getTime(),
  };
}

export async function getSudokuStats(userId: string) {
  const [game, solvedCount] = await Promise.all([
    sudokuGame(),
    prisma.sudokuGame.count({ where: { userId, status: SudokuStatus.SOLVED } }),
  ]);

  const today = dayBounds(new Date(), env.DEFAULT_TIMEZONE);
  const attempt = await prisma.gameAttempt.findUnique({
    where: { userId_gameId_day: { userId, gameId: game.id, day: today.start } },
  });

  const config = game.configuration!;
  return {
    energyCost: config.energyCost,
    dailyAttemptLimit: config.dailyAttemptLimit,
    attemptsUsed: attempt?.attempts ?? 0,
    attemptsRemaining: Math.max(0, config.dailyAttemptLimit - (attempt?.attempts ?? 0)),
    solvedCount,
  };
}

export const SUDOKU_DIFFICULTY_VALUES = ['EASY', 'MEDIUM', 'HARD'] as const satisfies readonly SudokuDifficulty[];
