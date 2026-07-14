import type { NextRequest } from 'next/server';
import { PermissionKey } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { itemInputSchema } from '@/lib/validation';
import { z } from 'zod';

export async function GET() {
  return withApi(async () => {
    await requirePermission(PermissionKey.MANAGE_ITEMS);

    const items = await prisma.item.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { inventory: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return ok({ items });
  });
}

export async function POST(request: NextRequest) {
  return withApi(async () => {
    await requirePermission(PermissionKey.MANAGE_ITEMS);
    const input = itemInputSchema.parse(await request.json());

    const item = await prisma.item.create({
      data: {
        ...input,
        coinPrice: input.coinPrice ?? null,
        gemPrice: input.gemPrice ?? null,
      },
    });

    return ok({ item });
  });
}

const updateSchema = itemInputSchema.partial().extend({ id: z.string().cuid() });

export async function PATCH(request: NextRequest) {
  return withApi(async () => {
    await requirePermission(PermissionKey.MANAGE_ITEMS);
    const { id, ...data } = updateSchema.parse(await request.json());

    const item = await prisma.item.update({ where: { id }, data });
    return ok({ item });
  });
}
