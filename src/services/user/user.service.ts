import {
  Role,
  AccountStatus,
  CurrencyType,
  TransactionDirection,
  TransactionCategory,
  AuditAction,
  type Prisma,
} from '@prisma/client';

import { prisma, type TxClient } from '@/lib/db';
import { AppError } from '@/lib/api';
import { hashPassword } from '@/lib/auth';
import { generateReferralCode, generateVerificationToken } from '@/lib/crypto';
import { dayKey } from '@/lib/utils';
import { SIGNUP_BONUS } from '@/lib/game-config';
import { env } from '@/lib/env';
import { recordTransaction } from '@/services/currency/transaction.service';
import { attachReferral } from '@/services/referral/referral.service';
import { recordAudit } from '@/services/audit/audit.service';

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
  displayName: string;
  phone?: string;
  country?: string;
  timezone?: string;
  referralCode?: string;
  ip?: string;
}

export interface RegisterResult {
  userId: string;
  email: string;
  verificationToken: string;
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();

  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.profile.findUnique({ where: { username }, select: { id: true } }),
  ]);

  if (existingEmail) throw new AppError('CONFLICT', 'An account with that email already exists.');
  if (existingUsername) throw new AppError('CONFLICT', 'That username is taken.');

  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: input.displayName.trim(),
        role: Role.PLAYER,
        // Email verification is required, but we deliberately do NOT block login on
        // it — an unverified player can play, they just cannot redeem rewards. That
        // keeps the onboarding funnel intact while still gating the thing that costs
        // real money.
        status: AccountStatus.ACTIVE,
        lastLoginIp: input.ip,
      },
    });

    await tx.profile.create({
      data: {
        userId: user.id,
        username,
        displayName: input.displayName.trim(),
        phone: input.phone,
        country: input.country,
        timezone: input.timezone || env.DEFAULT_TIMEZONE,
        referralCode: await uniqueReferralCode(tx),
      },
    });

    await tx.loginStreak.create({ data: { userId: user.id } });

    for (const currency of [CurrencyType.COINS, CurrencyType.REWARD_POINTS, CurrencyType.GEMS]) {
      await tx.currencyBalance.create({ data: { userId: user.id, currency, balance: 0 } });
    }

    if (SIGNUP_BONUS.coins > 0) {
      await recordTransaction(tx, {
        userId: user.id,
        currency: CurrencyType.COINS,
        direction: TransactionDirection.CREDIT,
        amount: SIGNUP_BONUS.coins,
        category: TransactionCategory.SIGNUP_BONUS,
        description: 'Welcome bonus',
        idempotencyKey: `signup-coins:${user.id}`,
      });
    }

    if (SIGNUP_BONUS.gems > 0) {
      await recordTransaction(tx, {
        userId: user.id,
        currency: CurrencyType.GEMS,
        direction: TransactionDirection.CREDIT,
        amount: SIGNUP_BONUS.gems,
        category: TransactionCategory.SIGNUP_BONUS,
        description: 'Welcome bonus',
        idempotencyKey: `signup-gems:${user.id}`,
      });
    }

    if (input.referralCode) {
      await attachReferral(tx, user.id, input.referralCode, { ip: input.ip });
    }

    const token = generateVerificationToken();
    await tx.verificationToken.create({
      data: {
        identifier: email,
        token,
        purpose: 'EMAIL_VERIFICATION',
        expires: new Date(Date.now() + 24 * 3_600_000),
      },
    });

    return { userId: user.id, email, verificationToken: token };
  });

  return result;
}

async function uniqueReferralCode(tx: TxClient): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReferralCode();
    const taken = await tx.profile.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new AppError('INTERNAL_ERROR', 'Could not generate a referral code. Please try again.');
}

// --- Email verification & password reset ------------------------------------

export async function verifyEmail(token: string): Promise<{ email: string }> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record || record.purpose !== 'EMAIL_VERIFICATION') {
    throw new AppError('INVALID_TOKEN', 'This verification link is not valid.');
  }
  if (record.expires < new Date()) {
    throw new AppError('EXPIRED', 'This verification link has expired. Request a new one.');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { email: record.identifier },
      data: { emailVerified: new Date() },
    }),
    // Burn the token. A verification link is single-use.
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  return { email: record.identifier };
}

export async function requestPasswordReset(rawEmail: string): Promise<string | null> {
  const email = rawEmail.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  // Return null rather than throwing when the account doesn't exist. The route
  // handler responds "if that email exists, we've sent a link" either way — a
  // different response would turn this endpoint into a user-enumeration oracle.
  if (!user) return null;

  const token = generateVerificationToken();

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      purpose: 'PASSWORD_RESET',
      expires: new Date(Date.now() + 3_600_000),
    },
  });

  return token;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record || record.purpose !== 'PASSWORD_RESET') {
    throw new AppError('INVALID_TOKEN', 'This reset link is not valid.');
  }
  if (record.expires < new Date()) {
    throw new AppError('EXPIRED', 'This reset link has expired. Request a new one.');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { email: record.identifier },
      data: { passwordHash },
    }),
    prisma.verificationToken.delete({ where: { token } }),
    // Kill every existing session. If the reset was triggered because the account
    // was compromised, leaving the attacker's session alive defeats the point.
    prisma.session.deleteMany({ where: { user: { email: record.identifier } } }),
  ]);
}

// --- Profile ----------------------------------------------------------------

export async function getFullProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      profile: true,
      balances: true,
      loginStreak: true,
    },
  });

  const balances: Record<string, number> = { COINS: 0, REWARD_POINTS: 0, GEMS: 0 };
  for (const balance of user.balances) balances[balance.currency] = balance.balance;

  return {
    id: user.id,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    profile: user.profile,
    balances,
    loginStreak: user.loginStreak,
  };
}

export interface UpdateProfileInput {
  displayName?: string;
  phone?: string | null;
  country?: string | null;
  timezone?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  notifyMissions?: boolean;
  notifyPetCare?: boolean;
  notifyRewards?: boolean;
  notifyAnnouncements?: boolean;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  return prisma.profile.update({
    where: { userId },
    data: input,
  });
}

/**
 * Record a reward-shop visit, for the "visit the reward shop" mission.
 *
 * Called on every GET of the shop, so it must be cheap and must not fight with
 * anything else. The guard matters: writing `visitedRewardShopAt` on every page load
 * would touch the player's profile row on every render, and that row is also written
 * by `awardXp` — which runs inside the SERIALIZABLE redemption transaction. A player
 * who refreshes the shop while a redemption is in flight would then be conflicting
 * with themselves, and the redemption would abort.
 *
 * The mission tick is still evaluated every call (it is idempotent per period); only
 * the profile write is skipped once it has already happened today.
 */
export async function markRewardShopVisited(userId: string): Promise<void> {
  const { trackMissionProgress } = await import('@/services/mission/mission.service');
  const { MissionType } = await import('@prisma/client');

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { visitedRewardShopAt: true, timezone: true },
  });
  if (!profile) return;

  const today = dayKey(new Date(), profile.timezone || env.DEFAULT_TIMEZONE);
  const alreadyVisitedToday =
    profile.visitedRewardShopAt &&
    dayKey(profile.visitedRewardShopAt, profile.timezone || env.DEFAULT_TIMEZONE) === today;

  if (alreadyVisitedToday) return;

  await prisma.$transaction(async (tx) => {
    await tx.profile.update({
      where: { userId },
      data: { visitedRewardShopAt: new Date() },
    });
    await trackMissionProgress(tx, userId, MissionType.VISIT_REWARD_SHOP);
  });
}

// --- Admin ------------------------------------------------------------------

export async function listUsers(options: {
  search?: string;
  role?: Role;
  status?: AccountStatus;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, options.pageSize ?? 25);

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(options.role ? { role: options.role } : {}),
    ...(options.status ? { status: options.status } : {}),
    ...(options.search
      ? {
          OR: [
            { email: { contains: options.search, mode: 'insensitive' } },
            { name: { contains: options.search, mode: 'insensitive' } },
            { profile: { username: { contains: options.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        profile: { select: { username: true, displayName: true, level: true, avatarUrl: true } },
        balances: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getUserDetail(userId: string) {
  const [user, pets, claims, sessions, transactions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true, balances: true, loginStreak: true, permissions: true },
    }),
    prisma.pet.findMany({ where: { userId }, include: { species: true } }),
    prisma.rewardClaim.findMany({
      where: { userId },
      include: { reward: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.gameSession.findMany({
      where: { userId },
      include: { game: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.currencyTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  return { user, pets, claims, sessions, transactions };
}

export async function setUserStatus(
  userId: string,
  status: AccountStatus,
  adminId: string,
  reason: string,
) {
  const before = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { status: true, role: true },
  });

  if (before.role === Role.SUPER_ADMIN) {
    throw new AppError('FORBIDDEN', 'A super admin account cannot be suspended.');
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      status,
      suspendedAt: status === AccountStatus.SUSPENDED ? new Date() : null,
      suspendedReason: status === AccountStatus.SUSPENDED ? reason : null,
    },
  });

  await recordAudit({
    actorId: adminId,
    action:
      status === AccountStatus.SUSPENDED ? AuditAction.USER_SUSPENDED : AuditAction.USER_REACTIVATED,
    targetType: 'User',
    targetId: userId,
    oldValue: { status: before.status },
    newValue: { status, reason },
  });

  return user;
}

/**
 * The admin balance-adjustment path.
 *
 * A reason is mandatory (enforced by the Zod schema at the route, and again here),
 * the audit entry is written in the SAME transaction as the ledger row, and the
 * adjustment is exempt from the reward-point earning cap — an admin correcting a
 * bug should not be silently clipped by a cap meant for players.
 */
export async function adjustBalance(input: {
  userId: string;
  currency: CurrencyType;
  amount: number;
  direction: TransactionDirection;
  reason: string;
  adminId: string;
}) {
  if (!input.reason?.trim()) {
    throw new AppError('VALIDATION_ERROR', 'A reason is required for a balance adjustment.');
  }
  if (input.amount <= 0) {
    throw new AppError('VALIDATION_ERROR', 'Amount must be greater than zero.');
  }

  return prisma.$transaction(async (tx) => {
    const result = await recordTransaction(tx, {
      userId: input.userId,
      currency: input.currency,
      direction: input.direction,
      amount: input.amount,
      category: TransactionCategory.ADMIN_ADJUSTMENT,
      description: `Admin adjustment: ${input.reason}`,
      referenceType: 'AdminAdjustment',
      referenceId: input.adminId,
      idempotencyKey: `admin-adjust:${input.adminId}:${input.userId}:${Date.now()}`,
      actorId: input.adminId,
      metadata: { reason: input.reason },
    });

    await recordAudit(
      {
        actorId: input.adminId,
        action: AuditAction.BALANCE_ADJUSTED,
        targetType: 'User',
        targetId: input.userId,
        oldValue: { balance: result.transaction.balanceBefore, currency: input.currency },
        newValue: {
          balance: result.balanceAfter,
          currency: input.currency,
          direction: input.direction,
          amount: input.amount,
          reason: input.reason,
        },
      },
      tx,
    );

    return result;
  });
}

export async function setUserRole(userId: string, role: Role, actorId: string) {
  const before = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true },
  });

  const user = await prisma.user.update({ where: { id: userId }, data: { role } });

  await recordAudit({
    actorId,
    action: AuditAction.ROLE_CHANGED,
    targetType: 'User',
    targetId: userId,
    oldValue: { role: before.role },
    newValue: { role },
  });

  return user;
}
