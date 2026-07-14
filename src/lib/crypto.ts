import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';

/**
 * HMAC helpers for the two things a hostile client must never be able to forge:
 * mini-game sessions and reward-claim QR tokens.
 *
 * These functions are server-only by construction — they read secrets from
 * `env`, which is never bundled into client code. Importing this file from a
 * `'use client'` module is a build error, which is exactly what we want.
 */

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** Constant-time compare. A `===` here would leak the signature byte by byte. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// --- Game sessions ---------------------------------------------------------

export interface GameSessionPayload {
  sessionId: string;
  userId: string;
  gameId: string;
  nonce: string;
  startedAt: number;
}

function gameSessionPayloadString(p: GameSessionPayload): string {
  return [p.sessionId, p.userId, p.gameId, p.nonce, String(p.startedAt)].join('|');
}

export function signGameSession(payload: GameSessionPayload): string {
  return sign(env.GAME_SESSION_SECRET, gameSessionPayloadString(payload));
}

export function verifyGameSession(payload: GameSessionPayload, signature: string): boolean {
  return safeEqual(signGameSession(payload), signature);
}

// --- Reward claim QR tokens ------------------------------------------------

export interface ClaimTokenPayload {
  claimId: string;
  claimCode: string;
  userId: string;
  rewardId: string;
  expiresAt: number;
}

/**
 * The QR encodes `base64url(json) + '.' + signature`. The signature proves the
 * token came from us; the DB row (checked separately at scan time) proves it
 * hasn't already been burned. Both checks are required — a signature alone would
 * let a screenshotted QR be redeemed twice.
 */
export function createClaimToken(payload: ClaimTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(env.QR_TOKEN_SECRET, body)}`;
}

export function verifyClaimToken(token: string): ClaimTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  if (!body || !signature) return null;
  if (!safeEqual(sign(env.QR_TOKEN_SECRET, body), signature)) return null;

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ClaimTokenPayload;
  } catch {
    return null;
  }
}

// --- Random identifiers ----------------------------------------------------

export function randomNonce(): string {
  return randomBytes(24).toString('base64url');
}

const CLAIM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I/L/O/0/1 — staff type these

/** Human-typable fallback for when the camera won't cooperate: `PQ-A7K2-9XQF`. */
export function generateClaimCode(): string {
  const pick = (n: number) =>
    Array.from(randomBytes(n))
      .map((byte) => CLAIM_CODE_ALPHABET[byte % CLAIM_CODE_ALPHABET.length])
      .join('');
  return `PQ-${pick(4)}-${pick(4)}`;
}

export function generateReferralCode(): string {
  const pick = Array.from(randomBytes(6))
    .map((byte) => CLAIM_CODE_ALPHABET[byte % CLAIM_CODE_ALPHABET.length])
    .join('');
  return `PET${pick}`;
}

export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}
