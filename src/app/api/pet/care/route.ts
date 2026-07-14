import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { careActionSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';
import { performCareAction } from '@/services/pet/pet.service';
import { getBalances } from '@/services/currency/transaction.service';

/**
 * POST /api/pet/care
 *
 * The request body is `{ action: 'FEED' }` — and nothing else. Not the coins it
 * should earn, not the stat deltas, not a timestamp. The server owns all of that.
 */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    await enforceRateLimit('petCare', user.id);

    const { action } = careActionSchema.parse(await request.json());

    const result = await performCareAction(user.id, action);
    const balances = await getBalances(user.id);

    return ok({ ...result, balances });
  });
}
