import {
  MissionType,
  MissionFrequency,
  UserMissionStatus,
  RewardType,
  CurrencyType,
  TransactionDirection,
  TransactionCategory,
  NotificationType,
  AcquisitionSource,
  type GameSlug,
} from '@prisma/client';

import { prisma, type TxClient } from '@/lib/db';
import { AppError } from '@/lib/api';
import { dayKey, weekKey } from '@/lib/utils';
import { env } from '@/lib/env';
import { recordTransaction } from '@/services/currency/transaction.service';
import { awardXp } from '@/services/level/level.service';
import { notify } from '@/services/notification/notification.service';

/**
 * The mission engine.
 *
 * Progress is never reported by the client. Every gameplay service (pet care, game
 * submission, redemption, promo codes) calls `trackMissionProgress` as part of its
 * own transaction, so mission progress is exactly as trustworthy as the event that
 * caused it.
 *
 * The period key is what makes "one claim per day/week" a database guarantee rather
 * than an application hope: `@@unique([userId, missionId, periodKey])` means a
 * double-submit races into a constraint violation instead of a double reward.
 */

export interface TrackContext {
  /** For REACH_SCORE / PLAY_MINI_GAME missions scoped to one game. */
  gameSlug?: GameSlug;
  /** For USE_ITEM missions scoped to one item. */
  itemSlug?: string;
  /** REACH_SCORE sets progress to the score rather than incrementing by 1. */
  absolute?: boolean;
}

export function periodKeyFor(frequency: MissionFrequency, now: Date, timezone: string): string {
  switch (frequency) {
    case MissionFrequency.DAILY:
      return dayKey(now, timezone);
    case MissionFrequency.WEEKLY:
      return weekKey(now, timezone);
    case MissionFrequency.ONE_TIME:
      return 'once';
  }
}

async function timezoneFor(tx: TxClient, userId: string): Promise<string> {
  const profile = await tx.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return profile?.timezone ?? env.DEFAULT_TIMEZONE;
}

/**
 * Advance every active mission of `type` for this user.
 *
 * Called from inside the caller's transaction — if the pet-care action rolls back,
 * so does the mission progress it would have granted.
 */
export async function trackMissionProgress(
  tx: TxClient,
  userId: string,
  type: MissionType,
  amount = 1,
  context: TrackContext = {},
): Promise<void> {
  if (amount <= 0) return;

  const now = new Date();
  const timezone = await timezoneFor(tx, userId);

  const missions = await tx.mission.findMany({
    where: {
      type,
      isActive: true,
      deletedAt: null,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
  });

  for (const mission of missions) {
    // A mission scoped to one game/item ignores events from any other.
    if (mission.gameSlug && mission.gameSlug !== context.gameSlug) continue;
    if (mission.itemSlug && mission.itemSlug !== context.itemSlug) continue;

    const periodKey = periodKeyFor(mission.frequency, now, timezone);

    const existing = await tx.userMission.findUnique({
      where: { userId_missionId_periodKey: { userId, missionId: mission.id, periodKey } },
    });

    // Already finished this period — nothing to advance, and definitely nothing
    // to re-complete.
    if (existing && existing.status !== UserMissionStatus.IN_PROGRESS) continue;

    const previous = existing?.progress ?? 0;
    // REACH_SCORE is a high-water mark, not a running total: three 200-point games
    // do not add up to a 600-point mission.
    const progress = context.absolute ? Math.max(previous, amount) : previous + amount;
    const isComplete = progress >= mission.targetValue;

    const record = await tx.userMission.upsert({
      where: { userId_missionId_periodKey: { userId, missionId: mission.id, periodKey } },
      create: {
        userId,
        missionId: mission.id,
        periodKey,
        progress: Math.min(progress, mission.targetValue),
        target: mission.targetValue,
        status: isComplete ? UserMissionStatus.COMPLETED : UserMissionStatus.IN_PROGRESS,
        completedAt: isComplete ? now : null,
      },
      update: {
        progress: Math.min(progress, mission.targetValue),
        status: isComplete ? UserMissionStatus.COMPLETED : UserMissionStatus.IN_PROGRESS,
        completedAt: isComplete ? now : null,
      },
    });

    if (isComplete && (!existing || existing.status === UserMissionStatus.IN_PROGRESS)) {
      if (mission.claimRequired) {
        await notify(
          {
            userId,
            type: NotificationType.MISSION_REWARD_AVAILABLE,
            title: 'Mission complete!',
            body: `"${mission.title}" is done. Claim your reward.`,
            linkUrl: '/missions',
            iconKey: 'mission',
          },
          tx,
        );
      } else {
        await grantMissionReward(tx, userId, record.id);
      }
    }
  }
}

/**
 * Pay out a completed mission.
 *
 * The status guard plus the idempotency key make this safe to call twice: the
 * second call either finds a non-COMPLETED status and throws, or hits the existing
 * ledger row and returns it unchanged. Both outcomes give the player exactly one
 * reward.
 */
export async function claimMissionReward(userId: string, userMissionId: string) {
  return prisma.$transaction(async (tx) => grantMissionReward(tx, userId, userMissionId));
}

async function grantMissionReward(tx: TxClient, userId: string, userMissionId: string) {
  const userMission = await tx.userMission.findUnique({
    where: { id: userMissionId },
    include: { mission: true },
  });

  if (!userMission || userMission.userId !== userId) {
    throw new AppError('NOT_FOUND', 'Mission not found.');
  }
  if (userMission.status === UserMissionStatus.CLAIMED) {
    throw new AppError('ALREADY_CLAIMED', 'You have already claimed this mission reward.');
  }
  if (userMission.status !== UserMissionStatus.COMPLETED) {
    throw new AppError('CONFLICT', 'This mission is not complete yet.');
  }

  const { mission } = userMission;
  const idempotencyKey = `mission-claim:${userMission.id}`;

  // Flip the status first, conditionally. If two requests race, exactly one sees
  // count === 1 and the other bails out here, before any money moves.
  const flipped = await tx.userMission.updateMany({
    where: { id: userMission.id, status: UserMissionStatus.COMPLETED },
    data: { status: UserMissionStatus.CLAIMED, claimedAt: new Date() },
  });

  if (flipped.count === 0) {
    throw new AppError('ALREADY_CLAIMED', 'You have already claimed this mission reward.');
  }

  const rewards = await payoutReward(tx, {
    userId,
    rewardType: mission.rewardType,
    rewardAmount: mission.rewardAmount,
    rewardItemId: mission.rewardItemId,
    xpReward: mission.xpReward,
    category: TransactionCategory.MISSION_REWARD,
    description: `Mission reward: ${mission.title}`,
    referenceType: 'UserMission',
    referenceId: userMission.id,
    idempotencyKey,
  });

  await notify(
    {
      userId,
      type: NotificationType.MISSION_COMPLETED,
      title: 'Reward claimed',
      body: `You claimed the reward for "${mission.title}".`,
      linkUrl: '/missions',
      iconKey: 'mission',
    },
    tx,
  );

  return { mission, rewards };
}

/**
 * Shared payout path for missions, achievements, promo codes and leaderboard prizes.
 * Every one of them can reward any RewardType, and none of them should each
 * reimplement the switch.
 */
export interface PayoutInput {
  userId: string;
  rewardType: RewardType;
  rewardAmount: number;
  rewardItemId?: string | null;
  xpReward?: number;
  category: TransactionCategory;
  description: string;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  actorId?: string;
}

export interface PayoutResult {
  coins: number;
  rewardPoints: number;
  gems: number;
  xp: number;
  itemId?: string;
  badge?: string;
  title?: string;
  cappedPoints?: number;
}

export async function payoutReward(tx: TxClient, input: PayoutInput): Promise<PayoutResult> {
  const result: PayoutResult = { coins: 0, rewardPoints: 0, gems: 0, xp: 0 };

  const credit = async (currency: CurrencyType, amount: number) => {
    if (amount <= 0) return 0;
    const tr = await recordTransaction(tx, {
      userId: input.userId,
      currency,
      direction: TransactionDirection.CREDIT,
      amount,
      category: input.category,
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      idempotencyKey: `${input.idempotencyKey}:${currency}`,
      actorId: input.actorId,
    });
    if (tr.cappedAmount) result.cappedPoints = tr.cappedAmount;
    return tr.transaction.amount;
  };

  switch (input.rewardType) {
    case RewardType.COINS:
      result.coins = await credit(CurrencyType.COINS, input.rewardAmount);
      break;
    case RewardType.REWARD_POINTS:
      result.rewardPoints = await credit(CurrencyType.REWARD_POINTS, input.rewardAmount);
      break;
    case RewardType.GEMS:
      result.gems = await credit(CurrencyType.GEMS, input.rewardAmount);
      break;
    case RewardType.ITEM:
      if (input.rewardItemId) {
        await tx.userInventory.upsert({
          where: { userId_itemId: { userId: input.userId, itemId: input.rewardItemId } },
          create: {
            userId: input.userId,
            itemId: input.rewardItemId,
            quantity: Math.max(1, input.rewardAmount),
            source: AcquisitionSource.MISSION_REWARD,
          },
          update: { quantity: { increment: Math.max(1, input.rewardAmount) } },
        });
        result.itemId = input.rewardItemId;
      }
      break;
    case RewardType.XP:
      // XP is handled below, via xpReward.
      break;
    case RewardType.BADGE:
    case RewardType.TITLE:
      // Cosmetic-only; recorded on UserAchievement, no ledger movement.
      break;
  }

  const xp = (input.xpReward ?? 0) + (input.rewardType === RewardType.XP ? input.rewardAmount : 0);
  if (xp > 0) {
    await awardXp(tx, input.userId, xp);
    result.xp = xp;
  }

  return result;
}

// --- Reads ------------------------------------------------------------------

export async function listMissionsForUser(userId: string, frequency: MissionFrequency) {
  const now = new Date();
  const timezone = await prisma.profile
    .findUnique({ where: { userId }, select: { timezone: true } })
    .then((p) => p?.timezone ?? env.DEFAULT_TIMEZONE);

  const periodKey = periodKeyFor(frequency, now, timezone);

  const missions = await prisma.mission.findMany({
    where: {
      frequency,
      isActive: true,
      deletedAt: null,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { sortOrder: 'asc' },
  });

  const progressRows = await prisma.userMission.findMany({
    where: { userId, periodKey, missionId: { in: missions.map((m) => m.id) } },
  });

  const byMissionId = new Map(progressRows.map((row) => [row.missionId, row]));

  return missions.map((mission) => {
    const progress = byMissionId.get(mission.id);
    return {
      id: mission.id,
      userMissionId: progress?.id ?? null,
      code: mission.code,
      title: mission.title,
      description: mission.description,
      type: mission.type,
      frequency: mission.frequency,
      target: mission.targetValue,
      progress: progress?.progress ?? 0,
      status: progress?.status ?? UserMissionStatus.IN_PROGRESS,
      rewardType: mission.rewardType,
      rewardAmount: mission.rewardAmount,
      xpReward: mission.xpReward,
      claimRequired: mission.claimRequired,
      progressPercent: Math.min(
        100,
        Math.round(((progress?.progress ?? 0) / mission.targetValue) * 100),
      ),
    };
  });
}

export async function countClaimableMissions(userId: string): Promise<number> {
  return prisma.userMission.count({
    where: { userId, status: UserMissionStatus.COMPLETED },
  });
}
