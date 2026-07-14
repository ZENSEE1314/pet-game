import type { NextRequest } from 'next/server';
import { RewardCategory } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { redeemRewardSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';
import { listRewards, redeemReward } from '@/services/reward/reward.service';
import { getBalances } from '@/services/currency/transaction.service';
import { markRewardShopVisited } from '@/services/user/user.service';

/** GET /api/rewards — the reward shop. */
export async function GET(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();

    const raw = request.nextUrl.searchParams.get('category');
    const category = raw && raw in RewardCategory ? (raw as RewardCategory) : undefined;

    const [rewards, balances] = await Promise.all([
      listRewards({ category, userId: user.id }),
      getBalances(user.id),
    ]);

    // Visiting the shop is itself a mission objective.
    void markRewardShopVisited(user.id).catch(() => {
      /* a failed mission tick must not break the shop */
    });

    return ok({ rewards, balances });
  });
}

/**
 * POST /api/rewards — redeem.
 *
 * The body is `{ rewardId }`. Not the point cost — that is read from the reward row
 * inside the same transaction that debits it, so a stale or doctored client price
 * has nowhere to land.
 */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    await enforceRateLimit('redemption', user.id);

    const { rewardId } = redeemRewardSchema.parse(await request.json());

    const result = await redeemReward(user.id, rewardId);
    const balances = await getBalances(user.id);

    return ok({ ...result, balances });
  });
}
