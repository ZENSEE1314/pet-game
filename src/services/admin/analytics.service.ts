import {
  CurrencyType,
  TransactionDirection,
  ClaimStatus,
  FraudAlertStatus,
  AccountStatus,
} from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * Admin analytics.
 *
 * All figures are derived from the ledger and the session tables — never from a
 * counter someone remembered to increment. If a number here is wrong, the ledger is
 * wrong, and that is a much louder problem than a stale dashboard.
 */

const LOW_STOCK_THRESHOLD = 5;

export interface DashboardStats {
  totalUsers: number;
  dailyActiveUsers: number;
  newUsersToday: number;
  gamesPlayedToday: number;
  coinsIssuedToday: number;
  pointsIssuedToday: number;
  rewardsRedeemedToday: number;
  pendingClaims: number;
  lowStockRewards: number;
  openFraudAlerts: number;
  suspendedUsers: number;
}

function startOfToday(): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = startOfToday();

  const [
    totalUsers,
    dailyActiveUsers,
    newUsersToday,
    gamesPlayedToday,
    coinsIssued,
    pointsIssued,
    rewardsRedeemedToday,
    pendingClaims,
    lowStockRewards,
    openFraudAlerts,
    suspendedUsers,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { lastLoginAt: { gte: today }, deletedAt: null } }),
    prisma.user.count({ where: { createdAt: { gte: today }, deletedAt: null } }),
    prisma.gameSession.count({ where: { createdAt: { gte: today }, status: 'COMPLETED' } }),
    prisma.currencyTransaction.aggregate({
      where: {
        currency: CurrencyType.COINS,
        direction: TransactionDirection.CREDIT,
        createdAt: { gte: today },
      },
      _sum: { amount: true },
    }),
    prisma.currencyTransaction.aggregate({
      where: {
        currency: CurrencyType.REWARD_POINTS,
        direction: TransactionDirection.CREDIT,
        createdAt: { gte: today },
      },
      _sum: { amount: true },
    }),
    prisma.rewardClaim.count({ where: { createdAt: { gte: today } } }),
    prisma.rewardClaim.count({
      where: { status: { in: [ClaimStatus.PENDING, ClaimStatus.RESERVED, ClaimStatus.READY] } },
    }),
    prisma.reward.count({
      where: { isActive: true, deletedAt: null, stockAvailable: { lte: LOW_STOCK_THRESHOLD } },
    }),
    prisma.fraudAlert.count({ where: { status: FraudAlertStatus.OPEN } }),
    prisma.user.count({ where: { status: AccountStatus.SUSPENDED } }),
  ]);

  return {
    totalUsers,
    dailyActiveUsers,
    newUsersToday,
    gamesPlayedToday,
    coinsIssuedToday: coinsIssued._sum.amount ?? 0,
    pointsIssuedToday: pointsIssued._sum.amount ?? 0,
    rewardsRedeemedToday,
    pendingClaims,
    lowStockRewards,
    openFraudAlerts,
    suspendedUsers,
  };
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

/**
 * Daily series over the last N days. Buckets are built in JS rather than with
 * `date_trunc` so that days with zero activity still appear — a chart with holes in
 * it is a chart that lies about the shape of the trend.
 */
async function dailySeries(
  days: number,
  fetch: (from: Date, to: Date) => Promise<{ createdAt: Date; amount?: number }[]>,
  sum = false,
): Promise<TimeSeriesPoint[]> {
  const to = new Date();
  to.setUTCHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  from.setUTCHours(0, 0, 0, 0);

  const rows = await fetch(from, to);

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i += 1) {
    const date = new Date(from);
    date.setUTCDate(date.getUTCDate() + i);
    buckets.set(date.toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + (sum ? (row.amount ?? 0) : 1));
  }

  return [...buckets.entries()].map(([date, value]) => ({ date, value }));
}

export async function getAnalytics(days = 14) {
  const [registrations, gameSessions, pointIssuance, coinIssuance, redemptions] = await Promise.all([
    dailySeries(days, (from, to) =>
      prisma.user.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { createdAt: true },
      }),
    ),
    dailySeries(days, (from, to) =>
      prisma.gameSession.findMany({
        where: { createdAt: { gte: from, lte: to }, status: 'COMPLETED' },
        select: { createdAt: true },
      }),
    ),
    dailySeries(
      days,
      (from, to) =>
        prisma.currencyTransaction.findMany({
          where: {
            currency: CurrencyType.REWARD_POINTS,
            direction: TransactionDirection.CREDIT,
            createdAt: { gte: from, lte: to },
          },
          select: { createdAt: true, amount: true },
        }),
      true,
    ),
    dailySeries(
      days,
      (from, to) =>
        prisma.currencyTransaction.findMany({
          where: {
            currency: CurrencyType.COINS,
            direction: TransactionDirection.CREDIT,
            createdAt: { gte: from, lte: to },
          },
          select: { createdAt: true, amount: true },
        }),
      true,
    ),
    dailySeries(days, (from, to) =>
      prisma.rewardClaim.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { createdAt: true },
      }),
    ),
  ]);

  const [popularGames, popularRewards] = await Promise.all([
    prisma.gameSession.groupBy({
      by: ['gameId'],
      where: { status: 'COMPLETED' },
      _count: true,
      orderBy: { _count: { gameId: 'desc' } },
      take: 5,
    }),
    prisma.rewardClaim.groupBy({
      by: ['rewardId'],
      _count: true,
      orderBy: { _count: { rewardId: 'desc' } },
      take: 5,
    }),
  ]);

  const [games, rewards] = await Promise.all([
    prisma.game.findMany({
      where: { id: { in: popularGames.map((g) => g.gameId) } },
      select: { id: true, name: true },
    }),
    prisma.reward.findMany({
      where: { id: { in: popularRewards.map((r) => r.rewardId) } },
      select: { id: true, name: true },
    }),
  ]);

  const gameNames = new Map(games.map((g) => [g.id, g.name]));
  const rewardNames = new Map(rewards.map((r) => [r.id, r.name]));

  return {
    registrations,
    gameSessions,
    pointIssuance,
    coinIssuance,
    redemptions,
    popularGames: popularGames.map((row) => ({
      name: gameNames.get(row.gameId) ?? 'Unknown',
      plays: row._count,
    })),
    popularRewards: popularRewards.map((row) => ({
      name: rewardNames.get(row.rewardId) ?? 'Unknown',
      claims: row._count,
    })),
  };
}

/** The economy at a glance: what's been minted vs. what's been burned. */
export async function getEconomySnapshot() {
  const [issued, spent, circulating] = await Promise.all([
    prisma.currencyTransaction.groupBy({
      by: ['currency'],
      where: { direction: TransactionDirection.CREDIT },
      _sum: { amount: true },
    }),
    prisma.currencyTransaction.groupBy({
      by: ['currency'],
      where: { direction: TransactionDirection.DEBIT },
      _sum: { amount: true },
    }),
    prisma.currencyBalance.groupBy({
      by: ['currency'],
      _sum: { balance: true },
    }),
  ]);

  const toMap = (rows: { currency: CurrencyType; _sum: { amount?: number | null; balance?: number | null } }[]) =>
    new Map(rows.map((row) => [row.currency, row._sum.amount ?? row._sum.balance ?? 0]));

  const issuedMap = toMap(issued);
  const spentMap = toMap(spent);
  const circulatingMap = toMap(circulating);

  return (['COINS', 'REWARD_POINTS', 'GEMS'] as CurrencyType[]).map((currency) => ({
    currency,
    issued: issuedMap.get(currency) ?? 0,
    spent: spentMap.get(currency) ?? 0,
    circulating: circulatingMap.get(currency) ?? 0,
  }));
}
