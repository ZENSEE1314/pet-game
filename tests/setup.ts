/**
 * Test environment.
 *
 * These are fake secrets for the pure-logic tests — real ones are never in the repo.
 * `src/lib/env.ts` validates at import time, so they must exist before any module
 * under test is loaded.
 */
// NODE_ENV is declared read-only by @types/node. Vitest already sets it to 'test',
// so there is nothing to do here — this comment stands in for the assignment that
// TypeScript (correctly) refuses to let us make.
process.env.DATABASE_URL ??= 'postgresql://petquest:petquest@localhost:5432/petquest_test';
process.env.AUTH_SECRET ??= 'test-auth-secret-at-least-16-chars-long';
process.env.GAME_SESSION_SECRET ??= 'test-game-session-secret-at-least-16-chars';
process.env.QR_TOKEN_SECRET ??= 'test-qr-token-secret-at-least-16-chars-long';
process.env.DEFAULT_TIMEZONE ??= 'Asia/Kuala_Lumpur';
// Redis is deliberately unset: every test must pass against the Postgres-only path.
delete process.env.REDIS_URL;
