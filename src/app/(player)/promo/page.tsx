'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ticket, Gift } from 'lucide-react';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Badge } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { formatDate } from '@/lib/utils';

interface PromoHistory {
  history: {
    id: string;
    rewardAmount: number;
    createdAt: string;
    promoCode: { code: string; rewardType: string };
  }[];
}

export default function PromoPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');

  const { data } = useQuery({
    queryKey: ['promo-history'],
    queryFn: () => api.get<PromoHistory>('/api/promo'),
  });

  const redeemMutation = useMutation({
    mutationFn: (value: string) =>
      api.post<{ granted: { coins: number; rewardPoints: number; gems: number; xp: number } }>(
        '/api/promo',
        { code: value },
      ),
    onSuccess: (result) => {
      const parts = [
        result.granted.coins > 0 ? `+${result.granted.coins} coins` : null,
        result.granted.rewardPoints > 0 ? `+${result.granted.rewardPoints} points` : null,
        result.granted.gems > 0 ? `+${result.granted.gems} gems` : null,
      ].filter(Boolean);

      toast.success('Promo code redeemed! 🎉', { description: parts.join(' · ') });
      setCode('');
      void queryClient.invalidateQueries({ queryKey: ['promo-history'] });
      router.refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Promo codes</h1>
        <p className="text-sm text-muted-foreground">Got a code? Redeem it for coins or points.</p>
      </div>

      <Card>
        <CardContent className="p-5">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (code.trim()) redeemMutation.mutate(code.trim().toUpperCase());
            }}
          >
            <div>
              <Label htmlFor="promoCode">Promo code</Label>
              <Input
                id="promoCode"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="WELCOME2026"
                maxLength={24}
                className="font-mono uppercase tracking-widest"
                autoComplete="off"
              />
            </div>

            <Button
              type="submit"
              variant="gradient"
              className="w-full"
              disabled={!code.trim()}
              isLoading={redeemMutation.isPending}
            >
              <Gift className="h-4 w-4" aria-hidden />
              Redeem
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-4 w-4" aria-hidden />
            Redeemed codes
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {!data || data.history.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No codes redeemed yet" message="Watch for codes in announcements." />
            </div>
          ) : (
            <ul className="divide-y">
              {data.history.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-mono font-bold">{entry.promoCode.code}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                  </div>
                  <Badge variant="success">
                    +{entry.rewardAmount} {entry.promoCode.rewardType.replace('_', ' ').toLowerCase()}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
