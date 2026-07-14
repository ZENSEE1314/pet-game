import type { NextRequest } from 'next/server';
import { PermissionKey } from '@prisma/client';
import { ok, withApi } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import {
  getDashboardStats,
  getAnalytics,
  getEconomySnapshot,
} from '@/services/admin/analytics.service';

export async function GET(request: NextRequest) {
  return withApi(async () => {
    await requirePermission(PermissionKey.VIEW_ANALYTICS);

    const days = Math.min(90, Math.max(7, Number(request.nextUrl.searchParams.get('days') ?? 14)));

    const [stats, analytics, economy] = await Promise.all([
      getDashboardStats(),
      getAnalytics(days),
      getEconomySnapshot(),
    ]);

    return ok({ stats, analytics, economy });
  });
}
