import type { NextRequest } from 'next/server';
import { PermissionKey, AuditAction } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { paginationSchema } from '@/lib/validation';
import { listAuditLogs } from '@/services/audit/audit.service';

export async function GET(request: NextRequest) {
  return withApi(async () => {
    await requirePermission(PermissionKey.VIEW_AUDIT_LOG);

    const pagination = paginationSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const rawAction = request.nextUrl.searchParams.get('action');
    const action = rawAction && rawAction in AuditAction ? (rawAction as AuditAction) : undefined;

    return ok(await listAuditLogs({ ...pagination, action }));
  });
}
