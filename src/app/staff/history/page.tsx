import { PermissionKey } from '@prisma/client';
import { History } from 'lucide-react';

import { requirePermission } from '@/lib/rbac';
import { getCollectionHistory } from '@/services/reward/reward.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CollectionHistoryPage() {
  const staff = await requirePermission(PermissionKey.SCAN_CLAIMS);
  const history = await getCollectionHistory(staff.id, 100);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Collection history</h1>
        <p className="text-sm text-muted-foreground">Rewards you&apos;ve processed.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" aria-hidden />
            {history.length} processed
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Nothing processed yet"
                message="Collections you confirm will appear here."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {history.map((claim) => (
                <li key={claim.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-2xl" aria-hidden>
                    {claim.reward.imageUrl.startsWith('http') ? '🎁' : claim.reward.imageUrl}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{claim.reward.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {claim.user.profile?.displayName ?? claim.user.email} ·{' '}
                      <span className="font-mono">{claim.claimCode}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <Badge variant={claim.status === 'COLLECTED' ? 'success' : 'destructive'}>
                      {claim.status}
                    </Badge>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {claim.collectedAt ? formatDateTime(claim.collectedAt) : '—'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
