import type { NextRequest } from 'next/server';
import { CurrencyType } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { getBalances, getTransactionHistory } from '@/services/currency/transaction.service';

/** GET /api/wallet — balances plus a page of the player's own ledger. */
export async function GET(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();

    const raw = request.nextUrl.searchParams.get('currency');
    const currency = raw && raw in CurrencyType ? (raw as CurrencyType) : undefined;
    const page = Number(request.nextUrl.searchParams.get('page') ?? 1);

    const [balances, history] = await Promise.all([
      getBalances(user.id),
      getTransactionHistory(user.id, { currency, page }),
    ]);

    return ok({ balances, ...history });
  });
}
