import { PermissionKey } from '@prisma/client';
import { ScrollText } from 'lucide-react';

import { requirePermission } from '@/lib/rbac';
import { listAuditLogs } from '@/services/audit/audit.service';
import { Card, CardContent } from '@/components/ui/card';
import {
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { formatDateTime, formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const SENSITIVE_ACTIONS = new Set([
  'BALANCE_ADJUSTED',
  'USER_SUSPENDED',
  'ROLE_CHANGED',
  'PERMISSION_GRANTED',
  'CLAIM_CANCELLED',
]);

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_AUDIT_LOG);

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));

  const logs = await listAuditLogs({ page, pageSize: 50 });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          {formatNumber(logs.total)} recorded actions. Who did what, to whom, and from where.
        </p>
      </div>

      {logs.items.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6" aria-hidden />}
          title="No audit entries"
          message="Sensitive actions will be recorded here as they happen."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {logs.items.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(log.createdAt)}
                  </TableCell>

                  <TableCell>
                    <p className="text-sm font-medium">{log.actor?.name ?? 'System'}</p>
                    <p className="text-xs text-muted-foreground">{log.actor?.email ?? '—'}</p>
                  </TableCell>

                  <TableCell>
                    <Badge variant={SENSITIVE_ACTIONS.has(log.action) ? 'warning' : 'outline'}>
                      {log.action.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs">
                    <p className="font-medium">{log.targetType}</p>
                    <p className="font-mono text-muted-foreground">
                      {log.targetId?.slice(0, 10) ?? '—'}
                    </p>
                  </TableCell>

                  <TableCell className="max-w-xs">
                    {log.oldValue || log.newValue ? (
                      <pre className="overflow-x-auto rounded bg-muted p-1.5 text-[10px]">
                        {JSON.stringify(log.newValue ?? log.oldValue)}
                      </pre>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.ipAddress ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Card>
            <CardContent className="flex items-center justify-between p-4 text-sm">
              <span className="text-muted-foreground">
                Page {logs.page} of {logs.totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <a
                    href={`/admin/audit?page=${page - 1}`}
                    className="rounded-lg border px-3 py-1.5 font-semibold hover:bg-secondary"
                  >
                    Previous
                  </a>
                ) : null}
                {page < logs.totalPages ? (
                  <a
                    href={`/admin/audit?page=${page + 1}`}
                    className="rounded-lg border px-3 py-1.5 font-semibold hover:bg-secondary"
                  >
                    Next
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
