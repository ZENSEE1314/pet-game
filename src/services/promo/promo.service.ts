import { TransactionCategory, MissionType, Prisma } from '@prisma/client';
import { prisma, runSerializable } from '@/lib/db';
import { AppError } from '@/lib/api';
import { payoutReward } from '@/services/mission/mission.service';
import { trackMissionProgress } from '@/services/mission/mission.service';

/**
 * Promo codes.
 *
 * The duplicate-use guard is the `PromoCodeRedemption` row, created inside the same
 * transaction as the payout. Counting `usedCount` alone would be a race; the row is
 * the fact.
 */

export interface RedeemPromoResult {
  code: string;
  rewardType: string;
  rewardAmount: number;
  granted: { coins: number; rewardPoints: number; gems: number; xp: number };
  cappedPoints?: number;
}

export async function redeemPromoCode(
  userId: string,
  rawCode: string,
  ipAddress?: string,
): Promise<RedeemPromoResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new AppError('VALIDATION_ERROR', 'Enter a promo code.');

  const now = new Date();

  return runSerializable(
    async (tx) => {
      const promo = await tx.promoCode.findUnique({ where: { code } });

      // Deliberately the same message for "doesn't exist" and "inactive": a
      // different error would let someone enumerate valid codes.
      if (!promo || !promo.isActive) {
        throw new AppError('NOT_FOUND', 'That promo code is not valid.');
      }
      if (promo.startsAt && promo.startsAt > now) {
        throw new AppError('CONFLICT', 'This promo code is not active yet.');
      }
      if (promo.endsAt && promo.endsAt < now) {
        throw new AppError('EXPIRED', 'This promo code has expired.');
      }
      if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
        throw new AppError('LIMIT_REACHED', 'This promo code has been fully redeemed.');
      }

      const profile = await tx.profile.findUniqueOrThrow({
        where: { userId },
        select: { level: true },
      });
      if (profile.level < promo.minPlayerLevel) {
        throw new AppError(
          'FORBIDDEN',
          `You need to be level ${promo.minPlayerLevel} to use this code.`,
        );
      }

      const userUses = await tx.promoCodeRedemption.count({
        where: { promoCodeId: promo.id, userId },
      });
      if (userUses >= promo.perUserLimit) {
        throw new AppError('ALREADY_CLAIMED', 'You have already used this promo code.');
      }

      // Conditional increment of the global counter — if two players race for the
      // last use, only one of them gets it.
      if (promo.maxUses !== null) {
        const bumped = await tx.promoCode.updateMany({
          where: { id: promo.id, usedCount: { lt: promo.maxUses } },
          data: { usedCount: { increment: 1 } },
        });
        if (bumped.count === 0) {
          throw new AppError('LIMIT_REACHED', 'This promo code has just been fully redeemed.');
        }
      } else {
        await tx.promoCode.update({
          where: { id: promo.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      // The redemption row IS the per-user guard. If a concurrent request already
      // wrote one, the count check above catches it inside a Serializable
      // transaction and this one aborts.
      const redemption = await tx.promoCodeRedemption.create({
        data: {
          promoCodeId: promo.id,
          userId,
          rewardAmount: promo.rewardAmount,
          ipAddress,
        },
      });

      const granted = await payoutReward(tx, {
        userId,
        rewardType: promo.rewardType,
        rewardAmount: promo.rewardAmount,
        rewardItemId: promo.rewardItemId,
        category: TransactionCategory.PROMO_CODE,
        description: `Promo code: ${code}`,
        referenceType: 'PromoCodeRedemption',
        referenceId: redemption.id,
        idempotencyKey: `promo:${redemption.id}`,
      });

      await trackMissionProgress(tx, userId, MissionType.ENTER_PROMO_CODE);

      return {
        code,
        rewardType: promo.rewardType,
        rewardAmount: promo.rewardAmount,
        granted: {
          coins: granted.coins,
          rewardPoints: granted.rewardPoints,
          gems: granted.gems,
          xp: granted.xp,
        },
        cappedPoints: granted.cappedPoints,
      };
    },
  );
}

export async function listPromoCodes(options: { page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, options.pageSize ?? 25);

  const [items, total] = await Promise.all([
    prisma.promoCode.findMany({
      include: { _count: { select: { redemptions: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.promoCode.count(),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getUserPromoHistory(userId: string) {
  return prisma.promoCodeRedemption.findMany({
    where: { userId },
    include: { promoCode: { select: { code: true, rewardType: true } } },
    orderBy: { createdAt: 'desc' },
  });
}
