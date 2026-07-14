import { describe, it, expect } from 'vitest';
import {
  signGameSession,
  verifyGameSession,
  createClaimToken,
  verifyClaimToken,
  generateClaimCode,
  generateReferralCode,
} from '@/lib/crypto';

/**
 * These are the two signatures that stand between a modified client and free money.
 * If any test in this file fails, the economy is open.
 */

describe('game session signing', () => {
  const payload = {
    sessionId: 'clsession123',
    userId: 'cluser456',
    gameId: 'clgame789',
    nonce: 'random-nonce-value',
    startedAt: 1_700_000_000_000,
  };

  it('should verify a signature produced for the same payload', () => {
    const signature = signGameSession(payload);
    expect(verifyGameSession(payload, signature)).toBe(true);
  });

  it('should reject a signature when the session id is changed', () => {
    const signature = signGameSession(payload);
    expect(verifyGameSession({ ...payload, sessionId: 'clOTHER' }, signature)).toBe(false);
  });

  it('should reject a signature when the user id is changed', () => {
    // This is the check that stops a player replaying someone else's session token.
    const signature = signGameSession(payload);
    expect(verifyGameSession({ ...payload, userId: 'clATTACKER' }, signature)).toBe(false);
  });

  it('should reject a signature when the start time is backdated', () => {
    // Backdating startedAt is how you'd fake a long enough game duration.
    const signature = signGameSession(payload);
    expect(verifyGameSession({ ...payload, startedAt: 1_600_000_000_000 }, signature)).toBe(false);
  });

  it('should reject a garbage signature', () => {
    expect(verifyGameSession(payload, 'not-a-signature')).toBe(false);
  });
});

describe('claim QR tokens', () => {
  const payload = {
    claimId: 'clclaim123',
    claimCode: 'PQ-A7K2-9XQF',
    userId: 'cluser456',
    rewardId: 'clreward789',
    expiresAt: 1_800_000_000_000,
  };

  it('should round-trip a valid token', () => {
    const token = createClaimToken(payload);
    expect(verifyClaimToken(token)).toEqual(payload);
  });

  it('should reject a token whose payload was tampered with', () => {
    const token = createClaimToken(payload);
    const [, signature] = token.split('.');

    // Forge a new body (a different reward) but keep the original signature.
    const forgedBody = Buffer.from(
      JSON.stringify({ ...payload, rewardId: 'clEXPENSIVE' }),
    ).toString('base64url');

    expect(verifyClaimToken(`${forgedBody}.${signature}`)).toBeNull();
  });

  it('should reject a token with a truncated signature', () => {
    const token = createClaimToken(payload);
    expect(verifyClaimToken(token.slice(0, -4))).toBeNull();
  });

  it('should reject a malformed token', () => {
    expect(verifyClaimToken('garbage')).toBeNull();
    expect(verifyClaimToken('')).toBeNull();
    expect(verifyClaimToken('a.b.c')).toBeNull();
  });
});

describe('generated codes', () => {
  it('should generate a claim code in the PQ-XXXX-XXXX format', () => {
    expect(generateClaimCode()).toMatch(/^PQ-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('should omit ambiguous characters from claim codes', () => {
    // Staff type these off a phone screen. I/L/O/0/1 are how you get a wrong code.
    const codes = Array.from({ length: 200 }, generateClaimCode).join('');
    expect(codes).not.toMatch(/[ILO01]/);
  });

  it('should generate distinct claim codes', () => {
    const codes = new Set(Array.from({ length: 500 }, generateClaimCode));
    expect(codes.size).toBe(500);
  });

  it('should generate a referral code with the PET prefix', () => {
    expect(generateReferralCode()).toMatch(/^PET[A-Z2-9]{6}$/);
  });
});
