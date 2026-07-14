import { ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import type { CurrencyType } from '@prisma/client';

import { requireUser } from '@/lib/rbac';
import { getBalances, getTransactionHistory } from '@/services/currency/transaction.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { CurrencyPills } from '@/components/layout/CurrencyPills';
import { REWARD_POINT_CAPS } from '@/lib/game-config';
import { formatNumber, formatDateTime, cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const CURRENCY_LABEL: Record<CurrencyType, string> = {
  COINS: 'coins',
  REWARD_POINTS: 'reward points',
  GEMS: 'gems',
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const { page } = await searchParams;

  const [balances, history] = await Promise.all([
    getBalances(user.id),
    getTransactionHistory(user.id, { page: Number(page ?? 1), pageSize: 25 }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Point history</h1>
        <p className="text-sm text-muted-foreground">
          Every coin, point and gem you&apos;ve ever earned or spent.
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <CurrencyPills balances={balances} />
        </CardContent>
      </Card>

      <Card className="border-purple-200 bg-purple-50/50 dark:border-purple-900/50 dark:bg-purple-950/20">
        <CardContent className="p-4 text-sm">
          <p className="font-semibold">Reward point earning limits</p>
          <p className="mt-1 text-muted-foreground">
            You can earn up to <strong>{REWARD_POINT_CAPS.daily}</strong> reward points per day and{' '}
            <strong>{formatNumber(REWARD_POINT_CAPS.monthly)}</strong> per month. Coins and gems are
            not capped.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" aria-hidden />
            Transactions
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {history.items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No transactions yet"
                message="Care for your pet or play a game to earn your first coins."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {history.items.map((transaction) => {
                const isCredit = transaction.direction === 'CREDIT';

                return (
                  <li key={transaction.id} className="flex items-center gap-3 px-5 py-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        isCredit
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
                      )}
                    >
                      {isCredit ? (
                        <ArrowUpRight className="h-4 w-4" aria-hidden />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" aria-hidden />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(transaction.createdAt)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={cn(
                          'font-bold tabular-nums',
                          isCredit
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400',
                        )}
                      >
                        {isCredit ? '+' : '−'}
                        {formatNumber(transaction.amount)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {CURRENCY_LABEL[transaction.currency]}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {history.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Badge variant="outline">
            Page {history.page} of {history.totalPages}
          </Badge>
        </div>
      ) : null}
    </div>
  );
}
