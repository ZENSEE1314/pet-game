import { PermissionKey } from '@prisma/client';
import {
  Users,
  UserPlus,
  Activity,
  Gamepad2,
  Coins,
  Sparkles,
  Gift,
  Clock,
  PackageX,
  ShieldAlert,
  Ban,
} from 'lucide-react';

import { requirePermission } from '@/lib/rbac';
import {
  getDashboardStats,
  getAnalytics,
  getEconomySnapshot,
} from '@/services/admin/analytics.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminCharts } from './AdminCharts';
import { formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  await requirePermission(PermissionKey.VIEW_ANALYTICS);

  const [stats, analytics, economy] = await Promise.all([
    getDashboardStats(),
    getAnalytics(14),
    getEconomySnapshot(),
  ]);

  const cards = [
    { label: 'Total users', value: stats.totalUsers, icon: Users },
    { label: 'Daily active', value: stats.dailyActiveUsers, icon: Activity },
    { label: 'New today', value: stats.newUsersToday, icon: UserPlus },
    { label: 'Games today', value: stats.gamesPlayedToday, icon: Gamepad2 },
    { label: 'Coins issued today', value: stats.coinsIssuedToday, icon: Coins },
    { label: 'Points issued today', value: stats.pointsIssuedToday, icon: Sparkles },
    { label: 'Rewards redeemed today', value: stats.rewardsRedeemedToday, icon: Gift },
    { label: 'Pending claims', value: stats.pendingClaims, icon: Clock, alert: stats.pendingClaims > 0 },
    {
      label: 'Low-stock rewards',
      value: stats.lowStockRewards,
      icon: PackageX,
      alert: stats.lowStockRewards > 0,
    },
    {
      label: 'Open fraud alerts',
      value: stats.openFraudAlerts,
      icon: ShieldAlert,
      alert: stats.openFraudAlerts > 0,
    },
    { label: 'Suspended users', value: stats.suspendedUsers, icon: Ban },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Every figure below is derived from the ledger, not from a cached counter.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card
            key={card.label}
            className={card.alert ? 'border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20' : undefined}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  card.alert
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                <card.icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold tabular-nums">{formatNumber(card.value)}</p>
                <p className="truncate text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Economy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {economy.map((row) => (
              <div key={row.currency} className="rounded-xl border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {row.currency.replace('_', ' ')}
                </p>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Issued</dt>
                    <dd className="font-semibold tabular-nums">{formatNumber(row.issued)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Spent</dt>
                    <dd className="font-semibold tabular-nums">{formatNumber(row.spent)}</dd>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <dt className="font-medium">In circulation</dt>
                    <dd className="font-bold tabular-nums">{formatNumber(row.circulating)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AdminCharts analytics={analytics} />
    </div>
  );
}
