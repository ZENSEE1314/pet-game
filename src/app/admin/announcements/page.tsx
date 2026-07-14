'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Megaphone, Send } from 'lucide-react';
import type { Role } from '@prisma/client';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, Select, Badge } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { formatDateTime } from '@/lib/utils';

interface Announcement {
  id: string;
  title: string;
  body: string;
  targetRole: Role | null;
  publishedAt: string | null;
  createdBy: { name: string | null; email: string };
}

export default function AdminAnnouncementsPage() {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState<Role | ''>('');

  const { data } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: () => api.get<{ announcements: Announcement[] }>('/api/admin/announcements'),
  });

  const sendMutation = useMutation({
    mutationFn: (values: { title: string; body: string; targetRole: Role | null }) =>
      api.post<{ recipients: number }>('/api/admin/announcements', values),
    onSuccess: (result) => {
      toast.success('Announcement sent', {
        description: `Delivered to ${result.recipients} player${result.recipients === 1 ? '' : 's'}.`,
      });
      setTitle('');
      setBody('');
      void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const isValid = title.trim().length >= 2 && body.trim().length >= 2;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground">
          Lands in every matching player&apos;s notification centre.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4" aria-hidden />
            New announcement
          </CardTitle>
          <CardDescription>
            Players who muted announcements in their settings will not receive this. That is
            deliberate — a mute that a broadcast can override is not a mute.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              placeholder="Double coins this weekend!"
            />
          </div>

          <div>
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1000}
              placeholder="From Friday to Sunday, every mini game pays double coins."
            />
          </div>

          <div>
            <Label htmlFor="targetRole">Audience</Label>
            <Select
              id="targetRole"
              value={targetRole}
              onChange={(event) => setTargetRole(event.target.value as Role | '')}
              className="sm:max-w-xs"
            >
              <option value="">Everyone</option>
              <option value="PLAYER">Players only</option>
              <option value="STAFF">Staff only</option>
              <option value="ADMIN">Admins only</option>
            </Select>
          </div>

          <Button
            disabled={!isValid || sendMutation.isPending}
            isLoading={sendMutation.isPending}
            onClick={() =>
              sendMutation.mutate({
                title: title.trim(),
                body: body.trim(),
                targetRole: targetRole || null,
              })
            }
          >
            <Send className="h-4 w-4" aria-hidden />
            Send announcement
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sent</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {!data || data.announcements.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Nothing sent yet" message="Your announcements will appear here." />
            </div>
          ) : (
            <ul className="divide-y">
              {data.announcements.map((announcement) => (
                <li key={announcement.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{announcement.title}</p>
                    <Badge variant="outline">{announcement.targetRole ?? 'Everyone'}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{announcement.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {announcement.publishedAt ? formatDateTime(announcement.publishedAt) : 'Draft'} ·{' '}
                    {announcement.createdBy.name ?? announcement.createdBy.email}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
