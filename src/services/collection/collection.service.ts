import {
  PuzzlePieceSource,
  CurrencyType,
  TransactionDirection,
  TransactionCategory,
  NotificationType,
  type Monster,
} from '@prisma/client';

import { prisma, type TxClient } from '@/lib/db';
import { AppError } from '@/lib/api';
import { PUZZLE_PIECE_COUNT, RARITY_META } from '@/lib/monsters';
import { recordTransaction } from '@/services/currency/transaction.service';
import { notify } from '@/services/notification/notification.service';

/**
 * The monster collection: puzzle pieces in, hatched monsters out.
 *
 * Every monster is a nine-piece (3x3) puzzle. A Sudoku win draws one random piece; the
 * ninth piece of a monster hatches it. The whole thing runs inside the caller's
 * transaction so a piece award and the hatch it triggers are atomic — you can never
 * end up with nine pieces and no monster, or a monster with a piece still missing.
 */

export interface PieceAwardResult {
  monster: Pick<Monster, 'id' | 'slug' | 'name' | 'element' | 'rarity' | 'archetype' | 'imageUrl' | 'accentColor' | 'description'>;
  pieceIndex: number;
  /** Pieces the player now owns for this monster (1-9). */
  ownedPieces: number;
  /** True when this piece completed the monster. */
  completedMonster: boolean;
  /** Gems awarded if the collection was already complete and no piece could be given. */
  fallbackGems?: number;
}

/**
 * Award one random puzzle piece.
 *
 * The lottery deliberately favours monsters the player has already started: an
 * in-progress monster is weighted far above an untouched one, so pieces *converge*
 * toward completion rather than scattering thinly across all fifty forever. Rarer
 * monsters surface less often (their `dropWeight` is lower). A player never receives a
 * piece they already own, and never a piece for a monster they've already hatched —
 * both are guaranteed by construction here and by the DB unique index as a backstop.
 */
export async function awardRandomPuzzlePiece(
  tx: TxClient,
  userId: string,
  source: PuzzlePieceSource = PuzzlePieceSource.SUDOKU,
): Promise<PieceAwardResult> {
  const [monsters, ownedPieces, unlocked] = await Promise.all([
    tx.monster.findMany({ where: { isActive: true } }),
    tx.userPuzzlePiece.findMany({ where: { userId }, select: { monsterId: true, pieceIndex: true } }),
    tx.userMonster.findMany({ where: { userId }, select: { monsterId: true } }),
  ]);

  const unlockedIds = new Set(unlocked.map((u) => u.monsterId));
  const ownedByMonster = new Map<string, Set<number>>();
  for (const piece of ownedPieces) {
    if (!ownedByMonster.has(piece.monsterId)) ownedByMonster.set(piece.monsterId, new Set());
    ownedByMonster.get(piece.monsterId)!.add(piece.pieceIndex);
  }

  // Candidates: active, not yet hatched, and still missing at least one piece.
  const candidates = monsters
    .filter((m) => !unlockedIds.has(m.id))
    .map((m) => {
      const owned = ownedByMonster.get(m.id) ?? new Set<number>();
      const missing = Array.from({ length: PUZZLE_PIECE_COUNT }, (_, i) => i).filter((i) => !owned.has(i));
      const inProgress = owned.size > 0;
      // In-progress monsters get an 8x pull so a player's near-complete puzzles finish
      // before brand-new ones start. rarity dropWeight still applies underneath.
      const weight = m.dropWeight * (inProgress ? 8 : 1);
      return { monster: m, missing, weight };
    })
    .filter((c) => c.missing.length > 0);

  // Every monster already hatched (or the catalogue is empty): pay a gem consolation.
  if (candidates.length === 0) {
    const fallbackGems = 5;
    await recordTransaction(tx, {
      userId,
      currency: CurrencyType.GEMS,
      direction: TransactionDirection.CREDIT,
      amount: fallbackGems,
      category: TransactionCategory.MONSTER_UNLOCK_REWARD,
      description: 'Collection complete bonus',
      idempotencyKey: `collection-full:${userId}:${Date.now()}`,
    });

    return {
      monster: {
        id: '',
        slug: 'complete',
        name: 'Collection complete',
        element: 'LIGHT',
        rarity: 'MYTHIC',
        archetype: 'bird',
        imageUrl: null,
        accentColor: '#fbbf24',
        description: '',
      },
      pieceIndex: 0,
      ownedPieces: PUZZLE_PIECE_COUNT,
      completedMonster: false,
      fallbackGems,
    };
  }

  const chosen = weightedPick(candidates, (c) => c.weight);
  const pieceIndex = chosen.missing[Math.floor(Math.random() * chosen.missing.length)]!;

  await tx.userPuzzlePiece.create({
    data: { userId, monsterId: chosen.monster.id, pieceIndex, source },
  });

  const ownedCount = (ownedByMonster.get(chosen.monster.id)?.size ?? 0) + 1;
  const completedMonster = ownedCount >= PUZZLE_PIECE_COUNT;

  if (completedMonster) {
    await hatchMonster(tx, userId, chosen.monster);
  } else {
    await notify(
      {
        userId,
        type: NotificationType.PUZZLE_PIECE_EARNED,
        title: 'Puzzle piece found!',
        body: `You found a piece of ${chosen.monster.name} (${ownedCount}/${PUZZLE_PIECE_COUNT}).`,
        linkUrl: '/collection',
        iconKey: 'puzzle',
      },
      tx,
    );
  }

  return {
    monster: chosen.monster,
    pieceIndex,
    ownedPieces: ownedCount,
    completedMonster,
  };
}

/** Hatch a monster: record ownership (once), pay the rarity reward, notify. */
async function hatchMonster(tx: TxClient, userId: string, monster: Monster): Promise<void> {
  // Conditional-safe: the unique index makes a duplicate hatch impossible, and
  // createMany+skipDuplicates means a race resolves to exactly one UserMonster.
  const created = await tx.userMonster.createMany({
    data: [{ userId, monsterId: monster.id }],
    skipDuplicates: true,
  });
  if (created.count === 0) return; // already hatched — pay nothing twice

  const reward = RARITY_META[monster.rarity];

  if (reward.unlockGems > 0) {
    await recordTransaction(tx, {
      userId,
      currency: CurrencyType.GEMS,
      direction: TransactionDirection.CREDIT,
      amount: reward.unlockGems,
      category: TransactionCategory.MONSTER_UNLOCK_REWARD,
      description: `Hatched ${monster.name}`,
      referenceType: 'Monster',
      referenceId: monster.id,
      idempotencyKey: `monster-gems:${userId}:${monster.id}`,
    });
  }

  if (reward.unlockPoints > 0) {
    await recordTransaction(tx, {
      userId,
      currency: CurrencyType.REWARD_POINTS,
      direction: TransactionDirection.CREDIT,
      amount: reward.unlockPoints,
      category: TransactionCategory.MONSTER_UNLOCK_REWARD,
      description: `Hatched ${monster.name}`,
      referenceType: 'Monster',
      referenceId: monster.id,
      idempotencyKey: `monster-points:${userId}:${monster.id}`,
    });
  }

  await notify(
    {
      userId,
      type: NotificationType.MONSTER_UNLOCKED,
      title: `${monster.name} hatched! 🎉`,
      body: `You completed the ${reward.label.toLowerCase()} ${monster.name}. It joined your collection.`,
      linkUrl: '/collection',
      iconKey: 'monster',
    },
    tx,
  );
}

function weightedPick<T>(items: T[], weightOf: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1]!;
}

// --- Reads ------------------------------------------------------------------

export interface CollectionEntry {
  id: string;
  slug: string;
  name: string;
  element: string;
  rarity: string;
  archetype: string;
  imageUrl: string | null;
  accentColor: string;
  description: string;
  ownedPieces: number[];
  pieceCount: number;
  isUnlocked: boolean;
  isNew: boolean;
}

export interface CollectionSummary {
  entries: CollectionEntry[];
  totalMonsters: number;
  unlockedCount: number;
  totalPieces: number;
  ownedPieceCount: number;
  byRarity: Record<string, { total: number; unlocked: number }>;
}

export async function getCollection(userId: string): Promise<CollectionSummary> {
  const [monsters, pieces, unlocked] = await Promise.all([
    prisma.monster.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.userPuzzlePiece.findMany({ where: { userId }, select: { monsterId: true, pieceIndex: true } }),
    prisma.userMonster.findMany({ where: { userId }, select: { monsterId: true, isNew: true } }),
  ]);

  const piecesByMonster = new Map<string, number[]>();
  for (const piece of pieces) {
    if (!piecesByMonster.has(piece.monsterId)) piecesByMonster.set(piece.monsterId, []);
    piecesByMonster.get(piece.monsterId)!.push(piece.pieceIndex);
  }
  const unlockedById = new Map(unlocked.map((u) => [u.monsterId, u.isNew]));

  const byRarity: Record<string, { total: number; unlocked: number }> = {};

  const entries: CollectionEntry[] = monsters.map((monster) => {
    const owned = (piecesByMonster.get(monster.id) ?? []).sort((a, b) => a - b);
    const isUnlocked = unlockedById.has(monster.id);

    byRarity[monster.rarity] ??= { total: 0, unlocked: 0 };
    byRarity[monster.rarity]!.total += 1;
    if (isUnlocked) byRarity[monster.rarity]!.unlocked += 1;

    return {
      id: monster.id,
      slug: monster.slug,
      name: monster.name,
      element: monster.element,
      rarity: monster.rarity,
      archetype: monster.archetype,
      imageUrl: monster.imageUrl,
      accentColor: monster.accentColor,
      description: monster.description,
      ownedPieces: owned,
      pieceCount: PUZZLE_PIECE_COUNT,
      isUnlocked,
      isNew: unlockedById.get(monster.id) ?? false,
    };
  });

  return {
    entries,
    totalMonsters: monsters.length,
    unlockedCount: unlocked.length,
    totalPieces: monsters.length * PUZZLE_PIECE_COUNT,
    ownedPieceCount: pieces.length,
    byRarity,
  };
}

/** Clear the "NEW!" flag once a player has opened a hatched monster's reveal. */
export async function markMonstersSeen(userId: string, monsterIds?: string[]): Promise<void> {
  await prisma.userMonster.updateMany({
    where: { userId, isNew: true, ...(monsterIds?.length ? { monsterId: { in: monsterIds } } : {}) },
    data: { isNew: false },
  });
}

export async function countNewMonsters(userId: string): Promise<number> {
  return prisma.userMonster.count({ where: { userId, isNew: true } });
}
