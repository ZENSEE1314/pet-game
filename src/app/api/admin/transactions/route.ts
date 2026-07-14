import type { NextRequest } from 'next/server';
import { PermissionKey, CurrencyType, type Prisma } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { paginationSchema } from '@/lib/validation';

/** GET /api/admin/transactions — the global ledger view. Read-only, always. */
export async function GET(request: NextRequest) {
  return withApi(async () => {
    await requirePermission(PermissionKey.VIEW_ANALYTICS);

    const { page, pageSize } = paginationSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const rawCurrency = request.nextUrl.searchParams.get('currency');
    const userId = request.nextUrl.searchParams.get('userId') ?? undefined;

    const where: Prisma.CurrencyTransactionWhereInput = {
      ...(rawCurrency && rawCurrency in CurrencyType
        ? { currency: rawCurrency as CurrencyType }
        : {}),
      ...(userId ? { userId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.currencyTransaction.findMany({
        where,
        include: {
          user: { select: { email: true, profile: { select: { displayName: true } } } },
          createdBy: { select: { email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.currencyTransaction.count({ where }),
    ]);

    return ok({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  });
}
