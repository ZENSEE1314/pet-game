import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { listClaims } from '@/services/reward/reward.service';

export async function GET() {
  return withApi(async () => {
    const user = await requireUser();
    const claims = await listClaims(user.id);
    return ok({ claims });
  });
}
