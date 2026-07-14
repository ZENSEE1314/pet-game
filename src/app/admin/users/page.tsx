'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Ban, CheckCircle2, Wallet } from 'lucide-react';
import type { Role, AccountStatus, CurrencyType, TransactionDirection } from '@prisma/client';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Input,
  Label,
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
} from '@/components/ui/primitives';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/ui/states';
import { formatNumber, formatDate } from '@/lib/utils';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: AccountStatus;
  createdAt: string;
  profile: { username: string; displayName: string; level: number } | null;
  balances: { currency: CurrencyType; balance: number }[];
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AccountStatus | ''>('');
  const [page, setPage] = useState(1);

  const [adjusting, setAdjusting] = useState<AdminUser | null>(null);
  const [suspending, setSuspending] = useState<AdminUser | null>(null);

  const query = new URLSearchParams({
    page: String(page),
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', search, status, page],
    queryFn: () =>
      api.get<{ items: AdminUser[]; total: number; totalPages: number }>(
        `/api/admin/users?${query}`,
      ),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { userId: string; status: AccountStatus; reason: string }) =>
      api.patch('/api/admin/users', input),
    onSuccess: () => {
      toast.success('Account status updated');
      setSuspending(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const balanceMutation = useMutation({
    mutationFn: (input: {
      userId: string;
      currency: CurrencyType;
      direction: TransactionDirection;
      amount: number;
      reason: string;
    }) => api.post<{ balanceAfter: number }>('/api/admin/users', input),
    onSuccess: (result) => {
      toast.success('Balance adjusted', { description: `New balance: ${result.balanceAfter}` });
      setAdjusting(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          {data ? `${formatNumber(data.total)} accounts` : 'Loading…'}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by email, name or username"
              className="pl-9"
              aria-label="Search users"
            />
          </div>

          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AccountStatus | '');
              setPage(1);
            }}
            aria-label="Filter by status"
            className="sm:w-48"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BANNED">Banned</option>
            <option value="PENDING_VERIFICATION">Pending verification</option>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton />
      ) : isError || !data ? (
        <ErrorState message="We couldn't load users." onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No users match" message="Try a different search or filter." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Level</TableHead>
                <TableHead className="text-right">Coins</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {data.items.map((user) => {
                const coins = user.balances.find((b) => b.currency === 'COINS')?.balance ?? 0;
                const points =
                  user.balances.find((b) => b.currency === 'REWARD_POINTS')?.balance ?? 0;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-semibold">
                        {user.profile?.displayName ?? user.name ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </TableCell>

                    <TableCell>
                      <Badge variant={user.role === 'PLAYER' ? 'outline' : 'secondary'}>
                        {user.role.replace('_', ' ')}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          user.status === 'ACTIVE'
                            ? 'success'
                            : user.status === 'SUSPENDED' || user.status === 'BANNED'
                              ? 'destructive'
                              : 'warning'
                        }
                      >
                        {user.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="tabular-nums">{user.profile?.level ?? 1}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(coins)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatNumber(points)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>

                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAdjusting(user)}
                          aria-label={`Adjust balance for ${user.email}`}
                        >
                          <Wallet className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSuspending(user)}
                          aria-label={
                            user.status === 'ACTIVE'
                              ? `Suspend ${user.email}`
                              : `Reactivate ${user.email}`
                          }
                        >
                          {user.status === 'ACTIVE' ? (
                            <Ban className="h-3.5 w-3.5 text-destructive" aria-hidden />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {data.totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}

      <BalanceDialog
        user={adjusting}
        onClose={() => setAdjusting(null)}
        onSubmit={(values) => balanceMutation.mutate(values)}
        isPending={balanceMutation.isPending}
      />

      <StatusDialog
        user={suspending}
        onClose={() => setSuspending(null)}
        onSubmit={(values) => statusMutation.mutate(values)}
        isPending={statusMutation.isPending}
      />
    </div>
  );
}

/**
 * Balance adjustment.
 *
 * The reason field is required and the confirm button stays disabled until it has
 * real content. That is not UI politeness — the same rule is enforced by the Zod
 * schema and again in the service, because an unexplained balance change is
 * indistinguishable from an insider helping themselves.
 */
function BalanceDialog({
  user,
  onClose,
  onSubmit,
  isPending,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSubmit: (values: {
    userId: string;
    currency: CurrencyType;
    direction: TransactionDirection;
    amount: number;
    reason: string;
  }) => void;
  isPending: boolean;
}) {
  const [currency, setCurrency] = useState<CurrencyType>('COINS');
  const [direction, setDirection] = useState<TransactionDirection>('CREDIT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const isValid = Number(amount) > 0 && reason.trim().length >= 5;

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust balance</DialogTitle>
          <DialogDescription>
            {user?.profile?.displayName ?? user?.email}. This writes an immutable ledger entry and
            an audit record — it cannot be undone, only offset by another adjustment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select
                id="currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value as CurrencyType)}
              >
                <option value="COINS">Coins</option>
                <option value="REWARD_POINTS">Reward points</option>
                <option value="GEMS">Gems</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="direction">Direction</Label>
              <Select
                id="direction"
                value={direction}
                onChange={(event) => setDirection(event.target.value as TransactionDirection)}
              >
                <option value="CREDIT">Credit (add)</option>
                <option value="DEBIT">Debit (remove)</option>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="reason">Reason (required)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Compensating for the double-charge bug on 2026-07-12"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Minimum 5 characters. Recorded in the audit log against your account.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={direction === 'DEBIT' ? 'destructive' : 'default'}
            disabled={!isValid || isPending}
            isLoading={isPending}
            onClick={() =>
              user &&
              onSubmit({
                userId: user.id,
                currency,
                direction,
                amount: Number(amount),
                reason: reason.trim(),
              })
            }
          >
            {direction === 'CREDIT' ? 'Credit' : 'Debit'} {amount || 0}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusDialog({
  user,
  onClose,
  onSubmit,
  isPending,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSubmit: (values: { userId: string; status: AccountStatus; reason: string }) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('');
  const isSuspending = user?.status === 'ACTIVE';

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isSuspending ? 'Suspend account' : 'Reactivate account'}</DialogTitle>
          <DialogDescription>
            {isSuspending
              ? 'The player will be signed out of every session and blocked from the API immediately.'
              : 'The player regains full access.'}
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="statusReason">Reason (required)</Label>
          <Textarea
            id="statusReason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={isSuspending ? 'e.g. Confirmed score manipulation' : 'e.g. Appeal upheld'}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={isSuspending ? 'destructive' : 'default'}
            disabled={reason.trim().length < 3 || isPending}
            isLoading={isPending}
            onClick={() =>
              user &&
              onSubmit({
                userId: user.id,
                status: isSuspending ? 'SUSPENDED' : 'ACTIVE',
                reason: reason.trim(),
              })
            }
          >
            {isSuspending ? 'Suspend' : 'Reactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
