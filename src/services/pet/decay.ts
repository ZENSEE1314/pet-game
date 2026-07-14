import { PetHealthState } from '@prisma/client';
import { clamp, hoursBetween } from '@/lib/utils';
import { PET_THRESHOLDS } from '@/lib/game-config';

/**
 * Lazy, timestamp-derived stat decay.
 *
 * There is no cron job. Stats are a pure function of (last known stats, elapsed
 * time, species rates), computed on every read. This is not a shortcut — it is
 * strictly better than a scheduler for this problem:
 *
 *   - It cannot drift. A cron that didn't fire for six hours leaves the pet in a
 *     lie; this cannot.
 *   - It survives downtime without punishing the player twice.
 *   - It is a pure function, so it is trivially unit-testable at any timescale.
 *
 * The cost is that every pet read may write back. That's one indexed update on a
 * row we already loaded — cheap, and only when something actually changed.
 */

export interface DecayableStats {
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
  health: number;
  isSleeping: boolean;
  statsUpdatedAt: Date;
}

export interface SpeciesDecayRates {
  hungerDecayPerHour: number;
  cleanlinessDecayPerHour: number;
  happinessDecayPerHour: number;
  energyDecayPerHour: number;
  energyRegenPerHour: number;
  healthDecayPerHour: number;
}

export interface DecayResult {
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
  health: number;
  healthState: PetHealthState;
  statsUpdatedAt: Date;
  /** False when no measurable time passed — lets callers skip the write. */
  changed: boolean;
}

export function applyDecay(
  stats: DecayableStats,
  rates: SpeciesDecayRates,
  now: Date = new Date(),
): DecayResult {
  const elapsedHours = hoursBetween(stats.statsUpdatedAt, now);

  // Sub-minute reads (a page refresh, a double-click) shouldn't churn the DB.
  if (elapsedHours < 1 / 60) {
    return {
      hunger: stats.hunger,
      happiness: stats.happiness,
      energy: stats.energy,
      cleanliness: stats.cleanliness,
      health: stats.health,
      healthState: deriveHealthState(stats.health, stats.energy),
      statsUpdatedAt: stats.statsUpdatedAt,
      changed: false,
    };
  }

  const hunger = clamp(stats.hunger - rates.hungerDecayPerHour * elapsedHours);
  const cleanliness = clamp(stats.cleanliness - rates.cleanlinessDecayPerHour * elapsedHours);
  const happiness = clamp(stats.happiness - rates.happinessDecayPerHour * elapsedHours);

  // A sleeping pet recovers energy; an awake one slowly burns it.
  const energy = stats.isSleeping
    ? clamp(stats.energy + rates.energyRegenPerHour * elapsedHours)
    : clamp(stats.energy - rates.energyDecayPerHour * elapsedHours);

  // Health is the only stat that is *not* a plain clock. It only erodes while the
  // pet is actually being neglected — starving or filthy — so a player who logs
  // off for a week with a well-fed pet comes back to a hungry pet, not a dying
  // one. And it never reaches zero: the pet gets sick, never dead (MVP rule).
  const isNeglected =
    hunger < PET_THRESHOLDS.neglect || cleanliness < PET_THRESHOLDS.neglect;

  const health = isNeglected
    ? clamp(stats.health - rates.healthDecayPerHour * elapsedHours, 1, 100)
    : stats.health;

  return {
    hunger: Math.round(hunger),
    happiness: Math.round(happiness),
    energy: Math.round(energy),
    cleanliness: Math.round(cleanliness),
    health: Math.round(health),
    healthState: deriveHealthState(health, energy),
    statsUpdatedAt: now,
    changed: true,
  };
}

export function deriveHealthState(health: number, energy: number): PetHealthState {
  if (health < PET_THRESHOLDS.sick) return PetHealthState.SICK;
  if (energy < PET_THRESHOLDS.tired) return PetHealthState.TIRED;
  return PetHealthState.HEALTHY;
}

/** A SICK pet can't play mini games until it's been medicated. */
export function canPlayGames(healthState: PetHealthState): boolean {
  return healthState !== PetHealthState.SICK;
}

/** Overall wellbeing, for the single "mood" ring in the pet UI. */
export function moodScore(stats: Pick<DecayResult, 'hunger' | 'happiness' | 'energy' | 'cleanliness' | 'health'>): number {
  return Math.round(
    (stats.hunger + stats.happiness + stats.energy + stats.cleanliness + stats.health) / 5,
  );
}

export function moodLabel(score: number): string {
  if (score >= 85) return 'Thriving';
  if (score >= 70) return 'Happy';
  if (score >= 50) return 'Okay';
  if (score >= 30) return 'Needs attention';
  return 'Struggling';
}
