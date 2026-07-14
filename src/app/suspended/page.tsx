import { ShieldAlert } from 'lucide-react';
import { SignOutButton } from './SignOutButton';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: 'Account suspended' };

export default function SuspendedPage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-7 w-7" aria-hidden />
          </div>

          <div>
            <h1 className="text-xl font-bold">Account suspended</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your account has been suspended and cannot access the game. If you believe this is a
              mistake, contact support and we&apos;ll review it — suspensions are decided by a person,
              and a person can undo one.
            </p>
          </div>

          <SignOutButton />
        </CardContent>
      </Card>
    </main>
  );
}
