import { AuditAction, Prisma } from '@prisma/client';
import { headers } from 'next/headers';
import { prisma, type DbClient } from '@/lib/db';

export interface AuditInput {
  actorId?: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit logging is best-effort by design: a failure to write the log must not roll
 * back the action it describes. We would rather have a suspended user and a missing
 * log line than an un-suspendable user because the log table is full.
 *
 * Pass a transaction client when the log genuinely must be atomic with the change
 * (balance adjustments do this — an unexplained balance change is worse than none).
 */
export async function recordAudit(input: AuditInput, db: DbClient = prisma): Promise<void> {
  try {
    const request = await requestContext();
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? undefined,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        oldValue: input.oldValue,
        newValue: input.newValue,
        ipAddress: input.ipAddress ?? request.ip,
        userAgent: input.userAgent ?? request.userAgent,
      },
    });
  } catch (error) {
    console.error('[audit] failed to write audit log:', error);
  }
}

/** Best-effort extraction of the caller's IP/UA. Returns undefined outside a request. */
export async function requestContext(): Promise<{ ip?: string; userAgent?: string }> {
  try {
    const headerList = await headers();
    const forwarded = headerList.get('x-forwarded-for');
    return {
      ip: forwarded?.split(',')[0]?.trim() ?? headerList.get('x-real-ip') ?? undefined,
      userAgent: headerList.get('user-agent') ?? undefined,
    };
  } catch {
    return {};
  }
}

export async function listAuditLogs(options: {
  actorId?: string;
  action?: AuditAction;
  targetType?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, options.pageSize ?? 25);

  const where: Prisma.AuditLogWhereInput = {
    ...(options.actorId ? { actorId: options.actorId } : {}),
    ...(options.action ? { action: options.action } : {}),
    ...(options.targetType ? { targetType: options.targetType } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, email: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
