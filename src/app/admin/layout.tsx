import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Gift,
  Target,
  Gamepad2,
  ShieldAlert,
  ScrollText,
  Ticket,
  Receipt,
  Package,
  Megaphone,
  Home,
} from 'lucide-react';

import { getCurrentUser, isAdmin } from '@/lib/rbac';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/rewards', label: 'Rewards', icon: Gift },
  { href: '/admin/claims', label: 'Claims', icon: Ticket },
  { href: '/admin/items', label: 'Items', icon: Package },
  { href: '/admin/missions', label: 'Missions', icon: Target },
  { href: '/admin/games', label: 'Games', icon: Gamepad2 },
  { href: '/admin/transactions', label: 'Transactions', icon: Receipt },
  { href: '/admin/fraud', label: 'Fraud alerts', icon: ShieldAlert },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
];

/**
 * The admin surface is deliberately plain: dense tables, muted colours, no gradients.
 * The player app should feel like a toy; the console that moves real money should not.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user.role)) redirect('/dashboard');

  return (
    <div className="flex min-h-dvh bg-slate-50 dark:bg-slate-950">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-background lg:flex">
        <div className="px-5 py-5">
          <p className="text-sm font-extrabold tracking-tight">PetQuest Admin</p>
          <p className="text-xs text-muted-foreground">{user.role.replace('_', ' ')}</p>
        </div>

        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3">
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
          >
            <Home className="h-4 w-4" aria-hidden />
            Back to game
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b bg-background px-4 py-3 lg:hidden">
          <div className="flex items-center gap-3 overflow-x-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </header>

        <main id="main" className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
