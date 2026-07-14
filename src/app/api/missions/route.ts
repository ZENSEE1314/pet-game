import type { NextRequest } from 'next/server';
import { MissionFrequency } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { claimMissionSchema } from '@/lib/validation';
import { listMissionsForUser, claimMissionReward } from '@/services/mission/mission.service';
import { getBalances } from '@/services/currency/transaction.service';

/** GET /api/missions?frequency=DAILY|WEEKLY */
export async function GET(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();

    const raw = request.nextUrl.searchParams.get('frequency');
    const frequency =
      raw && raw in MissionFrequency ? (raw as MissionFrequency) : MissionFrequency.DAILY;

    const missions = await listMissionsForUser(user.id, frequency);
    return ok({ missions, frequency });
  });
}

/** POST /api/missions — claim a completed mission's reward. */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    const { userMissionId } = claimMissionSchema.parse(await request.json());

    const result = await claimMissionReward(user.id, userMissionId);
    const balances = await getBalances(user.id);

    return ok({
      mission: { title: result.mission.title },
      rewards: result.rewards,
      balances,
    });
  });
}
