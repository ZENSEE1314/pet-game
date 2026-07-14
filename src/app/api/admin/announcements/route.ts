import type { NextRequest } from 'next/server';
import { PermissionKey, NotificationType, AuditAction } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { announcementSchema } from '@/lib/validation';
import { broadcast } from '@/services/notification/notification.service';
import { recordAudit } from '@/services/audit/audit.service';

export async function GET() {
  return withApi(async () => {
    await requirePermission(PermissionKey.SEND_ANNOUNCEMENTS);

    const announcements = await prisma.announcement.findMany({
      include: { createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return ok({ announcements });
  });
}

/**
 * POST — publish an announcement to every matching player's notification centre.
 *
 * This is a fan-out write, so it is the one admin action that can be slow on a large
 * user base. Kept synchronous in the MVP because correctness beats latency here and
 * the admin is standing right there; it is the obvious first thing to move to a
 * queue when the user count justifies it.
 */
export async function POST(request: NextRequest) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.SEND_ANNOUNCEMENTS);
    const input = announcementSchema.parse(await request.json());

    const announcement = await prisma.announcement.create({
      data: {
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl || null,
        targetRole: input.targetRole ?? null,
        isPublished: true,
        publishedAt: new Date(),
        createdById: admin.id,
      },
    });

    const recipients = await broadcast({
      type: NotificationType.ADMIN_ANNOUNCEMENT,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl || undefined,
      targetRole: input.targetRole ?? null,
      iconKey: 'megaphone',
    });

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.ANNOUNCEMENT_SENT,
      targetType: 'Announcement',
      targetId: announcement.id,
      newValue: { title: input.title, recipients },
    });

    return ok({ announcement, recipients });
  });
}
