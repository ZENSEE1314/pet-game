'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gift, Sparkles, MapPin, Package, AlertCircle } from 'lucide-react';
import type { RewardCategory, CollectionMethod } from '@prisma/client';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
} from '@/components/ui/primitives';
import { LoadingState, ErrorState, EmptyState, CardSkeleton } from '@/components/ui/states';
import { formatNumber, formatDate } from '@/lib/utils';

interface Reward {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: RewardCategory;
  pointCost: number;
  stockAvailable: number;
  perUserLimit: number;
  userClaimCount: number;
  canClaim: boolean;
  collectionMethod: CollectionMethod;
  collectionLocation: string | null;
  termsAndConditions: string | null;
  expiresAt: string | null;
}

const CATEGORIES: { value: RewardCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All rewards' },
  { value: 'DIGITAL_VOUCHER', label: 'Digital vouchers' },
  { value: 'DISCOUNT_COUPON', label: 'Discount coupons' },
  { value: 'FOOD_AND_DRINK', label: 'Food & drink' },
  { value: 'TOY', label: 'Toys' },
  { value: 'MERCHANDISE', label: 'Merchandise' },
  { value: 'FREE_GAME_ATTEMPT', label: 'Game attempts' },
  { value: 'EVENT_TICKET', label: 'Event tickets' },
  { value: 'LIMITED_EDITION', label: 'Limited edition' },
];

export default function RewardShopPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<RewardCategory | 'ALL'>('ALL');
  const [selected, setSelected] = useState<Reward | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['rewards', category],
    queryFn: () =>
      api.get<{ rewards: Reward[]; balances: { REWARD_POINTS: number } }>(
        `/api/rewards${category === 'ALL' ? '' : `?category=${category}`}`,
      ),
  });

  const redeemMutation = useMutation({
    mutationFn: (rewardId: string) => api.post<{ claimId: string }>('/api/rewards', { rewardId }),
    onSuccess: (result) => {
      setSelected(null);
      toast.success('Reward claimed! 🎁', { description: 'Your QR code is ready.' });
      void queryClient.invalidateQueries({ queryKey: ['rewards'] });
      router.push(`/claims/${result.claimId}`);
      router.refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading) return <CardSkeleton count={6} />;
  if (isError || !data) {
    return <ErrorState message="We couldn't load the reward shop." onRetry={() => void refetch()} />;
  }

  const points = data.balances.REWARD_POINTS;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Reward shop</h1>
          <p className="text-sm text-muted-foreground">
            Turn your reward points into things you can actually hold.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-purple-100 px-4 py-2 font-bold text-purple-800 dark:bg-purple-950/60 dark:text-purple-200">
          <Sparkles className="h-4 w-4" aria-hidden />
          {formatNumber(points)}
        </div>
      </div>

      <Select
        value={category}
        onChange={(event) => setCategory(event.target.value as RewardCategory | 'ALL')}
        aria-label="Filter by category"
        className="sm:max-w-xs"
      >
        {CATEGORIES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      {data.rewards.length === 0 ? (
        <EmptyState
          icon={<Gift className="h-6 w-6" aria-hidden />}
          title="No rewards in this category"
          message="Try another category — or check back after the next restock."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.rewards.map((reward) => {
            const affordable = points >= reward.pointCost;
            const outOfStock = reward.stockAvailable <= 0;
            const limitReached = reward.userClaimCount >= reward.perUserLimit;

            return (
              <Card key={reward.id} className="flex flex-col overflow-hidden">
                <div className="flex h-32 items-center justify-center bg-gradient-to-br from-purple-500 to-fuchsia-500 text-5xl">
                  {reward.imageUrl.startsWith('http') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={reward.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span aria-hidden>{reward.imageUrl}</span>
                  )}
                </div>

                <CardContent className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold leading-tight">{reward.name}</p>
                    <Badge variant="points" className="shrink-0">
                      {formatNumber(reward.pointCost)}
                    </Badge>
                  </div>

                  <p className="line-clamp-2 text-xs text-muted-foreground">{reward.description}</p>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <Badge variant="outline">
                      <Package className="mr-1 h-3 w-3" aria-hidden />
                      {outOfStock ? 'Out of stock' : `${reward.stockAvailable} left`}
                    </Badge>
                    {reward.collectionLocation ? (
                      <Badge variant="outline">
                        <MapPin className="mr-1 h-3 w-3" aria-hidden />
                        {reward.collectionLocation}
                      </Badge>
                    ) : null}
                  </div>

                  <Button
                    className="mt-auto"
                    variant={affordable && !outOfStock && !limitReached ? 'gradient' : 'outline'}
                    disabled={!affordable || outOfStock || limitReached}
                    onClick={() => setSelected(reward)}
                  >
                    {outOfStock
                      ? 'Out of stock'
                      : limitReached
                        ? 'Limit reached'
                        : !affordable
                          ? `Need ${formatNumber(reward.pointCost - points)} more`
                          : 'Redeem'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Redeem {selected.name}?</DialogTitle>
                <DialogDescription>
                  This will spend{' '}
                  <strong className="text-foreground">
                    {formatNumber(selected.pointCost)} reward points
                  </strong>{' '}
                  and reserve one unit for you.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 rounded-xl bg-secondary p-4 text-sm">
                <p className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-muted-foreground">
                    {selected.collectionMethod === 'DIGITAL_CODE'
                      ? 'Your code will appear in My Claims immediately.'
                      : selected.collectionMethod === 'DELIVERY'
                        ? 'We’ll arrange delivery. Track it in My Claims.'
                        : `Show your QR code at ${selected.collectionLocation ?? 'the collection point'} to collect.`}
                  </span>
                </p>

                <p className="text-xs text-muted-foreground">
                  Points are not refunded if you let the claim expire. Balance after:{' '}
                  <strong className="text-foreground">
                    {formatNumber(points - selected.pointCost)}
                  </strong>
                </p>

                {selected.termsAndConditions ? (
                  <p className="border-t pt-2 text-xs text-muted-foreground">
                    {selected.termsAndConditions}
                  </p>
                ) : null}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button
                  variant="gradient"
                  isLoading={redeemMutation.isPending}
                  onClick={() => redeemMutation.mutate(selected.id)}
                >
                  Confirm redemption
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
