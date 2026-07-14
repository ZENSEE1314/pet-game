import {
  CurrencyType,
  TransactionDirection,
  TransactionCategory,
  MissionType,
  AchievementCode,
} from '@prisma/client';

import { prisma } from '@/lib/db';
import { AppError } from '@/lib/api';
import { dayKey } from '@/lib/utils';
import { env } from '@/lib/env';
import { STREAK_REWARDS, streakRewardForDay } from '@/lib/game-config';
import { recordTransaction } from '@/services/currency/transaction.service';
import { awardXp } from '@/services/level/level.service';
import { trackMissionProgress } from '@/services/mission/mission.service';
import { trackAchievement } from '@/services/achievement/achievement.service';

/**
 * Login streak.
 *
 * The whole thing hinges on comparing *day keys in the player's timezone*, never
 * timestamps. A player in UTC+8 who logs in at 09:00 local is on a new day even
 * though it is still yesterday in UTC; comparing raw timestamps would either rob
 * them of a day or hand them two.
 *
 * `lastClaimDay` (a string like "2026-07-14") is therefore the source of truth, and
 * it is also the idempotency guard: claiming twice on the same calendar day is a
 * no-op by construction.
 */

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  totalLogins: number;
  cycleDay: number;
  canClaimToday: boolean;
  todayReward: (typeof STREAK_REWARDS)[number];
  cycle: typeof STREAK_REWARDS;
  lastClaimedAt: Date | null;
}

export async function getStreakState(userId: string): Promise<StreakState> {
  const [streak, profile] = await Promise.all([
    prisma.loginStreak.findUnique({ where: { userId } }),
    prisma.profile.findUnique({ where: { userId }, select: { timezone: true } }),
  ]);

  const timezone = profile?.timezone ?? env.DEFAULT_TIMEZONE;
  const today = dayKey(new Date(), timezone);

  const current = streak?.currentStreak ?? 0;
  const canClaimToday = streak?.lastClaimDay !== today;

  // If they've already claimed today, show today's reward; otherwise show the one
  // they're about to get.
  const displayDay = canClaimToday ? current + 1 : current;
  const cycleDay = ((displayDay - 1) % STREAK_REWARDS.length) + 1;

  return {
    currentStreak: current,
    longestStreak: streak?.longestStreak ?? 0,
    totalLogins: streak?.totalLogins ?? 0,
    cycleDay: Math.max(1, cycleDay),
    canClaimToday,
    todayReward: streakRewardForDay(Math.max(1, displayDay)),
    cycle: STREAK_REWARDS,
    lastClaimedAt: streak?.lastClaimedAt ?? null,
  };
}

export interface ClaimStreakResult {
  streakDay: number;
  currentStreak: number;
  coins: number;
  rewardPoints: number;
  xp: number;
  streakBroken: boolean;
}

export async function claimDailyStreak(userId: string): Promise<ClaimStreakResult> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const profile = await tx.profile.findUniqueOrThrow({
      where: { userId },
      select: { timezone: true },
    });
    const timezone = profile.timezone || env.DEFAULT_TIMEZONE;

    const today = dayKey(now, timezone);
    const yesterday = dayKey(new Date(now.getTime() - 86_400_000), timezone);

    const streak = await tx.loginStreak.upsert({
      where: { userId },
      create: { userId, currentStreak: 0, longestStreak: 0, totalLogins: 0 },
      update: {},
    });

    if (streak.lastClaimDay === today) {
      throw new AppError('ALREADY_CLAIMED', 'You already claimed your daily reward today.');
    }

    // Consecutive only if the last claim was literally yesterday. A one-day gap
    // resets to 1 — not to 0, because today still counts.
    const isConsecutive = streak.lastClaimDay === yesterday;
    const streakBroken = Boolean(streak.lastClaimDay) && !isConsecutive;
    const currentStreak = isConsecutive ? streak.currentStreak + 1 : 1;

    // Conditional on the lastClaimDay we just read: a double-tap races here and
    // exactly one request wins.
    const claimed = await tx.loginStreak.updateMany({
      where: { userId, lastClaimDay: streak.lastClaimDay },
      data: {
        currentStreak,
        longestStreak: Math.max(streak.longestStreak, currentStreak),
        totalLogins: { increment: 1 },
        lastClaimDay: today,
        lastClaimedAt: now,
      },
    });

    if (claimed.count === 0) {
      throw new AppError('ALREADY_CLAIMED', 'You already claimed your daily reward today.');
    }

    const reward = streakRewardForDay(currentStreak);

    if (reward.coins > 0) {
      await recordTransaction(tx, {
        userId,
        currency: CurrencyType.COINS,
        direction: TransactionDirection.CREDIT,
        amount: reward.coins,
        category: TransactionCategory.LOGIN_STREAK,
        description: `Login streak day ${currentStreak}`,
        referenceType: 'LoginStreak',
        referenceId: streak.id,
        // The day key makes this idempotent for free.
        idempotencyKey: `streak-coins:${userId}:${today}`,
      });
    }

    if (reward.rewardPoints > 0) {
      await recordTransaction(tx, {
        userId,
        currency: CurrencyType.REWARD_POINTS,
        direction: TransactionDirection.CREDIT,
        amount: reward.rewardPoints,
        category: TransactionCategory.LOGIN_STREAK,
        description: `Login streak day ${currentStreak}`,
        referenceType: 'LoginStreak',
        referenceId: streak.id,
        idempotencyKey: `streak-points:${userId}:${today}`,
      });
    }

    if (reward.xp > 0) await awardXp(tx, userId, reward.xp);

    await trackMissionProgress(tx, userId, MissionType.DAILY_LOGIN);
    await trackMissionProgress(tx, userId, MissionType.LOGIN_STREAK, currentStreak, {
      absolute: true,
    });
    await trackAchievement(tx, userId, AchievementCode.SEVEN_DAY_STREAK, currentStreak, true);

    return {
      streakDay: currentStreak,
      currentStreak,
      coins: reward.coins,
      rewardPoints: reward.rewardPoints,
      xp: reward.xp,
      streakBroken,
    };
  });
}
