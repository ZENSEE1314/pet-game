import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Bell } from 'lucide-react';

import { getCurrentUser } from '@/lib/rbac';
import { getBalances } from '@/services/currency/transaction.service';
import { prisma } from '@/lib/db';
import { Sidebar, BottomNav } from '@/components/layout/PlayerNav';
import { CurrencyPills } from '@/components/layout/CurrencyPills';
import { Badge } from '@/components/ui/primitives';

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  // Middleware already redirected an anonymous visitor, but this check is what
  // actually protects the data: middleware is a convenience, not a boundary.
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.status === 'SUSPENDED' || user.status === 'BANNED') redirect('/suspended');

  const [balances, unreadCount] = await Promise.all([
    getBalances(user.id),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar role={user.role} unreadCount={unreadCount} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <CurrencyPills balances={balances} size="sm" />

          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl hover:bg-secondary"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <Bell className="h-5 w-5" aria-hidden />
            {unreadCount > 0 ? (
              <Badge
                variant="destructive"
                className="absolute -right-0.5 -top-0.5 h-5 min-w-5 justify-center px-1 text-[10px]"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            ) : null}
          </Link>
        </header>

        {/* pb-24 leaves room for the mobile bottom bar; without it the last card on
            every page hides behind the nav. */}
        <main id="main" className="flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      <BottomNav unreadCount={unreadCount} />
    </div>
  );
}
