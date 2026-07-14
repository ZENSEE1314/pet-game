import type { NextRequest } from 'next/server';
import { ok, withApi } from '@/lib/api';
import { requireUser } from '@/lib/rbac';
import { markReadSchema } from '@/lib/validation';
import { listNotifications, markAsRead } from '@/services/notification/notification.service';

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true';
    const page = Number(request.nextUrl.searchParams.get('page') ?? 1);

    return ok(await listNotifications(user.id, { unreadOnly, page }));
  });
}

/** PATCH /api/notifications — mark some (or all) as read. */
export async function PATCH(request: NextRequest) {
  return withApi(async () => {
    const user = await requireUser();
    const { notificationIds } = markReadSchema.parse(await request.json().catch(() => ({})));

    const count = await markAsRead(user.id, notificationIds);
    return ok({ markedRead: count });
  });
}
