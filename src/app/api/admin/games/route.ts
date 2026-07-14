import type { NextRequest } from 'next/server';
import { PermissionKey, AuditAction } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { gameConfigSchema, paginationSchema } from '@/lib/validation';
import { recordAudit } from '@/services/audit/audit.service';
import { listGameSessions } from '@/services/game/game.service';

export async function GET(request: NextRequest) {
  return withApi(async () => {
    await requirePermission(PermissionKey.MANAGE_GAMES);

    const wantsSessions = request.nextUrl.searchParams.get('view') === 'sessions';

    if (wantsSessions) {
      const query = paginationSchema.parse(
        Object.fromEntries(request.nextUrl.searchParams.entries()),
      );
      return ok(await listGameSessions(query));
    }

    const games = await prisma.game.findMany({
      include: {
        configuration: true,
        _count: { select: { sessions: true, scores: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return ok({ games });
  });
}

/**
 * PATCH — update a game's configuration.
 *
 * This is the reward formula and every anti-cheat threshold, editable at runtime.
 * Because the formula lives in the database rather than the bundle, tuning the
 * economy does not require a deploy — and a leaked client build reveals nothing
 * about how rewards are actually computed.
 */
export async function PATCH(request: NextRequest) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.MANAGE_GAMES);
    const input = gameConfigSchema.parse(await request.json());
    const { gameId, ...config } = input;

    const before = await prisma.gameConfiguration.findUnique({ where: { gameId } });

    const updated = await prisma.gameConfiguration.upsert({
      where: { gameId },
      create: { gameId, ...config },
      update: config,
    });

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.GAME_CONFIG_UPDATED,
      targetType: 'GameConfiguration',
      targetId: updated.id,
      oldValue: before
        ? {
            coinsPerScorePoint: before.coinsPerScorePoint,
            dailyCoinCap: before.dailyCoinCap,
            maxValidScore: before.maxValidScore,
          }
        : undefined,
      newValue: {
        coinsPerScorePoint: updated.coinsPerScorePoint,
        dailyCoinCap: updated.dailyCoinCap,
        maxValidScore: updated.maxValidScore,
      },
    });

    return ok({ configuration: updated });
  });
}
