import {
  PetCareAction,
  PetStage,
  CurrencyType,
  TransactionDirection,
  TransactionCategory,
  MissionType,
  AchievementCode,
  ItemCategory,
  NotificationType,
  type Pet,
  type PetSpecies,
} from '@prisma/client';

import { prisma, type TxClient } from '@/lib/db';
import { AppError } from '@/lib/api';
import { clamp, dayKey } from '@/lib/utils';
import { env } from '@/lib/env';
import {
  CARE_ACTIONS,
  DAILY_CARE_REQUIRED,
  DAILY_CARE_BONUS,
  petXpForNextLevel,
} from '@/lib/game-config';
import { recordTransaction } from '@/services/currency/transaction.service';
import { awardXp } from '@/services/level/level.service';
import { trackMissionProgress } from '@/services/mission/mission.service';
import { trackAchievement } from '@/services/achievement/achievement.service';
import { notify } from '@/services/notification/notification.service';
import { applyDecay, deriveHealthState, moodScore, moodLabel } from './decay';

export type PetWithSpecies = Pet & { species: PetSpecies };

// --- Reads ------------------------------------------------------------------

/**
 * Load the player's pet with decay applied and persisted.
 *
 * This is the ONLY sanctioned way to read a pet. Reading `prisma.pet.findFirst`
 * directly gives you stale stats — the numbers in the row are only true as of
 * `statsUpdatedAt`.
 */
export async function getPetForUser(userId: string): Promise<PetWithSpecies | null> {
  const pet = await prisma.pet.findFirst({
    where: { userId, deletedAt: null },
    include: { species: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!pet) return null;
  return refreshPetStats(pet);
}

async function refreshPetStats(pet: PetWithSpecies): Promise<PetWithSpecies> {
  const decayed = applyDecay(pet, pet.species);
  if (!decayed.changed) return pet;

  const wasSick = pet.healthState === 'SICK';

  const updated = await prisma.pet.update({
    where: { id: pet.id },
    data: {
      hunger: decayed.hunger,
      happiness: decayed.happiness,
      energy: decayed.energy,
      cleanliness: decayed.cleanliness,
      health: decayed.health,
      healthState: decayed.healthState,
      statsUpdatedAt: decayed.statsUpdatedAt,
    },
    include: { species: true },
  });

  // Only nag on the *transition* into sickness, not on every page load.
  if (!wasSick && updated.healthState === 'SICK') {
    void notify({
      userId: pet.userId,
      type: NotificationType.PET_SICK,
      title: `${pet.name} is sick`,
      body: 'Give medicine to restore health. Mini games are locked until they recover.',
      linkUrl: '/pet/care',
      iconKey: 'pet-sick',
    });
  }

  return updated;
}

export function petSummary(pet: PetWithSpecies) {
  const mood = moodScore(pet);
  return {
    id: pet.id,
    name: pet.name,
    species: { id: pet.species.id, name: pet.species.name, slug: pet.species.slug },
    stage: pet.stage,
    level: pet.level,
    xp: pet.xp,
    xpForNext: petXpForNextLevel(pet.level),
    ageHours: Math.floor((Date.now() - pet.bornAt.getTime()) / 3_600_000),
    stats: {
      hunger: pet.hunger,
      happiness: pet.happiness,
      energy: pet.energy,
      cleanliness: pet.cleanliness,
      health: pet.health,
      friendship: pet.friendship,
    },
    healthState: pet.healthState,
    isSleeping: pet.isSleeping,
    mood,
    moodLabel: moodLabel(mood),
    totalCareActions: pet.totalCareActions,
    lastFedAt: pet.lastFedAt,
    lastBathedAt: pet.lastBathedAt,
    lastPlayedAt: pet.lastPlayedAt,
    lastSleptAt: pet.lastSleptAt,
    lastMedicatedAt: pet.lastMedicatedAt,
    equippedItemId: pet.equippedItemId,
  };
}

// --- Adoption ---------------------------------------------------------------

export async function adoptPet(userId: string, name: string, speciesId?: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 20) {
    throw new AppError('VALIDATION_ERROR', 'Pet name must be 2–20 characters.');
  }

  return prisma.$transaction(async (tx) => {
    // MVP rule: one pet per player. The schema is a 1-to-many so lifting this is a
    // matter of deleting this check, not a migration.
    const existing = await tx.pet.findFirst({ where: { userId, deletedAt: null } });
    if (existing) {
      throw new AppError('CONFLICT', 'You already have a pet.');
    }

    const species = speciesId
      ? await tx.petSpecies.findFirst({ where: { id: speciesId, isActive: true } })
      : await tx.petSpecies.findFirst({ where: { isStarter: true, isActive: true } });

    if (!species) throw new AppError('NOT_FOUND', 'That species is not available.');

    const pet = await tx.pet.create({
      data: {
        userId,
        speciesId: species.id,
        name: trimmed,
        stage: PetStage.BABY,
      },
      include: { species: true },
    });

    await trackAchievement(tx, userId, AchievementCode.ADOPT_FIRST_PET, 1);
    await awardXp(tx, userId, 20);

    await notify(
      {
        userId,
        type: NotificationType.PET_ENERGY_RESTORED,
        title: `Welcome, ${pet.name}!`,
        body: 'Your new companion is ready. Feed them to get started.',
        linkUrl: '/pet',
        iconKey: 'pet',
      },
      tx,
    );

    return pet;
  });
}

// --- Care actions -----------------------------------------------------------

export interface CareResult {
  pet: ReturnType<typeof petSummary>;
  action: PetCareAction;
  coinsAwarded: number;
  xpAwarded: number;
  deltas: Record<string, number>;
  dailyCareCompleted: boolean;
  dailyBonus?: { coins: number; rewardPoints: number; xp: number };
  petLeveledUp: boolean;
}

export async function performCareAction(
  userId: string,
  action: PetCareAction,
): Promise<CareResult> {
  const config = CARE_ACTIONS[action];
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const raw = await tx.pet.findFirst({
      where: { userId, deletedAt: null },
      include: { species: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!raw) throw new AppError('NOT_FOUND', 'You need to adopt a pet first.');

    // Decay first, so the action operates on the pet's *actual* current state.
    const decayed = applyDecay(raw, raw.species, now);

    // Cooldown is enforced against the DB timestamp, never against a Redis key.
    // Redis can be flushed; `last*At` cannot, so this is the authoritative check.
    const lastAt = lastActionAt(raw, action);
    if (lastAt) {
      const elapsedMinutes = (now.getTime() - lastAt.getTime()) / 60_000;
      if (elapsedMinutes < config.cooldownMinutes) {
        const remaining = Math.ceil(config.cooldownMinutes - elapsedMinutes);
        throw new AppError(
          'COOLDOWN_ACTIVE',
          `${labelFor(action)} is on cooldown for another ${remaining} minute${remaining === 1 ? '' : 's'}.`,
          { remainingMinutes: remaining, action },
        );
      }
    }

    if (config.requiresAwake && raw.isSleeping) {
      throw new AppError('CONFLICT', `${raw.name} is asleep. Wake them up first.`);
    }

    // SLEEP is a toggle, not a stat dump — energy then regenerates through the
    // same lazy-decay path as everything else.
    if (action === PetCareAction.SLEEP) {
      return toggleSleep(tx, raw, decayed, now);
    }

    // Medicine consumes an item. No item, no cure — you can't wish a pet well.
    let consumedItemId: string | undefined;
    if (config.consumesItemCategory) {
      const stack = await tx.userInventory.findFirst({
        where: {
          userId,
          quantity: { gt: 0 },
          item: { category: config.consumesItemCategory as ItemCategory, isActive: true },
        },
        include: { item: true },
      });
      if (!stack) {
        throw new AppError(
          'CONFLICT',
          `You need a medicine item to do that. Buy one from the shop.`,
        );
      }
      await tx.userInventory.update({
        where: { id: stack.id },
        data: { quantity: { decrement: 1 } },
      });
      consumedItemId = stack.itemId;
    }

    const next = {
      hunger: clamp(decayed.hunger + config.hunger),
      happiness: clamp(decayed.happiness + config.happiness),
      energy: clamp(decayed.energy + config.energy),
      cleanliness: clamp(decayed.cleanliness + config.cleanliness),
      health: clamp(decayed.health + config.health),
      friendship: clamp(raw.friendship + config.friendship),
    };

    // Pet XP + level roll-up.
    let petLevel = raw.level;
    let petXp = raw.xp + config.xp;
    let petLeveledUp = false;
    while (petXp >= petXpForNextLevel(petLevel)) {
      petXp -= petXpForNextLevel(petLevel);
      petLevel += 1;
      petLeveledUp = true;
    }

    const updated = await tx.pet.update({
      where: { id: raw.id },
      data: {
        ...next,
        healthState: deriveHealthState(next.health, next.energy),
        statsUpdatedAt: now,
        level: petLevel,
        xp: petXp,
        totalCareActions: { increment: 1 },
        totalFeeds: action === PetCareAction.FEED ? { increment: 1 } : undefined,
        ...timestampFor(action, now),
      },
      include: { species: true },
    });

    await tx.petActivity.create({
      data: {
        petId: raw.id,
        userId,
        action,
        hungerDelta: next.hunger - decayed.hunger,
        happinessDelta: next.happiness - decayed.happiness,
        energyDelta: next.energy - decayed.energy,
        cleanlinessDelta: next.cleanliness - decayed.cleanliness,
        healthDelta: next.health - decayed.health,
        friendshipDelta: config.friendship,
        coinsAwarded: config.coins,
        xpAwarded: config.xp,
      },
    });

    // The coin reward is derived from the server's CARE_ACTIONS table, never from
    // anything the client sent. The client sends one thing: which action.
    if (config.coins > 0) {
      await recordTransaction(tx, {
        userId,
        currency: CurrencyType.COINS,
        direction: TransactionDirection.CREDIT,
        amount: config.coins,
        category: TransactionCategory.PET_CARE,
        description: `${labelFor(action)} ${raw.name}`,
        referenceType: 'Pet',
        referenceId: raw.id,
        // One reward per action per cooldown window. Even if the request is
        // retried, the key collides and no second coin is minted.
        idempotencyKey: `care:${raw.id}:${action}:${now.getTime()}`,
      });
    }

    await awardXp(tx, userId, config.xp);

    // Mission + achievement side effects, inside the same transaction: if the care
    // action rolls back, so does everything it would have granted.
    await trackMissionProgress(tx, userId, missionTypeFor(action));
    await trackAchievement(tx, userId, AchievementCode.FIRST_CARE_ACTION, 1);
    if (action === PetCareAction.FEED) {
      await trackAchievement(tx, userId, AchievementCode.FEED_100_TIMES, 1);
    }

    const daily = await evaluateDailyCareBonus(tx, userId, raw.id, now);

    return {
      pet: petSummary(updated),
      action,
      coinsAwarded: config.coins,
      xpAwarded: config.xp,
      deltas: {
        hunger: next.hunger - decayed.hunger,
        happiness: next.happiness - decayed.happiness,
        energy: next.energy - decayed.energy,
        cleanliness: next.cleanliness - decayed.cleanliness,
        health: next.health - decayed.health,
        friendship: config.friendship,
      },
      dailyCareCompleted: daily.completed,
      dailyBonus: daily.bonus,
      petLeveledUp,
      consumedItemId,
    } satisfies CareResult & { consumedItemId?: string };
  });
}

async function toggleSleep(
  tx: TxClient,
  pet: PetWithSpecies,
  decayed: ReturnType<typeof applyDecay>,
  now: Date,
): Promise<CareResult> {
  const isSleeping = !pet.isSleeping;

  const updated = await tx.pet.update({
    where: { id: pet.id },
    data: {
      hunger: decayed.hunger,
      happiness: decayed.happiness,
      energy: decayed.energy,
      cleanliness: decayed.cleanliness,
      health: decayed.health,
      healthState: decayed.healthState,
      isSleeping,
      statsUpdatedAt: now,
      lastSleptAt: now,
      totalCareActions: { increment: 1 },
    },
    include: { species: true },
  });

  await tx.petActivity.create({
    data: { petId: pet.id, userId: pet.userId, action: PetCareAction.SLEEP, xpAwarded: 2 },
  });

  await awardXp(tx, pet.userId, 2);

  return {
    pet: petSummary(updated),
    action: PetCareAction.SLEEP,
    coinsAwarded: 0,
    xpAwarded: 2,
    deltas: {},
    dailyCareCompleted: false,
    petLeveledUp: false,
  };
}

/**
 * The "Complete Daily Pet Care" bonus: once per player-local day, after FEED,
 * BATHE and PLAY have all been done.
 *
 * `lastDailyCareAt` compared as a *day key in the player's timezone* is the guard.
 * Comparing timestamps instead would let a player in UTC+8 claim twice around
 * midnight UTC.
 */
async function evaluateDailyCareBonus(
  tx: TxClient,
  userId: string,
  petId: string,
  now: Date,
): Promise<{ completed: boolean; bonus?: typeof DAILY_CARE_BONUS }> {
  const profile = await tx.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const timezone = profile?.timezone ?? env.DEFAULT_TIMEZONE;
  const today = dayKey(now, timezone);

  const pet = await tx.pet.findUniqueOrThrow({
    where: { id: petId },
    select: { lastDailyCareAt: true },
  });

  if (pet.lastDailyCareAt && dayKey(pet.lastDailyCareAt, timezone) === today) {
    return { completed: false }; // already paid today
  }

  const startOfDay = new Date(`${today}T00:00:00Z`);
  const activities = await tx.petActivity.findMany({
    where: { petId, createdAt: { gte: startOfDay } },
    select: { action: true },
    distinct: ['action'],
  });

  const done = new Set(activities.map((a) => a.action));
  const allDone = DAILY_CARE_REQUIRED.every((action) => done.has(action));
  if (!allDone) return { completed: false };

  // Conditional write: two care actions completing the set simultaneously race
  // here, and only one of them wins the bonus.
  const claimed = await tx.pet.updateMany({
    where: {
      id: petId,
      OR: [{ lastDailyCareAt: null }, { lastDailyCareAt: { lt: startOfDay } }],
    },
    data: { lastDailyCareAt: now },
  });
  if (claimed.count === 0) return { completed: false };

  await recordTransaction(tx, {
    userId,
    currency: CurrencyType.COINS,
    direction: TransactionDirection.CREDIT,
    amount: DAILY_CARE_BONUS.coins,
    category: TransactionCategory.DAILY_CARE_BONUS,
    description: 'Daily pet care complete',
    referenceType: 'Pet',
    referenceId: petId,
    idempotencyKey: `daily-care:${petId}:${today}`,
  });

  await recordTransaction(tx, {
    userId,
    currency: CurrencyType.REWARD_POINTS,
    direction: TransactionDirection.CREDIT,
    amount: DAILY_CARE_BONUS.rewardPoints,
    category: TransactionCategory.DAILY_CARE_BONUS,
    description: 'Daily pet care complete',
    referenceType: 'Pet',
    referenceId: petId,
    idempotencyKey: `daily-care-points:${petId}:${today}`,
  });

  await awardXp(tx, userId, DAILY_CARE_BONUS.xp);
  await trackMissionProgress(tx, userId, MissionType.COMPLETE_DAILY_CARE);

  await notify(
    {
      userId,
      type: NotificationType.MISSION_COMPLETED,
      title: 'Daily care complete!',
      body: `+${DAILY_CARE_BONUS.coins} coins, +${DAILY_CARE_BONUS.rewardPoints} reward points.`,
      linkUrl: '/pet',
      iconKey: 'sparkle',
    },
    tx,
  );

  return { completed: true, bonus: DAILY_CARE_BONUS };
}

// --- Cooldown surface for the UI --------------------------------------------

export interface CooldownInfo {
  action: PetCareAction;
  isReady: boolean;
  remainingSeconds: number;
  cooldownMinutes: number;
}

export function getCooldowns(pet: Pet, now: Date = new Date()): CooldownInfo[] {
  return (Object.keys(CARE_ACTIONS) as PetCareAction[]).map((action) => {
    const config = CARE_ACTIONS[action];
    const lastAt = lastActionAt(pet, action);

    if (!lastAt) {
      return { action, isReady: true, remainingSeconds: 0, cooldownMinutes: config.cooldownMinutes };
    }

    const elapsedSeconds = (now.getTime() - lastAt.getTime()) / 1000;
    const remaining = Math.max(0, Math.ceil(config.cooldownMinutes * 60 - elapsedSeconds));

    return {
      action,
      isReady: remaining === 0,
      remainingSeconds: remaining,
      cooldownMinutes: config.cooldownMinutes,
    };
  });
}

export async function getDailyCareStatus(userId: string, petId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const timezone = profile?.timezone ?? env.DEFAULT_TIMEZONE;
  const today = dayKey(new Date(), timezone);
  const startOfDay = new Date(`${today}T00:00:00Z`);

  const [activities, pet] = await Promise.all([
    prisma.petActivity.findMany({
      where: { petId, createdAt: { gte: startOfDay } },
      select: { action: true },
      distinct: ['action'],
    }),
    prisma.pet.findUnique({ where: { id: petId }, select: { lastDailyCareAt: true } }),
  ]);

  const done = new Set(activities.map((a) => a.action));

  return {
    required: DAILY_CARE_REQUIRED,
    completed: DAILY_CARE_REQUIRED.filter((action) => done.has(action)),
    isBonusClaimed: Boolean(
      pet?.lastDailyCareAt && dayKey(pet.lastDailyCareAt, timezone) === today,
    ),
    bonus: DAILY_CARE_BONUS,
  };
}

export async function getPetActivities(petId: string, limit = 20) {
  return prisma.petActivity.findMany({
    where: { petId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// --- Internal helpers -------------------------------------------------------

function lastActionAt(pet: Pet, action: PetCareAction): Date | null {
  switch (action) {
    case PetCareAction.FEED:
      return pet.lastFedAt;
    case PetCareAction.BATHE:
      return pet.lastBathedAt;
    case PetCareAction.PLAY:
      return pet.lastPlayedAt;
    case PetCareAction.SLEEP:
      return pet.lastSleptAt;
    case PetCareAction.MEDICINE:
      return pet.lastMedicatedAt;
  }
}

function timestampFor(action: PetCareAction, now: Date) {
  switch (action) {
    case PetCareAction.FEED:
      return { lastFedAt: now };
    case PetCareAction.BATHE:
      return { lastBathedAt: now };
    case PetCareAction.PLAY:
      return { lastPlayedAt: now };
    case PetCareAction.SLEEP:
      return { lastSleptAt: now };
    case PetCareAction.MEDICINE:
      return { lastMedicatedAt: now };
  }
}

function missionTypeFor(action: PetCareAction): MissionType {
  switch (action) {
    case PetCareAction.FEED:
      return MissionType.FEED_PET;
    case PetCareAction.BATHE:
      return MissionType.BATHE_PET;
    case PetCareAction.PLAY:
      return MissionType.PLAY_WITH_PET;
    default:
      return MissionType.COMPLETE_DAILY_CARE;
  }
}

function labelFor(action: PetCareAction): string {
  const labels: Record<PetCareAction, string> = {
    FEED: 'Feed',
    BATHE: 'Bathe',
    PLAY: 'Play',
    SLEEP: 'Sleep',
    MEDICINE: 'Medicine',
  };
  return labels[action];
}
