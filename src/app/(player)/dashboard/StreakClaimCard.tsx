'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Flame, Coins, Sparkles } from 'lucide-react';

import type { StreakState } from '@/services/streak/streak.service';
import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function StreakClaimCard({ streak }: { streak: StreakState }) {
  const router = useRouter();
  const [isClaiming, setIsClaiming] = useState(false);

  async function claim() {
    setIsClaiming(true);
    try {
      const result = await api.post<{ coins: number; rewardPoints: number; streakDay: number }>(
        '/api/streak',
      );

      const parts = [
        result.coins > 0 ? `+${result.coins} coins` : null,
        result.rewardPoints > 0 ? `+${result.rewardPoints} reward points` : null,
      ].filter(Boolean);

      toast.success(`Day ${result.streakDay} claimed!`, { description: parts.join(' · ') });
      // Refresh the server components so every balance on the page updates at once —
      // rather than patching the header pill and letting the rest drift.
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsClaiming(false);
    }
  }

  return (
    <Card className="border-orange-300/60 bg-gradient-to-r from-orange-50 to-amber-50 dark:border-orange-900/60 dark:from-orange-950/40 dark:to-amber-950/30">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white">
            <Flame className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="font-bold">Daily reward — day {streak.cycleDay}</p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {streak.todayReward.coins > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                  {streak.todayReward.coins}
                </span>
              ) : null}
              {streak.todayReward.rewardPoints > 0 ? (
                <span className="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-300">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  {streak.todayReward.rewardPoints} reward points
                </span>
              ) : null}
              <span>· +{streak.todayReward.xp} XP</span>
            </p>
          </div>
        </div>

        <Button variant="gradient" onClick={claim} isLoading={isClaiming}>
          Claim
        </Button>
      </CardContent>
    </Card>
  );
}
