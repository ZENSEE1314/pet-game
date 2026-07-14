import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Interactive-transaction budget, applied client-wide.
 *
 * Prisma's default is 5 seconds, which is generous against a Postgres on localhost
 * and nowhere near enough against a managed Postgres in another region. Several of
 * our transactions are deliberately multi-step — registration alone writes a user, a
 * profile, three balance rows, two ledger entries and a verification token, and every
 * one of those is a round trip — so a 5s budget fails on a slow link and rolls back
 * work that was perfectly correct.
 *
 * Setting it here rather than at each `$transaction` call site means a new service
 * cannot forget it. It is not a licence to do unbounded work inside a transaction:
 * the work in each one is bounded and deliberate, and this budget only has to cover
 * the network, not hide a slow query.
 *
 * Individual call sites still override `isolationLevel` where they need Serializable
 * (redemption, purchases, promo codes) — passing options there replaces this default
 * for that call, so those sites pass `timeout` explicitly too.
 */
export const TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    transactionOptions: TX_OPTIONS,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * The transaction-scoped client type. Every service function that can be part of a
 * larger atomic operation takes this rather than the global client, so callers can
 * compose (e.g. "debit the points AND create the claim" is one transaction).
 */
export type TxClient = Prisma.TransactionClient;
export type DbClient = PrismaClient | TxClient;

/** Postgres 40001 (serialization failure) / 40P01 (deadlock), as surfaced by Prisma. */
const WRITE_CONFLICT = 'P2034';

const MAX_SERIALIZABLE_ATTEMPTS = 3;

/**
 * Run a transaction at SERIALIZABLE, retrying on a write conflict.
 *
 * This is not a workaround — it is the contract. Serializable isolation does not
 * prevent conflicts; it *detects* them and aborts one of the transactions, and
 * Postgres explicitly requires the client to retry. A Serializable transaction
 * without a retry loop is a transaction that fails under exactly the concurrency it
 * was chosen to protect against, which is the worst of both worlds.
 *
 * The financial paths use it — redemption, purchases, promo codes — because the
 * alternative (a weaker isolation level) trades a rare retry for a rare double-spend,
 * and a retry is cheap while a double-spend is a refund and an apology.
 *
 * Retrying is safe precisely because the ledger is idempotent: a transaction that
 * aborted wrote nothing, and one that partially succeeded cannot exist. On the retry,
 * any `recordTransaction` whose key already landed returns the existing row rather
 * than minting a second one.
 */
export async function runSerializable<T>(
  work: (tx: TxClient) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        ...TX_OPTIONS,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const isWriteConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === WRITE_CONFLICT;

      // Anything that isn't a conflict — insufficient funds, out of stock, a bad
      // request — is a real answer and must surface immediately. Retrying an
      // InsufficientFundsError three times just makes the player wait longer to be
      // told no.
      if (!isWriteConflict) throw error;

      lastError = error;

      // Exponential backoff with jitter, so two conflicting requests don't retry in
      // lockstep and collide again on the same tick.
      if (attempt < MAX_SERIALIZABLE_ATTEMPTS) {
        const backoffMs = 25 * 2 ** (attempt - 1) + Math.random() * 25;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError;
}

export { Prisma };
