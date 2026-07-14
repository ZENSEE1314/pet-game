import {
  ClaimStatus,
  CollectionMethod,
  CurrencyType,
  TransactionDirection,
  TransactionCategory,
  StockMovement,
  MissionType,
  AchievementCode,
  NotificationType,
  FraudAlertType,
  FraudSeverity,
  RewardCategory,
  Prisma,
} from '@prisma/client';

import { prisma, type TxClient, runSerializable } from '@/lib/db';
import { AppError } from '@/lib/api';
import { generateClaimCode, createClaimToken, verifyClaimToken } from '@/lib/crypto';
import { dayBounds } from '@/lib/utils';
import { env } from '@/lib/env';
import { recordTransaction } from '@/services/currency/transaction.service';
import { trackMissionProgress } from '@/services/mission/mission.service';
import { trackAchievement } from '@/services/achievement/achievement.service';
import { notify } from '@/services/notification/notification.service';
import { raiseFraudAlert } from '@/services/fraud/fraud.service';
import { recordAudit } from '@/services/audit/audit.service';

/**
 * Reward redemption — the point where virtual points become real things.
 *
 * Everything in here happens inside one Serializable transaction because a partial
 * failure is unacceptable in both directions: points debited without a claim is
 * theft, and a claim without a debit is free merchandise.
 */

// --- Shop -------------------------------------------------------------------

export async function listRewards(options: {
  category?: RewardCategory;
  userId?: string;
  includeInactive?: boolean;
} = {}) {
  const now = new Date();

  const rewards = await prisma.reward.findMany({
    where: {
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(options.category ? { category: options.category } : {}),
      ...(options.includeInactive
        ? {}
        : {
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
            AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
          }),
    },
    orderBy: [{ sortOrder: 'asc' }, { pointCost: 'asc' }],
  });

  if (!options.userId) {
    return rewards.map((reward) => ({ ...reward, userClaimCount: 0, canClaim: reward.stockAvailable > 0 }));
  }

  const claimCounts = await prisma.rewardClaim.groupBy({
    by: ['rewardId'],
    where: {
      userId: options.userId,
      // A cancelled or rejected claim shouldn't consume the player's per-user limit.
      status: { notIn: [ClaimStatus.CANCELLED, ClaimStatus.REJECTED, ClaimStatus.EXPIRED] },
    },
    _count: true,
  });

  const countByReward = new Map(claimCounts.map((row) => [row.rewardId, row._count]));

  return rewards.map((reward) => {
    const userClaimCount = countByReward.get(reward.id) ?? 0;
    return {
      ...reward,
      userClaimCount,
      canClaim: reward.stockAvailable > 0 && userClaimCount < reward.perUserLimit,
    };
  });
}

export async function getReward(rewardId: string) {
  const reward = await prisma.reward.findFirst({
    where: { id: rewardId, deletedAt: null },
  });
  if (!reward) throw new AppError('NOT_FOUND', 'That reward does not exist.');
  return reward;
}

// --- Redemption -------------------------------------------------------------

export interface RedeemResult {
  claimId: string;
  claimCode: string;
  qrToken: string;
  pointsSpent: number;
  balanceAfter: number;
  expiresAt: Date;
  collectionMethod: CollectionMethod;
  collectionLocation: string | null;
}

export async function redeemReward(userId: string, rewardId: string): Promise<RedeemResult> {
  const now = new Date();

  return runSerializable(
    async (tx) => {
      const reward = await tx.reward.findFirst({
        where: { id: rewardId, deletedAt: null },
      });

      if (!reward) throw new AppError('NOT_FOUND', 'That reward does not exist.');
      if (!reward.isActive) throw new AppError('CONFLICT', 'This reward is not available right now.');
      if (reward.startsAt && reward.startsAt > now) {
        throw new AppError('CONFLICT', 'This reward is not available yet.');
      }
      if (reward.expiresAt && reward.expiresAt < now) {
        throw new AppError('EXPIRED', 'This reward has expired.');
      }

      // Per-user limit.
      const userClaims = await tx.rewardClaim.count({
        where: {
          userId,
          rewardId,
          status: { notIn: [ClaimStatus.CANCELLED, ClaimStatus.REJECTED, ClaimStatus.EXPIRED] },
        },
      });
      if (userClaims >= reward.perUserLimit) {
        throw new AppError(
          'LIMIT_REACHED',
          `You've already claimed this reward the maximum of ${reward.perUserLimit} time${reward.perUserLimit === 1 ? '' : 's'}.`,
        );
      }

      // Global daily limit across all users.
      if (reward.dailyLimit !== null) {
        const today = dayBounds(now, env.DEFAULT_TIMEZONE);
        const todayClaims = await tx.rewardClaim.count({
          where: {
            rewardId,
            createdAt: { gte: today.start, lt: today.end },
            status: { notIn: [ClaimStatus.CANCELLED, ClaimStatus.REJECTED] },
          },
        });
        if (todayClaims >= reward.dailyLimit) {
          throw new AppError('LIMIT_REACHED', 'Today’s allocation for this reward is gone. Try again tomorrow.');
        }
      }

      // Reserve stock with a CONDITIONAL decrement. This is the whole oversell
      // defence: `stockAvailable: { gte: 1 }` in the WHERE clause means two
      // simultaneous redemptions of the last unit produce one success and one
      // `count === 0`, rather than two claims against one physical mug.
      const reserved = await tx.reward.updateMany({
        where: { id: rewardId, stockAvailable: { gte: 1 } },
        data: {
          stockAvailable: { decrement: 1 },
          stockReserved: { increment: 1 },
        },
      });

      if (reserved.count === 0) {
        throw new AppError('OUT_OF_STOCK', 'This reward just sold out.');
      }

      await tx.rewardStockTransaction.create({
        data: {
          rewardId,
          movement: StockMovement.RESERVE,
          quantity: -1,
          stockBefore: reward.stockAvailable,
          stockAfter: reward.stockAvailable - 1,
          reason: 'Player redemption',
          createdById: userId,
        },
      });

      // Debit the points. If the player can't afford it, this throws and the whole
      // transaction — including the stock reservation above — rolls back.
      const debit = await recordTransaction(tx, {
        userId,
        currency: CurrencyType.REWARD_POINTS,
        direction: TransactionDirection.DEBIT,
        amount: reward.pointCost,
        category: TransactionCategory.REWARD_REDEMPTION,
        description: `Redeemed: ${reward.name}`,
        referenceType: 'Reward',
        referenceId: rewardId,
        idempotencyKey: `redeem:${userId}:${rewardId}:${now.getTime()}`,
      });

      const claimCode = generateClaimCode();
      const expiresAt = new Date(now.getTime() + reward.claimValidHours * 3_600_000);

      const claim = await tx.rewardClaim.create({
        data: {
          userId,
          rewardId,
          pointCost: reward.pointCost,
          claimCode,
          // Placeholder — the real token needs the claim's own id, which we only
          // have after the insert. Overwritten immediately below.
          qrToken: `pending:${claimCode}`,
          status:
            reward.collectionMethod === CollectionMethod.DIGITAL_CODE
              ? ClaimStatus.READY
              : ClaimStatus.RESERVED,
          expiresAt,
          collectionLocation: reward.collectionLocation,
        },
      });

      const qrToken = createClaimToken({
        claimId: claim.id,
        claimCode,
        userId,
        rewardId,
        expiresAt: expiresAt.getTime(),
      });

      await tx.rewardClaim.update({
        where: { id: claim.id },
        data: { qrToken },
      });

      await trackMissionProgress(tx, userId, MissionType.REDEEM_REWARD);
      await trackAchievement(tx, userId, AchievementCode.FIRST_REDEMPTION, 1);

      await notify(
        {
          userId,
          type: NotificationType.CLAIM_READY,
          title: 'Reward claimed!',
          body:
            reward.collectionMethod === CollectionMethod.DIGITAL_CODE
              ? `Your ${reward.name} is ready. Open My Claims to view it.`
              : `Show your QR code at ${reward.collectionLocation ?? 'the collection point'} to collect ${reward.name}.`,
          linkUrl: `/claims/${claim.id}`,
          iconKey: 'gift',
        },
        tx,
      );

      return {
        claimId: claim.id,
        claimCode,
        qrToken,
        pointsSpent: reward.pointCost,
        balanceAfter: debit.balanceAfter,
        expiresAt,
        collectionMethod: reward.collectionMethod,
        collectionLocation: reward.collectionLocation,
      };
    },
  );
}

// --- Claims (player) --------------------------------------------------------

export async function listClaims(userId: string, status?: ClaimStatus) {
  // Lazily expire anything past its window, so a player never sees a "valid" claim
  // that staff would reject at the counter.
  await expireStaleClaims(userId);

  return prisma.rewardClaim.findMany({
    where: { userId, ...(status ? { status } : {}) },
    include: { reward: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getClaim(userId: string, claimId: string) {
  const claim = await prisma.rewardClaim.findFirst({
    where: { id: claimId, userId },
    include: { reward: true },
  });
  if (!claim) throw new AppError('NOT_FOUND', 'Claim not found.');
  return claim;
}

async function expireStaleClaims(userId: string): Promise<void> {
  const now = new Date();
  const stale = await prisma.rewardClaim.findMany({
    where: {
      userId,
      status: { in: [ClaimStatus.RESERVED, ClaimStatus.READY, ClaimStatus.PENDING] },
      expiresAt: { lt: now },
    },
    select: { id: true, rewardId: true },
  });

  if (stale.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const claim of stale) {
      const expired = await tx.rewardClaim.updateMany({
        where: {
          id: claim.id,
          status: { in: [ClaimStatus.RESERVED, ClaimStatus.READY, ClaimStatus.PENDING] },
        },
        data: { status: ClaimStatus.EXPIRED },
      });

      // Give the physical unit back to the pool. The points are NOT refunded — an
      // expired claim is the player's own lapse, and refunding would make claims a
      // free option to hold. Admins can still refund manually via cancelClaim.
      if (expired.count > 0) {
        await tx.reward.update({
          where: { id: claim.rewardId },
          data: {
            stockAvailable: { increment: 1 },
            stockReserved: { decrement: 1 },
          },
        });
      }
    }
  });
}

// --- Staff: QR validation & collection --------------------------------------

export interface ClaimLookupResult {
  claim: {
    id: string;
    claimCode: string;
    status: ClaimStatus;
    pointCost: number;
    expiresAt: Date;
    collectionLocation: string | null;
    createdAt: Date;
    collectedAt: Date | null;
  };
  reward: { id: string; name: string; imageUrl: string; category: RewardCategory; collectionMethod: CollectionMethod };
  player: { id: string; displayName: string; email: string; avatarUrl: string | null };
  isCollectable: boolean;
  blockReason?: string;
}

/**
 * Resolve a scanned QR token (or a typed claim code) to a claim.
 *
 * A signed token proves the QR came from us. It does NOT prove the claim is still
 * good — a screenshot of a valid QR stays cryptographically valid forever. So the
 * signature is checked first (cheap, no DB), and then the row is checked (the real
 * gate). Both are required.
 */
export async function lookupClaim(
  input: { qrToken?: string; claimCode?: string },
  staffId: string,
): Promise<ClaimLookupResult> {
  let claimId: string | undefined;

  if (input.qrToken) {
    const payload = verifyClaimToken(input.qrToken);
    if (!payload) {
      await raiseFraudAlert({
        userId: staffId,
        type: FraudAlertType.REPEATED_QR_FAILURE,
        severity: FraudSeverity.MEDIUM,
        description: 'Scanned a QR code whose signature failed verification (possible forgery).',
      });
      throw new AppError('INVALID_TOKEN', 'This QR code is not valid.');
    }
    claimId = payload.claimId;
  }

  const claim = await prisma.rewardClaim.findFirst({
    where: claimId
      ? { id: claimId }
      : { claimCode: (input.claimCode ?? '').trim().toUpperCase() },
    include: {
      reward: true,
      user: { select: { id: true, email: true, profile: true } },
    },
  });

  if (!claim) throw new AppError('NOT_FOUND', 'No claim found for that code.');

  const now = new Date();
  let isCollectable = true;
  let blockReason: string | undefined;

  if (claim.status === ClaimStatus.COLLECTED) {
    isCollectable = false;
    blockReason = `Already collected on ${claim.collectedAt?.toLocaleString() ?? 'an earlier date'}.`;
  } else if (claim.status === ClaimStatus.CANCELLED || claim.status === ClaimStatus.REJECTED) {
    isCollectable = false;
    blockReason = `This claim was ${claim.status.toLowerCase()}.`;
  } else if (claim.status === ClaimStatus.EXPIRED || claim.expiresAt < now) {
    isCollectable = false;
    blockReason = `This claim expired on ${claim.expiresAt.toLocaleDateString()}.`;
  } else if (claim.status === ClaimStatus.DELIVERED) {
    isCollectable = false;
    blockReason = 'This reward was delivered, not collected in person.';
  }

  return {
    claim: {
      id: claim.id,
      claimCode: claim.claimCode,
      status: claim.status,
      pointCost: claim.pointCost,
      expiresAt: claim.expiresAt,
      collectionLocation: claim.collectionLocation,
      createdAt: claim.createdAt,
      collectedAt: claim.collectedAt,
    },
    reward: {
      id: claim.reward.id,
      name: claim.reward.name,
      imageUrl: claim.reward.imageUrl,
      category: claim.reward.category,
      collectionMethod: claim.reward.collectionMethod,
    },
    player: {
      id: claim.user.id,
      displayName: claim.user.profile?.displayName ?? 'Unknown',
      email: claim.user.email,
      avatarUrl: claim.user.profile?.avatarUrl ?? null,
    },
    isCollectable,
    blockReason,
  };
}

/**
 * Mark a claim collected. Idempotent-by-conflict: a second scan of the same code
 * finds the status already COLLECTED and fails loudly rather than handing over a
 * second mug.
 */
export async function collectClaim(claimId: string, staffId: string) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const claim = await tx.rewardClaim.findUnique({
      where: { id: claimId },
      include: { reward: true },
    });

    if (!claim) throw new AppError('NOT_FOUND', 'Claim not found.');
    if (claim.expiresAt < now) {
      throw new AppError('EXPIRED', 'This claim has expired and cannot be collected.');
    }

    // The single-use guard. Two staff scanning the same QR at the same instant:
    // one gets count === 1, the other gets 0 and a clear error.
    const collected = await tx.rewardClaim.updateMany({
      where: {
        id: claimId,
        status: { in: [ClaimStatus.RESERVED, ClaimStatus.READY] },
      },
      data: {
        status: ClaimStatus.COLLECTED,
        collectedAt: now,
        processedById: staffId,
      },
    });

    if (collected.count === 0) {
      await raiseFraudAlert(
        {
          userId: claim.userId,
          type: FraudAlertType.REPEATED_QR_FAILURE,
          severity: FraudSeverity.MEDIUM,
          description: `Attempted to collect claim ${claim.claimCode} which was already in state ${claim.status}.`,
          referenceType: 'RewardClaim',
          referenceId: claimId,
        },
        tx,
      );
      throw new AppError(
        'ALREADY_CLAIMED',
        `This claim is already ${claim.status.toLowerCase()} and cannot be collected again.`,
      );
    }

    // The reserved unit has now physically left the building.
    await tx.reward.update({
      where: { id: claim.rewardId },
      data: { stockReserved: { decrement: 1 } },
    });

    await tx.rewardStockTransaction.create({
      data: {
        rewardId: claim.rewardId,
        movement: StockMovement.FULFIL,
        quantity: -1,
        stockBefore: claim.reward.stockReserved,
        stockAfter: claim.reward.stockReserved - 1,
        reason: 'Collected by player',
        referenceId: claimId,
        createdById: staffId,
      },
    });

    await recordAudit(
      {
        actorId: staffId,
        action: 'CLAIM_COLLECTED',
        targetType: 'RewardClaim',
        targetId: claimId,
        oldValue: { status: claim.status },
        newValue: { status: ClaimStatus.COLLECTED },
      },
      tx,
    );

    await notify(
      {
        userId: claim.userId,
        type: NotificationType.CLAIM_COLLECTED,
        title: 'Reward collected',
        body: `You collected ${claim.reward.name}. Enjoy!`,
        linkUrl: `/claims/${claimId}`,
        iconKey: 'check',
      },
      tx,
    );

    return { claimId, status: ClaimStatus.COLLECTED, collectedAt: now };
  });
}

export async function rejectClaim(claimId: string, staffId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.rewardClaim.findUniqueOrThrow({ where: { id: claimId } });

    if (claim.status === ClaimStatus.COLLECTED) {
      throw new AppError('CONFLICT', 'A collected claim cannot be rejected.');
    }

    await tx.rewardClaim.update({
      where: { id: claimId },
      data: {
        status: ClaimStatus.REJECTED,
        processedById: staffId,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });

    // Stock goes back on the shelf; the points do not come back automatically —
    // a rejection is a judgement call, so a refund should be an explicit admin
    // decision via cancelClaim, not an automatic consequence of a staff tap.
    await tx.reward.update({
      where: { id: claim.rewardId },
      data: { stockAvailable: { increment: 1 }, stockReserved: { decrement: 1 } },
    });

    await recordAudit(
      {
        actorId: staffId,
        action: 'CLAIM_CANCELLED',
        targetType: 'RewardClaim',
        targetId: claimId,
        oldValue: { status: claim.status },
        newValue: { status: ClaimStatus.REJECTED, reason },
      },
      tx,
    );

    return { claimId, status: ClaimStatus.REJECTED };
  });
}

export async function getCollectionHistory(staffId: string, limit = 50) {
  return prisma.rewardClaim.findMany({
    where: { processedById: staffId },
    include: {
      reward: { select: { name: true, imageUrl: true } },
      user: { select: { email: true, profile: { select: { displayName: true } } } },
    },
    orderBy: { collectedAt: 'desc' },
    take: limit,
  });
}

// --- Admin ------------------------------------------------------------------

/** Cancel a claim AND refund the points. The only path that gives points back. */
export async function cancelClaimWithRefund(claimId: string, adminId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.rewardClaim.findUniqueOrThrow({
      where: { id: claimId },
      include: { reward: true },
    });

    if (claim.status === ClaimStatus.COLLECTED) {
      throw new AppError('CONFLICT', 'This reward was already collected — it cannot be refunded.');
    }
    if (claim.status === ClaimStatus.CANCELLED) {
      throw new AppError('CONFLICT', 'This claim is already cancelled.');
    }

    const cancelled = await tx.rewardClaim.updateMany({
      where: { id: claimId, status: { not: ClaimStatus.CANCELLED } },
      data: {
        status: ClaimStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason,
        processedById: adminId,
      },
    });

    if (cancelled.count === 0) {
      throw new AppError('CONFLICT', 'This claim is already cancelled.');
    }

    // Refund, keyed on the claim — so a double-cancel refunds exactly once.
    await recordTransaction(tx, {
      userId: claim.userId,
      currency: CurrencyType.REWARD_POINTS,
      direction: TransactionDirection.CREDIT,
      amount: claim.pointCost,
      category: TransactionCategory.REWARD_REFUND,
      description: `Refund: ${claim.reward.name} (${reason})`,
      referenceType: 'RewardClaim',
      referenceId: claimId,
      idempotencyKey: `refund:${claimId}`,
      actorId: adminId,
    });

    await tx.reward.update({
      where: { id: claim.rewardId },
      data: { stockAvailable: { increment: 1 }, stockReserved: { decrement: 1 } },
    });

    await recordAudit(
      {
        actorId: adminId,
        action: 'CLAIM_CANCELLED',
        targetType: 'RewardClaim',
        targetId: claimId,
        oldValue: { status: claim.status },
        newValue: { status: ClaimStatus.CANCELLED, refunded: claim.pointCost, reason },
      },
      tx,
    );

    await notify(
      {
        userId: claim.userId,
        type: NotificationType.CLAIM_EXPIRING,
        title: 'Claim cancelled',
        body: `${claim.reward.name} was cancelled and ${claim.pointCost} reward points were refunded. Reason: ${reason}`,
        linkUrl: '/claims',
        iconKey: 'refund',
      },
      tx,
    );

    return { claimId, refunded: claim.pointCost };
  });
}

export async function markClaimReady(claimId: string, adminId: string, fulfilmentDetails?: string) {
  const claim = await prisma.rewardClaim.update({
    where: { id: claimId },
    data: {
      status: ClaimStatus.READY,
      fulfilmentDetails,
      processedById: adminId,
    },
    include: { reward: true },
  });

  await notify({
    userId: claim.userId,
    type: NotificationType.CLAIM_READY,
    title: 'Your reward is ready',
    body: `${claim.reward.name} is ready for collection.`,
    linkUrl: `/claims/${claimId}`,
    iconKey: 'gift',
  });

  return claim;
}

export async function adjustStock(
  rewardId: string,
  delta: number,
  adminId: string,
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
    const reward = await tx.reward.findUniqueOrThrow({ where: { id: rewardId } });

    const nextAvailable = reward.stockAvailable + delta;
    if (nextAvailable < 0) {
      throw new AppError('VALIDATION_ERROR', 'That would take available stock below zero.');
    }

    const updated = await tx.reward.update({
      where: { id: rewardId },
      data: {
        stockAvailable: nextAvailable,
        stockTotal: Math.max(reward.stockTotal + delta, nextAvailable + reward.stockReserved),
      },
    });

    await tx.rewardStockTransaction.create({
      data: {
        rewardId,
        movement: delta > 0 ? StockMovement.RESTOCK : StockMovement.ADMIN_ADJUSTMENT,
        quantity: delta,
        stockBefore: reward.stockAvailable,
        stockAfter: nextAvailable,
        reason,
        createdById: adminId,
      },
    });

    await recordAudit(
      {
        actorId: adminId,
        action: 'STOCK_ADJUSTED',
        targetType: 'Reward',
        targetId: rewardId,
        oldValue: { stockAvailable: reward.stockAvailable },
        newValue: { stockAvailable: nextAvailable, delta, reason },
      },
      tx,
    );

    return updated;
  });
}

export async function listAllClaims(options: {
  status?: ClaimStatus;
  rewardId?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, options.pageSize ?? 25);

  const where: Prisma.RewardClaimWhereInput = {
    ...(options.status ? { status: options.status } : {}),
    ...(options.rewardId ? { rewardId: options.rewardId } : {}),
    ...(options.userId ? { userId: options.userId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.rewardClaim.findMany({
      where,
      include: {
        reward: { select: { name: true, category: true, imageUrl: true } },
        user: { select: { email: true, profile: { select: { displayName: true } } } },
        processedBy: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.rewardClaim.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
