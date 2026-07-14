-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLAYER', 'STAFF', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "PermissionKey" AS ENUM ('ADJUST_BALANCE', 'MANAGE_USERS', 'MANAGE_REWARDS', 'MANAGE_MISSIONS', 'MANAGE_GAMES', 'MANAGE_ITEMS', 'APPROVE_CLAIMS', 'SCAN_CLAIMS', 'VIEW_ANALYTICS', 'VIEW_AUDIT_LOG', 'MANAGE_ROLES', 'MANAGE_SETTINGS', 'REVIEW_FRAUD', 'SEND_ANNOUNCEMENTS', 'MANAGE_PROMO_CODES');

-- CreateEnum
CREATE TYPE "CurrencyType" AS ENUM ('COINS', 'REWARD_POINTS', 'GEMS');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('PET_CARE', 'DAILY_CARE_BONUS', 'GAME_REWARD', 'MISSION_REWARD', 'ACHIEVEMENT_REWARD', 'LOGIN_STREAK', 'REFERRAL_REWARD', 'PROMO_CODE', 'EVENT_REWARD', 'LEADERBOARD_PRIZE', 'ITEM_PURCHASE', 'REWARD_REDEMPTION', 'REWARD_REFUND', 'ADMIN_ADJUSTMENT', 'SIGNUP_BONUS', 'GAME_ENERGY_REFILL');

-- CreateEnum
CREATE TYPE "PetStage" AS ENUM ('EGG', 'BABY', 'YOUNG', 'ADULT', 'EVOLVED');

-- CreateEnum
CREATE TYPE "PetHealthState" AS ENUM ('HEALTHY', 'TIRED', 'SICK');

-- CreateEnum
CREATE TYPE "PetCareAction" AS ENUM ('FEED', 'BATHE', 'PLAY', 'SLEEP', 'MEDICINE');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('FOOD', 'MEDICINE', 'CLOTHING', 'DECORATION', 'GAME_TICKET', 'EVOLUTION_ITEM', 'EVENT_ITEM', 'COLLECTIBLE');

-- CreateEnum
CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "AcquisitionSource" AS ENUM ('SHOP_PURCHASE', 'MISSION_REWARD', 'ACHIEVEMENT_REWARD', 'PROMO_CODE', 'ADMIN_GRANT', 'EVENT', 'STARTER_PACK');

-- CreateEnum
CREATE TYPE "GameSlug" AS ENUM ('ENDLESS_RUNNER', 'FEEDING_CATCH');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('DAILY_LOGIN', 'FEED_PET', 'BATHE_PET', 'PLAY_WITH_PET', 'COMPLETE_DAILY_CARE', 'PLAY_MINI_GAME', 'PLAY_GAME_COUNT', 'REACH_SCORE', 'EARN_COINS', 'VISIT_REWARD_SHOP', 'REDEEM_REWARD', 'LOGIN_STREAK', 'USE_ITEM', 'ENTER_PROMO_CODE');

-- CreateEnum
CREATE TYPE "MissionFrequency" AS ENUM ('DAILY', 'WEEKLY', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('COINS', 'REWARD_POINTS', 'GEMS', 'ITEM', 'BADGE', 'TITLE', 'XP');

-- CreateEnum
CREATE TYPE "UserMissionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CLAIMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AchievementCode" AS ENUM ('ADOPT_FIRST_PET', 'FIRST_CARE_ACTION', 'SEVEN_DAY_STREAK', 'FEED_100_TIMES', 'PLAY_100_GAMES', 'REACH_LEVEL_10', 'EARN_10000_COINS', 'FIRST_REDEMPTION', 'TOP_100_LEADERBOARD', 'EVOLVE_PET');

-- CreateEnum
CREATE TYPE "RewardCategory" AS ENUM ('DIGITAL_VOUCHER', 'DISCOUNT_COUPON', 'FOOD_AND_DRINK', 'TOY', 'MERCHANDISE', 'FREE_GAME_ATTEMPT', 'EVENT_TICKET', 'LIMITED_EDITION');

-- CreateEnum
CREATE TYPE "CollectionMethod" AS ENUM ('DIGITAL_CODE', 'PHYSICAL_COLLECTION', 'DELIVERY');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'RESERVED', 'READY', 'COLLECTED', 'DELIVERED', 'CANCELLED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StockMovement" AS ENUM ('RESTOCK', 'RESERVE', 'RELEASE', 'FULFIL', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REWARDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaderboardPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME');

-- CreateEnum
CREATE TYPE "LeaderboardScope" AS ENUM ('GLOBAL_XP', 'GLOBAL_COINS', 'PER_GAME');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MISSION_COMPLETED', 'MISSION_REWARD_AVAILABLE', 'PET_HUNGRY', 'PET_SICK', 'PET_ENERGY_RESTORED', 'CLAIM_READY', 'CLAIM_EXPIRING', 'CLAIM_COLLECTED', 'NEW_EVENT', 'LEADERBOARD_RESULT', 'ACHIEVEMENT_UNLOCKED', 'ADMIN_ANNOUNCEMENT', 'POINT_CAP_REACHED', 'REFERRAL_QUALIFIED', 'LEVEL_UP');

-- CreateEnum
CREATE TYPE "FraudAlertType" AS ENUM ('IMPOSSIBLE_SCORE', 'GAME_TOO_FAST', 'DUPLICATE_SUBMISSION', 'REUSED_SESSION', 'RATE_LIMIT_ABUSE', 'SHARED_IDENTIFIER', 'EXCESSIVE_REFERRALS', 'REPEATED_QR_FAILURE', 'ABNORMAL_POINT_EARNING', 'SELF_REFERRAL_ATTEMPT');

-- CreateEnum
CREATE TYPE "FraudSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FraudAlertStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED_LEGITIMATE', 'RESOLVED_ABUSE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ADMIN_LOGIN', 'USER_SUSPENDED', 'USER_REACTIVATED', 'BALANCE_ADJUSTED', 'REWARD_CREATED', 'REWARD_UPDATED', 'STOCK_ADJUSTED', 'CLAIM_APPROVED', 'CLAIM_CANCELLED', 'CLAIM_COLLECTED', 'ROLE_CHANGED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'SETTING_CHANGED', 'MISSION_CREATED', 'MISSION_UPDATED', 'GAME_CONFIG_UPDATED', 'PROMO_CODE_CREATED', 'ANNOUNCEMENT_SENT', 'FRAUD_ALERT_RESOLVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'EMAIL_VERIFICATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "PermissionKey" NOT NULL,
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permission" "PermissionKey" NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "key" "PermissionKey" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
    "bio" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "gameEnergy" INTEGER NOT NULL DEFAULT 10,
    "gameEnergyUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFreeRefillAt" TIMESTAMP(3),
    "referralCode" TEXT NOT NULL,
    "referredBy" TEXT,
    "notifyMissions" BOOLEAN NOT NULL DEFAULT true,
    "notifyPetCare" BOOLEAN NOT NULL DEFAULT true,
    "notifyRewards" BOOLEAN NOT NULL DEFAULT true,
    "notifyAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "visitedRewardShopAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_species" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isStarter" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hungerDecayPerHour" INTEGER NOT NULL DEFAULT 4,
    "cleanlinessDecayPerHour" INTEGER NOT NULL DEFAULT 3,
    "happinessDecayPerHour" INTEGER NOT NULL DEFAULT 2,
    "energyDecayPerHour" INTEGER NOT NULL DEFAULT 1,
    "energyRegenPerHour" INTEGER NOT NULL DEFAULT 12,
    "healthDecayPerHour" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pet_species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "PetStage" NOT NULL DEFAULT 'BABY',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "hunger" INTEGER NOT NULL DEFAULT 70,
    "happiness" INTEGER NOT NULL DEFAULT 70,
    "energy" INTEGER NOT NULL DEFAULT 80,
    "cleanliness" INTEGER NOT NULL DEFAULT 80,
    "health" INTEGER NOT NULL DEFAULT 100,
    "friendship" INTEGER NOT NULL DEFAULT 10,
    "healthState" "PetHealthState" NOT NULL DEFAULT 'HEALTHY',
    "isSleeping" BOOLEAN NOT NULL DEFAULT false,
    "totalCareActions" INTEGER NOT NULL DEFAULT 0,
    "totalFeeds" INTEGER NOT NULL DEFAULT 0,
    "bornAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFedAt" TIMESTAMP(3),
    "lastBathedAt" TIMESTAMP(3),
    "lastPlayedAt" TIMESTAMP(3),
    "lastSleptAt" TIMESTAMP(3),
    "lastMedicatedAt" TIMESTAMP(3),
    "statsUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDailyCareAt" TIMESTAMP(3),
    "equippedItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_activities" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "PetCareAction" NOT NULL,
    "hungerDelta" INTEGER NOT NULL DEFAULT 0,
    "happinessDelta" INTEGER NOT NULL DEFAULT 0,
    "energyDelta" INTEGER NOT NULL DEFAULT 0,
    "cleanlinessDelta" INTEGER NOT NULL DEFAULT 0,
    "healthDelta" INTEGER NOT NULL DEFAULT 0,
    "friendshipDelta" INTEGER NOT NULL DEFAULT 0,
    "coinsAwarded" INTEGER NOT NULL DEFAULT 0,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_evolutions" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "fromStage" "PetStage" NOT NULL,
    "toStage" "PetStage" NOT NULL,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "minAgeHours" INTEGER NOT NULL DEFAULT 0,
    "minFriendship" INTEGER NOT NULL DEFAULT 0,
    "minCareActions" INTEGER NOT NULL DEFAULT 0,
    "requiredItemId" TEXT,
    "requiredAchievement" "AchievementCode",
    "branchKey" TEXT NOT NULL DEFAULT 'default',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pet_evolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "rarity" "ItemRarity" NOT NULL DEFAULT 'COMMON',
    "imageUrl" TEXT NOT NULL,
    "coinPrice" INTEGER,
    "gemPrice" INTEGER,
    "isStackable" BOOLEAN NOT NULL DEFAULT true,
    "maxStack" INTEGER NOT NULL DEFAULT 99,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hungerRestore" INTEGER NOT NULL DEFAULT 0,
    "happinessRestore" INTEGER NOT NULL DEFAULT 0,
    "energyRestore" INTEGER NOT NULL DEFAULT 0,
    "cleanlinessRestore" INTEGER NOT NULL DEFAULT 0,
    "healthRestore" INTEGER NOT NULL DEFAULT 0,
    "friendshipBonus" INTEGER NOT NULL DEFAULT 0,
    "gameEnergyRestore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_inventory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isEquipped" BOOLEAN NOT NULL DEFAULT false,
    "source" "AcquisitionSource" NOT NULL DEFAULT 'SHOP_PURCHASE',
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_balances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" "CurrencyType" NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" "CurrencyType" NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currency_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "slug" "GameSlug" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_configurations" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "energyCost" INTEGER NOT NULL DEFAULT 1,
    "dailyAttemptLimit" INTEGER NOT NULL DEFAULT 10,
    "coinsPerScorePoint" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "scorePerRewardPoint" INTEGER NOT NULL DEFAULT 500,
    "dailyCoinCap" INTEGER NOT NULL DEFAULT 500,
    "dailyRewardPointCap" INTEGER NOT NULL DEFAULT 50,
    "xpPerScorePoint" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "minDurationSeconds" INTEGER NOT NULL DEFAULT 10,
    "maxValidScore" INTEGER NOT NULL DEFAULT 10000,
    "maxScorePerSecond" INTEGER NOT NULL DEFAULT 120,
    "isLeaderboardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reportedScore" INTEGER,
    "validatedScore" INTEGER,
    "durationSeconds" INTEGER,
    "coinsAwarded" INTEGER NOT NULL DEFAULT 0,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "rejectionReason" TEXT,
    "clientEvents" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_scores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "coinsEarned" INTEGER NOT NULL DEFAULT 0,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "MissionType" NOT NULL,
    "frequency" "MissionFrequency" NOT NULL DEFAULT 'DAILY',
    "targetValue" INTEGER NOT NULL DEFAULT 1,
    "rewardType" "RewardType" NOT NULL DEFAULT 'COINS',
    "rewardAmount" INTEGER NOT NULL DEFAULT 10,
    "rewardItemId" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 5,
    "gameSlug" "GameSlug",
    "itemSlug" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "claimRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_missions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "status" "UserMissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "code" "AchievementCode" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL DEFAULT 1,
    "rewardType" "RewardType" NOT NULL DEFAULT 'COINS',
    "rewardAmount" INTEGER NOT NULL DEFAULT 0,
    "rewardItemId" TEXT,
    "badgeLabel" TEXT,
    "titleLabel" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL DEFAULT 1,
    "unlockedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_streaks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "totalLogins" INTEGER NOT NULL DEFAULT 0,
    "lastClaimDay" TEXT,
    "lastClaimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "category" "RewardCategory" NOT NULL,
    "pointCost" INTEGER NOT NULL,
    "stockTotal" INTEGER NOT NULL DEFAULT 0,
    "stockAvailable" INTEGER NOT NULL DEFAULT 0,
    "stockReserved" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "dailyLimit" INTEGER,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "collectionMethod" "CollectionMethod" NOT NULL DEFAULT 'PHYSICAL_COLLECTION',
    "collectionLocation" TEXT,
    "claimValidHours" INTEGER NOT NULL DEFAULT 168,
    "termsAndConditions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_stock_transactions" (
    "id" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "movement" "StockMovement" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockBefore" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "referenceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_claims" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "pointCost" INTEGER NOT NULL,
    "claimCode" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'RESERVED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "collectionLocation" TEXT,
    "fulfilmentDetails" TEXT,
    "fulfilmentNotes" TEXT,
    "collectedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rewardType" "RewardType" NOT NULL DEFAULT 'COINS',
    "rewardAmount" INTEGER NOT NULL,
    "rewardItemId" TEXT,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "minPlayerLevel" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_code_redemptions" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardAmount" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_code_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "referrerReward" INTEGER NOT NULL DEFAULT 0,
    "referredReward" INTEGER NOT NULL DEFAULT 0,
    "qualifiedAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "signupIp" TEXT,
    "deviceHash" TEXT,
    "riskFlagged" BOOLEAN NOT NULL DEFAULT false,
    "riskReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period" "LeaderboardPeriod" NOT NULL,
    "scope" "LeaderboardScope" NOT NULL,
    "gameId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFinalised" BOOLEAN NOT NULL DEFAULT false,
    "finalisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_entries" (
    "id" TEXT NOT NULL,
    "leaderboardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "rewardClaimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_prizes" (
    "id" TEXT NOT NULL,
    "leaderboardId" TEXT NOT NULL,
    "rankFrom" INTEGER NOT NULL,
    "rankTo" INTEGER NOT NULL,
    "rewardType" "RewardType" NOT NULL DEFAULT 'REWARD_POINTS',
    "rewardAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_prizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "iconKey" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "targetRole" "Role",
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "bannerUrl" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "coinMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "pointMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "xpMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FraudAlertType" NOT NULL,
    "severity" "FraudSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "FraudAlertStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "evidence" JSONB,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE INDEX "verification_tokens_identifier_purpose_idx" ON "verification_tokens"("identifier", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "user_permissions_permission_idx" ON "user_permissions"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_permission_key" ON "user_permissions"("userId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permission_key" ON "role_permissions"("role", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_referralCode_key" ON "profiles"("referralCode");

-- CreateIndex
CREATE INDEX "profiles_level_idx" ON "profiles"("level");

-- CreateIndex
CREATE INDEX "profiles_referralCode_idx" ON "profiles"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "pet_species_slug_key" ON "pet_species"("slug");

-- CreateIndex
CREATE INDEX "pets_userId_idx" ON "pets"("userId");

-- CreateIndex
CREATE INDEX "pets_speciesId_idx" ON "pets"("speciesId");

-- CreateIndex
CREATE INDEX "pet_activities_petId_createdAt_idx" ON "pet_activities"("petId", "createdAt");

-- CreateIndex
CREATE INDEX "pet_activities_userId_action_createdAt_idx" ON "pet_activities"("userId", "action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pet_evolutions_speciesId_fromStage_branchKey_key" ON "pet_evolutions"("speciesId", "fromStage", "branchKey");

-- CreateIndex
CREATE UNIQUE INDEX "items_slug_key" ON "items"("slug");

-- CreateIndex
CREATE INDEX "items_category_isActive_idx" ON "items"("category", "isActive");

-- CreateIndex
CREATE INDEX "user_inventory_userId_idx" ON "user_inventory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_inventory_userId_itemId_key" ON "user_inventory"("userId", "itemId");

-- CreateIndex
CREATE INDEX "currency_balances_currency_balance_idx" ON "currency_balances"("currency", "balance");

-- CreateIndex
CREATE UNIQUE INDEX "currency_balances_userId_currency_key" ON "currency_balances"("userId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "currency_transactions_idempotencyKey_key" ON "currency_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "currency_transactions_userId_currency_createdAt_idx" ON "currency_transactions"("userId", "currency", "createdAt");

-- CreateIndex
CREATE INDEX "currency_transactions_category_createdAt_idx" ON "currency_transactions"("category", "createdAt");

-- CreateIndex
CREATE INDEX "currency_transactions_createdAt_idx" ON "currency_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "currency_transactions_referenceType_referenceId_idx" ON "currency_transactions"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "games_slug_key" ON "games"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "game_configurations_gameId_key" ON "game_configurations"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_nonce_key" ON "game_sessions"("nonce");

-- CreateIndex
CREATE INDEX "game_sessions_userId_gameId_createdAt_idx" ON "game_sessions"("userId", "gameId", "createdAt");

-- CreateIndex
CREATE INDEX "game_sessions_status_idx" ON "game_sessions"("status");

-- CreateIndex
CREATE INDEX "game_sessions_createdAt_idx" ON "game_sessions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "game_scores_sessionId_key" ON "game_scores"("sessionId");

-- CreateIndex
CREATE INDEX "game_scores_gameId_score_idx" ON "game_scores"("gameId", "score");

-- CreateIndex
CREATE INDEX "game_scores_userId_gameId_score_idx" ON "game_scores"("userId", "gameId", "score");

-- CreateIndex
CREATE INDEX "game_scores_createdAt_idx" ON "game_scores"("createdAt");

-- CreateIndex
CREATE INDEX "game_attempts_day_idx" ON "game_attempts"("day");

-- CreateIndex
CREATE UNIQUE INDEX "game_attempts_userId_gameId_day_key" ON "game_attempts"("userId", "gameId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "missions_code_key" ON "missions"("code");

-- CreateIndex
CREATE INDEX "missions_type_isActive_idx" ON "missions"("type", "isActive");

-- CreateIndex
CREATE INDEX "missions_frequency_isActive_idx" ON "missions"("frequency", "isActive");

-- CreateIndex
CREATE INDEX "user_missions_userId_status_idx" ON "user_missions"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_missions_userId_missionId_periodKey_key" ON "user_missions"("userId", "missionId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_code_key" ON "achievements"("code");

-- CreateIndex
CREATE INDEX "user_achievements_userId_unlockedAt_idx" ON "user_achievements"("userId", "unlockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_userId_achievementId_key" ON "user_achievements"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "login_streaks_userId_key" ON "login_streaks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_slug_key" ON "rewards"("slug");

-- CreateIndex
CREATE INDEX "rewards_category_isActive_idx" ON "rewards"("category", "isActive");

-- CreateIndex
CREATE INDEX "rewards_isActive_pointCost_idx" ON "rewards"("isActive", "pointCost");

-- CreateIndex
CREATE INDEX "reward_stock_transactions_rewardId_createdAt_idx" ON "reward_stock_transactions"("rewardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reward_claims_claimCode_key" ON "reward_claims"("claimCode");

-- CreateIndex
CREATE UNIQUE INDEX "reward_claims_qrToken_key" ON "reward_claims"("qrToken");

-- CreateIndex
CREATE INDEX "reward_claims_userId_status_idx" ON "reward_claims"("userId", "status");

-- CreateIndex
CREATE INDEX "reward_claims_status_expiresAt_idx" ON "reward_claims"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "reward_claims_rewardId_createdAt_idx" ON "reward_claims"("rewardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "promo_codes_isActive_idx" ON "promo_codes"("isActive");

-- CreateIndex
CREATE INDEX "promo_code_redemptions_userId_idx" ON "promo_code_redemptions"("userId");

-- CreateIndex
CREATE INDEX "promo_code_redemptions_promoCodeId_userId_idx" ON "promo_code_redemptions"("promoCodeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referredId_key" ON "referrals"("referredId");

-- CreateIndex
CREATE INDEX "referrals_referrerId_status_idx" ON "referrals"("referrerId", "status");

-- CreateIndex
CREATE INDEX "referrals_status_idx" ON "referrals"("status");

-- CreateIndex
CREATE INDEX "leaderboards_isActive_endsAt_idx" ON "leaderboards"("isActive", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboards_period_scope_gameId_startsAt_key" ON "leaderboards"("period", "scope", "gameId", "startsAt");

-- CreateIndex
CREATE INDEX "leaderboard_entries_leaderboardId_score_idx" ON "leaderboard_entries"("leaderboardId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_entries_leaderboardId_userId_key" ON "leaderboard_entries"("leaderboardId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_prizes_leaderboardId_rankFrom_rankTo_key" ON "leaderboard_prizes"("leaderboardId", "rankFrom", "rankTo");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "announcements_isPublished_publishedAt_idx" ON "announcements"("isPublished", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_isActive_startsAt_endsAt_idx" ON "events"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "fraud_alerts_status_severity_createdAt_idx" ON "fraud_alerts"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "fraud_alerts_userId_createdAt_idx" ON "fraud_alerts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "pet_species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_activities" ADD CONSTRAINT "pet_activities_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_activities" ADD CONSTRAINT "pet_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_evolutions" ADD CONSTRAINT "pet_evolutions_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "pet_species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_evolutions" ADD CONSTRAINT "pet_evolutions_requiredItemId_fkey" FOREIGN KEY ("requiredItemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_balances" ADD CONSTRAINT "currency_balances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_transactions" ADD CONSTRAINT "currency_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_transactions" ADD CONSTRAINT "currency_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_configurations" ADD CONSTRAINT "game_configurations_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_streaks" ADD CONSTRAINT "login_streaks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_stock_transactions" ADD CONSTRAINT "reward_stock_transactions_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_stock_transactions" ADD CONSTRAINT "reward_stock_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_redemptions" ADD CONSTRAINT "promo_code_redemptions_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_redemptions" ADD CONSTRAINT "promo_code_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboards" ADD CONSTRAINT "leaderboards_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_leaderboardId_fkey" FOREIGN KEY ("leaderboardId") REFERENCES "leaderboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_prizes" ADD CONSTRAINT "leaderboard_prizes_leaderboardId_fkey" FOREIGN KEY ("leaderboardId") REFERENCES "leaderboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_alerts" ADD CONSTRAINT "fraud_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_alerts" ADD CONSTRAINT "fraud_alerts_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
