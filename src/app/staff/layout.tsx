import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ScanLine, History, Home } from 'lucide-react';

import { getCurrentUser, isStaff } from '@/lib/rbac';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isStaff(user.role)) redirect('/dashboard');

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
              <ScanLine className="h-4 w-4" aria-hidden />
            </div>
            <span className="font-bold">Staff</span>
          </div>

          <nav className="flex items-center gap-1 text-sm">
            <Link href="/staff" className="rounded-lg px-3 py-2 font-semibold hover:bg-secondary">
              Scanner
            </Link>
            <Link
              href="/staff/history"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold hover:bg-secondary"
            >
              <History className="h-4 w-4" aria-hidden />
              History
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold text-muted-foreground hover:bg-secondary"
            >
              <Home className="h-4 w-4" aria-hidden />
              Game
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 py-5">
        {children}
      </main>
    </div>
  );
}
