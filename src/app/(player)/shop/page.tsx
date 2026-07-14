'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Coins, Gem, ShoppingBag } from 'lucide-react';
import type { ItemCategory, ItemRarity } from '@prisma/client';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { ErrorState, CardSkeleton, EmptyState } from '@/components/ui/states';
import { formatNumber } from '@/lib/utils';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  imageUrl: string;
  coinPrice: number | null;
  gemPrice: number | null;
  owned: number;
  maxStack: number;
}

const RARITY_VARIANT: Record<ItemRarity, 'outline' | 'secondary' | 'default' | 'warning' | 'destructive'> = {
  COMMON: 'outline',
  UNCOMMON: 'secondary',
  RARE: 'default',
  EPIC: 'warning',
  LEGENDARY: 'destructive',
};

export default function ItemShopPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['shop'],
    queryFn: () =>
      api.get<{ items: ShopItem[]; balances: { COINS: number; GEMS: number } }>('/api/items'),
  });

  const purchaseMutation = useMutation({
    mutationFn: (input: { itemId: string; currency: 'COINS' | 'GEMS' }) =>
      api.post<{ itemName: string; totalCost: number }>('/api/items', {
        itemId: input.itemId,
        quantity: 1,
        currency: input.currency,
      }),
    onSuccess: (result) => {
      toast.success(`Bought ${result.itemName}`, { description: `−${result.totalCost}` });
      void queryClient.invalidateQueries({ queryKey: ['shop'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      router.refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading) return <CardSkeleton count={6} />;
  if (isError || !data) {
    return <ErrorState message="We couldn't load the shop." onRetry={() => void refetch()} />;
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="h-6 w-6" aria-hidden />}
        title="The shop is empty"
        message="Check back once an admin stocks it."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Item shop</h1>
        <p className="text-sm text-muted-foreground">
          Spend coins and gems on food, medicine, outfits and game tickets.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item) => {
          const atMaxStack = item.owned >= item.maxStack;
          const canAffordCoins = item.coinPrice !== null && data.balances.COINS >= item.coinPrice;
          const canAffordGems = item.gemPrice !== null && data.balances.GEMS >= item.gemPrice;

          return (
            <Card key={item.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-3xl" aria-hidden>
                    {item.imageUrl}
                  </span>
                  <Badge variant={RARITY_VARIANT[item.rarity]}>{item.rarity}</Badge>
                </div>

                <div>
                  <p className="font-bold leading-tight">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>

                {item.owned > 0 ? (
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    You own {item.owned}
                  </p>
                ) : null}

                <div className="mt-auto flex gap-2 pt-2">
                  {item.coinPrice !== null ? (
                    <Button
                      size="sm"
                      variant={canAffordCoins && !atMaxStack ? 'default' : 'outline'}
                      className="flex-1"
                      disabled={!canAffordCoins || atMaxStack || purchaseMutation.isPending}
                      onClick={() =>
                        purchaseMutation.mutate({ itemId: item.id, currency: 'COINS' })
                      }
                    >
                      <Coins className="h-3.5 w-3.5" aria-hidden />
                      {formatNumber(item.coinPrice)}
                    </Button>
                  ) : null}

                  {item.gemPrice !== null ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={!canAffordGems || atMaxStack || purchaseMutation.isPending}
                      onClick={() => purchaseMutation.mutate({ itemId: item.id, currency: 'GEMS' })}
                    >
                      <Gem className="h-3.5 w-3.5" aria-hidden />
                      {formatNumber(item.gemPrice)}
                    </Button>
                  ) : null}
                </div>

                {atMaxStack ? (
                  <p className="text-center text-[11px] text-muted-foreground">Max stack reached</p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
