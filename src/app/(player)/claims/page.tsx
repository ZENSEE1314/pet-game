import Link from 'next/link';
import { Ticket, QrCode } from 'lucide-react';
import type { ClaimStatus } from '@prisma/client';

import { requireUser } from '@/lib/rbac';
import { listClaims } from '@/services/reward/reward.service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<ClaimStatus, 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'> =
  {
    PENDING: 'warning',
    RESERVED: 'warning',
    READY: 'success',
    COLLECTED: 'secondary',
    DELIVERED: 'secondary',
    CANCELLED: 'destructive',
    EXPIRED: 'destructive',
    REJECTED: 'destructive',
  };

const STATUS_HELP: Partial<Record<ClaimStatus, string>> = {
  RESERVED: 'Show your QR code at the collection point.',
  READY: 'Ready to collect.',
  COLLECTED: 'Collected — enjoy!',
  EXPIRED: 'This claim expired. Points were not refunded.',
  CANCELLED: 'Cancelled. Points were refunded.',
};

export default async function ClaimsPage() {
  const user = await requireUser();
  const claims = await listClaims(user.id);

  if (claims.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-extrabold tracking-tight">My claims</h1>
        <EmptyState
          icon={<Ticket className="h-6 w-6" aria-hidden />}
          title="No claims yet"
          message="Redeem a reward and it'll show up here with its QR code."
          action={
            <Button asChild variant="gradient">
              <Link href="/rewards">Browse rewards</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">My claims</h1>
        <p className="text-sm text-muted-foreground">
          Show the QR code — or read out the claim code — to collect.
        </p>
      </div>

      <div className="space-y-3">
        {claims.map((claim) => {
          const isActive = claim.status === 'RESERVED' || claim.status === 'READY';

          return (
            <Card key={claim.id} className={isActive ? 'border-primary/40' : undefined}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 text-2xl">
                  <span aria-hidden>
                    {claim.reward.imageUrl.startsWith('http') ? '🎁' : claim.reward.imageUrl}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold">{claim.reward.name}</p>
                    <Badge variant={STATUS_VARIANT[claim.status]}>{claim.status}</Badge>
                  </div>

                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {claim.claimCode}
                  </p>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {STATUS_HELP[claim.status] ??
                      `Expires ${formatDate(claim.expiresAt)}`}
                    {isActive ? ` · Expires ${formatDate(claim.expiresAt)}` : ''}
                  </p>
                </div>

                <Button asChild size="sm" variant={isActive ? 'default' : 'outline'}>
                  <Link href={`/claims/${claim.id}`} aria-label={`View ${claim.reward.name} claim`}>
                    <QrCode className="h-4 w-4" aria-hidden />
                    View
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
