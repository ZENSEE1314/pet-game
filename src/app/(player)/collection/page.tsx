'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Puzzle, Sparkles, Gamepad2 } from 'lucide-react';

import { api } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, Progress, Select } from '@/components/ui/primitives';
import { LoadingState, ErrorState } from '@/components/ui/states';
import { MonsterPuzzle } from '@/components/monster/MonsterPuzzle';
import { MonsterDetailDialog } from './MonsterDetailDialog';
import { ELEMENT_THEME, RARITY_META } from '@/lib/monsters';
import { cn } from '@/lib/utils';
import type { CollectionEntry, CollectionSummary } from '@/services/collection/collection.service';

const RARITY_ORDER = ['MYTHIC', 'LEGENDARY', 'EPIC', 'RARE', 'COMMON'];

export default function CollectionPage() {
  const router = useRouter();
  const [element, setElement] = useState<string>('ALL');
  const [selected, setSelected] = useState<CollectionEntry | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['collection'],
    queryFn: () => api.get<CollectionSummary>('/api/collection'),
  });

  // Clear the "NEW!" badges once the player opens the collection.
  useEffect(() => {
    if (data && data.entries.some((e) => e.isNew)) {
      api.patch('/api/collection', {}).then(() => router.refresh()).catch(() => {});
    }
  }, [data, router]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return element === 'ALL' ? data.entries : data.entries.filter((e) => e.element === element);
  }, [data, element]);

  if (isLoading) return <LoadingState label="Opening your collection…" />;
  if (isError || !data) {
    return <ErrorState message="We couldn't load your collection." onRetry={() => void refetch()} />;
  }

  const completion = Math.round((data.unlockedCount / Math.max(1, data.totalMonsters)) * 100);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Monster Collection</h1>
        <p className="text-sm text-muted-foreground">
          Win Sudoku puzzles to collect pieces and hatch all {data.totalMonsters} monsters.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="pq-gradient p-5 text-white">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-white/80">Hatched</p>
              <p className="text-3xl font-black">
                {data.unlockedCount}
                <span className="text-lg font-bold text-white/70"> / {data.totalMonsters}</span>
              </p>
            </div>
            <p className="text-3xl font-black">{completion}%</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${completion}%` }} />
          </div>
        </div>

        <CardContent className="flex flex-wrap gap-2 p-4">
          {RARITY_ORDER.map((rarity) => {
            const stat = data.byRarity[rarity];
            if (!stat) return null;
            const meta = RARITY_META[rarity as keyof typeof RARITY_META];
            return (
              <Badge key={rarity} variant="outline" style={{ borderColor: meta.badge, color: meta.badge }}>
                {meta.label}: {stat.unlocked}/{stat.total}
              </Badge>
            );
          })}
          <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Puzzle className="h-4 w-4" aria-hidden />
            {data.ownedPieceCount} / {data.totalPieces} pieces
          </span>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={element}
          onChange={(event) => setElement(event.target.value)}
          aria-label="Filter by element"
          className="sm:max-w-xs"
        >
          <option value="ALL">All elements</option>
          {Object.entries(ELEMENT_THEME).map(([value, theme]) => (
            <option key={value} value={value}>
              {theme.label}
            </option>
          ))}
        </Select>

        <Button asChild variant="gradient" size="sm" className="ml-auto">
          <Link href="/games/sudoku">
            <Gamepad2 className="h-4 w-4" aria-hidden />
            Play Sudoku
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((entry) => (
          <MonsterCard key={entry.id} entry={entry} onOpen={() => setSelected(entry)} />
        ))}
      </div>

      <MonsterDetailDialog entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function MonsterCard({ entry, onOpen }: { entry: CollectionEntry; onOpen: () => void }) {
  const rarity = RARITY_META[entry.rarity as keyof typeof RARITY_META];
  const theme = ELEMENT_THEME[entry.element as keyof typeof ELEMENT_THEME];
  const progress = Math.round((entry.ownedPieces.length / entry.pieceCount) * 100);
  const started = entry.ownedPieces.length > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-3 text-left transition-transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-primary',
        entry.isUnlocked ? 'border-2' : 'border-border',
      )}
      style={entry.isUnlocked ? { borderColor: rarity.badge } : undefined}
      aria-label={entry.isUnlocked ? `${entry.name}, hatched` : `${entry.name}, ${entry.ownedPieces.length} of ${entry.pieceCount} pieces`}
    >
      {entry.isNew ? (
        <span className="absolute right-2 top-2 z-10 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
          NEW!
        </span>
      ) : null}

      <div className="relative">
        <MonsterPuzzle
          element={entry.element as keyof typeof ELEMENT_THEME}
          archetype={entry.archetype}
          rarity={entry.rarity as keyof typeof RARITY_META}
          imageUrl={entry.imageUrl}
          name={entry.name}
          ownedPieces={entry.ownedPieces}
          isUnlocked={entry.isUnlocked}
          animated={entry.isUnlocked}
        />
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between gap-1">
          <p className={cn('truncate text-sm font-bold', !entry.isUnlocked && !started && 'text-muted-foreground')}>
            {entry.isUnlocked || started ? entry.name : '???'}
          </p>
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: theme.aura }}
            title={theme.label}
          />
        </div>

        {entry.isUnlocked ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold" style={{ color: rarity.badge }}>
            <Sparkles className="h-3 w-3" aria-hidden />
            {rarity.label}
          </p>
        ) : (
          <>
            <Progress value={progress} className="mt-1.5 h-1.5" />
            <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
              {entry.ownedPieces.length}/{entry.pieceCount} pieces
            </p>
          </>
        )}
      </div>
    </button>
  );
}
