'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDuration, cn } from '@/lib/utils';

interface CooldownButtonProps {
  label: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  remainingSeconds: number;
  isBusy: boolean;
  isDisabled: boolean;
  onClick: () => void;
}

/**
 * A care action with a live countdown.
 *
 * The countdown is purely cosmetic — it exists so the player isn't staring at a
 * frozen number, not to decide anything. The server re-checks the cooldown against
 * its own timestamps on every request, so a player who edits this component's state
 * in the console gets an enabled button and a 429.
 */
export function CooldownButton({
  label,
  description,
  icon: Icon,
  tone,
  remainingSeconds,
  isBusy,
  isDisabled,
  onClick,
}: CooldownButtonProps) {
  const [remaining, setRemaining] = useState(remainingSeconds);

  // Re-sync whenever the server tells us something new; the local tick only fills
  // the gaps between polls.
  useEffect(() => setRemaining(remainingSeconds), [remainingSeconds]);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const isOnCooldown = remaining > 0;

  return (
    <Card className={cn('transition-opacity', (isOnCooldown || isDisabled) && 'opacity-60')}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tone)}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-bold">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>

        <Button
          size="sm"
          variant={isOnCooldown ? 'outline' : 'default'}
          onClick={onClick}
          isLoading={isBusy}
          disabled={isOnCooldown || isDisabled || isBusy}
          aria-label={
            isOnCooldown ? `${label} — ready in ${formatDuration(remaining)}` : label
          }
        >
          {isOnCooldown ? (
            <>
              <Clock className="h-3.5 w-3.5" aria-hidden />
              <span className="tabular-nums">{formatDuration(remaining)}</span>
            </>
          ) : (
            'Go'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
