'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Target } from 'lucide-react';
import type { MissionType, MissionFrequency, RewardType } from '@prisma/client';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import {
  Switch,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/primitives';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/ui/states';

interface AdminMission {
  id: string;
  code: string;
  title: string;
  description: string;
  type: MissionType;
  frequency: MissionFrequency;
  targetValue: number;
  rewardType: RewardType;
  rewardAmount: number;
  xpReward: number;
  claimRequired: boolean;
  isActive: boolean;
  _count: { userMissions: number };
}

export default function AdminMissionsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-missions'],
    queryFn: () => api.get<{ missions: AdminMission[] }>('/api/admin/missions'),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      api.patch('/api/admin/missions', input),
    onSuccess: () => {
      toast.success('Mission updated');
      void queryClient.invalidateQueries({ queryKey: ['admin-missions'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading) return <TableSkeleton />;
  if (isError || !data) {
    return <ErrorState message="We couldn't load missions." onRetry={() => void refetch()} />;
  }

  const daily = data.missions.filter((m) => m.frequency === 'DAILY');
  const weekly = data.missions.filter((m) => m.frequency === 'WEEKLY');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Missions</h1>
        <p className="text-sm text-muted-foreground">
          Deactivating a mission stops new progress; existing completions stay claimable.
        </p>
      </div>

      {data.missions.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" aria-hidden />}
          title="No missions"
          message="Run the seed script, or create missions via the API."
        />
      ) : (
        <>
          <MissionTable
            title="Daily missions"
            missions={daily}
            onToggle={(id, isActive) => toggleMutation.mutate({ id, isActive })}
          />
          <MissionTable
            title="Weekly missions"
            missions={weekly}
            onToggle={(id, isActive) => toggleMutation.mutate({ id, isActive })}
          />
        </>
      )}
    </div>
  );
}

function MissionTable({
  title,
  missions,
  onToggle,
}: {
  title: string;
  missions: AdminMission[];
  onToggle: (id: string, isActive: boolean) => void;
}) {
  if (missions.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-bold">{title}</p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mission</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">Reward</TableHead>
              <TableHead className="text-right">Players</TableHead>
              <TableHead>Claim</TableHead>
              <TableHead className="text-right">Active</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {missions.map((mission) => (
              <TableRow key={mission.id}>
                <TableCell>
                  <p className="font-semibold">{mission.title}</p>
                  <p className="text-xs text-muted-foreground">{mission.description}</p>
                </TableCell>

                <TableCell>
                  <Badge variant="outline">{mission.type.replace(/_/g, ' ')}</Badge>
                </TableCell>

                <TableCell className="text-right tabular-nums">{mission.targetValue}</TableCell>

                <TableCell className="text-right text-sm">
                  <span className="font-semibold tabular-nums">{mission.rewardAmount}</span>{' '}
                  <span className="text-xs text-muted-foreground">
                    {mission.rewardType.replace('_', ' ').toLowerCase()}
                  </span>
                  {mission.xpReward > 0 ? (
                    <p className="text-[11px] text-muted-foreground">+{mission.xpReward} XP</p>
                  ) : null}
                </TableCell>

                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {mission._count.userMissions}
                </TableCell>

                <TableCell>
                  <Badge variant={mission.claimRequired ? 'secondary' : 'outline'}>
                    {mission.claimRequired ? 'Manual' : 'Auto'}
                  </Badge>
                </TableCell>

                <TableCell className="text-right">
                  <Switch
                    checked={mission.isActive}
                    onCheckedChange={(checked) => onToggle(mission.id, checked)}
                    aria-label={`${mission.isActive ? 'Deactivate' : 'Activate'} ${mission.title}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
