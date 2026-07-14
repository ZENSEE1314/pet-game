'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Minus, Gift, AlertTriangle } from 'lucide-react';
import type { RewardCategory, CollectionMethod } from '@prisma/client';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Input,
  Label,
  Select,
  Switch,
  Badge,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/primitives';
import { CardSkeleton, ErrorState, EmptyState } from '@/components/ui/states';
import { formatNumber } from '@/lib/utils';

const LOW_STOCK = 5;

interface AdminReward {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  category: RewardCategory;
  pointCost: number;
  stockTotal: number;
  stockAvailable: number;
  stockReserved: number;
  perUserLimit: number;
  collectionMethod: CollectionMethod;
  collectionLocation: string | null;
  isActive: boolean;
}

const CATEGORIES: RewardCategory[] = [
  'DIGITAL_VOUCHER',
  'DISCOUNT_COUPON',
  'FOOD_AND_DRINK',
  'TOY',
  'MERCHANDISE',
  'FREE_GAME_ATTEMPT',
  'EVENT_TICKET',
  'LIMITED_EDITION',
];

export default function AdminRewardsPage() {
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [stockTarget, setStockTarget] = useState<AdminReward | null>(null);
  const [stockDelta, setStockDelta] = useState('10');
  const [stockReason, setStockReason] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-rewards'],
    queryFn: () => api.get<{ rewards: AdminReward[] }>('/api/admin/rewards'),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-rewards'] });

  const stockMutation = useMutation({
    mutationFn: (input: { rewardId: string; delta: number; reason: string }) =>
      api.patch('/api/admin/rewards', input),
    onSuccess: () => {
      toast.success('Stock adjusted');
      setStockTarget(null);
      setStockReason('');
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      api.patch(`/api/admin/rewards/${input.id}`, { isActive: input.isActive }),
    onSuccess: () => {
      toast.success('Reward updated');
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.post('/api/admin/rewards', values),
    onSuccess: () => {
      toast.success('Reward created');
      setIsCreating(false);
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading) return <CardSkeleton count={6} />;
  if (isError || !data) {
    return <ErrorState message="We couldn't load rewards." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rewards</h1>
          <p className="text-sm text-muted-foreground">{data.rewards.length} rewards configured</p>
        </div>

        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          New reward
        </Button>
      </div>

      {data.rewards.length === 0 ? (
        <EmptyState
          icon={<Gift className="h-6 w-6" aria-hidden />}
          title="No rewards yet"
          message="Create your first reward for players to redeem."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.rewards.map((reward) => {
            const isLow = reward.stockAvailable <= LOW_STOCK;

            return (
              <Card
                key={reward.id}
                className={isLow && reward.isActive ? 'border-amber-400/60' : undefined}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl" aria-hidden>
                      {reward.imageUrl.startsWith('http') ? '🎁' : reward.imageUrl}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{reward.name}</p>
                        <Badge variant="points">{formatNumber(reward.pointCost)} pts</Badge>
                        {isLow && reward.isActive ? (
                          <Badge variant="warning">
                            <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
                            Low stock
                          </Badge>
                        ) : null}
                      </div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {reward.description}
                      </p>
                    </div>

                    <Switch
                      checked={reward.isActive}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: reward.id, isActive: checked })
                      }
                      aria-label={`${reward.isActive ? 'Pause' : 'Activate'} ${reward.name}`}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <Stat label="Available" value={reward.stockAvailable} highlight={isLow} />
                    <Stat label="Reserved" value={reward.stockReserved} />
                    <Stat label="Total" value={reward.stockTotal} />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setStockTarget(reward);
                        setStockDelta('10');
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Restock
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setStockTarget(reward);
                        setStockDelta('-1');
                      }}
                    >
                      <Minus className="h-3.5 w-3.5" aria-hidden />
                      Reduce
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(stockTarget)} onOpenChange={(open) => !open && setStockTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock — {stockTarget?.name}</DialogTitle>
            <DialogDescription>
              Currently {stockTarget?.stockAvailable} available, {stockTarget?.stockReserved}{' '}
              reserved. This writes an entry to the stock ledger and the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="delta">Change (negative to reduce)</Label>
              <Input
                id="delta"
                type="number"
                value={stockDelta}
                onChange={(event) => setStockDelta(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="stockReason">Reason (required)</Label>
              <Textarea
                id="stockReason"
                value={stockReason}
                onChange={(event) => setStockReason(event.target.value)}
                placeholder="e.g. New shipment of 20 mugs arrived"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStockTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                Number(stockDelta) === 0 ||
                stockReason.trim().length < 3 ||
                stockMutation.isPending
              }
              isLoading={stockMutation.isPending}
              onClick={() =>
                stockTarget &&
                stockMutation.mutate({
                  rewardId: stockTarget.id,
                  delta: Number(stockDelta),
                  reason: stockReason.trim(),
                })
              }
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateRewardDialog
        open={isCreating}
        onClose={() => setIsCreating(false)}
        onSubmit={(values) => createMutation.mutate(values)}
        isPending={createMutation.isPending}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-2 ${highlight ? 'bg-amber-100 dark:bg-amber-950/50' : 'bg-secondary'}`}>
      <p className="font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function CreateRewardDialog({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    imageUrl: '🎁',
    category: 'MERCHANDISE' as RewardCategory,
    pointCost: 100,
    stockTotal: 10,
    perUserLimit: 1,
    collectionMethod: 'PHYSICAL_COLLECTION' as CollectionMethod,
    collectionLocation: '',
    claimValidHours: 168,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const isValid = form.name.length >= 2 && form.slug.length >= 2 && form.description.length >= 2;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New reward</DialogTitle>
          <DialogDescription>Players will spend reward points on this.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => {
                  set('name', event.target.value);
                  // Auto-slug so an admin never has to think about URL-safety.
                  set(
                    'slug',
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, ''),
                  );
                }}
              />
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" value={form.slug} onChange={(event) => set('slug', event.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="imageUrl">Icon (emoji or URL)</Label>
              <Input
                id="imageUrl"
                value={form.imageUrl}
                onChange={(event) => set('imageUrl', event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                value={form.category}
                onChange={(event) => set('category', event.target.value as RewardCategory)}
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="pointCost">Point cost</Label>
              <Input
                id="pointCost"
                type="number"
                min={1}
                value={form.pointCost}
                onChange={(event) => set('pointCost', Number(event.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="stockTotal">Stock</Label>
              <Input
                id="stockTotal"
                type="number"
                min={0}
                value={form.stockTotal}
                onChange={(event) => set('stockTotal', Number(event.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="perUserLimit">Per-user limit</Label>
              <Input
                id="perUserLimit"
                type="number"
                min={1}
                value={form.perUserLimit}
                onChange={(event) => set('perUserLimit', Number(event.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="collectionMethod">Collection</Label>
              <Select
                id="collectionMethod"
                value={form.collectionMethod}
                onChange={(event) => set('collectionMethod', event.target.value as CollectionMethod)}
              >
                <option value="PHYSICAL_COLLECTION">Physical collection</option>
                <option value="DIGITAL_CODE">Digital code</option>
                <option value="DELIVERY">Delivery</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="collectionLocation">Location</Label>
              <Input
                id="collectionLocation"
                value={form.collectionLocation}
                onChange={(event) => set('collectionLocation', event.target.value)}
                placeholder="e.g. Level 2 Service Counter"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!isValid || isPending}
            isLoading={isPending}
            onClick={() =>
              onSubmit({
                ...form,
                collectionLocation: form.collectionLocation || null,
                isActive: true,
              })
            }
          >
            Create reward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
