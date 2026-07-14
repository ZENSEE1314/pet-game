import {
  FraudAlertType,
  FraudSeverity,
  FraudAlertStatus,
  type Prisma,
} from '@prisma/client';
import { prisma, type DbClient } from '@/lib/db';
import { requestContext } from '@/services/audit/audit.service';

export interface FraudAlertInput {
  userId: string;
  type: FraudAlertType;
  severity?: FraudSeverity;
  description: string;
  evidence?: Prisma.InputJsonValue;
  referenceType?: string;
  referenceId?: string;
}

/**
 * Raise a flag for a human to look at. Deliberately does NOT ban, suspend or claw
 * back anything.
 *
 * A single anomaly is not proof: a legitimately excellent player and a cheater
 * both produce a suspiciously high score, and a shared household IP looks exactly
 * like a sybil farm. Auto-banning on one signal punishes your best players. The
 * system's job is to surface the pattern; an admin decides.
 */
export async function raiseFraudAlert(
  input: FraudAlertInput,
  db: DbClient = prisma,
): Promise<void> {
  try {
    const request = await requestContext();
    await db.fraudAlert.create({
      data: {
        userId: input.userId,
        type: input.type,
        severity: input.severity ?? FraudSeverity.MEDIUM,
        description: input.description,
        evidence: input.evidence,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        ipAddress: request.ip,
        userAgent: request.userAgent,
      },
    });
  } catch (error) {
    console.error('[fraud] failed to raise alert:', error);
  }
}

/** Fire-and-forget variant for hot paths (game submission). */
export function raiseFraudAlertSafe(input: FraudAlertInput): void {
  void raiseFraudAlert(input).catch(() => {
    /* already logged */
  });
}

export async function listFraudAlerts(options: {
  status?: FraudAlertStatus;
  severity?: FraudSeverity;
  userId?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, options.pageSize ?? 25);

  const where: Prisma.FraudAlertWhereInput = {
    ...(options.status ? { status: options.status } : {}),
    ...(options.severity ? { severity: options.severity } : {}),
    ...(options.userId ? { userId: options.userId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.fraudAlert.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, name: true, status: true } },
        resolvedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.fraudAlert.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function resolveFraudAlert(
  alertId: string,
  resolverId: string,
  outcome: 'RESOLVED_LEGITIMATE' | 'RESOLVED_ABUSE',
  resolution: string,
) {
  return prisma.fraudAlert.update({
    where: { id: alertId },
    data: {
      status: outcome,
      resolvedById: resolverId,
      resolvedAt: new Date(),
      resolution,
    },
  });
}

export async function countOpenAlerts(): Promise<number> {
  return prisma.fraudAlert.count({ where: { status: FraudAlertStatus.OPEN } });
}

/**
 * Detects sybil-ish behaviour: several accounts signing up from one IP.
 * Returns the accounts, not a verdict — a university dorm and a click farm look
 * identical from here.
 */
export async function findSharedIdentifiers(ipAddress: string, excludeUserId: string) {
  return prisma.user.findMany({
    where: {
      lastLoginIp: ipAddress,
      id: { not: excludeUserId },
      deletedAt: null,
    },
    select: { id: true, email: true, createdAt: true },
    take: 20,
  });
}
