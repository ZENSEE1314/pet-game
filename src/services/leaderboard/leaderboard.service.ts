import {
  LeaderboardPeriod,
  LeaderboardScope,
  AchievementCode,
  type Leaderboard,
} from '@prisma/client';

import { prisma, type TxClient } from '@/lib/db';
import { redisKeys, safeRedis } from '@/lib/redis';
import { trackAchievement } from '@/services/achievement/achievement.service';

/**
 * Leaderboards.
 *
 * Postgres holds the official result; Redis holds a sorted-set cache of it. The
 * cache is a read accelerator only — if it is cold, empty, or the Redis box is on
 * fire, `getLeaderboard` rebuilds from Postgres and the player sees the same
 * numbers, just a few milliseconds later. Nothing is ever *only* in Redis.
 *
 * Only validated GameScores reach here (see game.service.ts). A rejected or
 * clamped session never inflates a ranking.
 */

const CACHE_TTL_SECONDS = 60;

export function periodBounds(period: LeaderboardPeriod, now: Date): { startsAt: Date; endsAt: Date } {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  switch (period) {
    case LeaderboardPeriod.DAILY: {
      const endsAt = new Date(start);
      endsAt.setUTCDate(endsAt.getUTCDate() + 1);
      return { startsAt: start, endsAt };
    }
    case LeaderboardPeriod.WEEKLY: {
      const dayOfWeek = (start.getUTCDay() + 6) % 7; // Monday = 0
      const startsAt = new Date(start);
      startsAt.setUTCDate(startsAt.getUTCDate() - dayOfWeek);
      const endsAt = new Date(startsAt);
      endsAt.setUTCDate(endsAt.getUTCDate() + 7);
      return { startsAt, endsAt };
    }
    case LeaderboardPeriod.MONTHLY: {
      const startsAt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      const endsAt = new Date(startsAt);
      endsAt.setUTCMonth(endsAt.getUTCMonth() + 1);
      return { startsAt, endsAt };
    }
    case LeaderboardPeriod.ALL_TIME:
      return {
        startsAt: new Date('2020-01-01T00:00:00Z'),
        endsAt: new Date('2099-12-31T23:59:59Z'),
      };
  }
}

/** Find (or lazily create) the leaderboard covering `now` for this period+scope. */
export async function ensureLeaderboard(
  db: TxClient | typeof prisma,
  period: LeaderboardPeriod,
  scope: LeaderboardScope,
  gameId: string | null,
  now: Date = new Date(),
): Promise<Leaderboard> {
  const { startsAt, endsAt } = periodBounds(period, now);

  const existing = await db.leaderboard.findFirst({
    where: { period, scope, gameId, startsAt },
  });
  if (existing) return existing;

  return db.leaderboard.create({
    data: {
      name: leaderboardName(period, scope),
      period,
      scope,
      gameId,
      startsAt,
      endsAt,
    },
  });
}

function leaderboardName(period: LeaderboardPeriod, scope: LeaderboardScope): string {
  const periodLabel = period.charAt(0) + period.slice(1).toLowerCase().replace('_', '-');
  const scopeLabel =
    scope === LeaderboardScope.PER_GAME
      ? 'Game'
      : scope === LeaderboardScope.GLOBAL_COINS
        ? 'Coins'
        : 'XP';
  return `${periodLabel} ${scopeLabel}`;
}

/**
 * Push a validated score onto every leaderboard it belongs to.
 *
 * A player's leaderboard entry is their **best** score in the period, not their
 * total — otherwise the ranking measures free time rather than skill, and grinding
 * fifty mediocre runs would beat one great one.
 */
export async function recordScore(
  tx: TxClient,
  input: { userId: string; gameId: string; score: number; at: Date },
): Promise<void> {
  const targets: { period: LeaderboardPeriod; scope: LeaderboardScope; gameId: string | null }[] = [
    { period: LeaderboardPeriod.DAILY, scope: LeaderboardScope.PER_GAME, gameId: input.gameId },
    { period: LeaderboardPeriod.WEEKLY, scope: LeaderboardScope.PER_GAME, gameId: input.gameId },
    { period: LeaderboardPeriod.MONTHLY, scope: LeaderboardScope.PER_GAME, gameId: input.gameId },
    { period: LeaderboardPeriod.ALL_TIME, scope: LeaderboardScope.PER_GAME, gameId: input.gameId },
  ];

  for (const target of targets) {
    const board = await ensureLeaderboard(tx, target.period, target.scope, target.gameId, input.at);
    if (board.isFinalised) continue;

    const existing = await tx.leaderboardEntry.findUnique({
      where: { leaderboardId_userId: { leaderboardId: board.id, userId: input.userId } },
    });

    if (!existing) {
      await tx.leaderboardEntry.create({
        data: { leaderboardId: board.id, userId: input.userId, score: input.score },
      });
    } else if (input.score > existing.score) {
      await tx.leaderboardEntry.update({
        where: { id: existing.id },
        data: { score: input.score },
      });
    } else {
      continue; // not a personal best for this period — nothing to invalidate
    }

    // The cache is now wrong. Drop it rather than trying to patch it: a ZSET
    // update that races with a rebuild produces a subtly wrong board, and a cache
    // miss costs one query.
    void invalidateCache(board.id);
  }

  await maybeAwardTop100(tx, input.userId, input.gameId);
}

async function maybeAwardTop100(tx: TxClient, userId: string, gameId: string): Promise<void> {
  const board = await tx.leaderboard.findFirst({
    where: { period: LeaderboardPeriod.ALL_TIME, scope: LeaderboardScope.PER_GAME, gameId },
  });
  if (!board) return;

  const entry = await tx.leaderboardEntry.findUnique({
    where: { leaderboardId_userId: { leaderboardId: board.id, userId } },
  });
  if (!entry) return;

  const better = await tx.leaderboardEntry.count({
    where: { leaderboardId: board.id, score: { gt: entry.score } },
  });

  if (better < 100) {
    await trackAchievement(tx, userId, AchievementCode.TOP_100_LEADERBOARD, 1);
  }
}

async function invalidateCache(leaderboardId: string): Promise<void> {
  await safeRedis(async (client) => {
    await client.del(redisKeys.leaderboard(leaderboardId));
    return true;
  }, false);
}

// --- Reads ------------------------------------------------------------------

export interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  score: number;
  isCurrentUser: boolean;
  rewardClaimed: boolean;
}

export interface LeaderboardView {
  leaderboard: {
    id: string;
    name: string;
    period: LeaderboardPeriod;
    scope: LeaderboardScope;
    startsAt: Date;
    endsAt: Date;
    isFinalised: boolean;
  };
  rows: LeaderboardRow[];
  currentUserRow: LeaderboardRow | null;
  prizes: { rankFrom: number; rankTo: number; rewardType: string; rewardAmount: number }[];
  fromCache: boolean;
}

export async function getLeaderboard(options: {
  period: LeaderboardPeriod;
  scope: LeaderboardScope;
  gameId?: string | null;
  currentUserId?: string;
  limit?: number;
}): Promise<LeaderboardView> {
  const limit = Math.min(100, options.limit ?? 50);
  const gameId = options.gameId ?? null;

  const board = await ensureLeaderboard(prisma, options.period, options.scope, gameId);

  const cached = await safeRedis<string[] | null>(
    async (client) => client.zrevrange(redisKeys.leaderboard(board.id), 0, limit - 1, 'WITHSCORES'),
    null,
  );

  let rankedUserIds: { userId: string; score: number }[] = [];
  let fromCache = false;

  if (cached && cached.length > 0) {
    fromCache = true;
    for (let i = 0; i < cached.length; i += 2) {
      rankedUserIds.push({ userId: cached[i]!, score: Number(cached[i + 1]) });
    }
  } else {
    const entries = await prisma.leaderboardEntry.findMany({
      where: { leaderboardId: board.id },
      orderBy: [{ score: 'desc' }, { updatedAt: 'asc' }], // earlier achiever wins a tie
      take: limit,
    });
    rankedUserIds = entries.map((e) => ({ userId: e.userId, score: e.score }));

    // Warm the cache for the next reader.
    if (rankedUserIds.length > 0) {
      void safeRedis(async (client) => {
        const args: (string | number)[] = [];
        for (const entry of rankedUserIds) args.push(entry.score, entry.userId);
        await client.zadd(redisKeys.leaderboard(board.id), ...args);
        await client.expire(redisKeys.leaderboard(board.id), CACHE_TTL_SECONDS);
        return true;
      }, false);
    }
  }

  const profiles = await prisma.profile.findMany({
    where: { userId: { in: rankedUserIds.map((r) => r.userId) } },
    select: { userId: true, displayName: true, avatarUrl: true, level: true },
  });
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

  const entryFlags = await prisma.leaderboardEntry.findMany({
    where: { leaderboardId: board.id, userId: { in: rankedUserIds.map((r) => r.userId) } },
    select: { userId: true, rewardClaimed: true },
  });
  const claimedByUserId = new Map(entryFlags.map((e) => [e.userId, e.rewardClaimed]));

  const rows: LeaderboardRow[] = rankedUserIds.map((entry, index) => {
    const profile = profileByUserId.get(entry.userId);
    return {
      rank: index + 1,
      userId: entry.userId,
      displayName: profile?.displayName ?? 'Unknown player',
      avatarUrl: profile?.avatarUrl ?? null,
      level: profile?.level ?? 1,
      score: entry.score,
      isCurrentUser: entry.userId === options.currentUserId,
      rewardClaimed: claimedByUserId.get(entry.userId) ?? false,
    };
  });

  // The current player always sees where they stand, even if they're rank 4,812
  // and nowhere near the visible page.
  let currentUserRow: LeaderboardRow | null = rows.find((r) => r.isCurrentUser) ?? null;

  if (!currentUserRow && options.currentUserId) {
    const entry = await prisma.leaderboardEntry.findUnique({
      where: { leaderboardId_userId: { leaderboardId: board.id, userId: options.currentUserId } },
    });

    if (entry) {
      const better = await prisma.leaderboardEntry.count({
        where: { leaderboardId: board.id, score: { gt: entry.score } },
      });
      const profile = await prisma.profile.findUnique({
        where: { userId: options.currentUserId },
        select: { displayName: true, avatarUrl: true, level: true },
      });

      currentUserRow = {
        rank: better + 1,
        userId: options.currentUserId,
        displayName: profile?.displayName ?? 'You',
        avatarUrl: profile?.avatarUrl ?? null,
        level: profile?.level ?? 1,
        score: entry.score,
        isCurrentUser: true,
        rewardClaimed: entry.rewardClaimed,
      };
    }
  }

  const prizes = await prisma.leaderboardPrize.findMany({
    where: { leaderboardId: board.id },
    orderBy: { rankFrom: 'asc' },
  });

  return {
    leaderboard: {
      id: board.id,
      name: board.name,
      period: board.period,
      scope: board.scope,
      startsAt: board.startsAt,
      endsAt: board.endsAt,
      isFinalised: board.isFinalised,
    },
    rows,
    currentUserRow,
    prizes: prizes.map((p) => ({
      rankFrom: p.rankFrom,
      rankTo: p.rankTo,
      rewardType: p.rewardType,
      rewardAmount: p.rewardAmount,
    })),
    fromCache,
  };
}

/**
 * Freeze a finished period and write final ranks.
 *
 * Prize payout is deliberately a separate admin action rather than something this
 * does automatically — an operator wants to eyeball the top of the board for
 * obvious cheating before real reward points go out.
 */
export async function finaliseLeaderboard(leaderboardId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const board = await tx.leaderboard.findUniqueOrThrow({ where: { id: leaderboardId } });
    if (board.isFinalised) return 0;

    const entries = await tx.leaderboardEntry.findMany({
      where: { leaderboardId },
      orderBy: [{ score: 'desc' }, { updatedAt: 'asc' }],
    });

    for (let i = 0; i < entries.length; i += 1) {
      await tx.leaderboardEntry.update({
        where: { id: entries[i]!.id },
        data: { rank: i + 1 },
      });
    }

    await tx.leaderboard.update({
      where: { id: leaderboardId },
      data: { isFinalised: true, finalisedAt: new Date(), isActive: false },
    });

    return entries.length;
  });
}
