import type { NextRequest } from 'next/server';
import { PermissionKey, AuditAction } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rewardInputSchema } from '@/lib/validation';
import { recordAudit } from '@/services/audit/audit.service';

/** PATCH — edit a reward. Stock is NOT editable here; use the audited stock route. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.MANAGE_REWARDS);
    const { id } = await params;

    const input = rewardInputSchema.partial().parse(await request.json());
    const before = await prisma.reward.findUniqueOrThrow({ where: { id } });

    // stockTotal is deliberately dropped: changing stock has to go through
    // `adjustStock`, which writes a RewardStockTransaction. Allowing a silent edit
    // here would let stock move without a paper trail.
    const { stockTotal: _ignored, ...editable } = input;

    const reward = await prisma.reward.update({ where: { id }, data: editable });

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.REWARD_UPDATED,
      targetType: 'Reward',
      targetId: id,
      oldValue: { name: before.name, pointCost: before.pointCost, isActive: before.isActive },
      newValue: { name: reward.name, pointCost: reward.pointCost, isActive: reward.isActive },
    });

    return ok({ reward });
  });
}

/** DELETE — soft delete, so existing claims keep resolving to a real reward row. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.MANAGE_REWARDS);
    const { id } = await params;

    const reward = await prisma.reward.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.REWARD_UPDATED,
      targetType: 'Reward',
      targetId: id,
      newValue: { deleted: true },
    });

    return ok({ rewardId: reward.id, deleted: true });
  });
}
