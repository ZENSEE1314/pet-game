import type { NextRequest } from 'next/server';
import { PermissionKey } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission, requireRole } from '@/lib/rbac';
import {
  userQuerySchema,
  adjustBalanceSchema,
  setUserStatusSchema,
  setUserRoleSchema,
} from '@/lib/validation';
import { listUsers, adjustBalance, setUserStatus, setUserRole } from '@/services/user/user.service';

export async function GET(request: NextRequest) {
  return withApi(async () => {
    await requirePermission(PermissionKey.MANAGE_USERS);

    const query = userQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    return ok(await listUsers(query));
  });
}

/**
 * POST /api/admin/users — adjust a balance.
 *
 * Gated on ADJUST_BALANCE rather than on the ADMIN role, which is what makes the
 * brief's "staff can't touch balances unless an admin grants it" rule work: grant a
 * staff account that one permission and this endpoint opens for them, with the
 * identical audit trail.
 */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.ADJUST_BALANCE);
    const input = adjustBalanceSchema.parse(await request.json());

    const result = await adjustBalance({
      userId: input.userId,
      currency: input.currency,
      amount: input.amount,
      direction: input.direction,
      reason: input.reason,
      adminId: admin.id,
    });

    return ok({
      transactionId: result.transaction.id,
      balanceAfter: result.balanceAfter,
      message: `Balance adjusted. New ${input.currency.toLowerCase()} balance: ${result.balanceAfter}.`,
    });
  });
}

/** PATCH /api/admin/users — suspend or reactivate. */
export async function PATCH(request: NextRequest) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.MANAGE_USERS);
    const input = setUserStatusSchema.parse(await request.json());

    const user = await setUserStatus(input.userId, input.status, admin.id, input.reason);
    return ok({ userId: user.id, status: user.status });
  });
}

/** PUT /api/admin/users — change a role. Super admin only. */
export async function PUT(request: NextRequest) {
  return withApi(async () => {
    // Deliberately role-gated, not permission-gated: the ability to hand out roles is
    // the ability to hand yourself every permission, so it cannot be delegated.
    const admin = await requireRole('SUPER_ADMIN');
    const input = setUserRoleSchema.parse(await request.json());

    const user = await setUserRole(input.userId, input.role, admin.id);
    return ok({ userId: user.id, role: user.role });
  });
}
