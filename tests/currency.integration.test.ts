import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient, CurrencyType, TransactionDirection, TransactionCategory } from '@prisma/client';
import { recordTransaction, InsufficientFundsError } from '@/services/currency/transaction.service';

/**
 * Integration tests for the ledger — the single most important code in the project.
 *
 * These need a real Postgres, because the invariants under test (idempotency via a
 * unique index, lost-update prevention via a conditional write) are enforced BY the
 * database. A mocked Prisma would happily let a double-spend through and report
 * green, which is worse than no test at all.
 *
 * Run with: RUN_DB_TESTS=1 npm test
 * They are skipped by default so `npm test` stays green on a machine with no DB.
 */

const shouldRun = process.env.RUN_DB_TESTS === '1';
const prisma = new PrismaClient();

describe.skipIf(!shouldRun)('currency ledger (integration)', () => {
  let userId: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `ledger-test-${Date.now()}-${Math.random()}@test.local`,
        name: 'Ledger Test',
        profile: {
          create: {
            username: `ledger${Date.now()}${Math.floor(Math.random() * 1000)}`,
            displayName: 'Ledger Test',
            referralCode: `PET${Date.now().toString(36).toUpperCase().slice(-6)}`,
            timezone: 'UTC',
          },
        },
      },
    });
    userId = user.id;
  });

  it('should credit a balance and record the before and after', async () => {
    const result = await prisma.$transaction((tx) =>
      recordTransaction(tx, {
        userId,
        currency: CurrencyType.COINS,
        direction: TransactionDirection.CREDIT,
        amount: 100,
        category: TransactionCategory.PET_CARE,
        description: 'Test credit',
        idempotencyKey: `test-credit-${userId}`,
      }),
    );

    expect(result.balanceAfter).toBe(100);
    expect(result.transaction.balanceBefore).toBe(0);
    expect(result.transaction.balanceAfter).toBe(100);
    expect(result.wasIdempotentReplay).toBe(false);
  });

  it('should return the original transaction when the idempotency key is reused', async () => {
    const key = `test-idem-${userId}`;

    const input = {
      userId,
      currency: CurrencyType.COINS,
      direction: TransactionDirection.CREDIT,
      amount: 50,
      category: TransactionCategory.GAME_REWARD,
      description: 'Test',
      idempotencyKey: key,
    } as const;

    const first = await prisma.$transaction((tx) => recordTransaction(tx, input));
    const second = await prisma.$transaction((tx) => recordTransaction(tx, input));

    // The second call must move no money and hand back the first result. This is what
    // makes a double-clicked Claim button, or a retried request, harmless.
    expect(second.wasIdempotentReplay).toBe(true);
    expect(second.transaction.id).toBe(first.transaction.id);

    const balance = await prisma.currencyBalance.findUniqueOrThrow({
      where: { userId_currency: { userId, currency: CurrencyType.COINS } },
    });
    expect(balance.balance).toBe(50);
  });

  it('should refuse a debit that would take the balance negative', async () => {
    await expect(
      prisma.$transaction((tx) =>
        recordTransaction(tx, {
          userId,
          currency: CurrencyType.REWARD_POINTS,
          direction: TransactionDirection.DEBIT,
          amount: 999,
          category: TransactionCategory.REWARD_REDEMPTION,
          description: 'Overdraft attempt',
          idempotencyKey: `test-overdraft-${userId}`,
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    const balance = await prisma.currencyBalance.findUnique({
      where: { userId_currency: { userId, currency: CurrencyType.REWARD_POINTS } },
    });
    expect(balance?.balance ?? 0).toBe(0);
  });

  it('should cap reward-point credits at the daily limit', async () => {
    // The cap lives inside the ledger service, so no feature — present or future —
    // can grant unlimited reward points by forgetting to check it.
    const result = await prisma.$transaction((tx) =>
      recordTransaction(tx, {
        userId,
        currency: CurrencyType.REWARD_POINTS,
        direction: TransactionDirection.CREDIT,
        amount: 100_000,
        category: TransactionCategory.GAME_REWARD,
        description: 'Absurd point grant',
        idempotencyKey: `test-cap-${userId}`,
      }),
    );

    expect(result.transaction.amount).toBeLessThan(100_000);
    expect(result.cappedAmount).toBeGreaterThan(0);
  });

  it('should NOT cap an admin adjustment', async () => {
    // An admin correcting a bug must not be silently clipped by a cap meant for players.
    const result = await prisma.$transaction((tx) =>
      recordTransaction(tx, {
        userId,
        currency: CurrencyType.REWARD_POINTS,
        direction: TransactionDirection.CREDIT,
        amount: 5_000,
        category: TransactionCategory.ADMIN_ADJUSTMENT,
        description: 'Compensating a bug',
        idempotencyKey: `test-admin-${userId}`,
      }),
    );

    expect(result.transaction.amount).toBe(5_000);
    expect(result.cappedAmount).toBeUndefined();
  });

  it('should keep exactly one transaction when the same key races itself', async () => {
    const key = `test-race-${userId}`;

    const attempt = () =>
      prisma
        .$transaction((tx) =>
          recordTransaction(tx, {
            userId,
            currency: CurrencyType.COINS,
            direction: TransactionDirection.CREDIT,
            amount: 25,
            category: TransactionCategory.MISSION_REWARD,
            description: 'Race',
            idempotencyKey: key,
          }),
        )
        .catch(() => null); // one of the racers may lose on the unique index — that's the point

    await Promise.all([attempt(), attempt(), attempt(), attempt(), attempt()]);

    const transactions = await prisma.currencyTransaction.findMany({
      where: { idempotencyKey: key },
    });
    expect(transactions).toHaveLength(1);

    const balance = await prisma.currencyBalance.findUniqueOrThrow({
      where: { userId_currency: { userId, currency: CurrencyType.COINS } },
    });
    expect(balance.balance).toBe(25);
  });

  it('should reject a negative amount', async () => {
    await expect(
      prisma.$transaction((tx) =>
        recordTransaction(tx, {
          userId,
          currency: CurrencyType.COINS,
          direction: TransactionDirection.CREDIT,
          amount: -100,
          category: TransactionCategory.PET_CARE,
          description: 'Negative',
          idempotencyKey: `test-negative-${userId}`,
        }),
      ),
    ).rejects.toThrow();
  });
});
