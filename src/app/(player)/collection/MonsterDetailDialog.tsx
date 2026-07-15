'use client';

import { Puzzle, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Badge,
  Progress,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MonsterPuzzle } from '@/components/monster/MonsterPuzzle';
import { ELEMENT_THEME, RARITY_META } from '@/lib/monsters';
import type { CollectionEntry } from '@/services/collection/collection.service';

export function MonsterDetailDialog({
  entry,
  onClose,
}: {
  entry: CollectionEntry | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={entry !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        {entry ? <Body entry={entry} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({ entry }: { entry: CollectionEntry }) {
  const rarity = RARITY_META[entry.rarity as keyof typeof RARITY_META];
  const theme = ELEMENT_THEME[entry.element as keyof typeof ELEMENT_THEME];
  const started = entry.ownedPieces.length > 0;
  const known = entry.isUnlocked || started;
  const progress = Math.round((entry.ownedPieces.length / entry.pieceCount) * 100);

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <div className="h-44 w-44">
        <MonsterPuzzle
          element={entry.element as keyof typeof ELEMENT_THEME}
          archetype={entry.archetype}
          rarity={entry.rarity as keyof typeof RARITY_META}
          imageUrl={entry.imageUrl}
          name={entry.name}
          ownedPieces={entry.ownedPieces}
          isUnlocked={entry.isUnlocked}
        />
      </div>

      <div>
        <DialogTitle className="flex items-center justify-center gap-2 text-xl">
          {known ? entry.name : '???'}
        </DialogTitle>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Badge variant="outline" style={{ borderColor: rarity.badge, color: rarity.badge }}>
            {rarity.label}
          </Badge>
          <Badge variant="outline" style={{ borderColor: theme.aura, color: theme.aura }}>
            {theme.label}
          </Badge>
          {entry.isUnlocked ? (
            <Badge variant="success">
              <Sparkles className="mr-1 h-3 w-3" aria-hidden />
              Hatched
            </Badge>
          ) : null}
        </div>
      </div>

      {entry.isUnlocked ? (
        <p className="text-sm text-muted-foreground">{entry.description}</p>
      ) : (
        <div className="w-full space-y-2">
          <p className="text-sm text-muted-foreground">
            {started
              ? 'Keep solving Sudoku puzzles to find the missing pieces.'
              : 'This monster is still a mystery. Win Sudoku puzzles to find its first piece.'}
          </p>
          <Progress value={progress} />
          <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Puzzle className="h-3.5 w-3.5" aria-hidden />
            {entry.ownedPieces.length} / {entry.pieceCount} pieces
          </p>
        </div>
      )}

      <Button asChild variant="gradient" className="w-full">
        <Link href="/games/sudoku">Play Sudoku</Link>
      </Button>
    </div>
  );
}
