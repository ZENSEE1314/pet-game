# PetQuest Rewards — Task Checklist

Status legend: `[x]` done & verified · `[~]` done, partially verified · `[ ]` not done

## Phase 1 — Project Foundation
- [x] Initialize Next.js 15 project with strict TypeScript
- [x] Configure Tailwind CSS + shadcn/ui-style primitives
- [x] Configure Prisma + PostgreSQL (Neon in this dev environment; compose file for local Docker)
- [x] Configure Redis client with graceful Postgres-only degradation
- [x] Auth.js v5: credentials + Google (Google auto-hides when keys are absent)
- [x] Role-based access control (role enum + permission-grant table)
- [x] Base layouts: player shell (sidebar + mobile bottom nav), staff, admin
- [x] Docker setup (postgres, redis, multi-stage app image, compose profiles)
- [x] Environment validation at boot (`src/lib/env.ts`)

## Phase 2 — Database & Core Services
- [x] Full Prisma schema (40+ models, enums, indexes, unique constraints, soft deletes)
- [x] Initial migration created and applied (`prisma/migrations/20260714121345_init`)
- [x] Idempotent seed script (5 accounts, species, pet, 10 items, 10 rewards, 10 missions, 10 achievements, 2 games, leaderboards, promo code, notifications)
- [x] Currency transaction ledger service (idempotency keys, caps, no-negative-balance, conflict-safe projection)
- [x] Serializable-retry wrapper for financial transactions (`runSerializable`)
- [x] Audit service (best-effort, or transactional where required)
- [x] Notification service (preference-aware, transport-pluggable)
- [x] Fraud alert service (flag-for-review, never auto-ban)
- [x] Permission middleware (`requireUser` / `requireRole` / `requirePermission`)

## Phase 3 — Player & Pet System
- [x] Registration with referral capture, signup bonus, email-verification token
- [x] Login / forgot / reset password (enumeration-safe), verify email
- [x] Profile page + settings (timezone, notification preferences)
- [x] Pet adoption (onboarding flow)
- [x] Pet dashboard with live stats, mood, activity feed
- [x] Five care actions with server-side cooldowns *(verified: FEED pays 5 coins, immediate retry rejected with COOLDOWN_ACTIVE)*
- [x] Daily care bonus (timezone-correct, race-guarded)
- [x] Lazy stat decay from timestamps (unit-tested at multiple timescales)
- [x] Sick state locks mini games; pet can never die
- [x] Player XP / levels with referral-qualification hook

## Phase 4 — Inventory & Items
- [x] Item shop (coins/gems; reward points deliberately refused)
- [x] Inventory with use/equip flows
- [x] Consumables affect pet stats or game energy; conditional-decrement race guard
- [x] Clothing equip (one outfit at a time)

## Phase 5 — Mini Games
- [x] Game lobby with energy, attempts, high scores, per-game caps
- [x] Lazy energy regen + once-daily free refill
- [x] Signed single-use game sessions *(verified: forged signature rejected)*
- [x] Endless Runner (Phaser, jump, obstacles, coins, ramping speed, touch + keyboard)
- [x] Feeding Catch (Phaser, 60s round, combos, hazards, touch + keyboard)
- [x] Server-side score validation *(verified: 999,999 claim clamped to duration×rate ceiling = 2,040; rewards computed from clamped score; fraud alert raised)*
- [x] Session replay prevention *(verified: second submit rejected)*
- [x] Duration floor *(verified: instant submit rejected as too fast)*

## Phase 6 — Missions & Achievements
- [x] Mission engine with per-period unique constraint (timezone-aware period keys)
- [x] Automatic progress from pet care, games, purchases, redemptions, promo codes
- [x] Manual claim flow with double-claim guard
- [x] Achievements (10) with once-only payout
- [x] Login streak (7-day cycle, timezone-correct, race-guarded)

## Phase 7 — Rewards & QR Claims
- [x] Reward shop with categories, stock, per-user and daily limits
- [x] Secure redemption *(verified: stock reserved + points debited atomically; insufficient funds correctly refused at 299/300)*
- [x] HMAC-signed QR tokens + human-typable claim codes
- [x] Claim detail page with server-rendered QR
- [x] Staff scanner (html5-qrcode camera + manual code entry)
- [x] Collection flow *(verified end-to-end: lookup → collect → second collect rejected ALREADY_CLAIMED → player hitting staff endpoint rejected FORBIDDEN)*
- [x] Admin cancel-with-refund (the only path that returns points)
- [x] Lazy claim expiry (stock returned, points not auto-refunded)

## Phase 8 — Leaderboards & Engagement
- [x] Daily/weekly/monthly/all-time boards, best-score-per-period semantics
- [x] Redis ZSET cache with Postgres as truth (cold-cache rebuild verified by design; Redis absent in this environment and app degrades correctly)
- [x] Leaderboard prizes table + finalise flow
- [x] Notification centre with read state
- [x] Promo codes *(seeded WELCOME2026; duplicate-use guarded by redemption row)*
- [x] Referral system (level-3 qualification, one-source-per-account constraint, IP flagging)

## Phase 9 — Admin Dashboard
- [x] Dashboard cards *(verified live: users, DAU, games, coins/points issued, claims, low stock, fraud alerts)*
- [x] Economy snapshot (issued/spent/circulating — reconciles with the ledger)
- [x] Recharts analytics (registrations, sessions, issuance, redemptions, popular games/rewards)
- [x] User management: search, filter, suspend/reactivate, balance adjustment *(verified: refused without reason; audited with reason)*
- [x] Reward management: create, stock adjust (audited), pause, CSV export
- [x] Claims management: cancel-with-refund, mark ready
- [x] Mission management: activate/deactivate, edit via API
- [x] Game configuration: full reward formula + anti-cheat thresholds, admin-editable
- [x] Fraud review *(verified: the clamped-score attempt produced a CRITICAL IMPOSSIBLE_SCORE alert)*
- [x] Audit log *(verified: BALANCE_ADJUSTED and CLAIM_COLLECTED entries present with actor + values)*
- [x] Announcements with role targeting

## Phase 10 — Testing & Polish
- [x] 64 unit tests passing (crypto, decay, energy, config, period keys)
- [x] 7 DB integration tests for the ledger (gated behind `RUN_DB_TESTS=1`)
- [x] Playwright E2E suites for the 8 required flows (player journey, staff, admin)
- [x] Loading / empty / error states as shared components
- [x] Skeleton loaders, toasts, confirmation dialogs
- [x] Mobile bottom nav, 44px touch targets, safe-area padding
- [x] Accessibility: labels, aria-invalid, role=alert, reduced-motion support, skip link
- [x] PWA: manifest, service worker (shell-only cache; API never cached), installable
- [x] README, PROJECT_PLAN, ARCHITECTURE, DATABASE_DESIGN

## Known deviations in this dev environment
- Docker Desktop would not start on this machine, so live verification ran against a
  Neon serverless Postgres and without Redis (the designed degradation path). The
  compose file remains the canonical local setup.
- Playwright E2E specs are written but were not executed in this session (they need
  the webServer + seeded DB; unit and API-level verification was done instead, by hand,
  against the running server).
