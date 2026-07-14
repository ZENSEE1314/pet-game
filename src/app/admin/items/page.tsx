'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package } from 'lucide-react';
import type { ItemCategory, ItemRarity } from '@prisma/client';

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
import { formatNumber } from '@/lib/utils';

interface AdminItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  imageUrl: string;
  coinPrice: number | null;
  gemPrice: number | null;
  isActive: boolean;
  _count: { inventory: number };
}

export default function AdminItemsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-items'],
    queryFn: () => api.get<{ items: AdminItem[] }>('/api/admin/items'),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) => api.patch('/api/admin/items', input),
    onSuccess: () => {
      toast.success('Item updated');
      void queryClient.invalidateQueries({ queryKey: ['admin-items'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading) return <TableSkeleton />;
  if (isError || !data) {
    return <ErrorState message="We couldn't load items." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Items</h1>
        <p className="text-sm text-muted-foreground">{data.items.length} items in the shop</p>
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" aria-hidden />}
          title="No items"
          message="Run the seed script to populate the shop."
        />
      ) : (
        <Card>
          <CardContent className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Rarity</TableHead>
                  <TableHead className="text-right">Coins</TableHead>
                  <TableHead className="text-right">Gems</TableHead>
                  <TableHead className="text-right">Owned by</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xl" aria-hidden>
                          {item.imageUrl}
                        </span>
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">{item.category.replace(/_/g, ' ')}</Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary">{item.rarity}</Badge>
                    </TableCell>

                    <TableCell className="text-right tabular-nums">
                      {item.coinPrice !== null ? formatNumber(item.coinPrice) : '—'}
                    </TableCell>

                    <TableCell className="text-right tabular-nums">
                      {item.gemPrice !== null ? formatNumber(item.gemPrice) : '—'}
                    </TableCell>

                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {item._count.inventory}
                    </TableCell>

                    <TableCell className="text-right">
                      <Switch
                        checked={item.isActive}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: item.id, isActive: checked })
                        }
                        aria-label={`${item.isActive ? 'Deactivate' : 'Activate'} ${item.name}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
