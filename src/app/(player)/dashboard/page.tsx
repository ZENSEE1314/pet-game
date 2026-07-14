import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Gamepad2, Target, Gift, Flame, Trophy, ArrowRight, Sparkles } from 'lucide-react';

import { requireUser } from '@/lib/rbac';
import { getPetForUser, petSummary } from '@/services/pet/pet.service';
import { getStreakState } from '@/services/streak/streak.service';
import { getLevelProgress } from '@/services/level/level.service';
import { countClaimableMissions } from '@/services/mission/mission.service';
import { getEnergy } from '@/services/game/energy.service';
import { getFullProfile } from '@/services/user/user.service';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress, Badge } from '@/components/ui/primitives';
import { PetMascot } from '@/components/pet/PetMascot';
import { StreakClaimCard } from './StreakClaimCard';
import { formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();

  const [pet, streak, level, claimable, energy, profile] = await Promise.all([
    getPetForUser(user.id),
    getStreakState(user.id),
    getLevelProgress(user.id),
    countClaimableMissions(user.id),
    getEnergy(user.id),
    getFullProfile(user.id),
  ]);

  // A player without a pet has nothing to do here — the whole game hangs off the pet.
  if (!pet) redirect('/onboarding');

  const summary = petSummary(pet);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Hey {profile.profile?.displayName ?? 'player'} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {summary.healthState === 'SICK'
            ? `${summary.name} isn't feeling well. Give them medicine.`
            : `${summary.name} is ${summary.moodLabel.toLowerCase()}.`}
        </p>
      </div>

      {streak.canClaimToday ? <StreakClaimCard streak={streak} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="flex items-center gap-5 p-5">
            <div className="h-28 w-28 shrink-0">
              <PetMascot
                stage={summary.stage}
                healthState={summary.healthState}
                mood={summary.mood}
                isSleeping={summary.isSleeping}
              />
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-bold">{summary.name}</h2>
                <Badge variant="secondary">Lv {summary.level}</Badge>
                <Badge variant={summary.healthState === 'SICK' ? 'destructive' : 'outline'}>
                  {summary.stage}
                </Badge>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-muted-foreground">
                  <span>Mood</span>
                  <span>{summary.mood}%</span>
                </div>
                <Progress
                  value={summary.mood}
                  indicatorClassName={
                    summary.mood >= 70
                      ? 'bg-emerald-500'
                      : summary.mood >= 40
                        ? 'bg-amber-500'
                        : 'bg-destructive'
                  }
                />
              </div>

              <Button asChild size="sm" variant="gradient">
                <Link href="/pet/care">
                  Care for {summary.name}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              Level {level.level}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Progress value={level.progressPercent} />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {formatNumber(level.xp)} / {formatNumber(level.xpForNext)} XP to level{' '}
                {level.level + 1}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
              <Flame className="h-4 w-4 text-orange-500" aria-hidden />
              <span className="text-sm font-semibold">
                {streak.currentStreak}-day streak
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <QuickAction
          href="/games"
          icon={Gamepad2}
          title="Play a game"
          subtitle={`${energy.current}/${energy.max} energy`}
          tone="bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
        />
        <QuickAction
          href="/missions"
          icon={Target}
          title="Missions"
          subtitle={claimable > 0 ? `${claimable} ready to claim` : 'Check today’s tasks'}
          highlight={claimable > 0}
          tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
        />
        <QuickAction
          href="/rewards"
          icon={Gift}
          title="Reward shop"
          subtitle={`${formatNumber(profile.balances.REWARD_POINTS)} points`}
          tone="bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
            Climb the board
          </CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link href="/leaderboards">View</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Only validated game scores make the leaderboard. Play a mini game to get on it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  subtitle,
  tone,
  highlight,
}: {
  href: string;
  icon: typeof Gamepad2;
  title: string;
  subtitle: string;
  tone: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href} className="group">
      <Card
        className={
          highlight
            ? 'border-primary/50 ring-2 ring-primary/20 transition-transform group-hover:-translate-y-0.5'
            : 'transition-transform group-hover:-translate-y-0.5'
        }
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-bold">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
