import { describe, it, expect } from 'vitest';
import { applyDecay, deriveHealthState, canPlayGames, moodScore } from '@/services/pet/decay';

const RATES = {
  hungerDecayPerHour: 4,
  cleanlinessDecayPerHour: 3,
  happinessDecayPerHour: 2,
  energyDecayPerHour: 1,
  energyRegenPerHour: 12,
  healthDecayPerHour: 2,
};

function statsAt(hoursAgo: number, overrides: Partial<Parameters<typeof applyDecay>[0]> = {}) {
  return {
    hunger: 100,
    happiness: 100,
    energy: 100,
    cleanliness: 100,
    health: 100,
    isSleeping: false,
    statsUpdatedAt: new Date(Date.now() - hoursAgo * 3_600_000),
    ...overrides,
  };
}

describe('pet stat decay', () => {
  it('should not change stats when no measurable time has passed', () => {
    const result = applyDecay(statsAt(0), RATES);
    expect(result.changed).toBe(false);
    expect(result.hunger).toBe(100);
  });

  it('should decay hunger at the species rate', () => {
    const result = applyDecay(statsAt(5), RATES);
    expect(result.hunger).toBe(80); // 100 − (4/h × 5h)
  });

  it('should decay cleanliness at the species rate', () => {
    const result = applyDecay(statsAt(10), RATES);
    expect(result.cleanliness).toBe(70); // 100 − (3/h × 10h)
  });

  it('should clamp stats at zero rather than going negative', () => {
    const result = applyDecay(statsAt(1000), RATES);
    expect(result.hunger).toBe(0);
    expect(result.cleanliness).toBe(0);
    expect(result.happiness).toBe(0);
  });

  it('should regenerate energy while the pet is sleeping', () => {
    const result = applyDecay(statsAt(3, { energy: 20, isSleeping: true }), RATES);
    expect(result.energy).toBe(56); // 20 + (12/h × 3h)
  });

  it('should cap regenerated energy at 100', () => {
    const result = applyDecay(statsAt(50, { energy: 20, isSleeping: true }), RATES);
    expect(result.energy).toBe(100);
  });

  it('should leave health untouched when the pet is well cared for', () => {
    // Two hours of decay leaves hunger at 92 and cleanliness at 94 — nowhere near
    // the neglect threshold, so health must not move.
    const result = applyDecay(statsAt(2), RATES);
    expect(result.health).toBe(100);
  });

  it('should decay health only once hunger drops below the neglect threshold', () => {
    const result = applyDecay(statsAt(10, { hunger: 10, cleanliness: 100 }), RATES);
    expect(result.health).toBe(80); // 100 − (2/h × 10h)
  });

  it('should decay health once cleanliness drops below the neglect threshold', () => {
    const result = applyDecay(statsAt(10, { hunger: 100, cleanliness: 5 }), RATES);
    expect(result.health).toBe(80);
  });

  it('should never let health reach zero — the pet cannot die', () => {
    // This is the MVP's hard rule. A month of total neglect leaves a very sick pet,
    // not a dead one.
    const result = applyDecay(statsAt(10_000, { hunger: 0, cleanliness: 0, health: 100 }), RATES);
    expect(result.health).toBeGreaterThanOrEqual(1);
  });
});

describe('health state', () => {
  it('should report SICK when health is below 25', () => {
    expect(deriveHealthState(20, 100)).toBe('SICK');
  });

  it('should report TIRED when energy is below 20 but health is fine', () => {
    expect(deriveHealthState(100, 15)).toBe('TIRED');
  });

  it('should report HEALTHY when both health and energy are fine', () => {
    expect(deriveHealthState(80, 60)).toBe('HEALTHY');
  });

  it('should prioritise SICK over TIRED', () => {
    expect(deriveHealthState(10, 10)).toBe('SICK');
  });
});

describe('game access', () => {
  it('should block a sick pet from playing mini games', () => {
    expect(canPlayGames('SICK')).toBe(false);
  });

  it('should allow a tired pet to play', () => {
    expect(canPlayGames('TIRED')).toBe(true);
  });

  it('should allow a healthy pet to play', () => {
    expect(canPlayGames('HEALTHY')).toBe(true);
  });
});

describe('mood', () => {
  it('should average the five stats', () => {
    expect(
      moodScore({ hunger: 100, happiness: 80, energy: 60, cleanliness: 40, health: 20 }),
    ).toBe(60);
  });
});
