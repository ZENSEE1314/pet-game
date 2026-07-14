'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Home,
  PawPrint,
  Gamepad2,
  Target,
  Gift,
  User,
  Bell,
  LogOut,
  Trophy,
  Backpack,
  ShoppingBag,
  Wallet,
  Users,
  Ticket,
  Shield,
  ScanLine,
} from 'lucide-react';
import type { Role } from '@prisma/client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/primitives';

/**
 * Mobile gets a bottom bar with the five things a player actually does; desktop gets
 * the full sidebar. Same route list, two densities — rather than hiding half the app
 * on a phone, the secondary items live under Profile.
 */

const PRIMARY = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/pet', label: 'Pet', icon: PawPrint },
  { href: '/games', label: 'Games', icon: Gamepad2 },
  { href: '/missions', label: 'Missions', icon: Target },
  { href: '/rewards', label: 'Rewards', icon: Gift },
];

const SECONDARY = [
  { href: '/inventory', label: 'Inventory', icon: Backpack },
  { href: '/shop', label: 'Item shop', icon: ShoppingBag },
  { href: '/achievements', label: 'Achievements', icon: Trophy },
  { href: '/leaderboards', label: 'Leaderboards', icon: Trophy },
  { href: '/claims', label: 'My claims', icon: Ticket },
  { href: '/wallet', label: 'Point history', icon: Wallet },
  { href: '/referrals', label: 'Refer a friend', icon: Users },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile', icon: User },
];

export function BottomNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {PRIMARY.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive && 'scale-110')} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar({ role, unreadCount = 0 }: { role: Role; unreadCount?: number }) {
  const pathname = usePathname();

  const isStaff = role === 'STAFF' || role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const renderLink = (item: { href: string; label: string; icon: typeof Home }, badge?: number) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
          <span className="flex-1">{item.label}</span>
          {badge && badge > 0 ? (
            <Badge variant={isActive ? 'secondary' : 'destructive'} className="h-5 px-1.5">
              {badge > 9 ? '9+' : badge}
            </Badge>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="pq-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white">
          <PawPrint className="h-5 w-5" aria-hidden />
        </div>
        <span className="text-lg font-extrabold tracking-tight">PetQuest</span>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1">{PRIMARY.map((item) => renderLink(item))}</ul>

        <p className="px-3 pb-2 pt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          More
        </p>
        <ul className="space-y-1">
          {SECONDARY.map((item) =>
            renderLink(item, item.href === '/notifications' ? unreadCount : undefined),
          )}
        </ul>

        {isStaff || isAdmin ? (
          <>
            <p className="px-3 pb-2 pt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Operations
            </p>
            <ul className="space-y-1">
              {isStaff ? renderLink({ href: '/staff', label: 'Staff scanner', icon: ScanLine }) : null}
              {isAdmin ? renderLink({ href: '/admin', label: 'Admin', icon: Shield }) : null}
            </ul>
          </>
        ) : null}
      </nav>

      <div className="border-t p-3">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4.5 w-4.5" aria-hidden />
          Sign out
        </button>
      </div>
    </aside>
  );
}
