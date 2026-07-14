# PetQuest Rewards

A production-shaped, full-stack virtual-pet game with a **real rewards economy**:
adopt a pet, keep it alive and happy, play two Phaser mini games, complete missions,
climb leaderboards — and convert reward points into physical and digital rewards,
collected in person via a signed, single-use QR code.

> The design principle running through the whole codebase: **the client is a
> renderer; the server owns every number that can become something real.**

## Features

**Players** — email/password + Google sign-in, email verification, password reset ·
starter pet with five care actions (feed, bathe, play, sleep, medicine), cooldowns,
lazy stat decay, sickness (never death), five growth stages · two Phaser mini games
(Endless Runner, Feeding Catch) behind signed single-use game sessions · game energy
with lazy regen and a daily free refill · daily/weekly missions with automatic
progress and claim-once rewards · achievements · 7-day login streak cycle ·
daily/weekly/monthly/all-time leaderboards (validated scores only) · item shop and
inventory (coins/gems) · reward shop (reward points) with QR redemption · promo
codes · referrals paid only when the invitee reaches level 3 · notification centre ·
installable PWA.

**Staff** — mobile camera QR scanner + manual code entry · claim validation with
player and reward details · single-use collection confirmation · rejection with
reason · collection history.

**Admins** — dashboard (users, DAU, issuance, redemptions, pending claims, low
stock, fraud alerts) · Recharts analytics · economy snapshot derived from the
ledger · user management with audited, reason-required balance adjustments ·
reward/stock management with a stock ledger · claim cancellation with automatic
refund · mission and item management · per-game reward formulas and anti-cheat
thresholds, editable at runtime · fraud alert review (humans decide; nothing
auto-bans) · immutable transaction ledger view · full audit log · announcements.

**Super admins** — everything above, plus role changes (deliberately not delegable
via permissions) and per-user permission grants (e.g. giving one staff member
`ADJUST_BALANCE`).

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS +
shadcn/ui-style primitives · PostgreSQL + Prisma · Redis (ioredis) · Auth.js v5 ·
Phaser 3 · Zod · React Hook Form · TanStack Query · Recharts · qrcode +
html5-qrcode · Vitest · Playwright · Docker Compose.

## Architecture in one paragraph

Three layers, dependencies point down: **UI** (`src/app`, `src/components`) renders
and never computes a reward; **services** (`src/services`) own all business logic —
they are the only code allowed to move currency, close game sessions, or burn QR
tokens; **infrastructure** (`src/lib`) provides Prisma, Redis, auth, crypto, RBAC,
rate limiting. Balances are a cached projection of an immutable
`currency_transactions` ledger written in exactly one place, guarded by unique
idempotency keys. Pet stats and game energy are *derived from timestamps on read* —
there is no cron, and there doesn't need to be. Redis is a cache, never a source of
truth; the app runs correctly without it. Full detail: [ARCHITECTURE.md](ARCHITECTURE.md)
and [DATABASE_DESIGN.md](DATABASE_DESIGN.md).

```
src/
  app/          (public) (auth) (player) staff/ admin/ api/
  components/   ui/ layout/ pet/ game/
  features/     typed client fetchers + hooks
  lib/          env db redis auth rbac crypto rate-limit validation api utils
  services/     currency pet game mission achievement reward leaderboard
                streak promo referral user notification audit fraud admin level
prisma/         schema.prisma migrations/ seed.ts
tests/          vitest unit + DB integration
e2e/            playwright
public/         manifest, service worker, assets
```

## Getting started

Prerequisites: Node 20+, Docker (for local Postgres/Redis) or any Postgres URL.

```bash
git clone <repo> && cd petquest-rewards
npm install

cp env.example .env          # then edit secrets — see Environment below

docker compose up -d         # Postgres :5432 + Redis :6379
npm run db:migrate           # create schema
npm run db:seed              # accounts, items, rewards, missions, games
npm run dev                  # http://localhost:3000
```

Fully containerised instead: `docker compose --profile full up --build`
(the app container runs `prisma migrate deploy` on boot).

No Docker? Point `DATABASE_URL` at any Postgres (Neon, Supabase, RDS) and leave
`REDIS_URL` unset — the app degrades to its Postgres-only path automatically.

### Development accounts (seeded — development only)

| Role | Email | Password |
|---|---|---|
| Super admin | `superadmin@petquest.dev` | `SuperAdmin123!` |
| Admin | `admin@petquest.dev` | `Admin123!pass` |
| Staff | `staff@petquest.dev` | `Staff123!pass` |
| Player (has pet, balances) | `player1@petquest.dev` | `Player123!pass` |
| Player (fresh) | `player2@petquest.dev` | `Player123!pass` |

Seeded promo code: `WELCOME2026` (+250 coins).

### Environment

Copy `env.example` → `.env`. Validated at boot by `src/lib/env.ts`; the app refuses
to start if anything required is missing or too short.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `REDIS_URL` | no | Cooldown/rate-limit/leaderboard cache; app degrades without it |
| `AUTH_SECRET` | yes | Auth.js JWT signing (≥16 chars; `openssl rand -base64 32`) |
| `GAME_SESSION_SECRET` | yes | HMAC key for mini-game sessions — never client-side |
| `QR_TOKEN_SECRET` | yes | HMAC key for claim QR tokens — never client-side |
| `GOOGLE_CLIENT_ID/SECRET` | no | Google sign-in (button hides when unset) |
| `DEFAULT_TIMEZONE` | no | Fallback player timezone (daily resets, caps) |

For a managed Postgres with cold starts (e.g. Neon), append
`&connect_timeout=30&pool_timeout=30` to `DATABASE_URL`.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `RUN_DB_TESTS=1 npm test` | Also run ledger integration tests (needs Postgres) |
| `npm run test:e2e` | Playwright (needs migrated + seeded DB) |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:reset` / `db:studio` | Prisma lifecycle |

Email delivery is stubbed: verification and reset links are printed to the server
console, and returned in the API response **in development only**.

## Security model (the short version)

- **One ledger, one writer.** Every balance change goes through
  `recordTransaction()` inside a DB transaction, with a unique idempotency key
  derived from the intent (`mission-claim:<id>`, `game-coins:<sessionId>`). Retries,
  double-clicks and replays collide with the key and move nothing.
- **Games:** the server issues an HMAC-signed, single-use session; on submit it
  verifies the signature, checks ownership, enforces a duration floor, clamps the
  score to `min(maxValidScore, duration × maxScorePerSecond)`, computes rewards from
  admin-configured formulas, and closes the session with a conditional write. Every
  anomaly raises a fraud alert for a human — nothing auto-bans.
- **Redemption:** stock is reserved with a conditional decrement and points debited
  in the same Serializable transaction (with automatic retry on write conflicts, as
  Postgres requires). QR tokens are HMAC-signed *and* single-use in the DB — both
  checks are required, and both were exercised end-to-end.
- **RBAC:** role enum + grantable permissions. Staff cannot adjust balances unless a
  super admin grants `ADJUST_BALANCE` explicitly. Middleware gates pages; every
  route handler independently re-checks against the database, so a suspended user's
  JWT dies on the next request.
- **Caps:** reward-point earning is capped daily and monthly *inside the ledger
  service*, so no future feature can forget to enforce it. Gems can never convert
  to reward points. Admin adjustments bypass caps but require a reason and are
  written to the audit log atomically with the ledger row.
- Also: bcrypt(12) · enumeration-safe login/reset · rate limiting per bucket ·
  security headers · no secrets in the client bundle · money is `Int`, never float.

## Deployment guidance

1. Provision Postgres and Redis; set all env vars with real secrets (rotate the three
   HMAC/auth secrets independently).
2. `npx prisma migrate deploy` on release (never `migrate dev` in production).
3. The Dockerfile produces a standalone, non-root image; put a TLS-terminating proxy
   in front and keep `/admin` + `/staff` behind your network policy as an extra layer.
4. Watch the fraud-alerts table and the low-stock dashboard card from day one.
5. Before real users: wire an email provider into `notification.service.ts`, replace
   the placeholder terms/privacy pages with counsel-reviewed ones, and decide the
   expired-claim refund policy with your finance owner (current default: no
   auto-refund; admins can refund manually).

## Known MVP limitations

- One pet per player, one species (schema already supports many).
- Evolution requirements are stored and seeded, but automatic stage-up execution is
  not wired to gameplay yet (the check exists as data; the trigger is a next step).
- Gems exist as a currency with no purchase flow (deliberately — no payments yet).
- Email/push transports are stubbed (console); in-app notifications are complete.
- Leaderboard prize *distribution* is a manual admin action after finalise, by design.
- Clothing renders as an icon overlay near the pet, not fitted artwork.
- Announcement fan-out is synchronous; queue it when the user count justifies it.

## Roadmap

Payments for gems (Stripe) → automatic evolution + branching paths → email/push
notification transports → multiple pets & species → scheduled leaderboard finalise +
prize payout job → delivery-method fulfilment tracking → React Native client reusing
`src/features` against the same API envelope.
