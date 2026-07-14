import { PermissionKey } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { getUserDetail } from '@/services/user/user.service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApi(async () => {
    await requirePermission(PermissionKey.MANAGE_USERS);
    const { id } = await params;

    const detail = await getUserDetail(id);

    // The password hash is never serialised out of the API, not even for an admin.
    const { passwordHash: _omit, ...user } = detail.user;

    return ok({ ...detail, user });
  });
}
