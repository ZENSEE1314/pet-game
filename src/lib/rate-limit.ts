import { redis, redisKeys, safeRedis } from '@/lib/redis';
import { AppError } from '@/lib/api';

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/**
 * Tuned per bucket rather than one global limit, because the cost of abuse is
 * wildly different: hammering the leaderboard is rude, hammering game submission
 * is an attack on the economy.
 */
export const RATE_LIMITS = {
  auth: { limit: 10, windowSeconds: 300 },
  register: { limit: 5, windowSeconds: 3600 },
  passwordReset: { limit: 5, windowSeconds: 3600 },
  petCare: { limit: 60, windowSeconds: 60 },
  gameStart: { limit: 20, windowSeconds: 300 },
  gameSubmit: { limit: 20, windowSeconds: 300 },
  redemption: { limit: 10, windowSeconds: 300 },
  promoCode: { limit: 10, windowSeconds: 3600 },
  qrScan: { limit: 60, windowSeconds: 60 },
  general: { limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Fixed-window counter in Redis.
 *
 * When Redis is unavailable this fails **open** (allows the request), which is a
 * deliberate trade: a Redis outage should degrade the game, not close it. The
 * things that actually protect the economy — signed single-use game sessions,
 * idempotency keys, cooldown timestamps in Postgres — do not depend on Redis and
 * keep working regardless.
 */
export async function checkRateLimit(
  bucket: RateLimitBucket,
  identifier: string,
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[bucket];
  const key = redisKeys.rateLimit(bucket, identifier);

  return safeRedis(
    async (client) => {
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, rule.windowSeconds);
      }
      const ttl = await client.ttl(key);
      return {
        allowed: count <= rule.limit,
        remaining: Math.max(0, rule.limit - count),
        resetInSeconds: ttl > 0 ? ttl : rule.windowSeconds,
      };
    },
    { allowed: true, remaining: rule.limit, resetInSeconds: rule.windowSeconds },
  );
}

export async function enforceRateLimit(
  bucket: RateLimitBucket,
  identifier: string,
): Promise<void> {
  const result = await checkRateLimit(bucket, identifier);
  if (!result.allowed) {
    throw new AppError(
      'RATE_LIMITED',
      `Too many requests. Try again in ${result.resetInSeconds}s.`,
      { resetInSeconds: result.resetInSeconds },
    );
  }
}

/** Count of rate-limit breaches in the window — feeds the fraud detector. */
export async function getBreachCount(bucket: RateLimitBucket, identifier: string): Promise<number> {
  if (!redis) return 0;
  return safeRedis(async (client) => {
    const value = await client.get(redisKeys.rateLimit(bucket, identifier));
    return value ? Number(value) : 0;
  }, 0);
}
