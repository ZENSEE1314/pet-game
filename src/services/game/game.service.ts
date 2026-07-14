import {
  GameSlug,
  GameSessionStatus,
  CurrencyType,
  TransactionDirection,
  TransactionCategory,
  MissionType,
  AchievementCode,
  FraudAlertType,
  FraudSeverity,
  type Prisma,
} from '@prisma/client';

import { prisma, type TxClient } from '@/lib/db';
import { AppError } from '@/lib/api';
import { dayBounds, secondsBetween } from '@/lib/utils';
import { env } from '@/lib/env';
import { signGameSession, verifyGameSession, randomNonce } from '@/lib/crypto';
import { recordTransaction } from '@/services/currency/transaction.service';
import { awardXp } from '@/services/level/level.service';
import { trackMissionProgress } from '@/services/mission/mission.service';
import { trackAchievement } from '@/services/achievement/achievement.service';
import { raiseFraudAlert } from '@/services/fraud/fraud.service';
import { recordScore } from '@/services/leaderboard/leaderboard.service';
import { spendEnergy, getEnergy } from './energy.service';
import { getPetForUser } from '@/services/pet/pet.service';
import { canPlayGames } from '@/services/pet/decay';

/**
 * Mini-game trust model.
 *
 * The client is assumed to have a debugger open and a modified bundle. It is
 * allowed to tell us exactly one thing: "I scored N". Everything that turns N into
 * money happens here.
 *
 * Four independent gates have to pass before a coin is minted:
 *   1. The session token's HMAC verifies (it came from us).
 *   2. The session row is ACTIVE and belongs to this user (it hasn't been used).
 *   3. The elapsed time is plausible for the score (physics).
 *   4. The score is within the configured ceiling (sanity).
 *
 * Any of them failing is a rejection *and* a fraud alert for a human to look at.
 * We do not auto-ban: a legitimately brilliant player and a cheater produce the
 * same signal, and banning your best player is worse than paying out one cheat.
 */

const SESSION_TTL_MINUTES = 30;

// --- Lobby ------------------------------------------------------------------

export async function getGameLobby(userId: string) {
  const [games, energy, pet] = await Promise.all([
    prisma.game.findMany({
      where: { isActive: true },
      include: { configuration: true },
      orderBy: { sortOrder: 'asc' },
    }),
    getEnergy(userId),
    getPetForUser(userId),
  ]);

  const today = dayBounds(new Date(), env.DEFAULT_TIMEZONE);

  const entries = await Promise.all(
    games.map(async (game) => {
      const config = game.configuration;

      const [attempt, best] = await Promise.all([
        prisma.gameAttempt.findUnique({
          where: {
            userId_gameId_day: { userId, gameId: game.id, day: today.start },
          },
        }),
        prisma.gameScore.findFirst({
          where: { userId, gameId: game.id },
          orderBy: { score: 'desc' },
          select: { score: true, createdAt: true },
        }),
      ]);

      const attemptsUsed = attempt?.attempts ?? 0;
      const dailyLimit = config?.dailyAttemptLimit ?? 10;

      return {
        id: game.id,
        slug: game.slug,
        name: game.name,
        description: game.description,
        imageUrl: game.imageUrl,
        energyCost: config?.energyCost ?? 1,
        attemptsUsed,
        attemptsRemaining: Math.max(0, dailyLimit - attemptsUsed),
        dailyAttemptLimit: dailyLimit,
        highScore: best?.score ?? 0,
        highScoreAt: best?.createdAt ?? null,
        // Shown as guidance only. The server recomputes both at submit time.
        rewardInfo: {
          coinsPerScorePoint: config?.coinsPerScorePoint ?? 0.1,
          scorePerRewardPoint: config?.scorePerRewardPoint ?? 500,
          dailyCoinCap: config?.dailyCoinCap ?? 500,
          dailyRewardPointCap: config?.dailyRewardPointCap ?? 50,
        },
        coinsEarnedToday: attempt?.coinsEarned ?? 0,
        pointsEarnedToday: attempt?.pointsEarned ?? 0,
        isPlayable:
          Boolean(config?.isActive) &&
          energy.current >= (config?.energyCost ?? 1) &&
          attemptsUsed < dailyLimit &&
          (pet ? canPlayGames(pet.healthState) : false),
      };
    }),
  );

  return {
    games: entries,
    energy,
    petBlocked: pet ? !canPlayGames(pet.healthState) : true,
    petMissing: !pet,
  };
}

// --- Session creation -------------------------------------------------------

export interface StartSessionResult {
  sessionId: string;
  signature: string;
  nonce: string;
  startedAt: number;
  expiresAt: number;
  energy: Awaited<ReturnType<typeof getEnergy>>;
  attemptsRemaining: number;
}

export async function startGameSession(
  userId: string,
  slug: GameSlug,
  context: { ip?: string; userAgent?: string } = {},
): Promise<StartSessionResult> {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({
      where: { slug },
      include: { configuration: true },
    });

    if (!game || !game.isActive || !game.configuration?.isActive) {
      throw new AppError('NOT_FOUND', 'That game is not available right now.');
    }

    const config = game.configuration;

    // A sick pet can't play. Enforced here, not just greyed out in the UI.
    const pet = await tx.pet.findFirst({
      where: { userId, deletedAt: null },
      select: { healthState: true, name: true },
    });
    if (!pet) throw new AppError('CONFLICT', 'Adopt a pet before playing.');
    if (!canPlayGames(pet.healthState)) {
      throw new AppError('PET_SICK', `${pet.name} is too sick to play. Give them medicine first.`);
    }

    const now = new Date();
    const today = dayBounds(now, env.DEFAULT_TIMEZONE);

    // Daily attempt limit, checked and incremented in the same transaction that
    // spends the energy — so a burst of parallel requests can't all pass the check.
    const attempt = await tx.gameAttempt.upsert({
      where: { userId_gameId_day: { userId, gameId: game.id, day: today.start } },
      create: { userId, gameId: game.id, day: today.start, attempts: 0 },
      update: {},
    });

    if (attempt.attempts >= config.dailyAttemptLimit) {
      throw new AppError(
        'LIMIT_REACHED',
        `You've used all ${config.dailyAttemptLimit} attempts for today. Come back tomorrow.`,
      );
    }

    const energy = await spendEnergy(tx, userId, config.energyCost);

    const bumped = await tx.gameAttempt.updateMany({
      where: { id: attempt.id, attempts: attempt.attempts },
      data: { attempts: { increment: 1 } },
    });
    if (bumped.count === 0) {
      throw new AppError('CONFLICT', 'Another game is starting. Please try again.');
    }

    const nonce = randomNonce();
    const startedAt = now;
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MINUTES * 60_000);

    const session = await tx.gameSession.create({
      data: {
        userId,
        gameId: game.id,
        nonce,
        status: GameSessionStatus.ACTIVE,
        startedAt,
        expiresAt,
        ipAddress: context.ip,
        userAgent: context.userAgent,
      },
    });

    // The signature binds session ⇄ user ⇄ game ⇄ nonce ⇄ start time. Change any of
    // them and it stops verifying. The secret never leaves the server.
    const signature = signGameSession({
      sessionId: session.id,
      userId,
      gameId: game.id,
      nonce,
      startedAt: startedAt.getTime(),
    });

    return {
      sessionId: session.id,
      signature,
      nonce,
      startedAt: startedAt.getTime(),
      expiresAt: expiresAt.getTime(),
      energy,
      attemptsRemaining: Math.max(0, config.dailyAttemptLimit - (attempt.attempts + 1)),
    };
  });
}

// --- Submission -------------------------------------------------------------

export interface SubmitScoreInput {
  userId: string;
  sessionId: string;
  signature: string;
  /** The client's *claim*. Treated as untrusted input from here on. */
  score: number;
  events?: Prisma.InputJsonValue;
}

export interface SubmitScoreResult {
  validatedScore: number;
  coinsAwarded: number;
  pointsAwarded: number;
  xpAwarded: number;
  durationSeconds: number;
  isHighScore: boolean;
  wasScoreClamped: boolean;
  dailyCoinCapReached: boolean;
  dailyPointCapReached: boolean;
}

export async function submitGameScore(input: SubmitScoreInput): Promise<SubmitScoreResult> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const session = await tx.gameSession.findUnique({
      where: { id: input.sessionId },
      include: { game: { include: { configuration: true } } },
    });

    if (!session) throw new AppError('INVALID_SESSION', 'That game session does not exist.');

    // Gate 0: ownership. Not the same as authentication — this stops an authenticated
    // player submitting a score against someone else's session.
    if (session.userId !== input.userId) {
      await raiseFraudAlert(
        {
          userId: input.userId,
          type: FraudAlertType.REUSED_SESSION,
          severity: FraudSeverity.HIGH,
          description: 'Attempted to submit a score for another user’s game session.',
          referenceType: 'GameSession',
          referenceId: session.id,
          evidence: { sessionOwner: session.userId, submitter: input.userId },
        },
        tx,
      );
      throw new AppError('FORBIDDEN', 'That session does not belong to you.');
    }

    // Gate 1: the signature. A forged or tampered session dies here.
    const signatureValid = verifyGameSession(
      {
        sessionId: session.id,
        userId: session.userId,
        gameId: session.gameId,
        nonce: session.nonce,
        startedAt: session.startedAt.getTime(),
      },
      input.signature,
    );

    if (!signatureValid) {
      await rejectSession(tx, session.id, 'Invalid session signature');
      await raiseFraudAlert(
        {
          userId: input.userId,
          type: FraudAlertType.REUSED_SESSION,
          severity: FraudSeverity.CRITICAL,
          description: 'Game session signature failed verification — likely a forged session.',
          referenceType: 'GameSession',
          referenceId: session.id,
        },
        tx,
      );
      throw new AppError('INVALID_SESSION', 'This game session could not be verified.');
    }

    // Gate 2: single use. This is what makes a replayed submission worthless.
    if (session.status !== GameSessionStatus.ACTIVE) {
      await raiseFraudAlert(
        {
          userId: input.userId,
          type: FraudAlertType.DUPLICATE_SUBMISSION,
          severity: FraudSeverity.HIGH,
          description: `Re-submitted a game session already in state ${session.status}.`,
          referenceType: 'GameSession',
          referenceId: session.id,
        },
        tx,
      );
      throw new AppError('INVALID_SESSION', 'This game session has already been submitted.');
    }

    if (session.expiresAt < now) {
      await rejectSession(tx, session.id, 'Session expired');
      throw new AppError('EXPIRED', 'This game session expired. Start a new game.');
    }

    const config = session.game.configuration;
    if (!config) throw new AppError('INTERNAL_ERROR', 'This game has no configuration.');

    const durationSeconds = Math.floor(secondsBetween(session.startedAt, now));
    const reportedScore = Math.max(0, Math.floor(input.score));

    // Gate 3: physics. A 4,000-point run that took three seconds did not happen.
    if (durationSeconds < config.minDurationSeconds) {
      await rejectSession(tx, session.id, 'Game completed impossibly fast');
      await raiseFraudAlert(
        {
          userId: input.userId,
          type: FraudAlertType.GAME_TOO_FAST,
          severity: FraudSeverity.HIGH,
          description: `Game submitted after ${durationSeconds}s; minimum is ${config.minDurationSeconds}s.`,
          referenceType: 'GameSession',
          referenceId: session.id,
          evidence: { durationSeconds, reportedScore, min: config.minDurationSeconds },
        },
        tx,
      );
      throw new AppError('INVALID_SESSION', 'That game finished too quickly to be valid.');
    }

    // Gate 4: sanity ceilings. Two of them — an absolute cap, and a rate cap
    // relative to how long the player actually played.
    const plausibleCeiling = Math.min(
      config.maxValidScore,
      durationSeconds * config.maxScorePerSecond,
    );

    let validatedScore = reportedScore;
    let wasScoreClamped = false;

    if (reportedScore > plausibleCeiling) {
      validatedScore = plausibleCeiling;
      wasScoreClamped = true;

      await raiseFraudAlert(
        {
          userId: input.userId,
          type: FraudAlertType.IMPOSSIBLE_SCORE,
          severity: reportedScore > config.maxValidScore * 2 ? FraudSeverity.CRITICAL : FraudSeverity.HIGH,
          description: `Reported ${reportedScore} in ${durationSeconds}s; plausible ceiling was ${plausibleCeiling}. Score clamped.`,
          referenceType: 'GameSession',
          referenceId: session.id,
          evidence: {
            reportedScore,
            validatedScore,
            durationSeconds,
            maxValidScore: config.maxValidScore,
            maxScorePerSecond: config.maxScorePerSecond,
          },
        },
        tx,
      );
    }

    // --- Rewards. Computed here, from admin config, from the *validated* score. ---

    const today = dayBounds(now, env.DEFAULT_TIMEZONE);
    const attempt = await tx.gameAttempt.findUnique({
      where: { userId_gameId_day: { userId: input.userId, gameId: session.gameId, day: today.start } },
    });

    const coinsEarnedToday = attempt?.coinsEarned ?? 0;
    const pointsEarnedToday = attempt?.pointsEarned ?? 0;

    const rawCoins = Math.floor(validatedScore * config.coinsPerScorePoint);
    const rawPoints = Math.floor(validatedScore / config.scorePerRewardPoint);
    const rawXp = Math.floor(validatedScore * config.xpPerScorePoint);

    const coinsAwarded = Math.max(0, Math.min(rawCoins, config.dailyCoinCap - coinsEarnedToday));
    const pointsAwarded = Math.max(
      0,
      Math.min(rawPoints, config.dailyRewardPointCap - pointsEarnedToday),
    );

    // Close the session BEFORE paying out. The conditional `where` means that if two
    // submissions race, exactly one flips ACTIVE→COMPLETED and the loser pays nothing.
    const closed = await tx.gameSession.updateMany({
      where: { id: session.id, status: GameSessionStatus.ACTIVE },
      data: {
        status: GameSessionStatus.COMPLETED,
        submittedAt: now,
        reportedScore,
        validatedScore,
        durationSeconds,
        coinsAwarded,
        pointsAwarded,
        xpAwarded: rawXp,
        clientEvents: input.events,
      },
    });

    if (closed.count === 0) {
      throw new AppError('INVALID_SESSION', 'This game session has already been submitted.');
    }

    // Only validated scores become a GameScore, and only GameScores reach a
    // leaderboard. `session.reportedScore` is never read by the ranking code.
    await tx.gameScore.create({
      data: {
        userId: input.userId,
        gameId: session.gameId,
        sessionId: session.id,
        score: validatedScore,
        durationSeconds,
        metadata: input.events,
      },
    });

    await tx.gameAttempt.update({
      where: { userId_gameId_day: { userId: input.userId, gameId: session.gameId, day: today.start } },
      data: {
        coinsEarned: { increment: coinsAwarded },
        pointsEarned: { increment: pointsAwarded },
      },
    });

    if (coinsAwarded > 0) {
      await recordTransaction(tx, {
        userId: input.userId,
        currency: CurrencyType.COINS,
        direction: TransactionDirection.CREDIT,
        amount: coinsAwarded,
        category: TransactionCategory.GAME_REWARD,
        description: `${session.game.name}: ${validatedScore} points`,
        referenceType: 'GameSession',
        referenceId: session.id,
        // Keyed on the session, so even a replay that somehow got past the status
        // guard would find this key taken and mint nothing.
        idempotencyKey: `game-coins:${session.id}`,
      });
    }

    if (pointsAwarded > 0) {
      await recordTransaction(tx, {
        userId: input.userId,
        currency: CurrencyType.REWARD_POINTS,
        direction: TransactionDirection.CREDIT,
        amount: pointsAwarded,
        category: TransactionCategory.GAME_REWARD,
        description: `${session.game.name}: ${validatedScore} points`,
        referenceType: 'GameSession',
        referenceId: session.id,
        idempotencyKey: `game-points:${session.id}`,
      });
    }

    if (rawXp > 0) await awardXp(tx, input.userId, rawXp);

    // Missions, achievements, leaderboard — all fed from the validated score.
    await trackMissionProgress(tx, input.userId, MissionType.PLAY_MINI_GAME, 1, {
      gameSlug: session.game.slug,
    });
    await trackMissionProgress(tx, input.userId, MissionType.PLAY_GAME_COUNT, 1, {
      gameSlug: session.game.slug,
    });
    await trackMissionProgress(tx, input.userId, MissionType.REACH_SCORE, validatedScore, {
      gameSlug: session.game.slug,
      absolute: true,
    });
    if (coinsAwarded > 0) {
      await trackMissionProgress(tx, input.userId, MissionType.EARN_COINS, coinsAwarded);
    }

    await trackAchievement(tx, input.userId, AchievementCode.PLAY_100_GAMES, 1);

    const previousBest = await tx.gameScore.findFirst({
      where: { userId: input.userId, gameId: session.gameId, id: { not: undefined } },
      orderBy: { score: 'desc' },
      select: { score: true },
      skip: 1,
    });

    if (config.isLeaderboardEnabled) {
      await recordScore(tx, {
        userId: input.userId,
        gameId: session.gameId,
        score: validatedScore,
        at: now,
      });
    }

    return {
      validatedScore,
      coinsAwarded,
      pointsAwarded,
      xpAwarded: rawXp,
      durationSeconds,
      isHighScore: !previousBest || validatedScore > previousBest.score,
      wasScoreClamped,
      dailyCoinCapReached: coinsEarnedToday + coinsAwarded >= config.dailyCoinCap,
      dailyPointCapReached: pointsEarnedToday + pointsAwarded >= config.dailyRewardPointCap,
    };
  });
}

async function rejectSession(tx: TxClient, sessionId: string, reason: string): Promise<void> {
  await tx.gameSession.updateMany({
    where: { id: sessionId, status: GameSessionStatus.ACTIVE },
    data: {
      status: GameSessionStatus.REJECTED,
      submittedAt: new Date(),
      rejectionReason: reason,
    },
  });
}

// --- Admin reads ------------------------------------------------------------

export async function listGameSessions(options: {
  userId?: string;
  gameId?: string;
  status?: GameSessionStatus;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, options.pageSize ?? 25);

  const where: Prisma.GameSessionWhereInput = {
    ...(options.userId ? { userId: options.userId } : {}),
    ...(options.gameId ? { gameId: options.gameId } : {}),
    ...(options.status ? { status: options.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.gameSession.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, name: true } },
        game: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.gameSession.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
