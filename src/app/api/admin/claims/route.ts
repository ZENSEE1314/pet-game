import type { NextRequest } from 'next/server';
import { PermissionKey } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { claimQuerySchema, cancelClaimSchema } from '@/lib/validation';
import {
  listAllClaims,
  cancelClaimWithRefund,
  markClaimReady,
} from '@/services/reward/reward.service';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  return withApi(async () => {
    await requirePermission(PermissionKey.APPROVE_CLAIMS);

    const query = claimQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    return ok(await listAllClaims(query));
  });
}

/** POST — cancel a claim and refund the points. The only path that gives points back. */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.APPROVE_CLAIMS);
    const { claimId, reason } = cancelClaimSchema.parse(await request.json());

    const result = await cancelClaimWithRefund(claimId, admin.id, reason);
    return ok({ ...result, message: `Cancelled and refunded ${result.refunded} reward points.` });
  });
}

const markReadySchema = z.object({
  claimId: z.string().cuid(),
  fulfilmentDetails: z.string().max(500).optional(),
});

/** PATCH — mark a claim ready for collection (e.g. the voucher code is now known). */
export async function PATCH(request: NextRequest) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.APPROVE_CLAIMS);
    const { claimId, fulfilmentDetails } = markReadySchema.parse(await request.json());

    const claim = await markClaimReady(claimId, admin.id, fulfilmentDetails);
    return ok({ claimId: claim.id, status: claim.status });
  });
}
