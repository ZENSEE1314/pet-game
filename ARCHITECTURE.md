# PetQuest Rewards — Architecture

## 1. Shape of the system

```
┌───────────────────────────────────────────────────────────────┐
│  Browser (PWA)                                                │
│  Next.js App Router · React 19 · Tailwind · shadcn/ui         │
│  Phaser 3 canvases (client-only, dynamically imported)        │
│  TanStack Query for player-facing polling data                │
└───────────────┬───────────────────────────────────────────────┘
                │  fetch  →  /api/*   (Zod-validated, RBAC-guarded)
┌───────────────▼───────────────────────────────────────────────┐
│  Next.js server (Route Handlers + Server Components)          │
│                                                               │
│  lib/          auth · rbac · redis · rate-limit · crypto      │
│  services/     currency · pet · game · mission · reward       │
│                achievement · notification · audit · fraud     │
│                leaderboard · referral · promo                 │
└──────┬──────────────────────────────────────┬─────────────────┘
       │ Prisma                               │ ioredis
┌──────▼──────────────┐            ┌──────────▼──────────────────┐
│  PostgreSQL         │            │  Redis                      │
│  source of truth    │            │  cooldowns · rate limits    │
│  ledger · claims    │            │  leaderboard ZSETs (cache)  │
└─────────────────────┘            └─────────────────────────────┘
```

Redis is a **cache and a speed layer, never a source of truth**. If Redis is empty or down,
every read falls back to Postgres and the app still behaves correctly — just slower. Cooldowns
are double-checked against DB timestamps for the same reason: a flushed Redis must not become
a free cooldown reset.

## 2. Layering rules

There are exactly three layers and the dependency arrow only ever points down.

1. **UI** (`src/app/**`, `src/components/**`) — rendering, forms, optimistic feedback.
   It may call route handlers and server actions. It contains **no** business rules and
   **never** computes a reward.
2. **Services** (`src/services/**`) — all business logic. Pure-ish functions that take a
   Prisma client (or transaction client) and typed inputs. This is the only layer allowed
   to move currency, mutate pets, close game sessions, or burn a QR token.
3. **Infrastructure** (`src/lib/**`) — Prisma client, Redis client, auth, crypto, RBAC,
   rate limiting, env validation.

A route handler is thin on purpose: authenticate → authorise → Zod-parse → call a service →
map the result to a consistent API envelope. If a route handler starts doing arithmetic on a
balance, that arithmetic belongs in a service.

## 3. The currency ledger — the heart of the app

Balances are **not** the truth. The ledger is. `CurrencyBalance` is a cached projection that
is only ever written by `services/currency/transaction.service.ts`, inside a DB transaction,
alongside the `CurrencyTransaction` row that explains it.

Every write goes through one function:

```ts
recordTransaction(tx, {
  userId, currency, direction, amount, category,
  description, referenceType, referenceId,
  idempotencyKey, actorId, metadata,
})
```

It does, in order, inside a `Serializable` Prisma transaction:

1. Look up the `idempotencyKey`. If it exists, **return the existing transaction** — the
   caller gets the same answer it got the first time, and no money moves. This is what makes
   a double-clicked "Claim" button harmless.
2. Load (or create) the balance row for `(userId, currency)`.
3. For a DEBIT, assert `balance >= amount`. Insufficient funds throws a typed
   `InsufficientFundsError`, never a negative balance.
4. For a `REWARD_POINTS` CREDIT, check the **daily and monthly earning caps** by summing
   today's/this month's credits. Over-cap credits are clamped to the remaining headroom (and
   a `POINT_CAP_REACHED` notification fires). A cap enforced here cannot be bypassed by adding
   a new feature later.
5. Refuse `GEMS → REWARD_POINTS` conversions outright (decision D7).
6. Write the immutable `CurrencyTransaction` with `balanceBefore` / `balanceAfter`.
7. Write the new balance.

Nothing else in the codebase is allowed to `prisma.currencyBalance.update(...)`. That is the
single most important invariant in the project.

## 4. Trust boundary for mini games

The client is assumed to be a cheater with a debugger open.

```
POST /api/games/session          (server)
  ├─ check energy, daily attempts, suspension
  ├─ spend 1 energy + 1 attempt  (recorded, not trusted)
  ├─ create GameSession { nonce, startedAt, status: ACTIVE }
  └─ return { sessionId, signature = HMAC(secret, sessionId|userId|gameId|nonce|startedAt) }

        ... client plays; the client's score is a *claim*, not a fact ...

POST /api/games/submit           (server)
  ├─ verify HMAC signature                → forged session?      reject
  ├─ session exists, ACTIVE, owned by me  → replay?              reject + FraudAlert
  ├─ elapsed >= game.minDurationSeconds   → too fast?            reject + FraudAlert
  ├─ score <= game.maxValidScore          → impossible?          clamp + FraudAlert
  ├─ score plausible vs. duration & events→ anomalous?           FraudAlert (review, not ban)
  ├─ reward = f(score) per GameConfiguration, capped by dailyRewardCap
  ├─ close session (status: COMPLETED)    ← single-use guard
  ├─ recordTransaction(coins), recordTransaction(points)
  ├─ update mission progress, achievements, XP, leaderboard
  └─ return the *server's* numbers, which the client then displays
```

The reward formula lives in `GameConfiguration` (admin-editable), never in the bundle.
`coins = floor(score * coinsPerPoint)`, `points = floor(score / pointsPerScoreUnit)`, both
capped. The client never sends a coin or point amount, only a score and an event summary.

## 5. Reward redemption & QR

```
Redeem  →  [ DB transaction ]
             ├─ reward active? within window? stock > 0?
             ├─ per-user + daily claim limits not exceeded?
             ├─ conditional decrement of stockAvailable  (no oversell)
             ├─ recordTransaction(REWARD_POINTS, DEBIT, idempotencyKey)
             ├─ create RewardClaim { claimCode, status: RESERVED, expiresAt }
             └─ qrToken = HMAC(QR_TOKEN_SECRET, claimId|claimCode|userId|rewardId|expiresAt)
```

The QR encodes `claimId.payload.signature`. Staff scan → the server verifies the signature
(authenticity), then verifies the DB row (freshness + single use). **Both** checks are
required: the signature alone would let a screenshotted QR be reused; the DB row alone would
let someone brute-force claim codes. Collection is a conditional write on
`status IN (RESERVED, READY)`, so two staff scanning the same code at the same moment produce
exactly one collection and one clear error.

## 6. Pet stat decay (lazy, timestamp-derived)

`services/pet/decay.ts` exports `applyDecay(pet, now)`, a pure function. Every read of a pet
runs it, persists the result if it changed, and returns the decayed pet. Rates are per-hour
and configured per species:

- hunger −4/h, cleanliness −3/h, happiness −2/h, energy +5/h while sleeping else −1/h
- health only drops (−2/h) while `hunger < 20 || cleanliness < 20`; below 25 health the pet is
  `SICK`, which blocks mini games until it is medicated. **The pet never dies.**

Because it's a pure function of `(stats, elapsed)`, it is trivially unit-testable and it can't
drift from a cron that didn't run.

## 7. RBAC

`Role` is an enum on `User` (`PLAYER | STAFF | ADMIN | SUPER_ADMIN`), and `UserPermission`
grants named capabilities (e.g. `ADJUST_BALANCE`) on top. `src/lib/rbac.ts` exposes:

```ts
requireUser()                       // authenticated, not suspended
requireRole('ADMIN', 'SUPER_ADMIN') // role gate
requirePermission('ADJUST_BALANCE') // capability gate, satisfied by role default OR grant
```

`middleware.ts` gates `/admin`, `/staff` and `/player` at the edge so an unauthorised user
never even downloads the page; every route handler re-checks independently, because middleware
is a convenience, not a security boundary.

## 8. Folder map

```
src/
  app/
    (public)/          landing, terms, privacy
    (auth)/            login, register, forgot/reset password, verify
    (player)/          dashboard, pet, care, inventory, shop, games, missions,
                       achievements, leaderboards, rewards, claims, wallet,
                       notifications, profile, settings, referrals, promo
    staff/             dashboard, scanner, manual lookup, history
    admin/             dashboard, users, pets, species, items, games, sessions,
                       missions, achievements, rewards, claims, promo, referrals,
                       events, announcements, fraud, transactions, audit, roles, settings
    api/               route handlers, mirrored to the above
  components/          ui/ (shadcn) · game/ · pet/ · rewards/ · admin/ · layout/
  features/            client-side hooks + typed fetchers per domain
  lib/                 auth · db · redis · rbac · crypto · rate-limit · env · api · utils
  services/            currency · pet · game · mission · achievement · reward
                       notification · audit · fraud · leaderboard · referral · promo · level
prisma/                schema.prisma · seed.ts · migrations/
tests/                 vitest unit + integration
e2e/                   playwright
public/                assets (pets, items, games), manifest, service worker
```

## 9. Path to a native app

The API is a plain JSON HTTP surface with a consistent envelope
(`{ ok: true, data } | { ok: false, error: { code, message, details? } }`), all business logic
sits in `services/`, and nothing in a service imports React. A React Native or Expo client can
be added by reusing `src/features/**` fetchers against the same routes; only the auth token
transport (cookie → bearer) needs a new adapter.
