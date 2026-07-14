'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';
import { z } from 'zod';

import { updateProfileSchema } from '@/lib/validation';
import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError, Switch, Separator } from '@/components/ui/primitives';
import { LoadingState } from '@/components/ui/states';

type FormValues = z.infer<typeof updateProfileSchema>;

const NOTIFICATION_PREFS = [
  { key: 'notifyMissions', label: 'Mission updates', hint: 'When a mission completes or a reward is ready.' },
  { key: 'notifyPetCare', label: 'Pet care', hint: 'When your pet gets hungry or falls ill.' },
  { key: 'notifyRewards', label: 'Rewards & claims', hint: 'When a claim is ready or about to expire.' },
  { key: 'notifyAnnouncements', label: 'Announcements', hint: 'Events and news from the team.' },
] as const;

export default function SettingsPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () =>
      api.get<{
        profile: {
          displayName: string;
          phone: string | null;
          country: string | null;
          timezone: string;
          avatarUrl: string | null;
          notifyMissions: boolean;
          notifyPetCare: boolean;
          notifyRewards: boolean;
          notifyAnnouncements: boolean;
        };
      }>('/api/profile'),
  });

  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(updateProfileSchema),
  });

  // The form is only populated once the fetch lands — rendering an empty form and
  // then filling it would let a fast typist have their input clobbered.
  useEffect(() => {
    if (data?.profile) reset(data.profile);
  }, [data, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => api.patch('/api/profile', values),
    onSuccess: () => {
      toast.success('Settings saved');
      router.refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading || !data) return <LoadingState label="Loading settings…" />;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>

      <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>How you appear on leaderboards.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" {...register('displayName')} />
              <FieldError message={formState.errors.displayName?.message} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" {...register('phone')} />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" {...register('country')} />
              </div>
            </div>

            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" {...register('timezone')} />
              {/* This is not cosmetic: the timezone decides when "today" rolls over for
                  daily missions, the login streak and the reward-point cap. */}
              <p className="mt-1 text-xs text-muted-foreground">
                Determines when your daily missions and login streak reset.
              </p>
            </div>

            <div>
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input id="avatarUrl" type="url" placeholder="https://…" {...register('avatarUrl')} />
              <FieldError message={formState.errors.avatarUrl?.message} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>Choose what lands in your notification centre.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-1">
            {NOTIFICATION_PREFS.map((pref, index) => (
              <div key={pref.key}>
                {index > 0 ? <Separator className="my-1" /> : null}
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <div>
                    <Label htmlFor={pref.key} className="cursor-pointer">
                      {pref.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{pref.hint}</p>
                  </div>
                  <Switch
                    id={pref.key}
                    checked={Boolean(watch(pref.key))}
                    onCheckedChange={(checked) =>
                      setValue(pref.key, checked, { shouldDirty: true })
                    }
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button
          type="submit"
          variant="gradient"
          className="w-full"
          isLoading={saveMutation.isPending}
          disabled={!formState.isDirty}
        >
          Save changes
        </Button>
      </form>

      <Card className="border-destructive/30">
        <CardContent className="p-5">
          <Button
            variant="outline"
            className="w-full text-destructive hover:bg-destructive/10"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
