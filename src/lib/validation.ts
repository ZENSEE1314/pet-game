import { z } from 'zod';
import {
  PetCareAction,
  CurrencyType,
  GameSlug,
  MissionFrequency,
  RewardCategory,
  LeaderboardPeriod,
  LeaderboardScope,
  Role,
  AccountStatus,
  TransactionDirection,
  ClaimStatus,
  FraudAlertStatus,
  MissionType,
  RewardType,
  ItemCategory,
  ItemRarity,
  CollectionMethod,
} from '@prisma/client';

/**
 * Every request body in the app is parsed by one of these before a service sees it.
 *
 * Note what is NOT here: there is no `coins`, `points`, `price` or `reward` field on
 * any player-facing input schema. The client is never permitted to state what
 * something is worth — only which thing it wants. That is not an oversight; it is
 * the single rule that keeps the economy honest.
 */

// --- Auth -------------------------------------------------------------------

const password = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[a-z]/, 'Password needs a lowercase letter')
  .regex(/[A-Z]/, 'Password needs an uppercase letter')
  .regex(/[0-9]/, 'Password needs a number');

export const registerSchema = z
  .object({
    email: z.string().email('Enter a valid email address').max(255),
    password,
    confirmPassword: z.string(),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(20)
      .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
    displayName: z.string().min(2, 'Display name is too short').max(40),
    phone: z.string().max(24).optional().or(z.literal('')),
    country: z.string().max(56).optional().or(z.literal('')),
    timezone: z.string().max(64).optional(),
    referralCode: z.string().max(16).optional().or(z.literal('')),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms to continue' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// --- Profile ----------------------------------------------------------------

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(40).optional(),
  phone: z.string().max(24).nullable().optional(),
  country: z.string().max(56).nullable().optional(),
  timezone: z.string().max(64).optional(),
  avatarUrl: z.string().url().nullable().optional().or(z.literal('')),
  bio: z.string().max(280).nullable().optional(),
  notifyMissions: z.boolean().optional(),
  notifyPetCare: z.boolean().optional(),
  notifyRewards: z.boolean().optional(),
  notifyAnnouncements: z.boolean().optional(),
});

// --- Pet --------------------------------------------------------------------

export const adoptPetSchema = z.object({
  name: z.string().min(2, 'Give your pet a name').max(20),
  speciesId: z.string().cuid().optional(),
});

export const careActionSchema = z.object({
  action: z.nativeEnum(PetCareAction),
});

// --- Items ------------------------------------------------------------------

export const purchaseItemSchema = z.object({
  itemId: z.string().cuid(),
  quantity: z.number().int().min(1).max(99).default(1),
  currency: z.enum([CurrencyType.COINS, CurrencyType.GEMS]).default(CurrencyType.COINS),
});

export const useItemSchema = z.object({ itemId: z.string().cuid() });

export const equipItemSchema = z.object({
  itemId: z.string().cuid(),
  equip: z.boolean(),
});

// --- Games ------------------------------------------------------------------

export const startSessionSchema = z.object({
  slug: z.nativeEnum(GameSlug),
});

/**
 * The client tells us its score and what happened. Both are *claims*. The server
 * recomputes the reward from the validated score and the admin's configured formula
 * — `events` exists so a human reviewing a fraud alert has something to look at,
 * not because we trust it.
 */
export const submitScoreSchema = z.object({
  sessionId: z.string().cuid(),
  signature: z.string().min(1),
  score: z.number().int().min(0).max(1_000_000),
  events: z
    .object({
      coinsCollected: z.number().int().min(0).max(100_000).optional(),
      obstaclesCleared: z.number().int().min(0).max(100_000).optional(),
      distance: z.number().min(0).max(1_000_000).optional(),
      maxCombo: z.number().int().min(0).max(1000).optional(),
      itemsCaught: z.number().int().min(0).max(100_000).optional(),
      livesLost: z.number().int().min(0).max(100).optional(),
    })
    .partial()
    .optional(),
});

// --- Sudoku -----------------------------------------------------------------

export const startSudokuSchema = z.object({
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('EASY'),
});

/**
 * The submitted grid: 81 digits, 0 for blank. The client sends its answer; the server
 * compares it to the solution it alone holds. There is no "score" or reward field —
 * the only thing the client states is the grid.
 */
export const submitSudokuSchema = z.object({
  gameId: z.string().cuid(),
  signature: z.string().min(1),
  grid: z.array(z.number().int().min(0).max(9)).length(81),
});

export const markMonstersSeenSchema = z.object({
  monsterIds: z.array(z.string().cuid()).optional(),
});

// --- Missions ---------------------------------------------------------------

export const claimMissionSchema = z.object({ userMissionId: z.string().cuid() });

export const missionQuerySchema = z.object({
  frequency: z.nativeEnum(MissionFrequency).default(MissionFrequency.DAILY),
});

// --- Rewards ----------------------------------------------------------------

export const redeemRewardSchema = z.object({ rewardId: z.string().cuid() });

export const rewardQuerySchema = z.object({
  category: z.nativeEnum(RewardCategory).optional(),
});

// --- Staff ------------------------------------------------------------------

export const lookupClaimSchema = z
  .object({
    qrToken: z.string().min(1).optional(),
    claimCode: z.string().min(4).max(20).optional(),
  })
  .refine((data) => Boolean(data.qrToken || data.claimCode), {
    message: 'Provide a QR token or a claim code',
  });

export const collectClaimSchema = z.object({ claimId: z.string().cuid() });

export const rejectClaimSchema = z.object({
  claimId: z.string().cuid(),
  reason: z.string().min(3, 'Give a reason').max(280),
});

// --- Promo & referral -------------------------------------------------------

export const promoCodeSchema = z.object({
  code: z.string().min(3, 'Enter a promo code').max(24),
});

// --- Notifications ----------------------------------------------------------

export const markReadSchema = z.object({
  notificationIds: z.array(z.string().cuid()).optional(),
});

// --- Leaderboards -----------------------------------------------------------

export const leaderboardQuerySchema = z.object({
  period: z.nativeEnum(LeaderboardPeriod).default(LeaderboardPeriod.WEEKLY),
  scope: z.nativeEnum(LeaderboardScope).default(LeaderboardScope.PER_GAME),
  gameId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// --- Pagination -------------------------------------------------------------

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// --- Admin ------------------------------------------------------------------

/**
 * A reason is mandatory. An unexplained balance change is indistinguishable from
 * fraud by an insider, so the schema refuses to let one exist.
 */
export const adjustBalanceSchema = z.object({
  userId: z.string().cuid(),
  currency: z.nativeEnum(CurrencyType),
  direction: z.nativeEnum(TransactionDirection),
  amount: z.number().int().min(1).max(1_000_000),
  reason: z.string().min(5, 'Give a clear reason (min 5 characters)').max(280),
});

export const setUserStatusSchema = z.object({
  userId: z.string().cuid(),
  status: z.nativeEnum(AccountStatus),
  reason: z.string().min(3).max(280),
});

export const setUserRoleSchema = z.object({
  userId: z.string().cuid(),
  role: z.nativeEnum(Role),
});

export const userQuerySchema = paginationSchema.extend({
  search: z.string().max(120).optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(AccountStatus).optional(),
});

export const rewardInputSchema = z.object({
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(80),
  description: z.string().min(2).max(1000),
  imageUrl: z.string().min(1).max(500),
  category: z.nativeEnum(RewardCategory),
  pointCost: z.number().int().min(1).max(1_000_000),
  stockTotal: z.number().int().min(0).max(1_000_000),
  perUserLimit: z.number().int().min(1).max(100).default(1),
  dailyLimit: z.number().int().min(1).max(10_000).nullable().optional(),
  collectionMethod: z.nativeEnum(CollectionMethod),
  collectionLocation: z.string().max(200).nullable().optional(),
  claimValidHours: z.number().int().min(1).max(8760).default(168),
  termsAndConditions: z.string().max(2000).nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const adjustStockSchema = z.object({
  rewardId: z.string().cuid(),
  delta: z.number().int().refine((n) => n !== 0, 'Delta cannot be zero'),
  reason: z.string().min(3).max(280),
});

export const cancelClaimSchema = z.object({
  claimId: z.string().cuid(),
  reason: z.string().min(3).max(280),
});

export const missionInputSchema = z.object({
  code: z.string().min(2).max(60),
  title: z.string().min(2).max(80),
  description: z.string().min(2).max(500),
  type: z.nativeEnum(MissionType),
  frequency: z.nativeEnum(MissionFrequency),
  targetValue: z.number().int().min(1).max(1_000_000),
  rewardType: z.nativeEnum(RewardType),
  rewardAmount: z.number().int().min(0).max(100_000),
  xpReward: z.number().int().min(0).max(100_000).default(0),
  gameSlug: z.nativeEnum(GameSlug).nullable().optional(),
  claimRequired: z.boolean().default(true),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

export const gameConfigSchema = z.object({
  gameId: z.string().cuid(),
  energyCost: z.number().int().min(0).max(10),
  dailyAttemptLimit: z.number().int().min(1).max(100),
  coinsPerScorePoint: z.number().min(0).max(10),
  scorePerRewardPoint: z.number().int().min(1).max(100_000),
  dailyCoinCap: z.number().int().min(0).max(100_000),
  dailyRewardPointCap: z.number().int().min(0).max(10_000),
  xpPerScorePoint: z.number().min(0).max(10),
  minDurationSeconds: z.number().int().min(0).max(3600),
  maxValidScore: z.number().int().min(1).max(1_000_000),
  maxScorePerSecond: z.number().int().min(1).max(10_000),
  isLeaderboardEnabled: z.boolean(),
  isActive: z.boolean(),
});

export const itemInputSchema = z.object({
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(60),
  description: z.string().min(2).max(500),
  category: z.nativeEnum(ItemCategory),
  rarity: z.nativeEnum(ItemRarity),
  imageUrl: z.string().min(1).max(500),
  coinPrice: z.number().int().min(0).max(1_000_000).nullable().optional(),
  gemPrice: z.number().int().min(0).max(100_000).nullable().optional(),
  isStackable: z.boolean().default(true),
  maxStack: z.number().int().min(1).max(999).default(99),
  isActive: z.boolean().default(true),
  hungerRestore: z.number().int().min(0).max(100).default(0),
  happinessRestore: z.number().int().min(0).max(100).default(0),
  energyRestore: z.number().int().min(0).max(100).default(0),
  cleanlinessRestore: z.number().int().min(0).max(100).default(0),
  healthRestore: z.number().int().min(0).max(100).default(0),
  friendshipBonus: z.number().int().min(0).max(100).default(0),
  gameEnergyRestore: z.number().int().min(0).max(10).default(0),
});

export const promoCodeInputSchema = z.object({
  code: z.string().min(3).max(24).regex(/^[A-Z0-9-]+$/, 'Uppercase letters, numbers and dashes'),
  rewardType: z.nativeEnum(RewardType),
  rewardAmount: z.number().int().min(1).max(100_000),
  maxUses: z.number().int().min(1).max(1_000_000).nullable().optional(),
  perUserLimit: z.number().int().min(1).max(10).default(1),
  minPlayerLevel: z.number().int().min(1).max(100).default(1),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const announcementSchema = z.object({
  title: z.string().min(2).max(100),
  body: z.string().min(2).max(1000),
  linkUrl: z.string().url().nullable().optional().or(z.literal('')),
  targetRole: z.nativeEnum(Role).nullable().optional(),
});

export const resolveFraudSchema = z.object({
  alertId: z.string().cuid(),
  outcome: z.enum(['RESOLVED_LEGITIMATE', 'RESOLVED_ABUSE']),
  resolution: z.string().min(3).max(500),
});

export const fraudQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(FraudAlertStatus).optional(),
});

export const claimQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(ClaimStatus).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;
export type RewardInput = z.infer<typeof rewardInputSchema>;
export type MissionInput = z.infer<typeof missionInputSchema>;
export type GameConfigInput = z.infer<typeof gameConfigSchema>;
