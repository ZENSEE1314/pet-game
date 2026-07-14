import { AchievementCode, NotificationType, TransactionCategory } from '@prisma/client';
import { prisma, type TxClient } from '@/lib/db';
import { payoutReward } from '@/services/mission/mission.service';
import { notify } from '@/services/notification/notification.service';

/**
 * Achievements are cumulative and permanent — no period key, no reset.
 *
 * `unlockedAt` doubles as the paid-out marker: it is set in the same conditional
 * `updateMany` that pays the reward, so an achievement can only fire once even if
 * two events push it over the line simultaneously.
 */

export async function trackAchievement(
  tx: TxClient,
  userId: string,
  code: AchievementCode,
  amount = 1,
  absolute = false,
): Promise<void> {
  const achievement = await tx.achievement.findUnique({ where: { code } });
  if (!achievement || !achievement.isActive) return;

  const existing = await tx.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
  });

  if (existing?.unlockedAt) return; // already earned; nothing left to track

  const previous = existing?.progress ?? 0;
  const progress = absolute ? Math.max(previous, amount) : previous + amount;
  const isUnlocked = progress >= achievement.targetValue;
  const now = new Date();

  await tx.userAchievement.upsert({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
    create: {
      userId,
      achievementId: achievement.id,
      progress: Math.min(progress, achievement.targetValue),
      target: achievement.targetValue,
      unlockedAt: isUnlocked ? now : null,
    },
    update: {
      progress: Math.min(progress, achievement.targetValue),
    },
  });

  if (!isUnlocked) return;

  // Conditional flip: only the request that actually moves unlockedAt from null
  // gets to pay out. A concurrent second event sees count === 0 and stops.
  const unlocked = await tx.userAchievement.updateMany({
    where: { userId, achievementId: achievement.id, unlockedAt: null },
    data: { unlockedAt: now, claimedAt: now },
  });

  const shouldPay = unlocked.count > 0 || (existing === null && isUnlocked);
  if (!shouldPay) return;

  await payoutReward(tx, {
    userId,
    rewardType: achievement.rewardType,
    rewardAmount: achievement.rewardAmount,
    rewardItemId: achievement.rewardItemId,
    xpReward: achievement.xpReward,
    category: TransactionCategory.ACHIEVEMENT_REWARD,
    description: `Achievement unlocked: ${achievement.title}`,
    referenceType: 'Achievement',
    referenceId: achievement.id,
    idempotencyKey: `achievement:${userId}:${achievement.id}`,
  });

  await notify(
    {
      userId,
      type: NotificationType.ACHIEVEMENT_UNLOCKED,
      title: 'Achievement unlocked!',
      body: achievement.title,
      linkUrl: '/achievements',
      iconKey: 'trophy',
    },
    tx,
  );
}

export async function listAchievements(userId: string) {
  const [achievements, userRows] = await Promise.all([
    prisma.achievement.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.userAchievement.findMany({ where: { userId } }),
  ]);

  const byId = new Map(userRows.map((row) => [row.achievementId, row]));

  return achievements.map((achievement) => {
    const progress = byId.get(achievement.id);
    return {
      id: achievement.id,
      code: achievement.code,
      title: achievement.title,
      description: achievement.description,
      iconUrl: achievement.iconUrl,
      target: achievement.targetValue,
      progress: progress?.progress ?? 0,
      progressPercent: Math.min(
        100,
        Math.round(((progress?.progress ?? 0) / achievement.targetValue) * 100),
      ),
      isUnlocked: Boolean(progress?.unlockedAt),
      unlockedAt: progress?.unlockedAt ?? null,
      rewardType: achievement.rewardType,
      rewardAmount: achievement.rewardAmount,
      badgeLabel: achievement.badgeLabel,
      titleLabel: achievement.titleLabel,
    };
  });
}

export async function countUnlocked(userId: string): Promise<number> {
  return prisma.userAchievement.count({ where: { userId, unlockedAt: { not: null } } });
}
