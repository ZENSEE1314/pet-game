import Link from 'next/link';
import { Settings, Trophy, Flame, Sparkles, Lock, Ticket, Users } from 'lucide-react';

import { requireUser } from '@/lib/rbac';
import { getFullProfile } from '@/services/user/user.service';
import { getLevelProgress, unlocksForLevel, nextUnlock } from '@/services/level/level.service';
import { countUnlocked } from '@/services/achievement/achievement.service';
import { getStreakState } from '@/services/streak/streak.service';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Progress,
  Separator,
} from '@/components/ui/primitives';
import { CurrencyPills } from '@/components/layout/CurrencyPills';
import { formatDate, formatNumber, initials } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser();

  const [profile, level, achievements, streak] = await Promise.all([
    getFullProfile(user.id),
    getLevelProgress(user.id),
    countUnlocked(user.id),
    getStreakState(user.id),
  ]);

  const displayName = profile.profile?.displayName ?? 'Player';
  const upcoming = nextUnlock(level.level);
  const unlocked = unlocksForLevel(level.level);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="pq-gradient h-20" aria-hidden />
        <CardContent className="-mt-10 space-y-4 p-5">
          <div className="flex items-end gap-4">
            <Avatar className="h-20 w-20 border-4 border-background">
              {profile.profile?.avatarUrl ? (
                <AvatarImage src={profile.profile.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="text-lg">{initials(displayName)}</AvatarFallback>
            </Avatar>

            <div className="flex-1 pb-1">
              <h1 className="text-xl font-extrabold tracking-tight">{displayName}</h1>
              <p className="text-sm text-muted-foreground">@{profile.profile?.username}</p>
            </div>

            <Button asChild variant="outline" size="sm">
              <Link href="/settings">
                <Settings className="h-4 w-4" aria-hidden />
                Edit
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Level {level.level}</Badge>
            <Badge variant="outline">{profile.role}</Badge>
            {profile.emailVerified ? (
              <Badge variant="success">Verified</Badge>
            ) : (
              <Badge variant="warning">Email unverified</Badge>
            )}
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs font-semibold text-muted-foreground">
              <span>Level {level.level}</span>
              <span>
                {formatNumber(level.xp)} / {formatNumber(level.xpForNext)} XP
              </span>
            </div>
            <Progress value={level.progressPercent} />
            {upcoming ? (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden />
                {upcoming.feature} unlocks at level {upcoming.level}
              </p>
            ) : null}
          </div>

          <CurrencyPills balances={profile.balances as never} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Flame} label="Day streak" value={streak.currentStreak} tone="text-orange-500" />
        <StatCard icon={Trophy} label="Achievements" value={achievements} tone="text-amber-500" />
        <StatCard
          icon={Sparkles}
          label="Longest streak"
          value={streak.longestStreak}
          tone="text-purple-500"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Unlocked features</CardTitle>
        </CardHeader>
        <CardContent>
          {unlocked.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Reach level 2 to unlock your first feature.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unlocked.map((entry) => (
                <Badge key={entry.feature} variant="success">
                  {entry.feature}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y p-0">
          <ProfileLink href="/referrals" icon={Users} label="Refer a friend" />
          <ProfileLink href="/promo" icon={Ticket} label="Enter a promo code" />
          <ProfileLink href="/achievements" icon={Trophy} label="Achievements" />
          <ProfileLink href="/settings" icon={Settings} label="Settings" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-5 text-sm">
          <Row label="Email" value={profile.email} />
          <Separator />
          <Row label="Joined" value={formatDate(profile.createdAt)} />
          <Separator />
          <Row label="Referral code" value={profile.profile?.referralCode ?? '—'} mono />
          {profile.profile?.country ? (
            <>
              <Separator />
              <Row label="Country" value={profile.profile.country} />
            </>
          ) : null}
          <Separator />
          <Row label="Timezone" value={profile.profile?.timezone ?? '—'} />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Flame;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1 p-4">
        <Icon className={`h-5 w-5 ${tone}`} aria-hidden />
        <p className="text-xl font-black tabular-nums">{value}</p>
        <p className="text-center text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function ProfileLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Users;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
    >
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      {label}
    </Link>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono font-semibold' : 'font-semibold'}>{value}</span>
    </div>
  );
}
