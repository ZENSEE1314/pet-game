import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { useItemSchema, equipItemSchema } from '@/lib/validation';
import { getInventory, consumeItem, equipItem } from '@/services/inventory/item.service';

export async function GET() {
  return withApi(async () => {
    const user = await requireUser();
    return ok({ inventory: await getInventory(user.id) });
  });
}

/** POST /api/inventory — consume an item. */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    const { itemId } = useItemSchema.parse(await request.json());
    const result = await consumeItem(user.id, itemId);
    return ok(result);
  });
}

/** PATCH /api/inventory — equip or unequip clothing. */
export async function PATCH(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    const { itemId, equip } = equipItemSchema.parse(await request.json());
    const result = await equipItem(user.id, itemId, equip);
    return ok(result);
  });
}
