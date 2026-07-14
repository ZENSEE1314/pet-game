import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Utensils, Droplets, Gamepad2, Moon, Pill, ArrowRight } from 'lucide-react';

import { requireUser } from '@/lib/rbac';
import { getPetForUser, petSummary, getDailyCareStatus, getPetActivities } from '@/services/pet/pet.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress, Badge, Separator } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { PetMascot } from '@/components/pet/PetMascot';
import { relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STAT_META = [
  { key: 'hunger', label: 'Hunger', icon: Utensils, colour: 'bg-orange-500' },
  { key: 'happiness', label: 'Happiness', icon: Gamepad2, colour: 'bg-pink-500' },
  { key: 'energy', label: 'Energy', icon: Moon, colour: 'bg-sky-500' },
  { key: 'cleanliness', label: 'Cleanliness', icon: Droplets, colour: 'bg-cyan-500' },
  { key: 'health', label: 'Health', icon: Pill, colour: 'bg-emerald-500' },
] as const;

export default async function PetPage() {
  const user = await requireUser();
  const pet = await getPetForUser(user.id);

  if (!pet) {
    return (
      <EmptyState
        title="You don't have a pet yet"
        message="Adopt your starter pet to begin."
        action={
          <Button asChild variant="gradient">
            <Link href="/onboarding">Adopt a pet</Link>
          </Button>
        }
      />
    );
  }

  const summary = petSummary(pet);
  const [dailyCare, activities] = await Promise.all([
    getDailyCareStatus(user.id, pet.id),
    getPetActivities(pet.id, 8),
  ]);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="pq-gradient h-24" aria-hidden />
        <CardContent className="-mt-16 space-y-4 p-5">
          <div className="mx-auto h-36 w-36 rounded-full bg-background p-2 shadow-lg">
            <PetMascot
              stage={summary.stage}
              healthState={summary.healthState}
              mood={summary.mood}
              isSleeping={summary.isSleeping}
            />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight">{summary.name}</h1>
            <p className="text-sm text-muted-foreground">
              {summary.species.name} · {summary.moodLabel}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Badge variant="secondary">Level {summary.level}</Badge>
              <Badge variant="outline">{summary.stage}</Badge>
              <Badge variant={summary.healthState === 'SICK' ? 'destructive' : 'success'}>
                {summary.healthState}
              </Badge>
              {summary.isSleeping ? <Badge variant="outline">Sleeping</Badge> : null}
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs font-semibold text-muted-foreground">
              <span>Pet XP</span>
              <span>
                {summary.xp} / {summary.xpForNext}
              </span>
            </div>
            <Progress value={Math.round((summary.xp / summary.xpForNext) * 100)} />
          </div>

          <Button asChild variant="gradient" className="w-full">
            <Link href="/pet/care">
              Care for {summary.name}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vital stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3.5">
          {STAT_META.map((stat) => {
            const value = summary.stats[stat.key];
            const isLow = value < 25;

            return (
              <div key={stat.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <stat.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {stat.label}
                  </span>
                  <span
                    className={
                      isLow ? 'font-bold text-destructive' : 'font-semibold tabular-nums'
                    }
                  >
                    {value}
                    {isLow ? <span className="sr-only"> — critically low</span> : null}
                  </span>
                </div>
                <Progress
                  value={value}
                  indicatorClassName={isLow ? 'bg-destructive' : stat.colour}
                  aria-label={`${stat.label}: ${value} out of 100`}
                />
              </div>
            );
          })}

          <Separator className="my-2" />

          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Friendship</span>
            <span className="font-semibold tabular-nums">{summary.stats.friendship} / 100</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Age</span>
            <span className="font-semibold tabular-nums">{summary.ageHours}h</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Care actions</span>
            <span className="font-semibold tabular-nums">{summary.totalCareActions}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Today&apos;s care</CardTitle>
        </CardHeader>
        <CardContent>
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
          <p className="mt-3 text-sm text-muted-foreground">
            {dailyCare.isBonusClaimed
              ? `Daily bonus already earned today (+${dailyCare.bonus.coins} coins, +${dailyCare.bonus.rewardPoints} reward points).`
              : `Complete all three to earn +${dailyCare.bonus.coins} coins and +${dailyCare.bonus.rewardPoints} reward points.`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet — go and feed your pet.</p>
          ) : (
            <ul className="space-y-2">
              {activities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm"
                >
                  <span className="font-medium capitalize">{activity.action.toLowerCase()}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {activity.coinsAwarded > 0 ? (
                      <span className="font-semibold text-amber-600">+{activity.coinsAwarded} coins</span>
                    ) : null}
                    {relativeTime(activity.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
