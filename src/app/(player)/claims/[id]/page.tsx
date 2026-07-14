import Link from 'next/link';
import QRCode from 'qrcode';
import { notFound } from 'next/navigation';
import { MapPin, Clock, ArrowLeft, ShieldCheck } from 'lucide-react';

import { requireUser } from '@/lib/rbac';
import { getClaim } from '@/services/reward/reward.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, Separator } from '@/components/ui/primitives';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  // Scoped by userId inside the service, so someone else's claim id is a 404 rather
  // than a leak of what they redeemed.
  const claim = await getClaim(user.id, id).catch(() => null);
  if (!claim) notFound();

  const isCollectable = claim.status === 'RESERVED' || claim.status === 'READY';

  // Rendered on the server. The signed token is never reassembled in the browser, and
  // the page has no idea how a claim token is constructed.
  const qrDataUrl = isCollectable
    ? await QRCode.toDataURL(claim.qrToken, {
        width: 360,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#1e1b4b', light: '#ffffff' },
      })
    : null;

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/claims">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          My claims
        </Link>
      </Button>

      <Card className="overflow-hidden">
        <CardHeader className="items-center pb-2 text-center">
          <Badge
            variant={
              claim.status === 'COLLECTED'
                ? 'secondary'
                : isCollectable
                  ? 'success'
                  : 'destructive'
            }
          >
            {claim.status}
          </Badge>
          <CardTitle className="text-xl">{claim.reward.name}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {qrDataUrl ? (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl bg-white p-4 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`QR code for claim ${claim.claimCode}`}
                  className="h-56 w-56"
                />
              </div>

              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Claim code
                </p>
                <p className="font-mono text-xl font-bold tracking-widest">{claim.claimCode}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  If the camera won&apos;t cooperate, staff can type this instead.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-secondary p-5 text-center text-sm text-muted-foreground">
              {claim.status === 'COLLECTED'
                ? `Collected on ${claim.collectedAt ? formatDateTime(claim.collectedAt) : 'an earlier date'}.`
                : claim.status === 'EXPIRED'
                  ? 'This claim expired and can no longer be collected.'
                  : claim.status === 'CANCELLED'
                    ? `Cancelled${claim.cancelReason ? `: ${claim.cancelReason}` : ''}. Your points were refunded.`
                    : 'This claim is no longer collectable.'}
            </div>
          )}

          <Separator />

          <dl className="space-y-3 text-sm">
            <Row label="Cost" value={`${claim.pointCost} reward points`} />
            <Row
              label="Collection"
              value={claim.reward.collectionMethod.replace(/_/g, ' ').toLowerCase()}
              icon={<MapPin className="h-4 w-4" aria-hidden />}
            />
            {claim.collectionLocation ? (
              <Row label="Location" value={claim.collectionLocation} />
            ) : null}
            <Row
              label="Expires"
              value={formatDateTime(claim.expiresAt)}
              icon={<Clock className="h-4 w-4" aria-hidden />}
            />
            {claim.fulfilmentDetails ? (
              <Row label="Voucher code" value={claim.fulfilmentDetails} mono />
            ) : null}
          </dl>

          {claim.reward.termsAndConditions ? (
            <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
              {claim.reward.termsAndConditions}
            </p>
          ) : null}

          {isCollectable ? (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              This code is cryptographically signed and can only be used once. A screenshot
              won&apos;t work twice.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className={mono ? 'font-mono font-semibold' : 'font-semibold capitalize'}>{value}</dd>
    </div>
  );
}
