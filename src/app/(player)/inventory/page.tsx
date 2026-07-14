'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Backpack, Shirt, Sparkles } from 'lucide-react';
import type { ItemCategory } from '@prisma/client';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { ErrorState, CardSkeleton, EmptyState } from '@/components/ui/states';

interface InventoryRow {
  id: string;
  quantity: number;
  isEquipped: boolean;
  isConsumable: boolean;
  isEquippable: boolean;
  item: {
    id: string;
    name: string;
    description: string;
    category: ItemCategory;
    imageUrl: string;
  };
}

export default function InventoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<{ inventory: InventoryRow[] }>('/api/inventory'),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    void queryClient.invalidateQueries({ queryKey: ['pet'] });
    router.refresh();
  };

  const useMutation_ = useMutation({
    mutationFn: (itemId: string) =>
      api.post<{ itemName: string; remaining: number }>('/api/inventory', { itemId }),
    onSuccess: (result) => {
      toast.success(`Used ${result.itemName}`, {
        description: `${result.remaining} left.`,
      });
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const equipMutation = useMutation({
    mutationFn: (input: { itemId: string; equip: boolean }) =>
      api.patch<{ itemName: string; isEquipped: boolean }>('/api/inventory', input),
    onSuccess: (result) => {
      toast.success(result.isEquipped ? `${result.itemName} equipped` : `${result.itemName} removed`);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading) return <CardSkeleton count={4} />;
  if (isError || !data) {
    return <ErrorState message="We couldn't load your inventory." onRetry={() => void refetch()} />;
  }

  if (data.inventory.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Inventory</h1>
        <EmptyState
          icon={<Backpack className="h-6 w-6" aria-hidden />}
          title="Your bag is empty"
          message="Buy food, medicine and outfits from the item shop."
          action={
            <Button asChild variant="gradient">
              <Link href="/shop">Go to the shop</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Use consumables on your pet, or dress them up with clothing.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.inventory.map((row) => (
          <Card key={row.id} className={row.isEquipped ? 'border-primary/50' : undefined}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="text-3xl" aria-hidden>
                {row.item.imageUrl}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{row.item.name}</p>
                  <Badge variant="secondary">×{row.quantity}</Badge>
                  {row.isEquipped ? (
                    <Badge variant="success">
                      <Shirt className="mr-1 h-3 w-3" aria-hidden />
                      Worn
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">{row.item.description}</p>
              </div>

              {row.isConsumable ? (
                <Button
                  size="sm"
                  disabled={useMutation_.isPending}
                  isLoading={useMutation_.isPending && useMutation_.variables === row.item.id}
                  onClick={() => useMutation_.mutate(row.item.id)}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Use
                </Button>
              ) : row.isEquippable ? (
                <Button
                  size="sm"
                  variant={row.isEquipped ? 'outline' : 'default'}
                  disabled={equipMutation.isPending}
                  onClick={() =>
                    equipMutation.mutate({ itemId: row.item.id, equip: !row.isEquipped })
                  }
                >
                  {row.isEquipped ? 'Remove' : 'Wear'}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
