import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { getReferralOverview } from '@/services/referral/referral.service';

export async function GET() {
  return withApi(async () => {
    const user = await requireUser();
    return ok(await getReferralOverview(user.id));
  });
}
