import {
  CurrencyType,
  TransactionDirection,
  TransactionCategory,
  Prisma,
  type CurrencyTransaction,
} from '@prisma/client';

import { prisma, type TxClient, runSerializable } from '@/lib/db';
import { AppError } from '@/lib/api';
import { REWARD_POINT_CAPS } from '@/lib/game-config';
import { dayBounds, monthBounds } from '@/lib/utils';
import { env } from '@/lib/env';

/**
 * THE ledger service.
 *
 * Every coin, point and gem in PetQuest moves through `recordTransaction`. No
 * other module in the codebase is permitted to write `currencyBalance` — the
 * balance table is a cached projection of `currency_transactions`, and it is only
 * ever written here, inside a database transaction, alongside the ledger row that
 * explains the change.
 *
 * If you are adding a feature that gives a player something, you call this. If you
 * find yourself reaching for `prisma.currencyBalance.update`, stop.
 */

export interface RecordTransactionInput {
  userId: string;
  currency: CurrencyType;
  direction: TransactionDirection;
  /** Always positive. The direction, not the sign, decides which way money moves. */
  amount: number;
  category: TransactionCategory;
  description: string;
  referenceType?: string;
  referenceId?: string;
  /**
   * The double-spend guard. Two calls with the same key produce one ledger row;
   * the second returns the first one's result. Derive it from something stable
   * and unique to the intent — `mission-claim:<userMissionId>`, not a random UUID.
   */
  idempotencyKey: string;
  /** Admin/staff performing the action, when it isn't the player themselves. */
  actorId?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface TransactionResult {
  transaction: CurrencyTransaction;
  balanceAfter: number;
  /** True when the caller hit an existing idempotency key: nothing moved. */
  wasIdempotentReplay: boolean;
  /** Set when a REWARD_POINTS credit was clipped by the daily/monthly cap. */
  cappedAmount?: number;
}

export class InsufficientFundsError extends AppError {
  constructor(currency: CurrencyType, required: number, available: number) {
    super(
      'INSUFFICIENT_FUNDS',
      `Not enough ${currency.toLowerCase().replace('_', ' ')}. Need ${required}, have ${available}.`,
      { currency, required, available },
    );
  }
}

/**
 * Categories that are allowed to *create* reward points. A gem or coin balance can
 * never become reward points — see decision D7 in PROJECT_PLAN.md. If it could,
 * gems (a premium currency we intend to sell one day) would become a direct
 * purchase path into real-world rewards, which is a different and heavily
 * regulated kind of business.
 */
const GEM_TO_POINTS_BLOCKED_CATEGORIES: TransactionCategory[] = [];

export async function recordTransaction(
  tx: TxClient,
  input: RecordTransactionInput,
): Promise<TransactionResult> {
  if (!Number.isInteger(input.amount) || input.amount < 0) {
    throw new AppError('VALIDATION_ERROR', 'Transaction amount must be a non-negative integer.');
  }

  // 1. Idempotency. This is what makes a double-clicked "Claim" button harmless.
  const existing = await tx.currencyTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });

  if (existing) {
    return {
      transaction: existing,
      balanceAfter: existing.balanceAfter,
      wasIdempotentReplay: true,
    };
  }

  // 2. Gems must never become reward points.
  if (
    input.currency === CurrencyType.REWARD_POINTS &&
    GEM_TO_POINTS_BLOCKED_CATEGORIES.includes(input.category)
  ) {
    throw new AppError('FORBIDDEN', 'Gems cannot be converted into reward points.');
  }

  // 3. Load or create the balance row.
  const balance = await tx.currencyBalance.upsert({
    where: { userId_currency: { userId: input.userId, currency: input.currency } },
    create: { userId: input.userId, currency: input.currency, balance: 0 },
    update: {},
  });

  let amount = input.amount;
  let cappedAmount: number | undefined;

  // 4. Reward-point earning caps, enforced here so no future feature can dodge them.
  if (input.currency === CurrencyType.REWARD_POINTS && input.direction === 'CREDIT') {
    // Admin adjustments deliberately bypass the cap — an admin correcting a bug
    // should not be silently clipped, and the action is audit-logged anyway.
    if (input.category !== TransactionCategory.ADMIN_ADJUSTMENT) {
      const headroom = await getRewardPointHeadroom(tx, input.userId);
      if (amount > headroom) {
        cappedAmount = amount - headroom;
        amount = headroom;
      }
    }
  }

  if (amount === 0) {
    // Fully capped out. Record nothing, but tell the caller so it can notify.
    const noop = await tx.currencyTransaction.create({
      data: {
        userId: input.userId,
        currency: input.currency,
        direction: input.direction,
        amount: 0,
        category: input.category,
        description: `${input.description} (capped: no headroom remaining)`,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        balanceBefore: balance.balance,
        balanceAfter: balance.balance,
        idempotencyKey: input.idempotencyKey,
        createdById: input.actorId,
        metadata: input.metadata,
      },
    });
    return {
      transaction: noop,
      balanceAfter: balance.balance,
      wasIdempotentReplay: false,
      cappedAmount,
    };
  }

  // 5. Never allow a negative balance.
  const isDebit = input.direction === TransactionDirection.DEBIT;
  if (isDebit && balance.balance < amount) {
    throw new InsufficientFundsError(input.currency, amount, balance.balance);
  }

  const balanceBefore = balance.balance;
  const balanceAfter = isDebit ? balanceBefore - amount : balanceBefore + amount;

  // 6. Append the immutable ledger row. The unique index on idempotencyKey means a
  //    concurrent duplicate loses here with P2002 rather than double-spending.
  const transaction = await tx.currencyTransaction.create({
    data: {
      userId: input.userId,
      currency: input.currency,
      direction: input.direction,
      amount,
      category: input.category,
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      balanceBefore,
      balanceAfter,
      idempotencyKey: input.idempotencyKey,
      createdById: input.actorId,
      metadata: input.metadata,
    },
  });

  // 7. Update the projection. The conditional `where` makes a lost update impossible:
  //    if another transaction moved the balance since we read it, this matches zero
  //    rows and we throw rather than silently clobbering their write.
  const updated = await tx.currencyBalance.updateMany({
    where: {
      userId: input.userId,
      currency: input.currency,
      balance: balanceBefore,
    },
    data: {
      balance: balanceAfter,
      lifetimeEarned: isDebit ? undefined : { increment: amount },
      lifetimeSpent: isDebit ? { increment: amount } : undefined,
    },
  });

  if (updated.count === 0) {
    throw new AppError(
      'CONFLICT',
      'Your balance changed while we were processing that. Please try again.',
    );
  }

  return { transaction, balanceAfter, wasIdempotentReplay: false, cappedAmount };
}

/** How many more reward points this user may earn right now (daily ∧ monthly). */
export async function getRewardPointHeadroom(tx: TxClient, userId: string): Promise<number> {
  const now = new Date();
  const timezone = await getUserTimezone(tx, userId);
  const day = dayBounds(now, timezone);
  const month = monthBounds(now, timezone);

  const [dailyEarned, monthlyEarned] = await Promise.all([
    sumCredits(tx, userId, day.start, day.end),
    sumCredits(tx, userId, month.start, month.end),
  ]);

  return Math.max(
    0,
    Math.min(REWARD_POINT_CAPS.daily - dailyEarned, REWARD_POINT_CAPS.monthly - monthlyEarned),
  );
}

async function sumCredits(tx: TxClient, userId: string, start: Date, end: Date): Promise<number> {
  const result = await tx.currencyTransaction.aggregate({
    where: {
      userId,
      currency: CurrencyType.REWARD_POINTS,
      direction: TransactionDirection.CREDIT,
      // Admin corrections do not consume the player's earning headroom.
      category: { not: TransactionCategory.ADMIN_ADJUSTMENT },
      createdAt: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

async function getUserTimezone(tx: TxClient, userId: string): Promise<string> {
  const profile = await tx.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return profile?.timezone ?? env.DEFAULT_TIMEZONE;
}

// --- Convenience wrappers ---------------------------------------------------

/** Credit and debit in one atomic call. Used by the item shop and redemption. */
export async function transferAtomic(
  operations: RecordTransactionInput[],
): Promise<TransactionResult[]> {
  return runSerializable(async (tx) => {
    const results: TransactionResult[] = [];
    for (const op of operations) {
      results.push(await recordTransaction(tx, op));
    }
    return results;
  });
}

export async function getBalances(userId: string): Promise<Record<CurrencyType, number>> {
  const rows = await prisma.currencyBalance.findMany({ where: { userId } });
  const balances: Record<CurrencyType, number> = {
    COINS: 0,
    REWARD_POINTS: 0,
    GEMS: 0,
  };
  for (const row of rows) balances[row.currency] = row.balance;
  return balances;
}

export async function getTransactionHistory(
  userId: string,
  options: { currency?: CurrencyType; page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));

  const where = {
    userId,
    ...(options.currency ? { currency: options.currency } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.currencyTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.currencyTransaction.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
