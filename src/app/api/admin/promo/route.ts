import type { NextRequest } from 'next/server';
import { PermissionKey, AuditAction } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { promoCodeInputSchema, paginationSchema } from '@/lib/validation';
import { listPromoCodes } from '@/services/promo/promo.service';
import { recordAudit } from '@/services/audit/audit.service';

export async function GET(request: NextRequest) {
  return withApi(async () => {
    await requirePermission(PermissionKey.MANAGE_PROMO_CODES);

    const pagination = paginationSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    return ok(await listPromoCodes(pagination));
  });
}

export async function POST(request: NextRequest) {
  return withApi(async () => {
    const admin = await requirePermission(PermissionKey.MANAGE_PROMO_CODES);
    const input = promoCodeInputSchema.parse(await request.json());

    const promo = await prisma.promoCode.create({
      data: {
        ...input,
        code: input.code.toUpperCase(),
        maxUses: input.maxUses ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
      },
    });

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.PROMO_CODE_CREATED,
      targetType: 'PromoCode',
      targetId: promo.id,
      newValue: { code: promo.code, rewardType: promo.rewardType, rewardAmount: promo.rewardAmount },
    });

    return ok({ promo });
  });
}
