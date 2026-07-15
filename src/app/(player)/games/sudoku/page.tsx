'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eraser, Pencil, Zap, Trophy, ArrowLeft, Puzzle, Lightbulb } from 'lucide-react';
import type { SudokuDifficulty } from '@prisma/client';

import { api, errorMessage, ApiClientError } from '@/features/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { LoadingState } from '@/components/ui/states';
import { cn, formatDuration } from '@/lib/utils';
import { MonsterRevealDialog, type SudokuAward } from './MonsterRevealDialog';

interface StartResponse {
  gameId: string;
  difficulty: SudokuDifficulty;
  puzzle: string;
  signature: string;
  expiresAt: number;
  energy: number;
  attemptsRemaining: number;
}

interface SubmitResponse {
  solved: boolean;
  wrongCells: number[];
  emptyCells: number;
  award?: SudokuAward;
  balances?: { COINS: number; REWARD_POINTS: number; GEMS: number };
}

interface SudokuMeta {
  stats: {
    energyCost: number;
    dailyAttemptLimit: number;
    attemptsRemaining: number;
    solvedCount: number;
  };
  active: { hasActive: boolean; gameId?: string; puzzle?: string; signature?: string; difficulty?: SudokuDifficulty };
}

const DIFFICULTIES: { value: SudokuDifficulty; label: string; blurb: string }[] = [
  { value: 'EASY', label: 'Easy', blurb: '42 clues · a gentle warm-up' },
  { value: 'MEDIUM', label: 'Medium', blurb: '34 clues · a proper puzzle' },
  { value: 'HARD', label: 'Hard', blurb: '28 clues · for the sharp-eyed' },
];

type Phase = 'idle' | 'playing';

export default function SudokuPage() {
  const router = useRouter();

  const [meta, setMeta] = useState<SudokuMeta | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [isStarting, setIsStarting] = useState(false);

  const [game, setGame] = useState<StartResponse | null>(null);
  const [givens, setGivens] = useState<boolean[]>([]);
  const [grid, setGrid] = useState<number[]>([]);
  const [notes, setNotes] = useState<Set<number>[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [wrongCells, setWrongCells] = useState<Set<number>>(new Set());
  const [notesMode, setNotesMode] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [award, setAward] = useState<SudokuAward | null>(null);

  // Load stats + any resumable puzzle.
  useEffect(() => {
    api
      .get<SudokuMeta>('/api/games/sudoku')
      .then((data) => {
        setMeta(data);
        if (data.active.hasActive && data.active.puzzle && data.active.gameId && data.active.signature) {
          hydrate({
            gameId: data.active.gameId,
            difficulty: data.active.difficulty ?? 'EASY',
            puzzle: data.active.puzzle,
            signature: data.active.signature,
            expiresAt: Date.now() + 3_600_000,
            energy: 0,
            attemptsRemaining: data.stats.attemptsRemaining,
          });
        }
      })
      .catch((error) => toast.error(errorMessage(error)));
  }, []);

  // Timer.
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  function hydrate(started: StartResponse) {
    const digits = started.puzzle.split('').map(Number);
    setGame(started);
    setGivens(digits.map((d) => d !== 0));
    setGrid(digits);
    setNotes(digits.map(() => new Set<number>()));
    setWrongCells(new Set());
    setSelected(null);
    setSeconds(0);
    setPhase('playing');
  }

  async function start(difficulty: SudokuDifficulty) {
    setIsStarting(true);
    try {
      const started = await api.post<StartResponse>('/api/games/sudoku', { difficulty });
      hydrate(started);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsStarting(false);
    }
  }

  // Client-side conflict detection: a cell conflicts if its digit repeats in its row,
  // column or box. This is immediate feedback and needs no knowledge of the solution.
  const conflicts = useMemo(() => computeConflicts(grid), [grid]);

  const setCell = useCallback(
    (value: number) => {
      if (selected === null || givens[selected]) return;

      if (notesMode && value !== 0) {
        setNotes((prev) => {
          const next = prev.map((s) => new Set(s));
          const cell = next[selected]!;
          if (cell.has(value)) cell.delete(value);
          else cell.add(value);
          return next;
        });
        return;
      }

      setGrid((prev) => {
        const next = [...prev];
        next[selected] = value;
        return next;
      });
      // Clearing/entering a real value drops that cell's pencil marks and stale error.
      setNotes((prev) => {
        const next = prev.map((s) => new Set(s));
        next[selected] = new Set();
        return next;
      });
      setWrongCells((prev) => {
        if (!prev.has(selected)) return prev;
        const next = new Set(prev);
        next.delete(selected);
        return next;
      });
    },
    [selected, givens, notesMode],
  );

  // Keyboard support.
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key >= '1' && event.key <= '9') setCell(Number(event.key));
      else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') setCell(0);
      else if (selected !== null) {
        const moves: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
        const delta = moves[event.key];
        if (delta !== undefined) {
          event.preventDefault();
          setSelected((s) => Math.max(0, Math.min(80, (s ?? 0) + delta)));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, selected, setCell]);

  async function submit() {
    if (!game) return;
    if (grid.includes(0)) {
      toast.info('Fill in every cell first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.post<SubmitResponse>('/api/games/sudoku/submit', {
        gameId: game.gameId,
        signature: game.signature,
        grid,
      });

      if (result.solved && result.award) {
        setAward(result.award);
        router.refresh();
      } else if (!result.solved) {
        setWrongCells(new Set(result.wrongCells));
        toast.error(
          result.wrongCells.length > 0
            ? `Not quite — ${result.wrongCells.length} cell${result.wrongCells.length === 1 ? '' : 's'} are wrong.`
            : 'Not solved yet. Keep going!',
        );
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'EXPIRED') {
        toast.error('That puzzle expired. Starting fresh.');
        setPhase('idle');
      } else {
        toast.error(errorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function afterReveal() {
    setAward(null);
    setPhase('idle');
    // Refresh stats (attempts remaining etc.).
    api.get<SudokuMeta>('/api/games/sudoku').then(setMeta).catch(() => {});
  }

  const digitCounts = useMemo(() => {
    const counts = new Array(10).fill(0);
    for (const d of grid) counts[d] += 1;
    return counts;
  }, [grid]);

  if (!meta) return <LoadingState label="Loading Sudoku…" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Sudoku Quest</h1>
          <p className="text-sm text-muted-foreground">Solve it, win a monster puzzle piece.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/games">Back</Link>
        </Button>
      </div>

      {phase === 'idle' ? (
        <IdleScreen
          meta={meta}
          isStarting={isStarting}
          onStart={start}
        />
      ) : (
        <>
          <Card>
            <CardContent className="flex items-center justify-between gap-2 p-3 text-sm">
              <Badge variant="secondary">{game?.difficulty}</Badge>
              <span className="font-mono font-semibold tabular-nums">{formatDuration(seconds)}</span>
              <Button
                size="sm"
                variant={notesMode ? 'default' : 'outline'}
                onClick={() => setNotesMode((v) => !v)}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Notes
              </Button>
            </CardContent>
          </Card>

          <SudokuBoard
            grid={grid}
            givens={givens}
            notes={notes}
            selected={selected}
            conflicts={conflicts}
            wrongCells={wrongCells}
            onSelect={setSelected}
          />

          <NumberPad counts={digitCounts} onDigit={setCell} onErase={() => setCell(0)} />

          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={submit}
            isLoading={isSubmitting}
            disabled={grid.includes(0)}
          >
            <Puzzle className="h-4 w-4" aria-hidden />
            {grid.includes(0) ? 'Fill every cell to check' : 'Check my solution'}
          </Button>
        </>
      )}

      <MonsterRevealDialog award={award} onClose={afterReveal} />
    </div>
  );
}

function IdleScreen({
  meta,
  isStarting,
  onStart,
}: {
  meta: SudokuMeta;
  isStarting: boolean;
  onStart: (d: SudokuDifficulty) => void;
}) {
  const noAttempts = meta.stats.attemptsRemaining <= 0;

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
            {meta.stats.solvedCount} solved
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Zap className="h-4 w-4 text-amber-500" aria-hidden />
            {meta.stats.energyCost} energy per puzzle
          </span>
          <span className="text-muted-foreground">
            {meta.stats.attemptsRemaining}/{meta.stats.dailyAttemptLimit} left today
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden />
            How it works
          </p>
          <p className="text-sm text-muted-foreground">
            Fill the grid so every row, column and 3×3 box holds 1–9. Solve it and you win a random{' '}
            <strong className="text-foreground">monster puzzle piece</strong>. Collect all 9 pieces of
            a monster to hatch it into your{' '}
            <Link href="/collection" className="font-semibold text-primary hover:underline">
              collection
            </Link>{' '}
            — 50 to find in total.
          </p>
        </CardContent>
      </Card>

      {noAttempts ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            You&apos;ve used all your Sudoku puzzles for today. Come back tomorrow!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {DIFFICULTIES.map((d) => (
            <Card key={d.value} className="transition-transform hover:-translate-y-0.5">
              <CardContent className="flex flex-col gap-3 p-4">
                <div>
                  <p className="font-bold">{d.label}</p>
                  <p className="text-xs text-muted-foreground">{d.blurb}</p>
                </div>
                <Button
                  variant="gradient"
                  className="mt-auto"
                  onClick={() => onStart(d.value)}
                  isLoading={isStarting}
                >
                  Play
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SudokuBoard({
  grid,
  givens,
  notes,
  selected,
  conflicts,
  wrongCells,
  onSelect,
}: {
  grid: number[];
  givens: boolean[];
  notes: Set<number>[];
  selected: number | null;
  conflicts: Set<number>;
  wrongCells: Set<number>;
  onSelect: (index: number) => void;
}) {
  const selRow = selected !== null ? Math.floor(selected / 9) : -1;
  const selCol = selected !== null ? selected % 9 : -1;
  const selValue = selected !== null ? grid[selected] : 0;

  return (
    <div className="mx-auto aspect-square w-full max-w-md select-none">
      <div className="grid h-full grid-cols-9 overflow-hidden rounded-xl border-2 border-foreground/70 bg-card">
        {grid.map((value, index) => {
          const row = Math.floor(index / 9);
          const col = index % 9;
          const isGiven = givens[index];
          const isSelected = selected === index;
          const inPeer = row === selRow || col === selCol || sameBox(index, selected);
          const sameNumber = value !== 0 && value === selValue;
          const isConflict = conflicts.has(index);
          const isWrong = wrongCells.has(index);

          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`Row ${row + 1}, column ${col + 1}${value ? `, ${value}` : ', empty'}`}
              className={cn(
                'relative flex items-center justify-center text-lg font-bold tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary',
                // Thicker lines on the 3x3 box boundaries.
                col % 3 === 2 && col !== 8 && 'border-r-2 border-r-foreground/50',
                row % 3 === 2 && row !== 8 && 'border-b-2 border-b-foreground/50',
                'border border-border/60',
                isSelected
                  ? 'bg-primary/20'
                  : sameNumber
                    ? 'bg-primary/10'
                    : inPeer
                      ? 'bg-secondary/60'
                      : 'bg-card',
                isGiven ? 'text-foreground' : 'text-primary',
                (isConflict || isWrong) && value !== 0 && 'text-destructive',
              )}
            >
              {value !== 0 ? (
                value
              ) : notes[index] && notes[index]!.size > 0 ? (
                <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-0.5 text-[8px] font-medium text-muted-foreground">
                  {Array.from({ length: 9 }, (_, n) => (
                    <span key={n} className="flex items-center justify-center">
                      {notes[index]!.has(n + 1) ? n + 1 : ''}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumberPad({
  counts,
  onDigit,
  onErase,
}: {
  counts: number[];
  onDigit: (d: number) => void;
  onErase: () => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {Array.from({ length: 9 }, (_, i) => i + 1).map((digit) => {
        const done = counts[digit] >= 9;
        return (
          <button
            key={digit}
            type="button"
            onClick={() => onDigit(digit)}
            disabled={done}
            className={cn(
              'flex h-12 items-center justify-center rounded-xl border-2 text-lg font-bold tabular-nums transition-colors active:scale-95',
              done
                ? 'border-transparent bg-muted text-muted-foreground opacity-50'
                : 'border-border bg-card hover:border-primary hover:bg-primary/5',
            )}
            aria-label={`Enter ${digit}`}
          >
            {digit}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onErase}
        className="col-span-5 flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card font-semibold hover:border-destructive hover:bg-destructive/5 sm:col-span-1"
        aria-label="Erase"
      >
        <Eraser className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

// --- Pure helpers -----------------------------------------------------------

function sameBox(a: number, b: number | null): boolean {
  if (b === null) return false;
  const boxA = Math.floor(Math.floor(a / 9) / 3) * 3 + Math.floor((a % 9) / 3);
  const boxB = Math.floor(Math.floor(b / 9) / 3) * 3 + Math.floor((b % 9) / 3);
  return boxA === boxB;
}

function computeConflicts(grid: number[]): Set<number> {
  const conflicts = new Set<number>();

  const check = (indices: number[]) => {
    const seen = new Map<number, number[]>();
    for (const i of indices) {
      const v = grid[i]!;
      if (v === 0) continue;
      if (!seen.has(v)) seen.set(v, []);
      seen.get(v)!.push(i);
    }
    for (const group of seen.values()) {
      if (group.length > 1) group.forEach((i) => conflicts.add(i));
    }
  };

  for (let r = 0; r < 9; r += 1) check(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c += 1) check(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let br = 0; br < 3; br += 1) {
    for (let bc = 0; bc < 3; bc += 1) {
      const cells: number[] = [];
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) cells.push((br * 3 + r) * 9 + (bc * 3 + c));
      }
      check(cells);
    }
  }

  return conflicts;
}
