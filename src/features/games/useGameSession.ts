'use client';

import { useState, useCallback } from 'react';
import type { GameSlug } from '@prisma/client';
import { api, errorMessage } from '@/features/api-client';

/**
 * The client half of the secure game-session flow.
 *
 * Note what this hook does NOT do: it never computes a reward, never decides whether
 * a score is valid, and never persists anything. It carries an opaque signature from
 * `start` to `submit` and then renders whatever numbers the server sends back.
 *
 * A player who patches this file can send any score they like. They will get back
 * the server's opinion of that score, which is the only opinion that pays.
 */

export interface GameSession {
  sessionId: string;
  signature: string;
  startedAt: number;
  expiresAt: number;
}

export interface GameEvents {
  coinsCollected?: number;
  obstaclesCleared?: number;
  distance?: number;
  maxCombo?: number;
  itemsCaught?: number;
  livesLost?: number;
}

export interface SubmitResult {
  validatedScore: number;
  coinsAwarded: number;
  pointsAwarded: number;
  xpAwarded: number;
  durationSeconds: number;
  isHighScore: boolean;
  wasScoreClamped: boolean;
  dailyCoinCapReached: boolean;
  dailyPointCapReached: boolean;
  balances: { COINS: number; REWARD_POINTS: number; GEMS: number };
}

export function useGameSession(slug: GameSlug) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (): Promise<GameSession | null> => {
    setIsStarting(true);
    setError(null);

    try {
      const result = await api.post<GameSession & { energy: unknown; attemptsRemaining: number }>(
        '/api/games/session',
        { slug },
      );

      const next: GameSession = {
        sessionId: result.sessionId,
        signature: result.signature,
        startedAt: result.startedAt,
        expiresAt: result.expiresAt,
      };

      setSession(next);
      return next;
    } catch (caught) {
      setError(errorMessage(caught));
      return null;
    } finally {
      setIsStarting(false);
    }
  }, [slug]);

  const submit = useCallback(
    async (score: number, events?: GameEvents): Promise<SubmitResult | null> => {
      if (!session) {
        setError('No active game session.');
        return null;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const result = await api.post<SubmitResult>('/api/games/submit', {
          sessionId: session.sessionId,
          signature: session.signature,
          score: Math.max(0, Math.floor(score)),
          events,
        });

        // The session is single-use on the server; clearing it here stops the UI
        // from offering a resubmit that would only ever be rejected.
        setSession(null);
        return result;
      } catch (caught) {
        setError(errorMessage(caught));
        setSession(null);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [session],
  );

  const reset = useCallback(() => {
    setSession(null);
    setError(null);
  }, []);

  return { session, start, submit, reset, isStarting, isSubmitting, error };
}
