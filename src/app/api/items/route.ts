import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { purchaseItemSchema } from '@/lib/validation';
import { listShopItems, purchaseItem } from '@/services/inventory/item.service';
import { getBalances } from '@/services/currency/transaction.service';

/** GET /api/items — the shop. */
export async function GET() {
  return withApi(async () => {
    const user = await requireUser();
    const [items, balances] = await Promise.all([listShopItems(user.id), getBalances(user.id)]);
    return ok({ items, balances });
  });
}

/**
 * POST /api/items — buy. The body carries `{ itemId, quantity, currency }`; the
 * price comes from the database row, never from the request.
 */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    const input = purchaseItemSchema.parse(await request.json());

    const result = await purchaseItem(user.id, input.itemId, input.quantity, input.currency);
    const balances = await getBalances(user.id);

    return ok({ ...result, balances });
  });
}
