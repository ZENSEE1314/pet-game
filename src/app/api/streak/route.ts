import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { getStreakState, claimDailyStreak } from '@/services/streak/streak.service';
import { getBalances } from '@/services/currency/transaction.service';

export async function GET() {
  return withApi(async () => {
    const user = await requireUser();
    return ok(await getStreakState(user.id));
  });
}

/** POST /api/streak — claim today's login reward. */
export async function POST() {
  return withApi(async () => {
    const user = await requireUser();
    const result = await claimDailyStreak(user.id);
    const balances = await getBalances(user.id);
    return ok({ ...result, balances });
  });
}
