import { NotificationType } from '@prisma/client';
import { prisma, type TxClient } from '@/lib/db';
import { xpForNextLevel, MAX_LEVEL } from '@/lib/game-config';
import { notify } from '@/services/notification/notification.service';
import { checkReferralQualification } from '@/services/referral/referral.service';

export interface LevelProgress {
  level: number;
  xp: number;
  xpForNext: number;
  xpIntoLevel: number;
  progressPercent: number;
}

export interface AwardXpResult {
  level: number;
  xp: number;
  levelsGained: number;
  didLevelUp: boolean;
}

/**
 * Grant XP and roll over as many levels as the amount warrants.
 *
 * The while-loop matters: a big mission reward can carry a player through two
 * levels at once, and a single `if` would silently swallow the overflow.
 */
export async function awardXp(
  tx: TxClient,
  userId: string,
  amount: number,
): Promise<AwardXpResult> {
  if (amount <= 0) {
    const profile = await tx.profile.findUniqueOrThrow({
      where: { userId },
      select: { level: true, xp: true },
    });
    return { level: profile.level, xp: profile.xp, levelsGained: 0, didLevelUp: false };
  }

  const profile = await tx.profile.findUniqueOrThrow({
    where: { userId },
    select: { level: true, xp: true },
  });

  let level = profile.level;
  let xp = profile.xp + amount;
  let levelsGained = 0;

  while (level < MAX_LEVEL && xp >= xpForNextLevel(level)) {
    xp -= xpForNextLevel(level);
    level += 1;
    levelsGained += 1;
  }

  await tx.profile.update({
    where: { userId },
    data: { level, xp },
  });

  if (levelsGained > 0) {
    await notify(
      {
        userId,
        type: NotificationType.LEVEL_UP,
        title: `Level ${level}!`,
        body:
          levelsGained === 1
            ? `You reached level ${level}. Keep it up!`
            : `You gained ${levelsGained} levels and reached level ${level}!`,
        linkUrl: '/profile',
        iconKey: 'level-up',
      },
      tx,
    );

    // Level 3 is the referral qualification gate. Hooking it here — rather than
    // at each of the dozen places that grant XP — is what guarantees it can never
    // be missed.
    await checkReferralQualification(tx, userId);

    await trackAchievementIfLevelled(tx, userId, level);
  }

  return { level, xp, levelsGained, didLevelUp: levelsGained > 0 };
}

/**
 * Reaching level 10 is itself an achievement — and unlocking an achievement grants
 * XP, which routes back through `awardXp`. A static import would make
 * level → achievement → mission → level a hard cycle, so the dependency is resolved
 * lazily. The recursion terminates because the second pass finds the achievement
 * already unlocked and returns without granting anything.
 */
async function trackAchievementIfLevelled(tx: TxClient, userId: string, level: number): Promise<void> {
  const { trackAchievement } = await import('@/services/achievement/achievement.service');
  const { AchievementCode } = await import('@prisma/client');
  await trackAchievement(tx, userId, AchievementCode.REACH_LEVEL_10, level, true);
}

export function levelProgress(level: number, xp: number): LevelProgress {
  const xpForNext = xpForNextLevel(level);
  return {
    level,
    xp,
    xpForNext,
    xpIntoLevel: xp,
    progressPercent: Math.min(100, Math.round((xp / xpForNext) * 100)),
  };
}

export async function getLevelProgress(userId: string): Promise<LevelProgress> {
  const profile = await prisma.profile.findUniqueOrThrow({
    where: { userId },
    select: { level: true, xp: true },
  });
  return levelProgress(profile.level, profile.xp);
}

/**
 * Features that unlock with level. Purely additive so far — nothing is taken away,
 * and the list drives the "recently unlocked" strip on the profile page.
 */
export const LEVEL_UNLOCKS: { level: number; feature: string }[] = [
  { level: 2, feature: 'Weekly missions' },
  { level: 3, feature: 'Referral rewards' },
  { level: 5, feature: 'Reward shop: limited editions' },
  { level: 8, feature: 'Pet evolution: Young stage' },
  { level: 10, feature: 'Leaderboard prizes' },
  { level: 15, feature: 'Pet evolution: Adult stage' },
  { level: 25, feature: 'Pet evolution: Evolved stage' },
];

export function unlocksForLevel(level: number) {
  return LEVEL_UNLOCKS.filter((unlock) => unlock.level <= level);
}

export function nextUnlock(level: number) {
  return LEVEL_UNLOCKS.find((unlock) => unlock.level > level) ?? null;
}
