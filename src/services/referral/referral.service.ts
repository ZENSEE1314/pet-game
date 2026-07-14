import {
  ReferralStatus,
  CurrencyType,
  TransactionDirection,
  TransactionCategory,
  NotificationType,
  FraudAlertType,
  FraudSeverity,
} from '@prisma/client';

import { prisma, type TxClient } from '@/lib/db';
import { AppError } from '@/lib/api';
import { REFERRAL } from '@/lib/game-config';
import { recordTransaction } from '@/services/currency/transaction.service';
import { notify } from '@/services/notification/notification.service';
import { raiseFraudAlert } from '@/services/fraud/fraud.service';

/**
 * Referrals.
 *
 * The whole design exists to make farming unprofitable rather than impossible —
 * you cannot stop someone with ten phones, but you can make it not worth the effort:
 *
 *   1. Reward is paid only when the referred account reaches Level 3, which takes
 *      real play. A throwaway account earns its referrer nothing.
 *   2. One referral source per account, enforced by a unique index on referredId.
 *      Not a policy — a constraint.
 *   3. Self-referral is blocked on the code, and would be pointless anyway (see 1).
 *   4. Signup IP and a device hash are recorded; clusters raise a fraud alert for a
 *      human, and are never an automatic ban.
 */

export async function attachReferral(
  tx: TxClient,
  referredUserId: string,
  referralCode: string,
  context: { ip?: string; deviceHash?: string } = {},
): Promise<void> {
  const code = referralCode.trim().toUpperCase();

  const referrerProfile = await tx.profile.findUnique({
    where: { referralCode: code },
    select: { userId: true },
  });

  // A bad referral code should not fail the registration — the new player did
  // nothing wrong, and blocking signup over a typo is the worst possible trade.
  if (!referrerProfile) return;

  if (referrerProfile.userId === referredUserId) {
    await raiseFraudAlert(
      {
        userId: referredUserId,
        type: FraudAlertType.SELF_REFERRAL_ATTEMPT,
        severity: FraudSeverity.LOW,
        description: 'User attempted to use their own referral code at signup.',
      },
      tx,
    );
    return;
  }

  const existing = await tx.referral.findUnique({ where: { referredId: referredUserId } });
  if (existing) return; // one source per account, forever

  // Same-IP signups are the classic sybil signal. Flag, don't block: a family
  // sharing a router looks exactly like this.
  let riskFlagged = false;
  let riskReason: string | undefined;

  if (context.ip) {
    const sameIpCount = await tx.referral.count({
      where: {
        referrerId: referrerProfile.userId,
        signupIp: context.ip,
        createdAt: { gte: new Date(Date.now() - 86_400_000) },
      },
    });

    if (sameIpCount >= REFERRAL.dailyAlertThreshold) {
      riskFlagged = true;
      riskReason = `${sameIpCount + 1} referrals from the same IP within 24h`;

      await raiseFraudAlert(
        {
          userId: referrerProfile.userId,
          type: FraudAlertType.EXCESSIVE_REFERRALS,
          severity: FraudSeverity.HIGH,
          description: riskReason,
          evidence: { ip: context.ip, count: sameIpCount + 1 },
        },
        tx,
      );
    }
  }

  await tx.referral.create({
    data: {
      referrerId: referrerProfile.userId,
      referredId: referredUserId,
      code,
      status: ReferralStatus.PENDING,
      signupIp: context.ip,
      deviceHash: context.deviceHash,
      riskFlagged,
      riskReason,
    },
  });

  await tx.profile.update({
    where: { userId: referredUserId },
    data: { referredBy: code },
  });
}

/**
 * Called whenever a player levels up. Pays both sides once the referred player
 * reaches the qualifying level — and never before, which is the entire anti-abuse
 * mechanism.
 */
export async function checkReferralQualification(
  tx: TxClient,
  referredUserId: string,
): Promise<boolean> {
  const referral = await tx.referral.findUnique({
    where: { referredId: referredUserId },
    include: { referrer: { select: { id: true, status: true } } },
  });

  if (!referral || referral.status !== ReferralStatus.PENDING) return false;

  const profile = await tx.profile.findUniqueOrThrow({
    where: { userId: referredUserId },
    select: { level: true, displayName: true },
  });

  if (profile.level < REFERRAL.qualifyingLevel) return false;

  // A flagged referral still qualifies, but pays nothing until an admin clears it.
  // Silently paying a flagged referral would make the flag pointless; silently
  // voiding it would punish a legitimate player for their router's IP.
  if (referral.riskFlagged) {
    await tx.referral.update({
      where: { id: referral.id },
      data: { status: ReferralStatus.QUALIFIED, qualifiedAt: new Date() },
    });
    return false;
  }

  if (referral.referrer.status !== 'ACTIVE') return false;

  // Conditional flip — the payout below runs exactly once.
  const claimed = await tx.referral.updateMany({
    where: { id: referral.id, status: ReferralStatus.PENDING },
    data: {
      status: ReferralStatus.REWARDED,
      qualifiedAt: new Date(),
      rewardedAt: new Date(),
      referrerReward: REFERRAL.referrerPoints,
      referredReward: REFERRAL.referredPoints,
    },
  });

  if (claimed.count === 0) return false;

  await payReferralSide(tx, referral.referrerId, referral.id, 'referrer');
  await payReferralSide(tx, referredUserId, referral.id, 'referred');

  await notify(
    {
      userId: referral.referrerId,
      type: NotificationType.REFERRAL_QUALIFIED,
      title: 'Referral bonus!',
      body: `${profile.displayName} reached level ${REFERRAL.qualifyingLevel}. You earned ${REFERRAL.referrerPoints} reward points and ${REFERRAL.referrerCoins} coins.`,
      linkUrl: '/referrals',
      iconKey: 'users',
    },
    tx,
  );

  await notify(
    {
      userId: referredUserId,
      type: NotificationType.REFERRAL_QUALIFIED,
      title: 'Welcome bonus unlocked!',
      body: `You reached level ${REFERRAL.qualifyingLevel} and earned ${REFERRAL.referredPoints} reward points.`,
      linkUrl: '/referrals',
      iconKey: 'users',
    },
    tx,
  );

  return true;
}

async function payReferralSide(
  tx: TxClient,
  userId: string,
  referralId: string,
  side: 'referrer' | 'referred',
): Promise<void> {
  const points = side === 'referrer' ? REFERRAL.referrerPoints : REFERRAL.referredPoints;
  const coins = side === 'referrer' ? REFERRAL.referrerCoins : REFERRAL.referredCoins;

  await recordTransaction(tx, {
    userId,
    currency: CurrencyType.REWARD_POINTS,
    direction: TransactionDirection.CREDIT,
    amount: points,
    category: TransactionCategory.REFERRAL_REWARD,
    description: `Referral bonus (${side})`,
    referenceType: 'Referral',
    referenceId: referralId,
    idempotencyKey: `referral-points:${referralId}:${side}`,
  });

  await recordTransaction(tx, {
    userId,
    currency: CurrencyType.COINS,
    direction: TransactionDirection.CREDIT,
    amount: coins,
    category: TransactionCategory.REFERRAL_REWARD,
    description: `Referral bonus (${side})`,
    referenceType: 'Referral',
    referenceId: referralId,
    idempotencyKey: `referral-coins:${referralId}:${side}`,
  });
}

/** Admin override for a referral that was flagged but turns out to be legitimate. */
export async function approveFlaggedReferral(referralId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const referral = await tx.referral.findUniqueOrThrow({ where: { id: referralId } });

    if (referral.status === ReferralStatus.REWARDED) {
      throw new AppError('ALREADY_CLAIMED', 'This referral has already been paid.');
    }

    await tx.referral.update({
      where: { id: referralId },
      data: {
        status: ReferralStatus.REWARDED,
        riskFlagged: false,
        rewardedAt: new Date(),
        referrerReward: REFERRAL.referrerPoints,
        referredReward: REFERRAL.referredPoints,
      },
    });

    await payReferralSide(tx, referral.referrerId, referral.id, 'referrer');
    await payReferralSide(tx, referral.referredId, referral.id, 'referred');

    return { referralId, approvedBy: adminId };
  });
}

export async function rejectReferral(referralId: string, reason: string) {
  return prisma.referral.update({
    where: { id: referralId },
    data: { status: ReferralStatus.REJECTED, riskReason: reason },
  });
}

// --- Reads ------------------------------------------------------------------

export async function getReferralOverview(userId: string) {
  const [profile, referrals] = await Promise.all([
    prisma.profile.findUniqueOrThrow({
      where: { userId },
      select: { referralCode: true, referredBy: true },
    }),
    prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          select: {
            createdAt: true,
            profile: { select: { displayName: true, level: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const rewarded = referrals.filter((r) => r.status === ReferralStatus.REWARDED);

  return {
    referralCode: profile.referralCode,
    referredBy: profile.referredBy,
    qualifyingLevel: REFERRAL.qualifyingLevel,
    rewardPerReferral: {
      points: REFERRAL.referrerPoints,
      coins: REFERRAL.referrerCoins,
    },
    totalReferrals: referrals.length,
    qualifiedReferrals: rewarded.length,
    pointsEarned: rewarded.length * REFERRAL.referrerPoints,
    referrals: referrals.map((r) => ({
      id: r.id,
      status: r.status,
      displayName: r.referred.profile?.displayName ?? 'New player',
      avatarUrl: r.referred.profile?.avatarUrl ?? null,
      level: r.referred.profile?.level ?? 1,
      joinedAt: r.referred.createdAt,
      riskFlagged: r.riskFlagged,
      progressToQualify: Math.min(
        100,
        Math.round(((r.referred.profile?.level ?? 1) / REFERRAL.qualifyingLevel) * 100),
      ),
    })),
  };
}

export async function listReferralsForAdmin(options: {
  status?: ReferralStatus;
  flaggedOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, options.pageSize ?? 25);

  const where = {
    ...(options.status ? { status: options.status } : {}),
    ...(options.flaggedOnly ? { riskFlagged: true } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.referral.findMany({
      where,
      include: {
        referrer: { select: { email: true, profile: { select: { displayName: true } } } },
        referred: { select: { email: true, profile: { select: { displayName: true, level: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.referral.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
