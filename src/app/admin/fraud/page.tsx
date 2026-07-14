'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import type { FraudAlertType, FraudSeverity, FraudAlertStatus } from '@prisma/client';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Textarea,
  Label,
} from '@/components/ui/primitives';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/ui/states';
import { formatDateTime } from '@/lib/utils';

interface Alert {
  id: string;
  type: FraudAlertType;
  severity: FraudSeverity;
  status: FraudAlertStatus;
  description: string;
  evidence: unknown;
  createdAt: string;
  resolution: string | null;
  user: { id: string; email: string; name: string | null; status: string };
  resolvedBy: { name: string | null; email: string } | null;
}

const SEVERITY_VARIANT: Record<FraudSeverity, 'outline' | 'secondary' | 'warning' | 'destructive'> = {
  LOW: 'outline',
  MEDIUM: 'secondary',
  HIGH: 'warning',
  CRITICAL: 'destructive',
};

export default function AdminFraudPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FraudAlertStatus | ''>('OPEN');
  const [reviewing, setReviewing] = useState<Alert | null>(null);
  const [resolution, setResolution] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-fraud', status],
    queryFn: () =>
      api.get<{ items: Alert[]; total: number }>(
        `/api/admin/fraud${status ? `?status=${status}` : ''}`,
      ),
  });

  const resolveMutation = useMutation({
    mutationFn: (input: {
      alertId: string;
      outcome: 'RESOLVED_LEGITIMATE' | 'RESOLVED_ABUSE';
      resolution: string;
    }) => api.post('/api/admin/fraud', input),
    onSuccess: () => {
      toast.success('Alert resolved');
      setReviewing(null);
      setResolution('');
      void queryClient.invalidateQueries({ queryKey: ['admin-fraud'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fraud alerts</h1>
        <p className="text-sm text-muted-foreground">
          Signals for a human to judge. Nothing here bans anyone automatically.
        </p>
      </div>

      <Card className="border-sky-300/60 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">A single alert is not proof.</strong> A brilliant
          player and a cheat produce the same high score; a family and a click farm share the same
          IP. Look at the pattern across a player&apos;s history — game sessions, ledger,
          referrals — before you act.
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as FraudAlertStatus | '')}
            aria-label="Filter by status"
            className="sm:max-w-xs"
          >
            <option value="">All alerts</option>
            <option value="OPEN">Open</option>
            <option value="REVIEWING">Reviewing</option>
            <option value="RESOLVED_LEGITIMATE">Resolved — legitimate</option>
            <option value="RESOLVED_ABUSE">Resolved — abuse</option>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton />
      ) : isError || !data ? (
        <ErrorState message="We couldn't load fraud alerts." onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" aria-hidden />}
          title="No alerts"
          message="Nothing suspicious right now."
        />
      ) : (
        <div className="space-y-3">
          {data.items.map((alert) => (
            <Card key={alert.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldAlert
                    className={
                      alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
                        ? 'h-4 w-4 text-destructive'
                        : 'h-4 w-4 text-muted-foreground'
                    }
                    aria-hidden
                  />
                  <Badge variant={SEVERITY_VARIANT[alert.severity]}>{alert.severity}</Badge>
                  <Badge variant="outline">{alert.type.replace(/_/g, ' ')}</Badge>
                  <Badge variant={alert.status === 'OPEN' ? 'warning' : 'secondary'}>
                    {alert.status.replace(/_/g, ' ')}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(alert.createdAt)}
                  </span>
                </div>

                <p className="text-sm">{alert.description}</p>

                <p className="text-xs text-muted-foreground">
                  Player: <span className="font-semibold">{alert.user.email}</span> ·{' '}
                  {alert.user.status}
                </p>

                {alert.evidence ? (
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-[11px]">
                    {JSON.stringify(alert.evidence, null, 2)}
                  </pre>
                ) : null}

                {alert.resolution ? (
                  <p className="rounded-lg bg-secondary p-3 text-xs">
                    <strong>Resolution:</strong> {alert.resolution}
                    {alert.resolvedBy ? ` — ${alert.resolvedBy.name ?? alert.resolvedBy.email}` : ''}
                  </p>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setReviewing(alert)}>
                    Review
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve alert</DialogTitle>
            <DialogDescription>
              Record what you found. Resolving does not suspend the account — do that separately from
              the Users page if the evidence warrants it.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="resolution">What did you find?</Label>
            <Textarea
              id="resolution"
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              placeholder="e.g. Reviewed the last 20 sessions — score is consistent with their history. Legitimate."
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={resolution.trim().length < 3 || resolveMutation.isPending}
              onClick={() =>
                reviewing &&
                resolveMutation.mutate({
                  alertId: reviewing.id,
                  outcome: 'RESOLVED_LEGITIMATE',
                  resolution: resolution.trim(),
                })
              }
            >
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
              Legitimate
            </Button>

            <Button
              variant="destructive"
              disabled={resolution.trim().length < 3 || resolveMutation.isPending}
              isLoading={resolveMutation.isPending}
              onClick={() =>
                reviewing &&
                resolveMutation.mutate({
                  alertId: reviewing.id,
                  outcome: 'RESOLVED_ABUSE',
                  resolution: resolution.trim(),
                })
              }
            >
              <ShieldX className="h-4 w-4" aria-hidden />
              Confirmed abuse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
