import { Role, PermissionKey, AccountStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/api';

export interface AuthedUser {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  permissions: PermissionKey[];
}

/**
 * Permissions a role holds implicitly. Anything not listed here has to be granted
 * explicitly via `UserPermission` — which is how the brief's "staff cannot change
 * balances *unless an admin grants it*" rule is expressed without inventing a
 * second staff role.
 */
const ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  PLAYER: [],
  STAFF: [PermissionKey.SCAN_CLAIMS, PermissionKey.APPROVE_CLAIMS],
  ADMIN: [
    PermissionKey.MANAGE_USERS,
    PermissionKey.MANAGE_REWARDS,
    PermissionKey.MANAGE_MISSIONS,
    PermissionKey.MANAGE_GAMES,
    PermissionKey.MANAGE_ITEMS,
    PermissionKey.MANAGE_PROMO_CODES,
    PermissionKey.APPROVE_CLAIMS,
    PermissionKey.SCAN_CLAIMS,
    PermissionKey.ADJUST_BALANCE,
    PermissionKey.VIEW_ANALYTICS,
    PermissionKey.VIEW_AUDIT_LOG,
    PermissionKey.REVIEW_FRAUD,
    PermissionKey.SEND_ANNOUNCEMENTS,
  ],
  SUPER_ADMIN: Object.values(PermissionKey),
};

export function permissionsForRole(role: Role): PermissionKey[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Authenticate the caller and re-check their account status against the database.
 *
 * The DB read on every protected request is deliberate: sessions are JWTs, so a
 * suspended user would otherwise keep full access until their token expired.
 */
export async function getCurrentUser(): Promise<AuthedUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      deletedAt: true,
      permissions: { select: { permission: true, expiresAt: true } },
    },
  });

  if (!user || user.deletedAt) return null;

  const now = new Date();
  const granted = user.permissions
    .filter((p) => !p.expiresAt || p.expiresAt > now)
    .map((p) => p.permission);

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    permissions: [...new Set([...permissionsForRole(user.role), ...granted])],
  };
}

export async function requireUser(): Promise<AuthedUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError('UNAUTHENTICATED', 'You must be signed in to do that.');
  if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
    throw new AppError('SUSPENDED', 'This account is suspended. Contact support.');
  }
  return user;
}

export async function requireRole(...roles: Role[]): Promise<AuthedUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AppError('FORBIDDEN', 'You do not have access to this resource.');
  }
  return user;
}

export async function requirePermission(...permissions: PermissionKey[]): Promise<AuthedUser> {
  const user = await requireUser();
  const missing = permissions.filter((p) => !user.permissions.includes(p));
  if (missing.length > 0) {
    throw new AppError('FORBIDDEN', `Missing permission: ${missing.join(', ')}`);
  }
  return user;
}

export function hasPermission(user: AuthedUser, permission: PermissionKey): boolean {
  return user.permissions.includes(permission);
}

export const isStaff = (role: Role) => role === 'STAFF' || role === 'ADMIN' || role === 'SUPER_ADMIN';
export const isAdmin = (role: Role) => role === 'ADMIN' || role === 'SUPER_ADMIN';
