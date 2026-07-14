'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gamepad2, Save } from 'lucide-react';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Switch, Badge, Separator } from '@/components/ui/primitives';
import { LoadingState, ErrorState } from '@/components/ui/states';

interface GameConfig {
  id: string;
  energyCost: number;
  dailyAttemptLimit: number;
  coinsPerScorePoint: number;
  scorePerRewardPoint: number;
  dailyCoinCap: number;
  dailyRewardPointCap: number;
  xpPerScorePoint: number;
  minDurationSeconds: number;
  maxValidScore: number;
  maxScorePerSecond: number;
  isLeaderboardEnabled: boolean;
  isActive: boolean;
}

interface AdminGame {
  id: string;
  name: string;
  slug: string;
  configuration: GameConfig | null;
  _count: { sessions: number; scores: number };
}

/**
 * Game configuration.
 *
 * Everything on this page is a live economy lever. `coinsPerScorePoint` is literally
 * the exchange rate between skill and money, and the three anti-cheat fields below it
 * are what stop that rate from being exploited. Changes take effect on the next
 * submission — no deploy required, which is the point of keeping the formula in the
 * database rather than the bundle.
 */
export default function AdminGamesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-games'],
    queryFn: () => api.get<{ games: AdminGame[] }>('/api/admin/games'),
  });

  const saveMutation = useMutation({
    mutationFn: (config: GameConfig & { gameId: string }) =>
      api.patch('/api/admin/games', config),
    onSuccess: () => {
      toast.success('Game configuration saved');
      void queryClient.invalidateQueries({ queryKey: ['admin-games'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading) return <LoadingState label="Loading game configuration…" />;
  if (isError || !data) {
    return <ErrorState message="We couldn't load the games." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Game configuration</h1>
        <p className="text-sm text-muted-foreground">
          Reward formulas and anti-cheat thresholds. Applied on the next score submission.
        </p>
      </div>

      {data.games.map((game) => (
        <GameConfigCard
          key={game.id}
          game={game}
          onSave={(config) => saveMutation.mutate({ ...config, gameId: game.id })}
          isPending={saveMutation.isPending}
        />
      ))}
    </div>
  );
}

function GameConfigCard({
  game,
  onSave,
  isPending,
}: {
  game: AdminGame;
  onSave: (config: GameConfig) => void;
  isPending: boolean;
}) {
  const [config, setConfig] = useState<GameConfig>(
    game.configuration ?? {
      id: '',
      energyCost: 1,
      dailyAttemptLimit: 10,
      coinsPerScorePoint: 0.1,
      scorePerRewardPoint: 500,
      dailyCoinCap: 500,
      dailyRewardPointCap: 50,
      xpPerScorePoint: 0.05,
      minDurationSeconds: 10,
      maxValidScore: 10000,
      maxScorePerSecond: 120,
      isLeaderboardEnabled: true,
      isActive: true,
    },
  );

  const set = <K extends keyof GameConfig>(key: K, value: GameConfig[K]) =>
    setConfig((current) => ({ ...current, [key]: value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Gamepad2 className="h-4 w-4" aria-hidden />
          {game.name}
          <Badge variant={config.isActive ? 'success' : 'destructive'}>
            {config.isActive ? 'Live' : 'Disabled'}
          </Badge>
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {game._count.sessions} sessions · {game._count.scores} valid scores
          </span>
        </CardTitle>
        <CardDescription>
          Coins = floor(score × coins/point). Points = floor(score ÷ score-per-point). Both are then
          capped by the daily limits.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Cost & limits
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Energy cost"
              value={config.energyCost}
              onChange={(value) => set('energyCost', value)}
            />
            <Field
              label="Daily attempts"
              value={config.dailyAttemptLimit}
              onChange={(value) => set('dailyAttemptLimit', value)}
            />
            <Field
              label="Daily coin cap"
              value={config.dailyCoinCap}
              onChange={(value) => set('dailyCoinCap', value)}
            />
            <Field
              label="Daily point cap"
              value={config.dailyRewardPointCap}
              onChange={(value) => set('dailyRewardPointCap', value)}
            />
          </div>
        </section>

        <Separator />

        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Reward formula
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Coins per score point"
              value={config.coinsPerScorePoint}
              step={0.01}
              onChange={(value) => set('coinsPerScorePoint', value)}
            />
            <Field
              label="Score per reward point"
              value={config.scorePerRewardPoint}
              onChange={(value) => set('scorePerRewardPoint', value)}
              hint="Higher = points are rarer"
            />
            <Field
              label="XP per score point"
              value={config.xpPerScorePoint}
              step={0.01}
              onChange={(value) => set('xpPerScorePoint', value)}
            />
          </div>
        </section>

        <Separator />

        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Anti-cheat thresholds
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Minimum duration (s)"
              value={config.minDurationSeconds}
              onChange={(value) => set('minDurationSeconds', value)}
              hint="Anything faster is rejected"
            />
            <Field
              label="Max valid score"
              value={config.maxValidScore}
              onChange={(value) => set('maxValidScore', value)}
              hint="Absolute ceiling — clamped above this"
            />
            <Field
              label="Max score per second"
              value={config.maxScorePerSecond}
              onChange={(value) => set('maxScorePerSecond', value)}
              hint="Rate ceiling — the physics check"
            />
          </div>
        </section>

        <Separator />

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch
              checked={config.isActive}
              onCheckedChange={(checked) => set('isActive', checked)}
            />
            Game is live
          </label>

          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch
              checked={config.isLeaderboardEnabled}
              onCheckedChange={(checked) => set('isLeaderboardEnabled', checked)}
            />
            Feeds leaderboards
          </label>
        </div>

        <Button onClick={() => onSave(config)} isLoading={isPending}>
          <Save className="h-4 w-4" aria-hidden />
          Save configuration
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  hint?: string;
}) {
  const id = label.replace(/\s+/g, '-').toLowerCase();

  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        step={step}
        min={0}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9"
      />
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
