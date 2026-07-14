import type { NextRequest } from 'next/server';
import { PermissionKey } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { collectClaimSchema, rejectClaimSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';
import { collectClaim, rejectClaim, getCollectionHistory } from '@/services/reward/reward.service';

/** GET /api/staff/collect — this staff member's collection history. */
export async function GET() {
  return withApi(async () => {
    const staff = await requirePermission(PermissionKey.SCAN_CLAIMS);
    return ok({ history: await getCollectionHistory(staff.id) });
  });
}

/** POST /api/staff/collect — hand the item over. Single-use, enforced in the DB. */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const staff = await requirePermission(PermissionKey.SCAN_CLAIMS);
    await enforceRateLimit('qrScan', staff.id);

    const { claimId } = collectClaimSchema.parse(await request.json());
    const result = await collectClaim(claimId, staff.id);

    return ok({ ...result, message: 'Collection confirmed.' });
  });
}

/** PUT /api/staff/collect — reject an invalid claim. */
export async function PUT(request: NextRequest) {
  return withApi(async () => {
    const staff = await requirePermission(PermissionKey.APPROVE_CLAIMS);
    const { claimId, reason } = rejectClaimSchema.parse(await request.json());

    const result = await rejectClaim(claimId, staff.id, reason);
    return ok({ ...result, message: 'Claim rejected.' });
  });
}
