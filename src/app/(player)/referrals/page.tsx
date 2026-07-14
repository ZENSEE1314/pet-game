'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, Copy, Check, Sparkles, Coins } from 'lucide-react';
import type { ReferralStatus } from '@prisma/client';

import { api } from '@/features/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, Progress, Input } from '@/components/ui/primitives';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { formatDate } from '@/lib/utils';

interface ReferralOverview {
  referralCode: string;
  qualifyingLevel: number;
  rewardPerReferral: { points: number; coins: number };
  totalReferrals: number;
  qualifiedReferrals: number;
  pointsEarned: number;
  referrals: {
    id: string;
    status: ReferralStatus;
    displayName: string;
    level: number;
    joinedAt: string;
    riskFlagged: boolean;
    progressToQualify: number;
  }[];
}

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => api.get<ReferralOverview>('/api/referrals'),
  });

  if (isLoading) return <LoadingState label="Loading your referrals…" />;
  if (isError || !data) {
    return <ErrorState message="We couldn't load your referrals." onRetry={() => void refetch()} />;
  }

  const link =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/register?ref=${data.referralCode}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Invite link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Your browser wouldn't let us copy. Select the link and copy it manually.");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Refer a friend</h1>
        <p className="text-sm text-muted-foreground">
          You both get rewarded once they reach level {data.qualifyingLevel}.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="pq-gradient p-5 text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/80">
            Your referral code
          </p>
          <p className="font-mono text-3xl font-black tracking-widest">{data.referralCode}</p>
        </div>

        <CardContent className="space-y-3 p-5">
          <div className="flex gap-2">
            <Input value={link} readOnly aria-label="Your invite link" className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copy} aria-label="Copy invite link">
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-300">
              <Sparkles className="h-4 w-4" aria-hidden />+{data.rewardPerReferral.points} points
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
              <Coins className="h-4 w-4" aria-hidden />+{data.rewardPerReferral.coins} coins
            </span>
            <span className="text-muted-foreground">per qualified referral</span>
          </div>

          {/* Being upfront about the qualification gate is deliberate: a referral
              scheme that pays "later, maybe" without saying so reads as a scam. */}
          <p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
            Rewards are paid once your friend reaches level {data.qualifyingLevel} — not at signup.
            This is what keeps the scheme worth running for everyone.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Invited" value={data.totalReferrals} />
        <Stat label="Qualified" value={data.qualifiedReferrals} />
        <Stat label="Points earned" value={data.pointsEarned} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" aria-hidden />
            Your invites
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {data.referrals.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No invites yet" message="Share your code and start earning." />
            </div>
          ) : (
            <ul className="divide-y">
              {data.referrals.map((referral) => (
                <li key={referral.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{referral.displayName}</p>
                      <Badge
                        variant={
                          referral.status === 'REWARDED'
                            ? 'success'
                            : referral.riskFlagged
                              ? 'warning'
                              : 'outline'
                        }
                      >
                        {referral.riskFlagged && referral.status !== 'REWARDED'
                          ? 'Under review'
                          : referral.status}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Level {referral.level} · joined {formatDate(referral.joinedAt)}
                    </p>

                    {referral.status !== 'REWARDED' ? (
                      <Progress value={referral.progressToQualify} className="mt-1.5 h-1.5" />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-2xl font-black tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
