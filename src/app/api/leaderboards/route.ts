import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { leaderboardQuerySchema } from '@/lib/validation';
import { getLeaderboard } from '@/services/leaderboard/leaderboard.service';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();

    const query = leaderboardQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const [view, games] = await Promise.all([
      getLeaderboard({
        period: query.period,
        scope: query.scope,
        gameId: query.gameId ?? null,
        currentUserId: user.id,
        limit: query.limit,
      }),
      prisma.game.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    return ok({ ...view, games });
  });
}
