import { prisma, type TxClient } from '@/lib/db';
import { AppError } from '@/lib/api';
import { GAME_ENERGY } from '@/lib/game-config';

/**
 * Game energy, regenerated lazily from a timestamp — same reasoning as pet decay.
 *
 * The invariant is: `gameEnergy` is the energy the player had at `gameEnergyUpdatedAt`.
 * Current energy is derived, never stored ahead of time. That means a player cannot
 * gain energy by manipulating their clock, and we don't need a cron ticking over
 * every profile in the database every thirty minutes.
 */

export interface EnergyState {
  current: number;
  max: number;
  /** Seconds until the next +1. Zero when full. */
  nextRegenInSeconds: number;
  /** Seconds until a full bar. Zero when full. */
  fullInSeconds: number;
  canFreeRefill: boolean;
  freeRefillInSeconds: number;
}

interface EnergyRow {
  gameEnergy: number;
  gameEnergyUpdatedAt: Date;
  lastFreeRefillAt: Date | null;
}

export function computeEnergy(row: EnergyRow, now: Date = new Date()): EnergyState {
  const elapsedMs = Math.max(0, now.getTime() - row.gameEnergyUpdatedAt.getTime());
  const regenMs = GAME_ENERGY.regenMinutes * 60_000;

  const regenerated = Math.floor(elapsedMs / regenMs);
  const current = Math.min(GAME_ENERGY.max, row.gameEnergy + regenerated);

  const isFull = current >= GAME_ENERGY.max;
  const msIntoCurrentTick = elapsedMs % regenMs;
  const nextRegenInSeconds = isFull ? 0 : Math.ceil((regenMs - msIntoCurrentTick) / 1000);
  const fullInSeconds = isFull
    ? 0
    : Math.ceil(((GAME_ENERGY.max - current - 1) * regenMs + (regenMs - msIntoCurrentTick)) / 1000);

  const refillCooldownMs = GAME_ENERGY.freeRefillCooldownHours * 3_600_000;
  const sinceRefillMs = row.lastFreeRefillAt
    ? now.getTime() - row.lastFreeRefillAt.getTime()
    : Number.POSITIVE_INFINITY;

  return {
    current,
    max: GAME_ENERGY.max,
    nextRegenInSeconds,
    fullInSeconds,
    canFreeRefill: sinceRefillMs >= refillCooldownMs && current < GAME_ENERGY.max,
    freeRefillInSeconds:
      sinceRefillMs >= refillCooldownMs
        ? 0
        : Math.ceil((refillCooldownMs - sinceRefillMs) / 1000),
  };
}

export async function getEnergy(userId: string): Promise<EnergyState> {
  const profile = await prisma.profile.findUniqueOrThrow({
    where: { userId },
    select: { gameEnergy: true, gameEnergyUpdatedAt: true, lastFreeRefillAt: true },
  });
  return computeEnergy(profile);
}

/**
 * Spend energy inside the caller's transaction.
 *
 * Note the write: we persist the *derived* current energy minus the cost, and reset
 * the watermark to now. That collapses accrued regeneration into the stored value at
 * the moment of spending, which keeps the arithmetic honest across many small spends.
 */
export async function spendEnergy(tx: TxClient, userId: string, cost: number): Promise<EnergyState> {
  const now = new Date();
  const profile = await tx.profile.findUniqueOrThrow({
    where: { userId },
    select: { gameEnergy: true, gameEnergyUpdatedAt: true, lastFreeRefillAt: true },
  });

  const state = computeEnergy(profile, now);

  if (state.current < cost) {
    throw new AppError(
      'INSUFFICIENT_ENERGY',
      `Not enough energy. You need ${cost} and have ${state.current}. Next energy in ${Math.ceil(state.nextRegenInSeconds / 60)} min.`,
      { current: state.current, required: cost, nextRegenInSeconds: state.nextRegenInSeconds },
    );
  }

  await tx.profile.update({
    where: { userId },
    data: { gameEnergy: state.current - cost, gameEnergyUpdatedAt: now },
  });

  return computeEnergy(
    { gameEnergy: state.current - cost, gameEnergyUpdatedAt: now, lastFreeRefillAt: profile.lastFreeRefillAt },
    now,
  );
}

export async function grantEnergy(tx: TxClient, userId: string, amount: number): Promise<EnergyState> {
  const now = new Date();
  const profile = await tx.profile.findUniqueOrThrow({
    where: { userId },
    select: { gameEnergy: true, gameEnergyUpdatedAt: true, lastFreeRefillAt: true },
  });

  const state = computeEnergy(profile, now);
  const next = Math.min(GAME_ENERGY.max, state.current + amount);

  await tx.profile.update({
    where: { userId },
    data: { gameEnergy: next, gameEnergyUpdatedAt: now },
  });

  return computeEnergy({ gameEnergy: next, gameEnergyUpdatedAt: now, lastFreeRefillAt: profile.lastFreeRefillAt }, now);
}

/** One free top-up to full every 24h. */
export async function claimFreeRefill(userId: string): Promise<EnergyState> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const profile = await tx.profile.findUniqueOrThrow({
      where: { userId },
      select: { gameEnergy: true, gameEnergyUpdatedAt: true, lastFreeRefillAt: true },
    });

    const state = computeEnergy(profile, now);

    if (!state.canFreeRefill) {
      if (state.current >= GAME_ENERGY.max) {
        throw new AppError('CONFLICT', 'Your energy is already full.');
      }
      const hours = Math.ceil(state.freeRefillInSeconds / 3600);
      throw new AppError('COOLDOWN_ACTIVE', `Free refill available in ${hours}h.`, {
        freeRefillInSeconds: state.freeRefillInSeconds,
      });
    }

    // Conditional on the same lastFreeRefillAt we read, so a double-tap can't
    // produce two refills.
    const updated = await tx.profile.updateMany({
      where: { userId, lastFreeRefillAt: profile.lastFreeRefillAt },
      data: {
        gameEnergy: GAME_ENERGY.max,
        gameEnergyUpdatedAt: now,
        lastFreeRefillAt: now,
      },
    });

    if (updated.count === 0) {
      throw new AppError('CONFLICT', 'Refill already claimed. Try again in a moment.');
    }

    return computeEnergy(
      { gameEnergy: GAME_ENERGY.max, gameEnergyUpdatedAt: now, lastFreeRefillAt: now },
      now,
    );
  });
}
