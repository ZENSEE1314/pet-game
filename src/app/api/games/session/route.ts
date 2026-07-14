import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { startSessionSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';
import { startGameSession } from '@/services/game/game.service';

/**
 * POST /api/games/session — open a signed, single-use game session.
 *
 * Energy and the daily attempt are spent HERE, at the start, not at submission.
 * That matters: if the cost were charged on submit, a player could start a hundred
 * games, keep only the best result, and pay for one. Charging up front means every
 * attempt costs something whether or not you like how it went.
 */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    await enforceRateLimit('gameStart', user.id);

    const { slug } = startSessionSchema.parse(await request.json());

    const session = await startGameSession(user.id, slug, {
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return ok(session);
  });
}
