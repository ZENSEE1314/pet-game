import type { NextRequest } from 'next/server';
import { PermissionKey, AuditAction } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rewardInputSchema, adjustStockSchema } from '@/lib/validation';
import { listRewards, adjustStock } from '@/services/reward/reward.service';
import { recordAudit } from '@/services/audit/audit.service';

export async function GET() {
  return withApi(async () => {
    await requirePermission(PermissionKey.MANAGE_REWARDS);
    const rewards = await listRewards({ includeInactive: true });
    return ok({ rewards });
  });
}

/** POST — create a reward. */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.MANAGE_REWARDS);
    const input = rewardInputSchema.parse(await request.json());

    const reward = await prisma.reward.create({
      data: {
        ...input,
        collectionLocation: input.collectionLocation ?? null,
        termsAndConditions: input.termsAndConditions ?? null,
        dailyLimit: input.dailyLimit ?? null,
        startsAt: input.startsAt ?? null,
        expiresAt: input.expiresAt ?? null,
        // Total and available start equal — nothing is reserved until someone redeems.
        stockAvailable: input.stockTotal,
        stockReserved: 0,
      },
    });

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.REWARD_CREATED,
      targetType: 'Reward',
      targetId: reward.id,
      newValue: { name: reward.name, pointCost: reward.pointCost, stock: reward.stockTotal },
    });

    return ok({ reward });
  });
}

/** PATCH — adjust stock (audited, and written to the stock ledger). */
export async function PATCH(request: NextRequest) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.MANAGE_REWARDS);
    const input = adjustStockSchema.parse(await request.json());

    const reward = await adjustStock(input.rewardId, input.delta, admin.id, input.reason);
    return ok({ reward });
  });
}
