'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Camera,
  CameraOff,
  Keyboard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MapPin,
  Clock,
} from 'lucide-react';
import type { ClaimStatus } from '@prisma/client';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Input,
  Label,
  Badge,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Separator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Textarea,
} from '@/components/ui/primitives';
import { formatDateTime, initials } from '@/lib/utils';

interface ClaimLookup {
  claim: {
    id: string;
    claimCode: string;
    status: ClaimStatus;
    pointCost: number;
    expiresAt: string;
    collectionLocation: string | null;
    collectedAt: string | null;
  };
  reward: { name: string; imageUrl: string; category: string };
  player: { displayName: string; email: string; avatarUrl: string | null };
  isCollectable: boolean;
  blockReason?: string;
}

const SCANNER_ELEMENT_ID = 'pq-qr-scanner';

export default function StaffScannerPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lookup, setLookup] = useState<ClaimLookup | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // The Html5Qrcode class is loaded dynamically (it touches browser APIs at import
  // time), so its type can't appear in this module's top-level scope. This structural
  // type covers the two methods we call on it.
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  const lookupMutation = useMutation({
    mutationFn: (input: { qrToken?: string; claimCode?: string }) =>
      api.post<ClaimLookup>('/api/staff/lookup', input),
    onSuccess: (result) => {
      setLookup(result);
      void stopScanner();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const collectMutation = useMutation({
    mutationFn: (claimId: string) => api.post('/api/staff/collect', { claimId }),
    onSuccess: () => {
      toast.success('Collection confirmed ✅');
      setLookup(null);
      setManualCode('');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rejectMutation = useMutation({
    mutationFn: (input: { claimId: string; reason: string }) =>
      api.put('/api/staff/collect', input),
    onSuccess: () => {
      toast.success('Claim rejected');
      setIsRejecting(false);
      setRejectReason('');
      setLookup(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  async function startScanner() {
    try {
      // html5-qrcode reaches for `navigator.mediaDevices` at import time, so it can
      // only be loaded in the browser, on demand.
      const { Html5Qrcode } = await import('html5-qrcode');

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText: string) => {
          // Stop immediately on the first read: the camera fires this callback ten
          // times a second, and without this every frame becomes a lookup request.
          void stopScanner();
          lookupMutation.mutate({ qrToken: decodedText });
        },
        () => {
          /* per-frame decode misses are normal and extremely noisy — ignore them */
        },
      );

      setIsScanning(true);
    } catch (error) {
      toast.error(
        'Could not start the camera. Check the browser permission, or type the claim code instead.',
      );
      setIsScanning(false);
    }
  }

  async function stopScanner() {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
      scannerRef.current.clear();
    } catch {
      /* already stopped */
    }
    scannerRef.current = null;
    setIsScanning(false);
  }

  // Release the camera when the operator navigates away. A live camera left running
  // is a privacy problem, not just a battery one.
  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Reward scanner</h1>
        <p className="text-sm text-muted-foreground">
          Scan the player&apos;s QR code, or type their claim code.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" aria-hidden />
            Camera
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div
            id={SCANNER_ELEMENT_ID}
            className="overflow-hidden rounded-xl bg-slate-900"
            style={{ minHeight: isScanning ? 280 : 0 }}
          />

          {isScanning ? (
            <Button variant="outline" className="w-full" onClick={() => void stopScanner()}>
              <CameraOff className="h-4 w-4" aria-hidden />
              Stop camera
            </Button>
          ) : (
            <Button variant="gradient" className="w-full" onClick={() => void startScanner()}>
              <Camera className="h-4 w-4" aria-hidden />
              Start scanning
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Keyboard className="h-4 w-4" aria-hidden />
            Manual entry
          </CardTitle>
          <CardDescription>
            When the camera won&apos;t cooperate — a cracked screen, bad light, no camera permission.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (manualCode.trim()) {
                lookupMutation.mutate({ claimCode: manualCode.trim().toUpperCase() });
              }
            }}
          >
            <div className="flex-1">
              <Label htmlFor="claimCode" className="sr-only">
                Claim code
              </Label>
              <Input
                id="claimCode"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                placeholder="PQ-A7K2-9XQF"
                className="font-mono uppercase tracking-wider"
                autoComplete="off"
              />
            </div>
            <Button type="submit" isLoading={lookupMutation.isPending} disabled={!manualCode.trim()}>
              Look up
            </Button>
          </form>
        </CardContent>
      </Card>

      {lookup ? (
        <Card
          className={
            lookup.isCollectable
              ? 'border-emerald-400/60 ring-2 ring-emerald-400/20'
              : 'border-destructive/50 ring-2 ring-destructive/20'
          }
        >
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              {lookup.isCollectable ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden />
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    Valid claim
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
                  <p className="text-lg font-bold text-destructive">Cannot collect</p>
                </>
              )}
              <Badge variant="outline" className="ml-auto">
                {lookup.claim.status}
              </Badge>
            </div>

            {lookup.blockReason ? (
              <p className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {lookup.blockReason}
              </p>
            ) : null}

            <Separator />

            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11">
                {lookup.player.avatarUrl ? <AvatarImage src={lookup.player.avatarUrl} alt="" /> : null}
                <AvatarFallback>{initials(lookup.player.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-bold">{lookup.player.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{lookup.player.email}</p>
              </div>
            </div>

            <div className="rounded-xl bg-secondary p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>
                  {lookup.reward.imageUrl.startsWith('http') ? '🎁' : lookup.reward.imageUrl}
                </span>
                <div>
                  <p className="font-bold">{lookup.reward.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {lookup.claim.pointCost} reward points
                  </p>
                </div>
              </div>

              <Separator className="my-3" />

              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Claim code</dt>
                  <dd className="font-mono font-bold">{lookup.claim.claimCode}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    Expires
                  </dt>
                  <dd className="font-semibold">{formatDateTime(lookup.claim.expiresAt)}</dd>
                </div>
                {lookup.claim.collectionLocation ? (
                  <div className="flex justify-between">
                    <dt className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      Location
                    </dt>
                    <dd className="font-semibold">{lookup.claim.collectionLocation}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="gradient"
                size="lg"
                className="flex-1"
                disabled={!lookup.isCollectable}
                isLoading={collectMutation.isPending}
                onClick={() => collectMutation.mutate(lookup.claim.id)}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Confirm collection
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="text-destructive"
                onClick={() => setIsRejecting(true)}
              >
                <XCircle className="h-4 w-4" aria-hidden />
                Reject
              </Button>
            </div>

            <Button variant="ghost" size="sm" className="w-full" onClick={() => setLookup(null)}>
              Clear
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={isRejecting} onOpenChange={setIsRejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this claim?</DialogTitle>
            <DialogDescription>
              The stock is returned to the pool. Points are <strong>not</strong> refunded
              automatically — an admin can refund from the claims page if appropriate.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="rejectReason">Reason</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="e.g. Player could not verify their identity"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejecting(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectReason.trim().length < 3}
              isLoading={rejectMutation.isPending}
              onClick={() =>
                lookup &&
                rejectMutation.mutate({ claimId: lookup.claim.id, reason: rejectReason.trim() })
              }
            >
              Reject claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
