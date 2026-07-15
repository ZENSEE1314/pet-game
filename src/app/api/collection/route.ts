import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { markMonstersSeenSchema } from '@/lib/validation';
import { getCollection, markMonstersSeen } from '@/services/collection/collection.service';

/** GET /api/collection — the player's full 50-monster collection with piece progress. */
export async function GET() {
  return withApi(async () => {
    const user = await requireUser();
    return ok(await getCollection(user.id));
  });
}

/** PATCH /api/collection — clear the "NEW!" flag on hatched monsters once viewed. */
export async function PATCH(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    const { monsterIds } = markMonstersSeenSchema.parse(await request.json().catch(() => ({})));
    await markMonstersSeen(user.id, monsterIds);
    return ok({ ok: true });
  });
}
