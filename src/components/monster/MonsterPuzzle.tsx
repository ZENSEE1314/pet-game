'use client';

import { MonsterArt } from './MonsterCreature';
import { PUZZLE_PIECE_COUNT } from '@/lib/monsters';
import { cn } from '@/lib/utils';
import type { MonsterElement, MonsterRarity } from '@prisma/client';

/**
 * A monster shown as its 3x3 puzzle: owned pieces reveal the art beneath, missing
 * pieces stay as dark "?" tiles. When all nine are owned the grid dissolves and the
 * full creature shows through. This is the same visual whether the monster is drawn
 * procedurally or from an AI-art PNG — the overlay sits on top of `MonsterArt`.
 */

interface MonsterPuzzleProps {
  element: MonsterElement;
  archetype: string;
  rarity: MonsterRarity;
  imageUrl?: string | null;
  name?: string;
  ownedPieces: number[];
  /** A piece index to briefly pulse (the one just won). */
  highlightPiece?: number;
  isUnlocked: boolean;
  className?: string;
  animated?: boolean;
}

export function MonsterPuzzle({
  element,
  archetype,
  rarity,
  imageUrl,
  name,
  ownedPieces,
  highlightPiece,
  isUnlocked,
  className,
  animated = true,
}: MonsterPuzzleProps) {
  const owned = new Set(ownedPieces);
  const complete = isUnlocked || owned.size >= PUZZLE_PIECE_COUNT;

  return (
    <div className={cn('relative aspect-square w-full', className)}>
      <MonsterArt
        element={element}
        archetype={archetype}
        rarity={rarity}
        imageUrl={imageUrl}
        name={name}
        animated={animated && complete}
        silhouette={!complete && owned.size === 0}
      />

      {/* Piece overlay — only while incomplete. */}
      {!complete ? (
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: PUZZLE_PIECE_COUNT }, (_, index) => {
            const has = owned.has(index);
            return (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-center border border-white/10 transition-all',
                  has
                    ? highlightPiece === index
                      ? 'animate-pop-in bg-transparent ring-2 ring-inset ring-white/70'
                      : 'bg-transparent'
                    : 'bg-slate-900/85 text-slate-600 backdrop-blur-[2px]',
                )}
              >
                {!has ? <span className="text-xs font-bold">?</span> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
