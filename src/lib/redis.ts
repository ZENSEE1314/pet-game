import Redis from 'ioredis';
import { env } from './env';

/**
 * Redis is a cache and a speed layer, never a source of truth.
 *
 * Every caller must behave correctly when this returns null (unconfigured) or
 * when a command throws (Redis is down). Cooldowns, for instance, are checked
 * against Redis *and* against DB timestamps — a flushed Redis must not hand out
 * free cooldown resets.
 */
const globalForRedis = globalThis as unknown as { redis?: Redis | null };

function createClient(): Redis | null {
  if (!env.REDIS_URL) return null;

  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
  });

  // Without a handler, a connection error becomes an unhandled 'error' event and
  // takes the whole Node process down. Degrading is the correct behaviour here.
  client.on('error', (error) => {
    console.warn('[redis] connection error, falling back to Postgres:', error.message);
  });

  client.connect().catch(() => {
    /* handled by the 'error' listener above */
  });

  return client;
}

export const redis: Redis | null = globalForRedis.redis ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

/** Run a Redis command, returning `fallback` if Redis is absent or unhealthy. */
export async function safeRedis<T>(
  operation: (client: Redis) => Promise<T>,
  fallback: T,
): Promise<T> {
  if (!redis || redis.status !== 'ready') return fallback;
  try {
    return await operation(redis);
  } catch (error) {
    console.warn('[redis] command failed, using fallback:', (error as Error).message);
    return fallback;
  }
}

export const redisKeys = {
  cooldown: (userId: string, action: string) => `cd:${userId}:${action}`,
  rateLimit: (bucket: string, identifier: string) => `rl:${bucket}:${identifier}`,
  leaderboard: (leaderboardId: string) => `lb:${leaderboardId}`,
  leaderboardStale: (leaderboardId: string) => `lb:${leaderboardId}:built`,
} as const;
