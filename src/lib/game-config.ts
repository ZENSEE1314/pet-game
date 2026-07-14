import { PetCareAction } from '@prisma/client';

/**
 * Server-side game balance. None of this is shipped to the client as authority —
 * the UI may display these numbers, but the server recomputes every reward from
 * this file (or from admin-editable DB rows) before a single coin moves.
 */

// --- Pet care ---------------------------------------------------------------

export interface CareActionConfig {
  cooldownMinutes: number;
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
  health: number;
  friendship: number;
  coins: number;
  xp: number;
  /** Care actions that need the pet awake. Feeding a sleeping pet is silly. */
  requiresAwake: boolean;
  /** MEDICINE consumes an item; the action fails if the player has none. */
  consumesItemCategory?: 'MEDICINE' | 'FOOD';
}

export const CARE_ACTIONS: Record<PetCareAction, CareActionConfig> = {
  FEED: {
    cooldownMinutes: 60,
    hunger: 20,
    happiness: 2,
    energy: 0,
    cleanliness: -2,
    health: 1,
    friendship: 5,
    coins: 5,
    xp: 5,
    requiresAwake: true,
  },
  BATHE: {
    cooldownMinutes: 180,
    hunger: 0,
    happiness: 5,
    energy: -3,
    cleanliness: 25,
    health: 2,
    friendship: 5,
    coins: 5,
    xp: 5,
    requiresAwake: true,
  },
  PLAY: {
    cooldownMinutes: 90,
    hunger: -5,
    happiness: 20,
    energy: -10,
    cleanliness: -5,
    health: 0,
    friendship: 10,
    coins: 10,
    xp: 8,
    requiresAwake: true,
  },
  SLEEP: {
    // Sleep is a toggle: it flips `isSleeping`, and energy then regenerates
    // through the same lazy-decay path as everything else. No instant refill.
    cooldownMinutes: 30,
    hunger: 0,
    happiness: 0,
    energy: 0,
    cleanliness: 0,
    health: 0,
    friendship: 0,
    coins: 0,
    xp: 2,
    requiresAwake: false,
  },
  MEDICINE: {
    cooldownMinutes: 240,
    hunger: 0,
    happiness: -2,
    energy: 5,
    cleanliness: 0,
    health: 40,
    friendship: 3,
    coins: 0,
    xp: 10,
    requiresAwake: true,
    consumesItemCategory: 'MEDICINE',
  },
};

/** Actions the player must do once each to earn the daily care bonus. */
export const DAILY_CARE_REQUIRED: PetCareAction[] = ['FEED', 'BATHE', 'PLAY'];

export const DAILY_CARE_BONUS = {
  coins: 50,
  rewardPoints: 5,
  xp: 25,
} as const;

// --- Pet health thresholds --------------------------------------------------

export const PET_THRESHOLDS = {
  /** Below this, hunger/cleanliness start eating into health. */
  neglect: 20,
  /** Below this health, the pet is SICK and mini games are locked. */
  sick: 25,
  /** Below this energy, the pet is TIRED. */
  tired: 20,
} as const;

// --- Player levels ----------------------------------------------------------

/**
 * XP needed to go from level N to N+1: `100 * N^1.5`, rounded to the nearest 10.
 * Gentle early (L1→L2 = 100 XP, roughly two days of casual care) and steep later,
 * so the Level 3 referral gate is reachable in a session or two but Level 10 is
 * a genuine milestone.
 */
export function xpForNextLevel(level: number): number {
  return Math.round((100 * Math.pow(level, 1.5)) / 10) * 10;
}

export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let n = 1; n < level; n += 1) total += xpForNextLevel(n);
  return total;
}

export const MAX_LEVEL = 100;

// --- Pet levels -------------------------------------------------------------

export function petXpForNextLevel(level: number): number {
  return Math.round((60 * Math.pow(level, 1.4)) / 10) * 10;
}

// --- Game energy ------------------------------------------------------------

export const GAME_ENERGY = {
  max: 10,
  regenMinutes: 30,
  freeRefillCooldownHours: 24,
} as const;

// --- Login streak -----------------------------------------------------------

export interface StreakReward {
  day: number;
  coins: number;
  rewardPoints: number;
  xp: number;
}

/** A 7-day cycle. After day 7 the cycle restarts, but the total streak keeps counting. */
export const STREAK_REWARDS: StreakReward[] = [
  { day: 1, coins: 10, rewardPoints: 0, xp: 5 },
  { day: 2, coins: 15, rewardPoints: 0, xp: 5 },
  { day: 3, coins: 20, rewardPoints: 0, xp: 10 },
  { day: 4, coins: 25, rewardPoints: 0, xp: 10 },
  { day: 5, coins: 30, rewardPoints: 0, xp: 15 },
  { day: 6, coins: 40, rewardPoints: 0, xp: 15 },
  { day: 7, coins: 0, rewardPoints: 10, xp: 30 },
];

export function streakRewardForDay(streakDay: number): StreakReward {
  const index = ((streakDay - 1) % STREAK_REWARDS.length + STREAK_REWARDS.length) % STREAK_REWARDS.length;
  return STREAK_REWARDS[index]!;
}

// --- Reward point earning caps ---------------------------------------------

/**
 * Enforced inside the transaction service, not at call sites. A cap you enforce
 * at the call site is a cap you will forget to enforce at the next call site.
 */
export const REWARD_POINT_CAPS = {
  daily: 200,
  monthly: 2000,
} as const;

// --- Referral ---------------------------------------------------------------

export const REFERRAL = {
  qualifyingLevel: 3,
  referrerPoints: 25,
  referredPoints: 10,
  referrerCoins: 100,
  referredCoins: 50,
  /** More referrals than this from one account in 24h raises a fraud alert. */
  dailyAlertThreshold: 5,
} as const;

// --- Signup -----------------------------------------------------------------

export const SIGNUP_BONUS = {
  coins: 100,
  gems: 5,
  rewardPoints: 0,
} as const;
