import type { NextRequest } from 'next/server';
import { PermissionKey, AuditAction } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { missionInputSchema } from '@/lib/validation';
import { recordAudit } from '@/services/audit/audit.service';
import { z } from 'zod';

export async function GET() {
  return withApi(async () => {
    await requirePermission(PermissionKey.MANAGE_MISSIONS);

    const missions = await prisma.mission.findMany({
      where: { deletedAt: null },
      orderBy: [{ frequency: 'asc' }, { sortOrder: 'asc' }],
      include: { _count: { select: { userMissions: true } } },
    });

    return ok({ missions });
  });
}

export async function POST(request: NextRequest) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.MANAGE_MISSIONS);
    const input = missionInputSchema.parse(await request.json());

    const mission = await prisma.mission.create({
      data: {
        ...input,
        gameSlug: input.gameSlug ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
      },
    });

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.MISSION_CREATED,
      targetType: 'Mission',
      targetId: mission.id,
      newValue: { code: mission.code, title: mission.title, type: mission.type },
    });

    return ok({ mission });
  });
}

const updateSchema = missionInputSchema.partial().extend({ id: z.string().cuid() });

export async function PATCH(request: NextRequest) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.MANAGE_MISSIONS);
    const { id, ...data } = updateSchema.parse(await request.json());

    const before = await prisma.mission.findUniqueOrThrow({ where: { id } });
    const mission = await prisma.mission.update({ where: { id }, data });

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.MISSION_UPDATED,
      targetType: 'Mission',
      targetId: id,
      oldValue: { isActive: before.isActive, rewardAmount: before.rewardAmount },
      newValue: { isActive: mission.isActive, rewardAmount: mission.rewardAmount },
    });

    return ok({ mission });
  });
}

/**
 * DELETE — soft delete only.
 *
 * A hard delete would orphan every UserMission row that references it, taking a
 * player's claim history with it. Missions are cheap; history is not.
 */
export async function DELETE(request: NextRequest) {
  return withApi(async () => {
    await requirePermission(PermissionKey.MANAGE_MISSIONS);
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return ok({ deleted: false });

    await prisma.mission.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return ok({ deleted: true });
  });
}
