# PetQuest Rewards — Project Plan

## 1. Product summary

PetQuest Rewards is a responsive, installable (PWA) virtual-pet game with a real rewards
economy. A player adopts a pet, keeps it alive and happy through care actions, plays two
Phaser mini games, completes daily/weekly missions, climbs leaderboards, and converts
**Reward Points** into real vouchers, food & drink, merchandise or event tickets — collected
in person by showing a signed QR code to a staff member.

The thing that makes this project non-trivial is not the pet. It is that **points have real
value**, so every gram of the earning path has to be assumed hostile. The design principle
running through the whole build is:

> The client is a renderer. The server is the source of truth for every number that
> can be turned into something real.

## 2. Goals for the MVP

| Goal | Definition of done |
|---|---|
| Players can complete the full loop | Register → profile → adopt → care → mini game → mission → redeem → staff scans QR |
| Points are un-farmable by a hostile client | All rewards are computed server-side; sessions are HMAC-signed and single-use |
| Every balance change is auditable | Immutable ledger with balance-before/after and idempotency keys |
| Staff can fulfil a claim offline-ish | QR scan **or** manual claim-code entry, both idempotent |
| Admins can operate the economy | Adjust balances (with reason + audit), configure games, manage rewards/stock |
| It runs on one command | `docker compose up` → migrate → seed → play |

## 3. Non-goals (explicitly deferred)

Chat, guilds, trading, blockchain/crypto, real-money gambling, cash withdrawal, pet death,
multiplayer battles, real payment for gems, push/email delivery (architecture is prepared,
transport is stubbed).

## 4. Key product decisions

These were not specified in the brief; each is a deliberate, documented default.

| # | Decision | Rationale |
|---|---|---|
| D1 | **Integer currency only.** No floats anywhere in the ledger. | Floats and money never mix. Amounts are `Int`. |
| D2 | **Lazy stat decay.** Pet stats are derived from timestamps on read, not by a cron. | Correct without a scheduler, survives downtime, and cannot drift. A cron would also punish players for our outages. |
| D3 | **Lazy energy regen**, same mechanism as D2. | Same reasons. |
| D4 | **Missions are claimed manually** unless `autoClaim` is set. | Gives us the reward-celebration moment, and makes double-claim prevention a single guarded write. |
| D5 | **Reward stock is reserved at redemption time**, decremented inside the same DB transaction as the point debit. | No oversell. A cancelled claim refunds points *and* returns stock, both in one transaction. |
| D6 | **QR tokens are stateless HMAC + a DB single-use guard.** | Signature proves authenticity offline; the DB row proves it hasn't been burned. Both are required. |
| D7 | **Gems cannot convert to Reward Points, ever.** Enforced in the transaction service, not just the UI. | Otherwise gems become a money-laundering path into real rewards. |
| D8 | **Daily/monthly reward-point earning caps** are enforced inside the ledger service. | A cap enforced at the call site is a cap you will forget at the next call site. |
| D9 | Roles are a **DB enum plus a permission-grant table**. | Covers the brief's "staff can't change balances *unless granted*" requirement without inventing a role per exception. |
| D10 | Auth uses **Auth.js v5 (NextAuth) with JWT sessions**. | Works on serverless, avoids a session read per request; suspension is re-checked on every protected request against the DB. |

## 5. Delivery phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: Next.js 15, TS strict, Tailwind, shadcn/ui, Prisma, Postgres, Redis, Auth, RBAC, Docker | ✅ |
| 2 | Schema, migrations, seed, ledger service, audit service, notification service, permission middleware | ✅ |
| 3 | Registration/profile, pet adoption, care actions, cooldowns, decay, XP/levels | ✅ |
| 4 | Item shop, inventory, purchase/use/equip | ✅ |
| 5 | Game lobby, signed sessions, endless runner, feeding catch, score validation, rewards | ✅ |
| 6 | Mission engine, progress tracking, claim flow, achievements, login streak | ✅ |
| 7 | Reward shop, secure redemption, stock reservation, QR claims, staff scanner | ✅ |
| 8 | Leaderboards (+ Redis cache), notifications, promo codes, referrals | ✅ |
| 9 | Admin dashboard, analytics, user/reward/mission management, game config, fraud, audit logs | ✅ |
| 10 | Unit + E2E tests, loading/empty/error states, a11y, docs | ✅ |

See `TASKS.md` for the itemised checklist.

## 6. Risk register

| Risk | Mitigation |
|---|---|
| Score forgery in mini games | Signed session + server-side reward formula + duration floor + max-score ceiling + single-use session + fraud alert on anomaly |
| Duplicate reward on retry / double-click | Idempotency key unique index on the ledger; the second write is a no-op that returns the first result |
| Race on last unit of stock | `SELECT … FOR UPDATE`-equivalent via conditional `updateMany` on `stockAvailable` inside a transaction |
| Race on concurrent balance writes | Balance rows are updated with a conditional write inside a serialisable transaction |
| QR replay | Token is single-use: the collect write is conditional on `status != COLLECTED` |
| Referral farming | Self-referral blocked, one source per account, reward only at Level 3, IP/device signals raise a fraud alert |
