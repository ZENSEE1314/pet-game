import { PermissionKey, type CurrencyType } from '@prisma/client';
import { Receipt } from 'lucide-react';

import { requirePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
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

const PAGE_SIZE = 50;

/**
 * The global ledger, read-only.
 *
 * There is deliberately no edit or delete affordance anywhere on this page — the
 * ledger is append-only, and the API exposes no route that would let this page
 * mutate a row even if someone added a button.
 */
export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; currency?: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_ANALYTICS);

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const currency = params.currency as CurrencyType | undefined;

  const where = currency ? { currency } : {};

  const [items, total] = await Promise.all([
    prisma.currencyTransaction.findMany({
      where,
      include: {
        user: { select: { email: true, profile: { select: { displayName: true } } } },
        createdBy: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.currencyTransaction.count({ where }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transaction ledger</h1>
        <p className="text-sm text-muted-foreground">
          {formatNumber(total)} immutable entries. Append-only — nothing here can be edited.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" aria-hidden />}
          title="No transactions yet"
          message="The ledger fills up as players earn and spend."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Before → after</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {items.map((transaction) => {
                const isCredit = transaction.direction === 'CREDIT';

                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(transaction.createdAt)}
                    </TableCell>

                    <TableCell>
                      <p className="text-sm font-medium">
                        {transaction.user.profile?.displayName ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">{transaction.user.email}</p>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          transaction.category === 'ADMIN_ADJUSTMENT' ? 'warning' : 'outline'
                        }
                      >
                        {transaction.category.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>

                    <TableCell className="max-w-xs truncate text-sm">
                      {transaction.description}
                    </TableCell>

                    <TableCell
                      className={`text-right font-bold tabular-nums ${
                        isCredit
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isCredit ? '+' : '−'}
                      {formatNumber(transaction.amount)}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        {transaction.currency === 'REWARD_POINTS'
                          ? 'pts'
                          : transaction.currency.toLowerCase()}
                      </span>
                    </TableCell>

                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {formatNumber(transaction.balanceBefore)} →{' '}
                      {formatNumber(transaction.balanceAfter)}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {transaction.createdBy?.email ?? 'system'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Card>
            <CardContent className="flex items-center justify-between p-4 text-sm">
              <span className="text-muted-foreground">
                Page {page} of {Math.ceil(total / PAGE_SIZE)}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <a
                    href={`/admin/transactions?page=${page - 1}`}
                    className="rounded-lg border px-3 py-1.5 font-semibold hover:bg-secondary"
                  >
                    Previous
                  </a>
                ) : null}
                {page < Math.ceil(total / PAGE_SIZE) ? (
                  <a
                    href={`/admin/transactions?page=${page + 1}`}
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
