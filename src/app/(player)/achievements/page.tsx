import { Trophy, Lock } from 'lucide-react';

import { requireUser } from '@/lib/rbac';
import { listAchievements } from '@/services/achievement/achievement.service';
import { Card, CardContent } from '@/components/ui/card';
import { Progress, Badge } from '@/components/ui/primitives';
import { formatDate, cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AchievementsPage() {
  const user = await requireUser();
  const achievements = await listAchievements(user.id);

  const unlocked = achievements.filter((a) => a.isUnlocked).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Achievements</h1>
          <p className="text-sm text-muted-foreground">
            {unlocked} of {achievements.length} unlocked
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
          <Trophy className="h-4 w-4" aria-hidden />
          {Math.round((unlocked / Math.max(1, achievements.length)) * 100)}%
        </div>
      </div>

      <Progress
        value={(unlocked / Math.max(1, achievements.length)) * 100}
        indicatorClassName="bg-amber-500"
        aria-label={`${unlocked} of ${achievements.length} achievements unlocked`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {achievements.map((achievement) => (
          <Card
            key={achievement.id}
            className={cn(
              'transition-opacity',
              achievement.isUnlocked
                ? 'border-amber-300/60 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20'
                : 'opacity-75',
            )}
          >
            <CardContent className="flex items-start gap-3 p-4">
              <div
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl',
                  achievement.isUnlocked
                    ? 'bg-amber-100 dark:bg-amber-950/60'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {achievement.isUnlocked ? (
                  <span aria-hidden>{achievement.iconUrl}</span>
                ) : (
                  <Lock className="h-5 w-5" aria-hidden />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{achievement.title}</p>
                  {achievement.isUnlocked ? <Badge variant="warning">Unlocked</Badge> : null}
                </div>

                <p className="text-xs text-muted-foreground">{achievement.description}</p>

                {achievement.isUnlocked ? (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Earned {achievement.unlockedAt ? formatDate(achievement.unlockedAt) : ''}
                    {achievement.badgeLabel ? ` · ${achievement.badgeLabel}` : ''}
                  </p>
                ) : (
                  <>
                    <Progress value={achievement.progressPercent} className="h-1.5" />
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {achievement.progress} / {achievement.target} ·{' '}
                      {achievement.rewardAmount > 0
                        ? `${achievement.rewardAmount} ${achievement.rewardType.replace('_', ' ').toLowerCase()}`
                        : 'Badge'}
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
