'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import type { NotificationType } from '@prisma/client';

import { api } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { relativeTime, cn } from '@/lib/utils';

interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ items: NotificationRow[]; unreadCount: number }>('/api/notifications'),
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationIds?: string[]) =>
      api.patch('/api/notifications', notificationIds ? { notificationIds } : {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      router.refresh();
    },
  });

  if (isLoading) return <LoadingState label="Loading notifications…" />;
  if (isError || !data) {
    return <ErrorState message="We couldn't load notifications." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {data.unreadCount > 0 ? `${data.unreadCount} unread` : 'All caught up'}
          </p>
        </div>

        {data.unreadCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markReadMutation.mutate(undefined)}
            isLoading={markReadMutation.isPending}
          >
            <CheckCheck className="h-4 w-4" aria-hidden />
            Mark all read
          </Button>
        ) : null}
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" aria-hidden />}
          title="Nothing here yet"
          message="Mission rewards, pet alerts and reward updates will show up here."
        />
      ) : (
        <div className="space-y-2">
          {data.items.map((notification) => {
            const content = (
              <Card
                className={cn(
                  'transition-colors',
                  !notification.isRead && 'border-primary/40 bg-primary/5',
                )}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  {!notification.isRead ? (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                      aria-label="Unread"
                    />
                  ) : (
                    <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{notification.title}</p>
                    <p className="text-sm text-muted-foreground">{notification.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {relativeTime(notification.createdAt)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );

            return notification.linkUrl ? (
              <Link
                key={notification.id}
                href={notification.linkUrl}
                onClick={() => {
                  if (!notification.isRead) markReadMutation.mutate([notification.id]);
                }}
                className="block"
              >
                {content}
              </Link>
            ) : (
              <div key={notification.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
