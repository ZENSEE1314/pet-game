import type { NextRequest } from 'next/server';
import { PermissionKey } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { lookupClaimSchema } from '@/lib/validation';
import { enforceRateLimit } from '@/lib/rate-limit';
import { lookupClaim } from '@/services/reward/reward.service';

/**
 * POST /api/staff/lookup — resolve a scanned QR or a typed claim code.
 *
 * Read-only on purpose. Looking up a claim must never mutate it: staff will scan the
 * same code two or three times while the customer fumbles with their phone, and the
 * only thing that should burn the claim is the explicit "Confirm collection" tap.
 */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const staff = await requirePermission(PermissionKey.SCAN_CLAIMS);
    await enforceRateLimit('qrScan', staff.id);

    const input = lookupClaimSchema.parse(await request.json());
    const result = await lookupClaim(input, staff.id);

    return ok(result);
  });
}
