import { NotificationType, Role, type Prisma } from '@prisma/client';
import { prisma, type DbClient } from '@/lib/db';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl?: string;
  iconKey?: string;
}

/**
 * In-app notifications only, for now.
 *
 * The transport is deliberately behind this one function so that adding email or
 * web-push later means editing `dispatch()` — not hunting down thirty call sites.
 * Each notification type maps to a preference flag on the profile; a user who has
 * muted a category simply doesn't get the row.
 */
const PREFERENCE_BY_TYPE: Partial<Record<NotificationType, keyof PreferenceFlags>> = {
  MISSION_COMPLETED: 'notifyMissions',
  MISSION_REWARD_AVAILABLE: 'notifyMissions',
  PET_HUNGRY: 'notifyPetCare',
  PET_SICK: 'notifyPetCare',
  PET_ENERGY_RESTORED: 'notifyPetCare',
  CLAIM_READY: 'notifyRewards',
  CLAIM_EXPIRING: 'notifyRewards',
  CLAIM_COLLECTED: 'notifyRewards',
  ADMIN_ANNOUNCEMENT: 'notifyAnnouncements',
  NEW_EVENT: 'notifyAnnouncements',
};

interface PreferenceFlags {
  notifyMissions: boolean;
  notifyPetCare: boolean;
  notifyRewards: boolean;
  notifyAnnouncements: boolean;
}

export async function notify(input: NotifyInput, db: DbClient = prisma): Promise<void> {
  const preferenceKey = PREFERENCE_BY_TYPE[input.type];

  if (preferenceKey) {
    const profile = await db.profile.findUnique({
      where: { userId: input.userId },
      select: {
        notifyMissions: true,
        notifyPetCare: true,
        notifyRewards: true,
        notifyAnnouncements: true,
      },
    });
    if (profile && profile[preferenceKey] === false) return;
  }

  await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      iconKey: input.iconKey,
    },
  });
}

/** Fire-and-forget: a failed notification must never roll back the thing it announces. */
export function notifySafe(input: NotifyInput, db: DbClient = prisma): void {
  void notify(input, db).catch((error) => {
    console.error('[notification] failed to deliver:', error);
  });
}

export async function broadcast(
  input: Omit<NotifyInput, 'userId'> & { targetRole?: Role | null },
): Promise<number> {
  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      ...(input.targetRole ? { role: input.targetRole } : {}),
    },
    select: { id: true },
  });

  if (users.length === 0) return 0;

  const result = await prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      type: input.type,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      iconKey: input.iconKey,
    })),
  });

  return result.count;
}

export async function listNotifications(
  userId: string,
  options: { unreadOnly?: boolean; page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, options.pageSize ?? 20);

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(options.unreadOnly ? { isRead: false } : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { items, total, unreadCount, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function markAsRead(userId: string, notificationIds?: string[]): Promise<number> {
  const result = await prisma.notification.updateMany({
    // Scoping by userId is what stops someone marking another player's
    // notifications read by guessing IDs.
    where: {
      userId,
      isRead: false,
      ...(notificationIds?.length ? { id: { in: notificationIds } } : {}),
    },
    data: { isRead: true, readAt: new Date() },
  });
  return result.count;
}
