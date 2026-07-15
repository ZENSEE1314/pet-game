'use client';

import Link from 'next/link';
import { Sparkles, Gem, Puzzle } from 'lucide-react';
import type { MonsterElement, MonsterRarity } from '@prisma/client';

import { Dialog, DialogContent, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { MonsterPuzzle } from '@/components/monster/MonsterPuzzle';
import { RARITY_META, ELEMENT_THEME } from '@/lib/monsters';

export interface SudokuAward {
  monster: {
    id: string;
    slug: string;
    name: string;
    element: MonsterElement;
    rarity: MonsterRarity;
    archetype: string;
    imageUrl: string | null;
    description: string;
  };
  pieceIndex: number;
  ownedPieces: number;
  completedMonster: boolean;
  fallbackGems?: number;
}

/**
 * The win moment. A puzzle piece slots into the monster's 3x3 grid; the ninth piece
 * hatches the monster with a flourish. The reveal shows the piece landing where it
 * belongs so the collection mechanic reads instantly.
 */
export function MonsterRevealDialog({
  award,
  onClose,
}: {
  award: SudokuAward | null;
  onClose: () => void;
}) {
  const open = award !== null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        {award ? <RevealBody award={award} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RevealBody({ award, onClose }: { award: SudokuAward; onClose: () => void }) {
  // Collection-complete consolation path.
  if (award.fallbackGems) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950/60">
          <Gem className="h-8 w-8" aria-hidden />
        </div>
        <div>
          <h2 className="text-xl font-extrabold">Collection complete!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;ve hatched every monster. Here are <strong>{award.fallbackGems} gems</strong> instead.
          </p>
        </div>
        <Button variant="gradient" className="w-full" onClick={onClose}>
          Nice!
        </Button>
      </div>
    );
  }

  const rarity = RARITY_META[award.monster.rarity];
  const theme = ELEMENT_THEME[award.monster.element];
  const ownedIndices = Array.from({ length: award.ownedPieces }, (_, i) => i);

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <Badge
        className="animate-pop-in"
        style={{ backgroundColor: award.completedMonster ? rarity.badge : theme.aura, color: '#fff' }}
      >
        {award.completedMonster ? (
          <>
            <Sparkles className="mr-1 h-3 w-3" aria-hidden />
            Monster hatched!
          </>
        ) : (
          <>
            <Puzzle className="mr-1 h-3 w-3" aria-hidden />
            Puzzle piece found
          </>
        )}
      </Badge>

      <div className={award.completedMonster ? 'mon-hatch h-44 w-44' : 'h-44 w-44'}>
        <MonsterPuzzle
          element={award.monster.element}
          archetype={award.monster.archetype}
          rarity={award.monster.rarity}
          imageUrl={award.monster.imageUrl}
          name={award.monster.name}
          ownedPieces={award.completedMonster ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : ownedIndices}
          highlightPiece={award.completedMonster ? undefined : award.pieceIndex}
          isUnlocked={award.completedMonster}
        />
      </div>

      <div>
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-xl font-extrabold">{award.monster.name}</h2>
          <Badge variant="outline" style={{ borderColor: rarity.badge, color: rarity.badge }}>
            {rarity.label}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {award.completedMonster
            ? award.monster.description
            : `${award.ownedPieces} / 9 pieces collected. ${9 - award.ownedPieces} to go!`}
        </p>
      </div>

      {award.completedMonster ? (
        <p className="rounded-xl bg-secondary px-3 py-2 text-xs font-medium">
          +{rarity.unlockGems} gems
          {rarity.unlockPoints > 0 ? ` · +${rarity.unlockPoints} reward points` : ''}
        </p>
      ) : null}

      <div className="flex w-full gap-2">
        <Button variant="gradient" className="flex-1" onClick={onClose}>
          Play again
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/collection">Collection</Link>
        </Button>
      </div>
    </div>
  );
}
