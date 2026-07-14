import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { promoCodeSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';
import { redeemPromoCode, getUserPromoHistory } from '@/services/promo/promo.service';
import { getBalances } from '@/services/currency/transaction.service';

export async function GET() {
  return withApi(async () => {
    const user = await requireUser();
    return ok({ history: await getUserPromoHistory(user.id) });
  });
}

export async function POST(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    // Rate-limited hard: without this, the endpoint is a free code-guessing oracle.
    await enforceRateLimit('promoCode', user.id);

    const { code } = promoCodeSchema.parse(await request.json());
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;

    const result = await redeemPromoCode(user.id, code, ip);
    const balances = await getBalances(user.id);

    return ok({ ...result, balances });
  });
}
