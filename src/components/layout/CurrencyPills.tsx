'use client';

import { Coins, Gem, Sparkles } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

export interface Balances {
  COINS: number;
  REWARD_POINTS: number;
  GEMS: number;
}

/**
 * The player's three balances, always visible.
 *
 * Reward points get the loudest treatment because they are the only currency worth
 * real money — the visual hierarchy should match the actual stakes.
 */
export function CurrencyPills({
  balances,
  className,
  size = 'default',
}: {
  balances: Balances;
  className?: string;
  size?: 'default' | 'sm';
}) {
  const pills = [
    {
      key: 'COINS' as const,
      label: 'Coins',
      value: balances.COINS,
      icon: Coins,
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
    },
    {
      key: 'REWARD_POINTS' as const,
      label: 'Reward points',
      value: balances.REWARD_POINTS,
      icon: Sparkles,
      className: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200',
    },
    {
      key: 'GEMS' as const,
      label: 'Gems',
      value: balances.GEMS,
      icon: Gem,
      className: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200',
    },
  ];

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {pills.map((pill) => (
        <div
          key={pill.key}
          className={cn(
            'flex items-center gap-1.5 rounded-full font-bold tabular-nums',
            pill.className,
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
          )}
          title={`${formatNumber(pill.value)} ${pill.label}`}
        >
          <pill.icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
          <span>{formatNumber(pill.value)}</span>
          <span className="sr-only">{pill.label}</span>
        </div>
      ))}
    </div>
  );
}
