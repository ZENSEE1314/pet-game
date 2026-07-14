'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { Skeleton } from './primitives';
import { cn } from '@/lib/utils';

/**
 * The three states every data-driven surface must handle, in one place.
 *
 * Having these as shared components is what stops "loading" from being a blank
 * screen on one page and a spinner on another — and stops "error" from being a
 * silent no-op on the page someone was in a hurry to ship.
 */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertCircle className="h-9 w-9 text-destructive" aria-hidden />
        <div>
          <p className="font-semibold">{title}</p>
          {message ? <p className="mt-1 text-sm text-muted-foreground">{message}</p> : null}
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
          {icon ?? <Inbox className="h-6 w-6" aria-hidden />}
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          {message ? (
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
          ) : null}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function CardSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-xl border p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
