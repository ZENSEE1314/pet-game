'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Target, Coins, Sparkles, Gem, Check } from 'lucide-react';
import type { MissionFrequency, UserMissionStatus, RewardType } from '@prisma/client';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/primitives';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';

interface Mission {
  id: string;
  userMissionId: string | null;
  title: string;
  description: string;
  target: number;
  progress: number;
  progressPercent: number;
  status: UserMissionStatus;
  rewardType: RewardType;
  rewardAmount: number;
  xpReward: number;
}

const REWARD_ICON: Partial<Record<RewardType, typeof Coins>> = {
  COINS: Coins,
  REWARD_POINTS: Sparkles,
  GEMS: Gem,
};

export default function MissionsPage() {
  const [frequency, setFrequency] = useState<MissionFrequency>('DAILY');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Missions</h1>
        <p className="text-sm text-muted-foreground">
          Progress updates automatically. Rewards are yours to claim.
        </p>
      </div>

      <Tabs value={frequency} onValueChange={(value) => setFrequency(value as MissionFrequency)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="DAILY" className="flex-1 sm:flex-none">
            Daily
          </TabsTrigger>
          <TabsTrigger value="WEEKLY" className="flex-1 sm:flex-none">
            Weekly
          </TabsTrigger>
        </TabsList>

        <TabsContent value="DAILY">
          <MissionList frequency="DAILY" />
        </TabsContent>
        <TabsContent value="WEEKLY">
          <MissionList frequency="WEEKLY" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MissionList({ frequency }: { frequency: MissionFrequency }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['missions', frequency],
    queryFn: () => api.get<{ missions: Mission[] }>(`/api/missions?frequency=${frequency}`),
  });

  const claimMutation = useMutation({
    mutationFn: (userMissionId: string) => api.post('/api/missions', { userMissionId }),
    onSuccess: (result: unknown) => {
      const typed = result as { rewards: { coins: number; rewardPoints: number; gems: number; xp: number } };
      const parts = [
        typed.rewards.coins > 0 ? `+${typed.rewards.coins} coins` : null,
        typed.rewards.rewardPoints > 0 ? `+${typed.rewards.rewardPoints} points` : null,
        typed.rewards.gems > 0 ? `+${typed.rewards.gems} gems` : null,
        typed.rewards.xp > 0 ? `+${typed.rewards.xp} XP` : null,
      ].filter(Boolean);

      toast.success('Reward claimed! 🎉', { description: parts.join(' · ') });
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
      router.refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading) return <LoadingState label="Loading missions…" />;
  if (isError || !data) {
    return <ErrorState message="We couldn't load your missions." onRetry={() => void refetch()} />;
  }

  if (data.missions.length === 0) {
    return (
      <EmptyState
        icon={<Target className="h-6 w-6" aria-hidden />}
        title="No missions right now"
        message="Check back soon — new missions appear every day."
      />
    );
  }

  return (
    <div className="space-y-3">
      {data.missions.map((mission) => {
        const Icon = REWARD_ICON[mission.rewardType] ?? Coins;
        const isClaimable = mission.status === 'COMPLETED' && mission.userMissionId;
        const isClaimed = mission.status === 'CLAIMED';

        return (
          <Card
            key={mission.id}
            className={isClaimable ? 'border-primary/50 ring-2 ring-primary/20' : undefined}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{mission.title}</p>
                  {isClaimed ? (
                    <Badge variant="success">
                      <Check className="mr-1 h-3 w-3" aria-hidden />
                      Claimed
                    </Badge>
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground">{mission.description}</p>

                <Progress
                  value={mission.progressPercent}
                  className="h-2"
                  indicatorClassName={mission.status === 'IN_PROGRESS' ? undefined : 'bg-emerald-500'}
                  aria-label={`${mission.progress} of ${mission.target}`}
                />

                <div className="flex items-center justify-between text-xs">
                  <span className="tabular-nums text-muted-foreground">
                    {mission.progress} / {mission.target}
                  </span>
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {mission.rewardAmount}
                    </span>
                    {mission.xpReward > 0 ? (
                      <span className="text-muted-foreground">+{mission.xpReward} XP</span>
                    ) : null}
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                variant={isClaimable ? 'gradient' : 'outline'}
                disabled={!isClaimable || claimMutation.isPending}
                isLoading={claimMutation.isPending && claimMutation.variables === mission.userMissionId}
                onClick={() => mission.userMissionId && claimMutation.mutate(mission.userMissionId)}
              >
                {isClaimed ? 'Done' : isClaimable ? 'Claim' : 'In progress'}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
