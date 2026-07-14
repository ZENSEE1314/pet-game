import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { getEnergy, claimFreeRefill } from '@/services/game/energy.service';

export async function GET() {
  return withApi(async () => {
    const user = await requireUser();
    return ok(await getEnergy(user.id));
  });
}

/** POST /api/games/energy — claim the once-per-day free refill. */
export async function POST() {
  return withApi(async () => {
    const user = await requireUser();
    const energy = await claimFreeRefill(user.id);
    return ok({ energy, message: 'Energy refilled!' });
  });
}
