'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Undo2, PackageCheck, Download } from 'lucide-react';
import type { ClaimStatus } from '@prisma/client';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
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
import { formatDateTime, formatNumber } from '@/lib/utils';

interface AdminClaim {
  id: string;
  claimCode: string;
  status: ClaimStatus;
  pointCost: number;
  createdAt: string;
  expiresAt: string;
  collectedAt: string | null;
  reward: { name: string; category: string };
  user: { email: string; profile: { displayName: string } | null };
  processedBy: { email: string; name: string | null } | null;
}

export default function AdminClaimsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ClaimStatus | ''>('');
  const [cancelling, setCancelling] = useState<AdminClaim | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-claims', status],
    queryFn: () =>
      api.get<{ items: AdminClaim[]; total: number }>(
        `/api/admin/claims${status ? `?status=${status}` : ''}`,
      ),
  });

  const cancelMutation = useMutation({
    mutationFn: (input: { claimId: string; reason: string }) =>
      api.post<{ refunded: number }>('/api/admin/claims', input),
    onSuccess: (result) => {
      toast.success('Claim cancelled', {
        description: `${result.refunded} reward points refunded to the player.`,
      });
      setCancelling(null);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin-claims'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const readyMutation = useMutation({
    mutationFn: (claimId: string) => api.patch('/api/admin/claims', { claimId }),
    onSuccess: () => {
      toast.success('Marked ready for collection');
      void queryClient.invalidateQueries({ queryKey: ['admin-claims'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  /** CSV export runs entirely client-side over the rows already loaded — no new endpoint. */
  function exportCsv() {
    if (!data?.items.length) return;

    const header = ['Claim code', 'Reward', 'Player', 'Email', 'Points', 'Status', 'Created', 'Collected'];
    const rows = data.items.map((claim) => [
      claim.claimCode,
      claim.reward.name,
      claim.user.profile?.displayName ?? '',
      claim.user.email,
      String(claim.pointCost),
      claim.status,
      claim.createdAt,
      claim.collectedAt ?? '',
    ]);

    // Quote-and-escape every cell: a reward called `Coffee, large` would otherwise
    // silently shift every column to its right.
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `petquest-claims-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reward claims</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${formatNumber(data.total)} claims` : 'Loading…'}
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.items.length}>
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as ClaimStatus | '')}
            aria-label="Filter by status"
            className="sm:max-w-xs"
          >
            <option value="">All statuses</option>
            {['PENDING', 'RESERVED', 'READY', 'COLLECTED', 'DELIVERED', 'CANCELLED', 'EXPIRED', 'REJECTED'].map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton />
      ) : isError || !data ? (
        <ErrorState message="We couldn't load claims." onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No claims" message="Nothing matches that filter." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.items.map((claim) => {
              const isRefundable = !['COLLECTED', 'CANCELLED'].includes(claim.status);

              return (
                <TableRow key={claim.id}>
                  <TableCell className="font-mono text-xs font-semibold">{claim.claimCode}</TableCell>
                  <TableCell className="font-medium">{claim.reward.name}</TableCell>
                  <TableCell>
                    <p className="text-sm">{claim.user.profile?.displayName ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{claim.user.email}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{claim.pointCost}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        claim.status === 'COLLECTED'
                          ? 'secondary'
                          : claim.status === 'READY' || claim.status === 'RESERVED'
                            ? 'success'
                            : 'destructive'
                      }
                    >
                      {claim.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(claim.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {claim.status === 'RESERVED' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => readyMutation.mutate(claim.id)}
                          disabled={readyMutation.isPending}
                          aria-label={`Mark ${claim.claimCode} ready`}
                        >
                          <PackageCheck className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      ) : null}

                      {isRefundable ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCancelling(claim)}
                          aria-label={`Cancel and refund ${claim.claimCode}`}
                        >
                          <Undo2 className="h-3.5 w-3.5 text-destructive" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={Boolean(cancelling)} onOpenChange={(open) => !open && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel and refund?</DialogTitle>
            <DialogDescription>
              <strong>{cancelling?.pointCost} reward points</strong> will be returned to{' '}
              {cancelling?.user.profile?.displayName ?? cancelling?.user.email}, and the stock will
              go back on the shelf. Both happen in one transaction.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="cancelReason">Reason (required)</Label>
            <Textarea
              id="cancelReason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Reward out of stock at the collection point"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)}>
              Keep claim
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3 || cancelMutation.isPending}
              isLoading={cancelMutation.isPending}
              onClick={() =>
                cancelling &&
                cancelMutation.mutate({ claimId: cancelling.id, reason: reason.trim() })
              }
            >
              Cancel & refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
