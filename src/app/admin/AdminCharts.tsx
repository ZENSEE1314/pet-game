'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';

interface Point {
  date: string;
  value: number;
}

interface Analytics {
  registrations: Point[];
  gameSessions: Point[];
  pointIssuance: Point[];
  coinIssuance: Point[];
  redemptions: Point[];
  popularGames: { name: string; plays: number }[];
  popularRewards: { name: string; claims: number }[];
}

/**
 * A brand-neutral, colour-blind-safe palette. Series are also distinguishable by
 * position and label, so colour is never the only channel carrying meaning.
 */
const COLOURS = {
  primary: '#8b5cf6',
  accent: '#14b8a6',
  amber: '#f59e0b',
  rose: '#f43f5e',
} as const;

function shortDate(value: string) {
  return value.slice(5); // "2026-07-14" → "07-14"
}

export function AdminCharts({ analytics }: { analytics: Analytics }) {
  // Merge the series into one dataset so the tooltip shows every metric for a given
  // day at once — reading four separate charts to answer "what happened on Tuesday?"
  // is not analytics, it's homework.
  const combined = analytics.registrations.map((row, index) => ({
    date: shortDate(row.date),
    registrations: row.value,
    games: analytics.gameSessions[index]?.value ?? 0,
    points: analytics.pointIssuance[index]?.value ?? 0,
    coins: analytics.coinIssuance[index]?.value ?? 0,
    redemptions: analytics.redemptions[index]?.value ?? 0,
  }));

  const hasActivity = combined.some(
    (row) => row.registrations + row.games + row.points + row.redemptions > 0,
  );

  if (!hasActivity) {
    return (
      <EmptyState
        title="No activity in the last 14 days"
        message="Charts will populate once players start registering and playing."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Daily active — registrations & game sessions">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={combined} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="registrations"
                name="Registrations"
                stroke={COLOURS.primary}
                fill={COLOURS.primary}
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="games"
                name="Game sessions"
                stroke={COLOURS.accent}
                fill={COLOURS.accent}
                fillOpacity={0.18}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Currency issued & rewards redeemed">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={combined} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="coins"
                name="Coins issued"
                stroke={COLOURS.amber}
                fill={COLOURS.amber}
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="points"
                name="Points issued"
                stroke={COLOURS.primary}
                fill={COLOURS.primary}
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="redemptions"
                name="Redemptions"
                stroke={COLOURS.rose}
                fill={COLOURS.rose}
                fillOpacity={0.18}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Most played games">
          {analytics.popularGames.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No games played yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.popularGames} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} horizontal={false} />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  fontSize={11}
                  width={110}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="plays" name="Plays" fill={COLOURS.accent} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Most claimed rewards">
          {analytics.popularRewards.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No rewards claimed yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.popularRewards} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} horizontal={false} />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  fontSize={11}
                  width={110}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="claims" name="Claims" fill={COLOURS.primary} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pl-0">{children}</CardContent>
    </Card>
  );
}
