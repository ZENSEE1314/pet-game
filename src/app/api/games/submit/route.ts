import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { submitScoreSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';
import { submitGameScore } from '@/services/game/game.service';
import { getBalances } from '@/services/currency/transaction.service';

/**
 * POST /api/games/submit — close a session and pay out.
 *
 * Everything the client sends here is a claim, not a fact. The response contains the
 * server's numbers, and the client's job is to display them — which is why the game
 * over screen renders from this response rather than from its own counters.
 */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    await enforceRateLimit('gameSubmit', user.id);

    const input = submitScoreSchema.parse(await request.json());

    const result = await submitGameScore({
      userId: user.id,
      sessionId: input.sessionId,
      signature: input.signature,
      score: input.score,
      events: input.events,
    });

    const balances = await getBalances(user.id);

    return ok({ ...result, balances });
  });
}
