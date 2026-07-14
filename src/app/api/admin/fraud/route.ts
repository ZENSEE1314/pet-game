import type { NextRequest } from 'next/server';
import { PermissionKey, AuditAction } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { fraudQuerySchema, resolveFraudSchema } from '@/lib/validation';
import { listFraudAlerts, resolveFraudAlert } from '@/services/fraud/fraud.service';
import { recordAudit } from '@/services/audit/audit.service';

export async function GET(request: NextRequest) {
  return withApi(async () => {
    await requirePermission(PermissionKey.REVIEW_FRAUD);

    const query = fraudQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    return ok(await listFraudAlerts(query));
  });
}

/**
 * POST — resolve an alert.
 *
 * Resolution is a human judgement, always. Nothing in this codebase bans an account
 * automatically: a single alert is a signal, not a verdict, and the cost of banning
 * a legitimate player is far higher than the cost of paying out one cheat.
 */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.REVIEW_FRAUD);
    const input = resolveFraudSchema.parse(await request.json());

    const alert = await resolveFraudAlert(
      input.alertId,
      admin.id,
      input.outcome,
      input.resolution,
    );

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.FRAUD_ALERT_RESOLVED,
      targetType: 'FraudAlert',
      targetId: input.alertId,
      newValue: { outcome: input.outcome, resolution: input.resolution },
    });

    return ok({ alertId: alert.id, status: alert.status });
  });
}
