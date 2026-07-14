'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play, Pause, RotateCcw, Trophy, Coins, Sparkles, AlertTriangle } from 'lucide-react';
import type { GameSlug } from '@prisma/client';

import { useGameSession, type GameEvents, type SubmitResult } from '@/features/games/useGameSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { formatNumber } from '@/lib/utils';

/**
 * The shell every mini game runs inside: start screen → countdown → play → game over.
 *
 * It owns the session lifecycle and the Phaser instance's lifetime, so the two games
 * only have to be games. The important structural rule is at the bottom: the game
 * over screen renders `result.*` — the SERVER's numbers — and not the score the
 * canvas was displaying a second ago. If the server clamped a suspicious score, the
 * player sees the clamped one.
 */

export type PhaserGameFactory = (
  parent: HTMLElement,
  callbacks: {
    onGameOver: (score: number, events: GameEvents) => void;
    onScoreChange: (score: number) => void;
  },
) => Promise<{ destroy: () => void; pause: () => void; resume: () => void }>;

interface GameShellProps {
  slug: GameSlug;
  title: string;
  instructions: string;
  controls: string[];
  createGame: PhaserGameFactory;
}

type Phase = 'idle' | 'countdown' | 'playing' | 'paused' | 'over';

export function GameShell({ slug, title, instructions, controls, createGame }: GameShellProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Awaited<ReturnType<PhaserGameFactory>> | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [liveScore, setLiveScore] = useState(0);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const { start, submit, isStarting, isSubmitting, error } = useGameSession(slug);

  // Tear the canvas down on unmount. Phaser holds RAF loops and WebGL contexts; a
  // leaked instance keeps running (and eating battery) after you navigate away.
  useEffect(() => {
    return () => {
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, []);

  async function handleStart() {
    const session = await start();
    if (!session) return;

    setResult(null);
    setLiveScore(0);
    setPhase('countdown');
    setCountdown(3);
  }

  // The countdown gives the player a beat to get their thumbs ready — and,
  // incidentally, guarantees the session is a couple of seconds old before any score
  // can be submitted, which the server's minimum-duration check would reject anyway.
  useEffect(() => {
    if (phase !== 'countdown') return;

    if (countdown <= 0) {
      void launch();
      return;
    }

    const id = setTimeout(() => setCountdown((n) => n - 1), 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

  async function launch() {
    if (!containerRef.current) return;

    setPhase('playing');

    gameRef.current = await createGame(containerRef.current, {
      onScoreChange: setLiveScore,
      onGameOver: async (score, events) => {
        setPhase('over');
        gameRef.current?.destroy();
        gameRef.current = null;

        const submitted = await submit(score, events);
        if (submitted) {
          setResult(submitted);
          // Refresh the server components (header balances, energy) rather than
          // trying to patch them by hand.
          router.refresh();
        }
      },
    });
  }

  function togglePause() {
    if (phase === 'playing') {
      gameRef.current?.pause();
      setPhase('paused');
    } else if (phase === 'paused') {
      gameRef.current?.resume();
      setPhase('playing');
    }
  }

  function playAgain() {
    setPhase('idle');
    setResult(null);
    setLiveScore(0);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{instructions}</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/games">Back</Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="relative aspect-[4/3] w-full bg-slate-900 sm:aspect-[16/10]">
          <div ref={containerRef} className="absolute inset-0" />

          {phase === 'playing' || phase === 'paused' ? (
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/50 px-3 py-1.5 text-sm font-bold text-white tabular-nums">
              {formatNumber(liveScore)}
            </div>
          ) : null}

          {phase === 'idle' ? (
            <Overlay>
              <h2 className="text-xl font-extrabold text-white">Ready?</h2>
              <ul className="space-y-1 text-center text-sm text-white/80">
                {controls.map((control) => (
                  <li key={control}>{control}</li>
                ))}
              </ul>
              <Button variant="gradient" size="lg" onClick={handleStart} isLoading={isStarting}>
                <Play className="h-4 w-4" aria-hidden />
                Start — costs 1 energy
              </Button>
              {error ? (
                <p className="max-w-xs text-center text-sm font-medium text-red-300">{error}</p>
              ) : null}
            </Overlay>
          ) : null}

          {phase === 'countdown' ? (
            <Overlay>
              <p
                key={countdown}
                className="animate-pop-in text-7xl font-black text-white"
                aria-live="assertive"
              >
                {countdown > 0 ? countdown : 'GO!'}
              </p>
            </Overlay>
          ) : null}

          {phase === 'paused' ? (
            <Overlay>
              <h2 className="text-xl font-extrabold text-white">Paused</h2>
              <Button variant="gradient" onClick={togglePause}>
                <Play className="h-4 w-4" aria-hidden />
                Resume
              </Button>
            </Overlay>
          ) : null}

          {phase === 'over' ? (
            <Overlay>
              {isSubmitting ? (
                <p className="text-lg font-bold text-white">Verifying your score…</p>
              ) : result ? (
                <GameOver result={result} onPlayAgain={playAgain} />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <AlertTriangle className="h-8 w-8 text-amber-400" aria-hidden />
                  <p className="max-w-xs font-semibold text-white">
                    {error ?? 'Your score could not be verified.'}
                  </p>
                  <Button variant="outline" onClick={playAgain}>
                    Back
                  </Button>
                </div>
              )}
            </Overlay>
          ) : null}
        </div>
      </Card>

      {phase === 'playing' || phase === 'paused' ? (
        <Button variant="outline" className="w-full" onClick={togglePause}>
          {phase === 'playing' ? (
            <>
              <Pause className="h-4 w-4" aria-hidden />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4" aria-hidden />
              Resume
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/85 p-6 backdrop-blur-sm">
      {children}
    </div>
  );
}

function GameOver({ result, onPlayAgain }: { result: SubmitResult; onPlayAgain: () => void }) {
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-4 text-center">
      <div className="animate-pop-in">
        {result.isHighScore ? (
          <Badge variant="warning" className="mb-2">
            <Trophy className="mr-1 h-3 w-3" aria-hidden />
            New high score!
          </Badge>
        ) : null}
        <p className="text-sm font-semibold uppercase tracking-wide text-white/60">Final score</p>
        {/* Deliberately the SERVER's validated score, not the number the canvas was
            showing. If they diverge, the server is right by definition. */}
        <p className="text-5xl font-black text-white tabular-nums">
          {formatNumber(result.validatedScore)}
        </p>
      </div>

      {result.wasScoreClamped ? (
        <p className="rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-200">
          Your score was adjusted after verification.
        </p>
      ) : null}

      <div className="grid w-full grid-cols-2 gap-2">
        <Reward icon={Coins} label="Coins" value={result.coinsAwarded} tone="text-amber-300" />
        <Reward
          icon={Sparkles}
          label="Points"
          value={result.pointsAwarded}
          tone="text-purple-300"
        />
      </div>

      {result.dailyCoinCapReached || result.dailyPointCapReached ? (
        <p className="text-xs text-white/60">
          You&apos;ve hit today&apos;s earning cap for this game. Scores still count for the
          leaderboard.
        </p>
      ) : null}

      <div className="flex w-full gap-2">
        <Button variant="gradient" className="flex-1" onClick={onPlayAgain}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Again
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/games">Lobby</Link>
        </Button>
      </div>
    </div>
  );
}

function Reward({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Coins;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <p className={`flex items-center justify-center gap-1 text-lg font-bold tabular-nums ${tone}`}>
        <Icon className="h-4 w-4" aria-hidden />+{value}
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{label}</p>
    </div>
  );
}
