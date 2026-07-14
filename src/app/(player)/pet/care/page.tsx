'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Utensils, Droplets, Gamepad2, Moon, Pill, Coins, Sparkles } from 'lucide-react';
import type { PetCareAction } from '@prisma/client';

import { api, errorMessage, ApiClientError } from '@/features/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress, Badge } from '@/components/ui/primitives';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { PetMascot } from '@/components/pet/PetMascot';
import { CooldownButton } from './CooldownButton';

interface PetResponse {
  hasPet: boolean;
  pet: {
    name: string;
    stage: 'EGG' | 'BABY' | 'YOUNG' | 'ADULT' | 'EVOLVED';
    healthState: 'HEALTHY' | 'TIRED' | 'SICK';
    isSleeping: boolean;
    mood: number;
    moodLabel: string;
    stats: Record<string, number>;
  };
  cooldowns: {
    action: PetCareAction;
    isReady: boolean;
    remainingSeconds: number;
    cooldownMinutes: number;
  }[];
  dailyCare: {
    required: PetCareAction[];
    completed: PetCareAction[];
    isBonusClaimed: boolean;
    bonus: { coins: number; rewardPoints: number; xp: number };
  };
}

const ACTIONS: {
  action: PetCareAction;
  label: string;
  icon: typeof Utensils;
  description: string;
  tone: string;
}[] = [
  {
    action: 'FEED',
    label: 'Feed',
    icon: Utensils,
    description: '+20 hunger, +5 friendship, 5 coins',
    tone: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
  },
  {
    action: 'BATHE',
    label: 'Bathe',
    icon: Droplets,
    description: '+25 cleanliness, +5 happiness, 5 coins',
    tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
  },
  {
    action: 'PLAY',
    label: 'Play',
    icon: Gamepad2,
    description: '+20 happiness, +10 friendship, −10 energy, 10 coins',
    tone: 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300',
  },
  {
    action: 'SLEEP',
    label: 'Sleep',
    icon: Moon,
    description: 'Energy recovers while asleep',
    tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  },
  {
    action: 'MEDICINE',
    label: 'Medicine',
    icon: Pill,
    description: '+40 health · consumes 1 medicine item',
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
];

export default function PetCarePage() {
  const queryClient = useQueryClient();
  const [busyAction, setBusyAction] = useState<PetCareAction | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pet'],
    queryFn: () => api.get<PetResponse>('/api/pet'),
    // The cooldown countdowns tick locally; this keeps them honest against the
    // server every half minute without hammering it.
    refetchInterval: 30_000,
  });

  const careMutation = useMutation({
    mutationFn: (action: PetCareAction) => api.post<CareResult>('/api/pet/care', { action }),
    onSuccess: (result) => {
      const bits = [
        result.coinsAwarded > 0 ? `+${result.coinsAwarded} coins` : null,
        result.xpAwarded > 0 ? `+${result.xpAwarded} XP` : null,
      ].filter(Boolean);

      toast.success(`${result.action.toLowerCase()} done!`, {
        description: bits.join(' · ') || undefined,
      });

      if (result.dailyCareCompleted && result.dailyBonus) {
        toast.success('Daily care complete! 🎉', {
          description: `+${result.dailyBonus.coins} coins, +${result.dailyBonus.rewardPoints} reward points`,
          duration: 6000,
        });
      }

      if (result.petLeveledUp) {
        toast.success('Your pet levelled up!', { icon: '⭐' });
      }

      void queryClient.invalidateQueries({ queryKey: ['pet'] });
    },
    onError: (error) => {
      // A cooldown is not really an "error" from the player's point of view — it is
      // the game working. Tell them how long, and don't shout about it.
      if (error instanceof ApiClientError && error.code === 'COOLDOWN_ACTIVE') {
        toast.info(error.message);
        return;
      }
      toast.error(errorMessage(error));
    },
    onSettled: () => setBusyAction(null),
  });

  if (isLoading) return <LoadingState label="Waking your pet…" />;
  if (isError) return <ErrorState message="We couldn't load your pet." onRetry={() => void refetch()} />;

  if (!data?.hasPet) {
    return (
      <EmptyState
        title="No pet yet"
        message="Adopt a pet before you can care for one."
        action={
          <Button asChild variant="gradient">
            <Link href="/onboarding">Adopt a pet</Link>
          </Button>
        }
      />
    );
  }

  const { pet, cooldowns, dailyCare } = data;
  const cooldownByAction = new Map(cooldowns.map((c) => [c.action, c]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Care for {pet.name}</h1>
        <p className="text-sm text-muted-foreground">{pet.moodLabel}</p>
      </div>

      {pet.healthState === 'SICK' ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm">
            <p className="font-semibold text-destructive">{pet.name} is sick.</p>
            <p className="mt-1 text-muted-foreground">
              Mini games are locked until they recover. Use a medicine item to heal them — buy one
              from the{' '}
              <Link href="/shop" className="font-semibold text-primary hover:underline">
                item shop
              </Link>{' '}
              if you&apos;re out.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex items-center gap-5 p-5">
          <div className="h-28 w-28 shrink-0">
            <PetMascot
              stage={pet.stage}
              healthState={pet.healthState}
              mood={pet.mood}
              isSleeping={pet.isSleeping}
            />
          </div>
          <div className="flex-1 space-y-2">
            {(['hunger', 'happiness', 'energy', 'cleanliness', 'health'] as const).map((key) => (
              <div key={key}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="font-medium capitalize">{key}</span>
                  <span className="tabular-nums text-muted-foreground">{pet.stats[key]}</span>
                </div>
                <Progress
                  value={pet.stats[key]}
                  className="h-1.5"
                  indicatorClassName={pet.stats[key] < 25 ? 'bg-destructive' : undefined}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Daily care bonus</span>
            {dailyCare.isBonusClaimed ? <Badge variant="success">Earned today</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {dailyCare.required.map((action) => {
              const done = dailyCare.completed.includes(action);
              return (
                <Badge key={action} variant={done ? 'success' : 'outline'}>
                  {done ? '✓ ' : ''}
                  {action}
                </Badge>
              );
            })}
          </div>
          {!dailyCare.isBonusClaimed ? (
            <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                <Coins className="h-4 w-4" aria-hidden />+{dailyCare.bonus.coins}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-300">
                <Sparkles className="h-4 w-4" aria-hidden />+{dailyCare.bonus.rewardPoints} reward points
              </span>
              <span>when all three are done.</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {ACTIONS.map((config) => {
          const cooldown = cooldownByAction.get(config.action);
          const isSleepToggle = config.action === 'SLEEP';

          return (
            <CooldownButton
              key={config.action}
              label={isSleepToggle && pet.isSleeping ? 'Wake up' : config.label}
              description={config.description}
              icon={config.icon}
              tone={config.tone}
              remainingSeconds={cooldown?.remainingSeconds ?? 0}
              isBusy={busyAction === config.action}
              isDisabled={
                careMutation.isPending ||
                // Everything except SLEEP needs the pet awake — matching the
                // server rule, so the UI never offers an action the API will reject.
                (pet.isSleeping && !isSleepToggle)
              }
              onClick={() => {
                setBusyAction(config.action);
                careMutation.mutate(config.action);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

interface CareResult {
  action: PetCareAction;
  coinsAwarded: number;
  xpAwarded: number;
  dailyCareCompleted: boolean;
  dailyBonus?: { coins: number; rewardPoints: number; xp: number };
  petLeveledUp: boolean;
}
