'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Crown, Medal } from 'lucide-react';
import type { LeaderboardPeriod } from '@prisma/client';

import { api } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { formatNumber, initials, cn } from '@/lib/utils';

interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  score: number;
  isCurrentUser: boolean;
}

interface LeaderboardView {
  leaderboard: { name: string; period: LeaderboardPeriod };
  rows: LeaderboardRow[];
  currentUserRow: LeaderboardRow | null;
  prizes: { rankFrom: number; rankTo: number; rewardType: string; rewardAmount: number }[];
  games: { id: string; name: string }[];
}

const PERIODS: LeaderboardPeriod[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME'];

function LeaderboardContent() {
  const searchParams = useSearchParams();

  const [period, setPeriod] = useState<LeaderboardPeriod>('WEEKLY');
  const [gameId, setGameId] = useState<string>(searchParams.get('gameId') ?? '');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leaderboard', period, gameId],
    queryFn: () =>
      api.get<LeaderboardView>(
        `/api/leaderboards?period=${period}&scope=PER_GAME${gameId ? `&gameId=${gameId}` : ''}`,
      ),
  });

  if (isLoading) return <LoadingState label="Counting the scores…" />;
  if (isError || !data) {
    return <ErrorState message="We couldn't load the leaderboard." onRetry={() => void refetch()} />;
  }

  // The first game is the implicit default so the board isn't empty on first load.
  const effectiveGameId = gameId || data.games[0]?.id || '';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Leaderboards</h1>
        <p className="text-sm text-muted-foreground">
          Only verified scores make the board.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Tabs value={period} onValueChange={(value) => setPeriod(value as LeaderboardPeriod)}>
          <TabsList>
            {PERIODS.map((option) => (
              <TabsTrigger key={option} value={option}>
                {option === 'ALL_TIME' ? 'All time' : option.charAt(0) + option.slice(1).toLowerCase()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Select
          value={effectiveGameId}
          onChange={(event) => setGameId(event.target.value)}
          aria-label="Choose a game"
          className="sm:max-w-xs"
        >
          {data.games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </Select>
      </div>

      {data.prizes.length > 0 ? (
        <Card className="border-amber-300/60 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <Trophy className="h-4 w-4 text-amber-600" aria-hidden />
            <span className="font-semibold">Prizes:</span>
            {data.prizes.map((prize) => (
              <Badge key={`${prize.rankFrom}-${prize.rankTo}`} variant="warning">
                #{prize.rankFrom}
                {prize.rankTo > prize.rankFrom ? `–${prize.rankTo}` : ''} · {prize.rewardAmount}{' '}
                {prize.rewardType.replace('_', ' ').toLowerCase()}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {data.rows.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-6 w-6" aria-hidden />}
          title="Nobody on the board yet"
          message="Be the first — play a mini game and set the mark."
        />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {data.rows.map((row) => (
              <Row key={row.userId} row={row} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* If the player isn't in the visible page, show them anyway. A leaderboard that
          doesn't tell you where YOU are is a list of strangers. */}
      {data.currentUserRow && !data.rows.some((row) => row.isCurrentUser) ? (
        <Card className="border-primary/50 ring-2 ring-primary/20">
          <CardContent className="p-0">
            <Row row={data.currentUserRow} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ row }: { row: LeaderboardRow }) {
  const medal =
    row.rank === 1 ? (
      <Crown className="h-4 w-4 text-amber-500" aria-hidden />
    ) : row.rank <= 3 ? (
      <Medal className="h-4 w-4 text-slate-400" aria-hidden />
    ) : null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        row.isCurrentUser && 'bg-primary/5',
      )}
    >
      <div className="flex w-9 shrink-0 items-center justify-center gap-1">
        {medal ?? (
          <span className="text-sm font-bold tabular-nums text-muted-foreground">{row.rank}</span>
        )}
      </div>

      <Avatar className="h-9 w-9">
        {row.avatarUrl ? <AvatarImage src={row.avatarUrl} alt="" /> : null}
        <AvatarFallback>{initials(row.displayName)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {row.displayName}
          {row.isCurrentUser ? <span className="ml-1.5 text-xs text-primary">(you)</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">Level {row.level}</p>
      </div>

      <p className="font-bold tabular-nums">{formatNumber(row.score)}</p>
    </div>
  );
}

export default function LeaderboardsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LeaderboardContent />
    </Suspense>
  );
}
