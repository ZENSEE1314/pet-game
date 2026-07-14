import { describe, it, expect } from 'vitest';
import { computeEnergy } from '@/services/game/energy.service';
import { GAME_ENERGY } from '@/lib/game-config';

function row(minutesAgo: number, energy: number, lastFreeRefillAt: Date | null = null) {
  return {
    gameEnergy: energy,
    gameEnergyUpdatedAt: new Date(Date.now() - minutesAgo * 60_000),
    lastFreeRefillAt,
  };
}

describe('lazy game-energy regeneration', () => {
  it('should not regenerate before a full tick has elapsed', () => {
    // 29 minutes into a 30-minute tick is still 29 minutes. No partial energy.
    expect(computeEnergy(row(29, 5)).current).toBe(5);
  });

  it('should regenerate one energy per full tick', () => {
    expect(computeEnergy(row(30, 5)).current).toBe(6);
    expect(computeEnergy(row(90, 5)).current).toBe(8);
  });

  it('should cap regenerated energy at the maximum', () => {
    expect(computeEnergy(row(10_000, 0)).current).toBe(GAME_ENERGY.max);
  });

  it('should report zero time to next regen when the bar is full', () => {
    const state = computeEnergy(row(10_000, 0));
    expect(state.nextRegenInSeconds).toBe(0);
    expect(state.fullInSeconds).toBe(0);
  });

  it('should report the time remaining in the current tick', () => {
    const state = computeEnergy(row(10, 5));
    // 20 minutes left of the 30-minute tick.
    expect(state.nextRegenInSeconds).toBeGreaterThan(19 * 60);
    expect(state.nextRegenInSeconds).toBeLessThanOrEqual(20 * 60);
  });

  it('should offer a free refill when none has been taken and the bar is not full', () => {
    expect(computeEnergy(row(0, 3, null)).canFreeRefill).toBe(true);
  });

  it('should not offer a free refill when the bar is already full', () => {
    expect(computeEnergy(row(0, GAME_ENERGY.max, null)).canFreeRefill).toBe(false);
  });

  it('should not offer a free refill within the cooldown window', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000);
    const state = computeEnergy(row(0, 2, twoHoursAgo));
    expect(state.canFreeRefill).toBe(false);
    expect(state.freeRefillInSeconds).toBeGreaterThan(0);
  });

  it('should offer a free refill again once the cooldown has passed', () => {
    const yesterday = new Date(Date.now() - 25 * 3_600_000);
    expect(computeEnergy(row(0, 2, yesterday)).canFreeRefill).toBe(true);
  });

  it('should not grant energy for a clock moved backwards', () => {
    // A negative elapsed time must floor at zero rather than subtracting energy.
    const future = { gameEnergy: 5, gameEnergyUpdatedAt: new Date(Date.now() + 3_600_000), lastFreeRefillAt: null };
    expect(computeEnergy(future).current).toBe(5);
  });
});
