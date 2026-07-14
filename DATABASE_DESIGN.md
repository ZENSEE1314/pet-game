# PetQuest Rewards — Database Design

The full schema is `prisma/schema.prisma`. This document explains **why** it looks the
way it does. Read the schema for the what.

## 1. The one rule

> `CurrencyTransaction` is the truth. `CurrencyBalance` is a cache.

`CurrencyBalance` exists so that rendering a header doesn't require summing a
player's entire history. It is a **projection**, and it is written in exactly one
place: `services/currency/transaction.service.ts`, inside a database transaction,
always alongside the ledger row that explains the change.

If the projection and the ledger ever disagree, the ledger is right and the
projection is a bug. You can always rebuild balances from the ledger; you can never
rebuild the ledger from balances.

## 2. Model groups

| Group | Models |
|---|---|
| **Auth** | `User`, `Account`, `Session`, `VerificationToken`, `UserPermission`, `RolePermission`, `Permission` |
| **Player** | `Profile`, `LoginStreak` |
| **Pet** | `PetSpecies`, `Pet`, `PetActivity`, `PetEvolution` |
| **Economy** | `CurrencyBalance`, `CurrencyTransaction` |
| **Items** | `Item`, `UserInventory` |
| **Games** | `Game`, `GameConfiguration`, `GameSession`, `GameScore`, `GameAttempt` |
| **Progress** | `Mission`, `UserMission`, `Achievement`, `UserAchievement` |
| **Rewards** | `Reward`, `RewardStockTransaction`, `RewardClaim` |
| **Growth** | `PromoCode`, `PromoCodeRedemption`, `Referral` |
| **Ranking** | `Leaderboard`, `LeaderboardEntry`, `LeaderboardPrize` |
| **Ops** | `Notification`, `Announcement`, `Event`, `FraudAlert`, `AuditLog`, `SystemSetting` |

## 3. The constraints that are doing real work

These are not decoration. Each one converts an application-level hope into a
database-level guarantee — the difference between "we check for that" and "that
cannot happen".

### `CurrencyTransaction.idempotencyKey` — `@unique`

The double-spend guard. Every reward-granting call site derives a key from something
stable and unique to the *intent*:

```
mission-claim:<userMissionId>
game-coins:<gameSessionId>
daily-care:<petId>:<2026-07-14>
streak-points:<userId>:<2026-07-14>
refund:<claimId>
referral-points:<referralId>:referrer
```

Note what these are *not*: random UUIDs. A random key makes every retry a fresh
transaction, which is the exact bug idempotency exists to prevent. Because the keys
are derived, a double-clicked button, a retried request, and a duplicated webhook all
collide on the same key and the second one is a no-op.

### `UserMission` — `@@unique([userId, missionId, periodKey])`

`periodKey` is `2026-07-14` for a daily mission and `2026-W29` for a weekly one, in
**the player's timezone**. One row per player per mission per period means "you can
only complete this once today" is enforced by an index, not by a `if (alreadyDone)`
that someone will forget to write on the next feature.

### `Referral.referredId` — `@unique`

An account can be referred exactly once, by exactly one person, forever. This is the
whole anti-farming design in one constraint: you cannot re-attribute an existing
account to a new referrer, so there is no way to recycle accounts.

### `RewardClaim.qrToken` and `.claimCode` — both `@unique`

Two independent ways to identify a claim, both collision-free. The QR is for the
camera; the claim code is for when the camera won't cooperate.

### `GameSession.nonce` — `@unique`

Signed into the session token. A replayed nonce fails signature verification *and*
finds an already-`COMPLETED` session row. Two locks, one door.

### `Reward.stockAvailable` — guarded by a conditional write, not a constraint

No unique index can express "don't oversell". Instead, the reservation is a
conditional `updateMany`:

```sql
UPDATE rewards
   SET stock_available = stock_available - 1,
       stock_reserved  = stock_reserved  + 1
 WHERE id = $1 AND stock_available >= 1;
```

Two players redeeming the last mug at the same instant: one gets `count = 1`, the
other gets `count = 0` and a clean `OUT_OF_STOCK` error. No row lock held across a
round-trip, no oversell, no phantom.

## 4. Timestamps as state

Three subsystems store a *watermark* instead of a value, and derive the value on read:

| Subsystem | Watermark | Derived by |
|---|---|---|
| Pet stats | `Pet.statsUpdatedAt` | `services/pet/decay.ts` |
| Game energy | `Profile.gameEnergyUpdatedAt` | `services/game/energy.service.ts` |
| Care cooldowns | `Pet.lastFedAt`, `lastBathedAt`, … | `services/pet/pet.service.ts` |

This is why there is no cron job in this project, and why there doesn't need to be.
A scheduled job that fails to run leaves the database lying; a derived value cannot.
It also means a player who was offline for a week comes back to a hungry pet rather
than one that was starved by a job that ran 168 times while they were away.

The cooldown check reads `lastFedAt` from Postgres — deliberately *not* from Redis.
Redis is a cache, and a flushed cache must not become a free cooldown reset.

## 5. Soft deletion

`User`, `Pet`, `Item`, `Mission`, `Reward` all carry `deletedAt`. Hard-deleting any
of them would orphan history: a deleted reward takes every claim that referenced it,
and a deleted mission takes a player's claim record with it. Rewards are cheap;
history is not, and a ledger row pointing at a missing reward is an audit failure.

`CurrencyTransaction`, `AuditLog` and `FraudAlert` have **no** deletion path at all,
soft or hard. That is the point of them.

## 6. Indexes

Every index earns its place against a query that actually runs:

- `currency_transactions (userId, currency, createdAt)` — the player's wallet page.
- `currency_transactions (category, createdAt)` — admin analytics ("points issued today").
- `game_scores (gameId, score)` — leaderboard rebuilds when the Redis cache is cold.
- `reward_claims (status, expiresAt)` — the lazy expiry sweep.
- `fraud_alerts (status, severity, createdAt)` — the admin review queue, sorted the way it's read.
- `user_missions (userId, status)` — the "you have 3 rewards to claim" badge.

## 7. Money is `Int`

Every currency column is `Int`. Not `Float`, not `Decimal`. The smallest unit of every
currency in this game is 1, there are no fractional coins, and the cheapest way to
guarantee that `0.1 + 0.2 === 0.3` is to never let a float near the ledger.

Rates that *are* fractional — `coinsPerScorePoint`, `xpPerScorePoint` — are `Float`,
because they are inputs to a calculation, not balances. Their output is immediately
`Math.floor`ed back into an integer before it touches the ledger.
