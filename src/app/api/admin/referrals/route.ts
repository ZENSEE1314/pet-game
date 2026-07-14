import type { NextRequest } from 'next/server';
import { PermissionKey } from '@prisma/client';
import { z } from 'zod';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { paginationSchema } from '@/lib/validation';
import {
  listReferralsForAdmin,
  approveFlaggedReferral,
  rejectReferral,
} from '@/services/referral/referral.service';

export async function GET(request: NextRequest) {
  return withApi(async () => {
    await requirePermission(PermissionKey.REVIEW_FRAUD);

    const pagination = paginationSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const flaggedOnly = request.nextUrl.searchParams.get('flagged') === 'true';

    return ok(await listReferralsForAdmin({ ...pagination, flaggedOnly }));
  });
}

const reviewSchema = z.object({
  referralId: z.string().cuid(),
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().min(3).max(280),
});

/**
 * POST — clear or void a flagged referral.
 *
 * A flagged referral pays nothing until a human looks at it. Approving pays both
 * sides; rejecting voids it. Neither happens automatically, because "five signups
 * from one IP" describes a fraud ring and a family equally well.
 */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.REVIEW_FRAUD);
    const input = reviewSchema.parse(await request.json());

    if (input.decision === 'APPROVE') {
      const result = await approveFlaggedReferral(input.referralId, admin.id);
      return ok({ ...result, message: 'Referral approved and both sides paid.' });
    }

    const result = await rejectReferral(input.referralId, input.reason);
    return ok({ referralId: result.id, message: 'Referral rejected.' });
  });
}
