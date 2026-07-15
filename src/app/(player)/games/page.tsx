'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Zap, Trophy, Play, Coins, Sparkles, Battery } from 'lucide-react';
import type { GameSlug } from '@prisma/client';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress, Badge } from '@/components/ui/primitives';
import { LoadingState, ErrorState } from '@/components/ui/states';
import { formatNumber, formatDuration } from '@/lib/utils';

interface LobbyGame {
  id: string;
  slug: GameSlug;
  name: string;
  description: string;
  energyCost: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  dailyAttemptLimit: number;
  highScore: number;
  isPlayable: boolean;
  coinsEarnedToday: number;
  pointsEarnedToday: number;
  rewardInfo: {
    coinsPerScorePoint: number;
    scorePerRewardPoint: number;
    dailyCoinCap: number;
    dailyRewardPointCap: number;
  };
}

interface Lobby {
  games: LobbyGame[];
  energy: {
    current: number;
    max: number;
    nextRegenInSeconds: number;
    canFreeRefill: boolean;
    freeRefillInSeconds: number;
  };
  petBlocked: boolean;
  petMissing: boolean;
}

const ROUTE_BY_SLUG: Record<GameSlug, string> = {
  ENDLESS_RUNNER: '/games/endless-runner',
  FEEDING_CATCH: '/games/feeding-catch',
  SUDOKU: '/games/sudoku',
};

export default function GameLobbyPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['game-lobby'],
    queryFn: () => api.get<Lobby>('/api/games'),
    refetchInterval: 60_000,
  });

  const refillMutation = useMutation({
    mutationFn: () => api.post('/api/games/energy'),
    onSuccess: () => {
      toast.success('Energy refilled!');
      void queryClient.invalidateQueries({ queryKey: ['game-lobby'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading) return <LoadingState label="Loading the arcade…" />;
  if (isError || !data) {
    return <ErrorState message="We couldn't load the game lobby." onRetry={() => void refetch()} />;
  }

  const { games, energy, petBlocked, petMissing } = data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Mini games</h1>
        <p className="text-sm text-muted-foreground">
          Play, score, earn. Every score is verified before it pays.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
              <Zap className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className="font-bold">
                {energy.current} / {energy.max} energy
              </p>
              <p className="text-xs text-muted-foreground">
                {energy.current >= energy.max
                  ? 'Full — go and play something.'
                  : `Next in ${formatDuration(energy.nextRegenInSeconds)}`}
              </p>
            </div>
          </div>

          {energy.canFreeRefill ? (
            <Button
              variant="gradient"
              size="sm"
              onClick={() => refillMutation.mutate()}
              isLoading={refillMutation.isPending}
            >
              <Battery className="h-4 w-4" aria-hidden />
              Free refill
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {energy.current >= energy.max
                ? ''
                : `Free refill in ${formatDuration(energy.freeRefillInSeconds)}`}
            </p>
          )}
        </CardContent>
      </Card>

      {petMissing ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4 text-sm">
            You need a pet to play.{' '}
            <Link href="/onboarding" className="font-semibold text-primary hover:underline">
              Adopt one
            </Link>
            .
          </CardContent>
        </Card>
      ) : petBlocked ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm">
            <p className="font-semibold text-destructive">Your pet is too sick to play.</p>
            <p className="mt-1 text-muted-foreground">
              Give them medicine on the{' '}
              <Link href="/pet/care" className="font-semibold text-primary hover:underline">
                care page
              </Link>{' '}
              to unlock mini games again.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {games.map((game) => (
          <Card key={game.id} className="flex flex-col overflow-hidden">
            <div
              className={`h-28 ${
                game.slug === 'ENDLESS_RUNNER'
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                  : 'bg-gradient-to-br from-sky-500 to-cyan-500'
              }`}
              aria-hidden
            />

            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                {game.name}
                <Badge variant="secondary">
                  <Zap className="mr-1 h-3 w-3" aria-hidden />
                  {game.energyCost}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-3">
              <p className="text-sm text-muted-foreground">{game.description}</p>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-secondary px-3 py-2">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Trophy className="h-3 w-3" aria-hidden />
                    Best
                  </p>
                  <p className="font-bold tabular-nums">{formatNumber(game.highScore)}</p>
                </div>
                <div className="rounded-lg bg-secondary px-3 py-2">
                  <p className="text-xs text-muted-foreground">Attempts left</p>
                  <p className="font-bold tabular-nums">
                    {game.attemptsRemaining} / {game.dailyAttemptLimit}
                  </p>
                </div>
              </div>

              {/* Sudoku doesn't pay coins/points — it drops monster puzzle pieces —
                  so its caps are zero. Show its own reward line instead of dividing
                  by zero on the score-based bars. */}
              {game.slug === 'SUDOKU' ? (
                <div className="rounded-lg bg-secondary px-3 py-2 text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Win a monster puzzle piece
                  </span>
                  <p className="mt-0.5 text-muted-foreground">Collect 9 to hatch a monster.</p>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Coins className="h-3 w-3" aria-hidden />
                      Coins today
                    </span>
                    <span className="tabular-nums">
                      {game.coinsEarnedToday} / {game.rewardInfo.dailyCoinCap}
                    </span>
                  </div>
                  <Progress
                    value={(game.coinsEarnedToday / game.rewardInfo.dailyCoinCap) * 100}
                    className="h-1.5"
                    indicatorClassName="bg-amber-500"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Points today
                    </span>
                    <span className="tabular-nums">
                      {game.pointsEarnedToday} / {game.rewardInfo.dailyRewardPointCap}
                    </span>
                  </div>
                  <Progress
                    value={(game.pointsEarnedToday / game.rewardInfo.dailyRewardPointCap) * 100}
                    className="h-1.5"
                    indicatorClassName="bg-purple-500"
                  />
                </div>
              )}

              <div className="mt-auto flex gap-2 pt-2">
                <Button
                  asChild={game.isPlayable}
                  variant="gradient"
                  className="flex-1"
                  disabled={!game.isPlayable}
                >
                  {game.isPlayable ? (
                    <Link href={ROUTE_BY_SLUG[game.slug]}>
                      <Play className="h-4 w-4" aria-hidden />
                      Play
                    </Link>
                  ) : (
                    <span>
                      {game.attemptsRemaining === 0
                        ? 'No attempts left'
                        : petBlocked
                          ? 'Pet is sick'
                          : 'Not enough energy'}
                    </span>
                  )}
                </Button>
                <Button asChild variant="outline" size="icon" aria-label={`${game.name} leaderboard`}>
                  <Link href={`/leaderboards?gameId=${game.id}`}>
                    <Trophy className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
