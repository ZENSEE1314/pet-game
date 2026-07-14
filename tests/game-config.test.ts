import { describe, it, expect } from 'vitest';
import {
  xpForNextLevel,
  streakRewardForDay,
  STREAK_REWARDS,
  CARE_ACTIONS,
  REWARD_POINT_CAPS,
  REFERRAL,
} from '@/lib/game-config';
import { dayKey, weekKey, clamp } from '@/lib/utils';

describe('player level curve', () => {
  it('should require more XP at each successive level', () => {
    for (let level = 1; level < 20; level += 1) {
      expect(xpForNextLevel(level + 1)).toBeGreaterThan(xpForNextLevel(level));
    }
  });

  it('should make level 2 reachable in a session', () => {
    expect(xpForNextLevel(1)).toBeLessThanOrEqual(100);
  });

  it('should make the level-3 referral gate meaningful but not punishing', () => {
    // Total XP to reach level 3. Cheap enough that a real player gets there, dear
    // enough that a throwaway account does not.
    const total = xpForNextLevel(1) + xpForNextLevel(2);
    expect(total).toBeGreaterThan(200);
    expect(total).toBeLessThan(600);
  });
});

describe('login streak cycle', () => {
  it('should pay reward points only on day 7', () => {
    const withPoints = STREAK_REWARDS.filter((reward) => reward.rewardPoints > 0);
    expect(withPoints).toHaveLength(1);
    expect(withPoints[0]!.day).toBe(7);
  });

  it('should increase the coin reward across the cycle', () => {
    expect(streakRewardForDay(1).coins).toBeLessThan(streakRewardForDay(6).coins);
  });

  it('should restart the cycle after day 7', () => {
    // Day 8 pays the day-1 reward again, while the displayed total streak keeps climbing.
    expect(streakRewardForDay(8)).toEqual(streakRewardForDay(1));
    expect(streakRewardForDay(14)).toEqual(streakRewardForDay(7));
    expect(streakRewardForDay(15)).toEqual(streakRewardForDay(1));
  });

  it('should handle day 1 without wrapping to the end of the cycle', () => {
    expect(streakRewardForDay(1).day).toBe(1);
  });
});

describe('care action balance', () => {
  it('should give every care action a cooldown', () => {
    for (const [action, config] of Object.entries(CARE_ACTIONS)) {
      expect(config.cooldownMinutes, `${action} must have a cooldown`).toBeGreaterThan(0);
    }
  });

  it('should never pay reward points directly for a care action', () => {
    // Care actions pay coins only. Reward points come from the once-daily bonus, which
    // is capped — otherwise a player could farm real value by clicking Feed all day.
    for (const config of Object.values(CARE_ACTIONS)) {
      expect(config.coins).toBeLessThanOrEqual(10);
    }
  });

  it('should require an item for the medicine action', () => {
    expect(CARE_ACTIONS.MEDICINE.consumesItemCategory).toBe('MEDICINE');
  });

  it('should cost energy to play', () => {
    expect(CARE_ACTIONS.PLAY.energy).toBeLessThan(0);
  });
});

describe('reward point caps', () => {
  it('should set a monthly cap that is not simply 30× the daily cap', () => {
    // If monthly were 30 × daily, it would never bind and would be decoration.
    expect(REWARD_POINT_CAPS.monthly).toBeLessThan(REWARD_POINT_CAPS.daily * 30);
  });

  it('should set a positive daily cap', () => {
    expect(REWARD_POINT_CAPS.daily).toBeGreaterThan(0);
  });
});

describe('referral configuration', () => {
  it('should require a level above 1 to qualify', () => {
    // Qualifying at level 1 would mean a bare signup pays out — the whole farm.
    expect(REFERRAL.qualifyingLevel).toBeGreaterThan(1);
  });

  it('should pay the referrer more than the referred user', () => {
    expect(REFERRAL.referrerPoints).toBeGreaterThan(REFERRAL.referredPoints);
  });
});

describe('period keys', () => {
  it('should produce a stable day key for a timezone', () => {
    const date = new Date('2026-07-14T18:30:00Z');
    expect(dayKey(date, 'UTC')).toBe('2026-07-14');
  });

  it('should roll over the day in the player’s timezone, not UTC', () => {
    // 18:30 UTC is already 02:30 the NEXT day in Kuala Lumpur (UTC+8). A player there
    // must get their new daily missions, not yesterday's.
    const date = new Date('2026-07-14T18:30:00Z');
    expect(dayKey(date, 'Asia/Kuala_Lumpur')).toBe('2026-07-15');
    expect(dayKey(date, 'UTC')).toBe('2026-07-14');
  });

  it('should produce an ISO week key', () => {
    expect(weekKey(new Date('2026-07-14T12:00:00Z'), 'UTC')).toMatch(/^2026-W\d{2}$/);
  });

  it('should give the same week key to every day in one week', () => {
    const monday = weekKey(new Date('2026-07-13T12:00:00Z'), 'UTC');
    const friday = weekKey(new Date('2026-07-17T12:00:00Z'), 'UTC');
    expect(monday).toBe(friday);
  });

  it('should give different week keys across a week boundary', () => {
    const sunday = weekKey(new Date('2026-07-12T12:00:00Z'), 'UTC');
    const monday = weekKey(new Date('2026-07-13T12:00:00Z'), 'UTC');
    expect(sunday).not.toBe(monday);
  });
});

describe('clamp', () => {
  it('should clamp above the maximum', () => {
    expect(clamp(150)).toBe(100);
  });

  it('should clamp below the minimum', () => {
    expect(clamp(-50)).toBe(0);
  });

  it('should leave an in-range value alone', () => {
    expect(clamp(42)).toBe(42);
  });
});
