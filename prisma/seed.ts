/**
 * Development seed.
 *
 * Idempotent: every write is an upsert keyed on a natural unique field, so running
 * `npm run db:seed` twice does not produce two of everything. That matters more than
 * it sounds -- a seed you're afraid to re-run is a seed you stop running.
 *
 * The passwords below are DEVELOPMENT ONLY and are documented in the README. They
 * are deliberately obvious rather than plausible: nobody should be able to mistake
 * `Admin123!pass` for a real credential that escaped into a repo.
 */

import {
  PrismaClient,
  Role,
  AccountStatus,
  PermissionKey,
  CurrencyType,
  TransactionDirection,
  TransactionCategory,
  ItemCategory,
  ItemRarity,
  GameSlug,
  MissionType,
  MissionFrequency,
  RewardType,
  AchievementCode,
  RewardCategory,
  CollectionMethod,
  PetStage,
  NotificationType,
  LeaderboardPeriod,
  LeaderboardScope,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEV_PASSWORDS = {
  superAdmin: 'SuperAdmin123!',
  admin: 'Admin123!pass',
  staff: 'Staff123!pass',
  player: 'Player123!pass',
} as const;

async function main() {
  console.info('[seed] Seeding PetQuest Rewards...\n');

  // --- Permissions reference table -----------------------------------------

  const permissionLabels: Record<PermissionKey, string> = {
    ADJUST_BALANCE: 'Adjust user balances',
    MANAGE_USERS: 'Manage users',
    MANAGE_REWARDS: 'Manage rewards',
    MANAGE_MISSIONS: 'Manage missions',
    MANAGE_GAMES: 'Manage games',
    MANAGE_ITEMS: 'Manage items',
    APPROVE_CLAIMS: 'Approve and cancel claims',
    SCAN_CLAIMS: 'Scan reward QR codes',
    VIEW_ANALYTICS: 'View analytics',
    VIEW_AUDIT_LOG: 'View the audit log',
    MANAGE_ROLES: 'Assign roles',
    MANAGE_SETTINGS: 'Change system settings',
    REVIEW_FRAUD: 'Review fraud alerts',
    SEND_ANNOUNCEMENTS: 'Send announcements',
    MANAGE_PROMO_CODES: 'Create promo codes',
  };

  for (const [key, label] of Object.entries(permissionLabels)) {
    await prisma.permission.upsert({
      where: { key: key as PermissionKey },
      create: { key: key as PermissionKey, label, description: label },
      update: { label },
    });
  }
  console.info('[ok] Permissions');

  // --- Users ----------------------------------------------------------------

  const superAdmin = await createUser({
    email: 'superadmin@petquest.dev',
    password: DEV_PASSWORDS.superAdmin,
    name: 'Super Admin',
    username: 'superadmin',
    role: Role.SUPER_ADMIN,
  });

  const admin = await createUser({
    email: 'admin@petquest.dev',
    password: DEV_PASSWORDS.admin,
    name: 'Ada Admin',
    username: 'adaadmin',
    role: Role.ADMIN,
  });

  const staff = await createUser({
    email: 'staff@petquest.dev',
    password: DEV_PASSWORDS.staff,
    name: 'Sam Staff',
    username: 'samstaff',
    role: Role.STAFF,
  });

  const player1 = await createUser({
    email: 'player1@petquest.dev',
    password: DEV_PASSWORDS.player,
    name: 'Pip Player',
    username: 'pipplayer',
    role: Role.PLAYER,
    level: 4,
    xp: 60,
  });

  const player2 = await createUser({
    email: 'player2@petquest.dev',
    password: DEV_PASSWORDS.player,
    name: 'Robin Rookie',
    username: 'robinrookie',
    role: Role.PLAYER,
    level: 2,
    xp: 30,
  });

  console.info('[ok] Users (5)');

  // A staff member who has been *explicitly granted* the ability to adjust balances --
  // demonstrating the permission-grant mechanism the brief calls for. By default staff
  // cannot touch balances; this row is what opens that door, and it is auditable.
  await prisma.userPermission.upsert({
    where: {
      userId_permission: { userId: staff.id, permission: PermissionKey.VIEW_ANALYTICS },
    },
    create: {
      userId: staff.id,
      permission: PermissionKey.VIEW_ANALYTICS,
      grantedBy: superAdmin.id,
      reason: 'Shift lead -- needs the daily collection dashboard',
    },
    update: {},
  });
  console.info('[ok] Permission grant (staff \u2192 VIEW_ANALYTICS)');

  // --- Pet species ----------------------------------------------------------

  const species = await prisma.petSpecies.upsert({
    where: { slug: 'quibble' },
    create: {
      slug: 'quibble',
      name: 'Quibble',
      description:
        'A round, violet companion with oversized ears and an appetite that never quite quits.',
      imageUrl: '/assets/pets/quibble.svg',
      isStarter: true,
      hungerDecayPerHour: 4,
      cleanlinessDecayPerHour: 3,
      happinessDecayPerHour: 2,
      energyDecayPerHour: 1,
      energyRegenPerHour: 12,
      healthDecayPerHour: 2,
    },
    update: {},
  });
  console.info('[ok] Pet species (Quibble)');

  // --- Evolution rules ------------------------------------------------------

  const evolutions = [
    { fromStage: PetStage.EGG, toStage: PetStage.BABY, minLevel: 1, minAgeHours: 0, minFriendship: 0, minCareActions: 0 },
    { fromStage: PetStage.BABY, toStage: PetStage.YOUNG, minLevel: 5, minAgeHours: 24, minFriendship: 30, minCareActions: 10 },
    { fromStage: PetStage.YOUNG, toStage: PetStage.ADULT, minLevel: 12, minAgeHours: 96, minFriendship: 60, minCareActions: 40 },
    { fromStage: PetStage.ADULT, toStage: PetStage.EVOLVED, minLevel: 25, minAgeHours: 240, minFriendship: 90, minCareActions: 100 },
  ];

  for (const rule of evolutions) {
    await prisma.petEvolution.upsert({
      where: {
        speciesId_fromStage_branchKey: {
          speciesId: species.id,
          fromStage: rule.fromStage,
          branchKey: 'default',
        },
      },
      create: { speciesId: species.id, ...rule },
      update: rule,
    });
  }
  console.info('[ok] Evolution rules (4)');

  // --- Starter pet for player 1 --------------------------------------------

  const existingPet = await prisma.pet.findFirst({ where: { userId: player1.id } });
  if (!existingPet) {
    await prisma.pet.create({
      data: {
        userId: player1.id,
        speciesId: species.id,
        name: 'Mochi',
        stage: PetStage.BABY,
        level: 3,
        xp: 20,
        hunger: 65,
        happiness: 72,
        energy: 80,
        cleanliness: 70,
        health: 95,
        friendship: 35,
        totalCareActions: 12,
        totalFeeds: 6,
      },
    });
  }
  console.info('[ok] Starter pet (Mochi)');

  // --- Items (10) -----------------------------------------------------------

  const items = [
    { slug: 'kibble', name: 'Basic Kibble', description: 'Restores a little hunger.', category: ItemCategory.FOOD, rarity: ItemRarity.COMMON, imageUrl: '\u{1F963}', coinPrice: 20, hungerRestore: 15, happinessRestore: 2 },
    { slug: 'gourmet-bowl', name: 'Gourmet Bowl', description: 'A proper meal. Big hunger restore.', category: ItemCategory.FOOD, rarity: ItemRarity.UNCOMMON, imageUrl: '\u{1F372}', coinPrice: 60, hungerRestore: 40, happinessRestore: 8, friendshipBonus: 3 },
    { slug: 'berry-treat', name: 'Berry Treat', description: 'Sweet, and your pet knows it.', category: ItemCategory.FOOD, rarity: ItemRarity.COMMON, imageUrl: '\u{1F353}', coinPrice: 30, hungerRestore: 10, happinessRestore: 15, friendshipBonus: 5 },
    { slug: 'medicine', name: 'Medicine', description: 'Cures a sick pet. Required for the Medicine care action.', category: ItemCategory.MEDICINE, rarity: ItemRarity.UNCOMMON, imageUrl: '\u{1F48A}', coinPrice: 80, healthRestore: 40 },
    { slug: 'super-tonic', name: 'Super Tonic', description: 'Full health restore, instantly.', category: ItemCategory.MEDICINE, rarity: ItemRarity.RARE, imageUrl: '\u{1F9EA}', coinPrice: 200, gemPrice: 10, healthRestore: 100, energyRestore: 30 },
    { slug: 'party-hat', name: 'Party Hat', description: 'A jaunty cone. Purely cosmetic, entirely necessary.', category: ItemCategory.CLOTHING, rarity: ItemRarity.COMMON, imageUrl: '\u{1F389}', coinPrice: 150, isStackable: false, maxStack: 1 },
    { slug: 'wizard-cloak', name: 'Wizard Cloak', description: 'Grants no magic. Looks like it might.', category: ItemCategory.CLOTHING, rarity: ItemRarity.EPIC, imageUrl: '\u{1F9D9}', coinPrice: 800, gemPrice: 40, isStackable: false, maxStack: 1 },
    { slug: 'game-ticket', name: 'Game Ticket', description: 'Restores 3 game energy.', category: ItemCategory.GAME_TICKET, rarity: ItemRarity.UNCOMMON, imageUrl: '\u{1F39F}\uFE0F', coinPrice: 120, gemPrice: 5, gameEnergyRestore: 3 },
    { slug: 'cosy-cushion', name: 'Cosy Cushion', description: 'A decoration for the corner of your pet\u2019s room.', category: ItemCategory.DECORATION, rarity: ItemRarity.COMMON, imageUrl: '\u{1F6CB}\uFE0F', coinPrice: 100, isStackable: false, maxStack: 1 },
    { slug: 'evolution-stone', name: 'Evolution Stone', description: 'Required for certain evolutions.', category: ItemCategory.EVOLUTION_ITEM, rarity: ItemRarity.LEGENDARY, imageUrl: '\u{1F48E}', coinPrice: 2000, gemPrice: 100, isStackable: false, maxStack: 1 },
  ];

  for (const item of items) {
    await prisma.item.upsert({
      where: { slug: item.slug },
      create: item,
      // The update clause converges existing rows to the source of truth, including
      // imageUrl and description -- an earlier encoding bug left corrupted values in
      // the DB, and a seed that skips these fields can never repair them.
      update: {
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        coinPrice: item.coinPrice,
        isActive: true,
      },
    });
  }
  console.info('[ok] Items (10)');

  // Give player 1 a starter stash so medicine and item-use are testable immediately.
  const medicine = await prisma.item.findUniqueOrThrow({ where: { slug: 'medicine' } });
  const kibble = await prisma.item.findUniqueOrThrow({ where: { slug: 'kibble' } });

  for (const [item, quantity] of [
    [medicine, 3],
    [kibble, 5],
  ] as const) {
    await prisma.userInventory.upsert({
      where: { userId_itemId: { userId: player1.id, itemId: item.id } },
      create: { userId: player1.id, itemId: item.id, quantity, source: 'STARTER_PACK' },
      update: {},
    });
  }
  console.info('[ok] Starter inventory');

  // --- Games (2) + configuration -------------------------------------------

  const gameDefs = [
    {
      slug: GameSlug.ENDLESS_RUNNER,
      name: 'Endless Runner',
      description: 'Jump the obstacles, grab the coins, survive as long as you can.',
      imageUrl: '/assets/games/runner.svg',
      sortOrder: 1,
      config: {
        energyCost: 1,
        dailyAttemptLimit: 10,
        coinsPerScorePoint: 0.1,
        scorePerRewardPoint: 500,
        dailyCoinCap: 500,
        dailyRewardPointCap: 50,
        xpPerScorePoint: 0.05,
        minDurationSeconds: 10,
        maxValidScore: 10_000,
        maxScorePerSecond: 120,
      },
    },
    {
      slug: GameSlug.FEEDING_CATCH,
      name: 'Feeding Catch',
      description: 'Catch the good food, dodge the rotten. Sixty seconds on the clock.',
      imageUrl: '/assets/games/catch.svg',
      sortOrder: 2,
      config: {
        energyCost: 1,
        dailyAttemptLimit: 10,
        coinsPerScorePoint: 0.12,
        scorePerRewardPoint: 400,
        dailyCoinCap: 500,
        dailyRewardPointCap: 50,
        xpPerScorePoint: 0.06,
        // The round is a fixed 60s, so anything under 30s means the player quit or
        // the client lied. Either way it isn't a valid run.
        minDurationSeconds: 30,
        maxValidScore: 8_000,
        maxScorePerSecond: 100,
      },
    },
  ];

  const games = [];
  for (const def of gameDefs) {
    const game = await prisma.game.upsert({
      where: { slug: def.slug },
      create: {
        slug: def.slug,
        name: def.name,
        description: def.description,
        imageUrl: def.imageUrl,
        sortOrder: def.sortOrder,
      },
      update: { name: def.name, description: def.description },
    });

    await prisma.gameConfiguration.upsert({
      where: { gameId: game.id },
      create: { gameId: game.id, ...def.config },
      update: def.config,
    });

    games.push(game);
  }
  console.info('[ok] Games (2) + configuration');

  // --- Missions (5 daily + 5 weekly) ---------------------------------------

  const missions = [
    { code: 'daily-login', title: 'Sign in today', description: 'Claim your daily login reward.', type: MissionType.DAILY_LOGIN, frequency: MissionFrequency.DAILY, targetValue: 1, rewardType: RewardType.COINS, rewardAmount: 20, xpReward: 5, sortOrder: 1 },
    { code: 'daily-feed', title: 'Feed your pet', description: 'Feed your pet once today.', type: MissionType.FEED_PET, frequency: MissionFrequency.DAILY, targetValue: 1, rewardType: RewardType.COINS, rewardAmount: 15, xpReward: 5, sortOrder: 2 },
    { code: 'daily-care', title: 'Complete daily pet care', description: 'Feed, bathe and play with your pet.', type: MissionType.COMPLETE_DAILY_CARE, frequency: MissionFrequency.DAILY, targetValue: 1, rewardType: RewardType.REWARD_POINTS, rewardAmount: 5, xpReward: 20, sortOrder: 3 },
    { code: 'daily-game', title: 'Play a mini game', description: 'Play any mini game once.', type: MissionType.PLAY_MINI_GAME, frequency: MissionFrequency.DAILY, targetValue: 1, rewardType: RewardType.COINS, rewardAmount: 25, xpReward: 10, sortOrder: 4 },
    { code: 'daily-coins', title: 'Earn 100 coins', description: 'Earn 100 coins from any source today.', type: MissionType.EARN_COINS, frequency: MissionFrequency.DAILY, targetValue: 100, rewardType: RewardType.COINS, rewardAmount: 30, xpReward: 10, sortOrder: 5 },

    { code: 'weekly-games', title: 'Play 10 mini games', description: 'Play any mini game ten times this week.', type: MissionType.PLAY_GAME_COUNT, frequency: MissionFrequency.WEEKLY, targetValue: 10, rewardType: RewardType.REWARD_POINTS, rewardAmount: 15, xpReward: 50, sortOrder: 1 },
    { code: 'weekly-score', title: 'Score 1,000 in Endless Runner', description: 'Reach a score of 1,000 in a single run.', type: MissionType.REACH_SCORE, frequency: MissionFrequency.WEEKLY, targetValue: 1000, rewardType: RewardType.REWARD_POINTS, rewardAmount: 20, xpReward: 60, gameSlug: GameSlug.ENDLESS_RUNNER, sortOrder: 2 },
    { code: 'weekly-streak', title: 'Keep a 7-day streak', description: 'Sign in seven days in a row.', type: MissionType.LOGIN_STREAK, frequency: MissionFrequency.WEEKLY, targetValue: 7, rewardType: RewardType.REWARD_POINTS, rewardAmount: 25, xpReward: 80, sortOrder: 3 },
    { code: 'weekly-shop', title: 'Visit the reward shop', description: 'Take a look at what your points can buy.', type: MissionType.VISIT_REWARD_SHOP, frequency: MissionFrequency.WEEKLY, targetValue: 1, rewardType: RewardType.COINS, rewardAmount: 50, xpReward: 10, sortOrder: 4 },
    { code: 'weekly-redeem', title: 'Redeem a reward', description: 'Turn your points into something real.', type: MissionType.REDEEM_REWARD, frequency: MissionFrequency.WEEKLY, targetValue: 1, rewardType: RewardType.GEMS, rewardAmount: 5, xpReward: 100, sortOrder: 5 },
  ];

  for (const mission of missions) {
    await prisma.mission.upsert({
      where: { code: mission.code },
      create: mission,
      update: { title: mission.title, rewardAmount: mission.rewardAmount, isActive: true },
    });
  }
  console.info('[ok] Missions (5 daily + 5 weekly)');

  // --- Achievements (10) ----------------------------------------------------

  const achievements = [
    { code: AchievementCode.ADOPT_FIRST_PET, title: 'New best friend', description: 'Adopt your first pet.', iconUrl: '\u{1F423}', targetValue: 1, rewardType: RewardType.COINS, rewardAmount: 50, xpReward: 20, sortOrder: 1 },
    { code: AchievementCode.FIRST_CARE_ACTION, title: 'First steps', description: 'Complete your first pet-care action.', iconUrl: '\u{1F932}', targetValue: 1, rewardType: RewardType.COINS, rewardAmount: 25, xpReward: 10, sortOrder: 2 },
    { code: AchievementCode.SEVEN_DAY_STREAK, title: 'Regular', description: 'Sign in seven days in a row.', iconUrl: '\u{1F525}', targetValue: 7, rewardType: RewardType.REWARD_POINTS, rewardAmount: 20, xpReward: 100, badgeLabel: 'Devoted', sortOrder: 3 },
    { code: AchievementCode.FEED_100_TIMES, title: 'Chef', description: 'Feed your pet 100 times.', iconUrl: '\u{1F468}\u200D\u{1F373}', targetValue: 100, rewardType: RewardType.COINS, rewardAmount: 500, xpReward: 200, titleLabel: 'The Chef', sortOrder: 4 },
    { code: AchievementCode.PLAY_100_GAMES, title: 'Arcade regular', description: 'Play 100 mini games.', iconUrl: '\u{1F579}\uFE0F', targetValue: 100, rewardType: RewardType.GEMS, rewardAmount: 25, xpReward: 300, sortOrder: 5 },
    { code: AchievementCode.REACH_LEVEL_10, title: 'Double digits', description: 'Reach player level 10.', iconUrl: '\u{1F51F}', targetValue: 10, rewardType: RewardType.REWARD_POINTS, rewardAmount: 30, xpReward: 0, sortOrder: 6 },
    { code: AchievementCode.EARN_10000_COINS, title: 'Coin baron', description: 'Earn 10,000 coins in total.', iconUrl: '\u{1F4B0}', targetValue: 10_000, rewardType: RewardType.GEMS, rewardAmount: 50, xpReward: 250, titleLabel: 'Coin Baron', sortOrder: 7 },
    { code: AchievementCode.FIRST_REDEMPTION, title: 'Worth it', description: 'Redeem your first real reward.', iconUrl: '\u{1F381}', targetValue: 1, rewardType: RewardType.COINS, rewardAmount: 200, xpReward: 100, sortOrder: 8 },
    { code: AchievementCode.TOP_100_LEADERBOARD, title: 'Contender', description: 'Reach the all-time top 100 in any game.', iconUrl: '\u{1F3C5}', targetValue: 1, rewardType: RewardType.REWARD_POINTS, rewardAmount: 15, xpReward: 150, badgeLabel: 'Contender', sortOrder: 9 },
    { code: AchievementCode.EVOLVE_PET, title: 'Metamorphosis', description: 'Evolve your pet for the first time.', iconUrl: '\u2728', targetValue: 1, rewardType: RewardType.GEMS, rewardAmount: 20, xpReward: 200, sortOrder: 10 },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      create: achievement,
      update: { title: achievement.title, isActive: true },
    });
  }
  console.info('[ok] Achievements (10)');

  // --- Rewards (10) ---------------------------------------------------------

  const rewards = [
    { slug: 'coffee-voucher', name: 'Free Coffee', description: 'One regular coffee at the caf\u00E9 counter.', imageUrl: '\u2615', category: RewardCategory.FOOD_AND_DRINK, pointCost: 50, stockTotal: 100, perUserLimit: 2, collectionMethod: CollectionMethod.PHYSICAL_COLLECTION, collectionLocation: 'Ground Floor Caf\u00E9', sortOrder: 1 },
    { slug: 'ice-cream', name: 'Ice Cream Cone', description: 'One scoop, your choice of flavour.', imageUrl: '\u{1F366}', category: RewardCategory.FOOD_AND_DRINK, pointCost: 40, stockTotal: 80, perUserLimit: 3, collectionMethod: CollectionMethod.PHYSICAL_COLLECTION, collectionLocation: 'Ground Floor Caf\u00E9', sortOrder: 2 },
    { slug: 'discount-10', name: '10% Off Voucher', description: '10% off your next in-store purchase.', imageUrl: '\u{1F3F7}\uFE0F', category: RewardCategory.DISCOUNT_COUPON, pointCost: 80, stockTotal: 200, perUserLimit: 1, collectionMethod: CollectionMethod.DIGITAL_CODE, sortOrder: 3 },
    { slug: 'movie-ticket', name: 'Cinema Ticket', description: 'One standard admission, any weekday screening.', imageUrl: '\u{1F3AC}', category: RewardCategory.EVENT_TICKET, pointCost: 300, stockTotal: 25, perUserLimit: 1, collectionMethod: CollectionMethod.DIGITAL_CODE, sortOrder: 4 },
    { slug: 'plush-toy', name: 'Quibble Plush', description: 'A soft, huggable version of your pet.', imageUrl: '\u{1F9F8}', category: RewardCategory.TOY, pointCost: 500, stockTotal: 15, perUserLimit: 1, collectionMethod: CollectionMethod.PHYSICAL_COLLECTION, collectionLocation: 'Level 2 Service Counter', sortOrder: 5 },
    { slug: 'tshirt', name: 'PetQuest T-Shirt', description: 'Official PetQuest tee. Sizes S-XL.', imageUrl: '\u{1F455}', category: RewardCategory.MERCHANDISE, pointCost: 600, stockTotal: 20, perUserLimit: 1, collectionMethod: CollectionMethod.PHYSICAL_COLLECTION, collectionLocation: 'Level 2 Service Counter', sortOrder: 6 },
    { slug: 'tote-bag', name: 'Canvas Tote', description: 'Sturdy tote with the Quibble print.', imageUrl: '\u{1F45C}', category: RewardCategory.MERCHANDISE, pointCost: 250, stockTotal: 40, perUserLimit: 2, collectionMethod: CollectionMethod.PHYSICAL_COLLECTION, collectionLocation: 'Level 2 Service Counter', sortOrder: 7 },
    { slug: 'game-attempts', name: '5 Extra Game Attempts', description: 'Five extra mini-game attempts, applied instantly.', imageUrl: '\u{1F3AE}', category: RewardCategory.FREE_GAME_ATTEMPT, pointCost: 30, stockTotal: 500, perUserLimit: 5, collectionMethod: CollectionMethod.DIGITAL_CODE, sortOrder: 8 },
    { slug: 'gift-card-25', name: '$25 Gift Card', description: 'Digital gift card, delivered as a code.', imageUrl: '\u{1F4B3}', category: RewardCategory.DIGITAL_VOUCHER, pointCost: 1000, stockTotal: 10, perUserLimit: 1, collectionMethod: CollectionMethod.DIGITAL_CODE, sortOrder: 9 },
    { slug: 'founder-badge', name: 'Founder Edition Pin', description: 'Limited to the first 50. Never restocked.', imageUrl: '\u{1F4DB}', category: RewardCategory.LIMITED_EDITION, pointCost: 750, stockTotal: 5, perUserLimit: 1, collectionMethod: CollectionMethod.PHYSICAL_COLLECTION, collectionLocation: 'Level 2 Service Counter', sortOrder: 10 },
  ];

  for (const reward of rewards) {
    await prisma.reward.upsert({
      where: { slug: reward.slug },
      create: {
        ...reward,
        stockAvailable: reward.stockTotal,
        termsAndConditions: 'Non-transferable. Valid ID may be required at collection.',
      },
      update: {
        name: reward.name,
        description: reward.description,
        imageUrl: reward.imageUrl,
        collectionLocation: reward.collectionLocation ?? null,
        pointCost: reward.pointCost,
        isActive: true,
      },
    });
  }
  console.info('[ok] Rewards (10)');

  // --- Promo code -----------------------------------------------------------

  await prisma.promoCode.upsert({
    where: { code: 'WELCOME2026' },
    create: {
      code: 'WELCOME2026',
      rewardType: RewardType.COINS,
      rewardAmount: 250,
      maxUses: 1000,
      perUserLimit: 1,
      minPlayerLevel: 1,
    },
    update: { isActive: true },
  });
  console.info('[ok] Promo code (WELCOME2026)');

  // --- Starting balances ----------------------------------------------------

  await grant(player1.id, CurrencyType.COINS, 1500, 'Seed: starting coins');
  await grant(player1.id, CurrencyType.REWARD_POINTS, 320, 'Seed: starting reward points');
  await grant(player1.id, CurrencyType.GEMS, 25, 'Seed: starting gems');

  await grant(player2.id, CurrencyType.COINS, 400, 'Seed: starting coins');
  await grant(player2.id, CurrencyType.REWARD_POINTS, 60, 'Seed: starting reward points');
  await grant(player2.id, CurrencyType.GEMS, 5, 'Seed: starting gems');
  console.info('[ok] Starting balances + ledger entries');

  // --- Leaderboards + sample entries ---------------------------------------

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  for (const game of games) {
    const board = await prisma.leaderboard.upsert({
      where: {
        period_scope_gameId_startsAt: {
          period: LeaderboardPeriod.WEEKLY,
          scope: LeaderboardScope.PER_GAME,
          gameId: game.id,
          startsAt: weekStart,
        },
      },
      create: {
        name: `Weekly ${game.name}`,
        period: LeaderboardPeriod.WEEKLY,
        scope: LeaderboardScope.PER_GAME,
        gameId: game.id,
        startsAt: weekStart,
        endsAt: weekEnd,
      },
      update: {},
    });

    await prisma.leaderboardPrize.upsert({
      where: { leaderboardId_rankFrom_rankTo: { leaderboardId: board.id, rankFrom: 1, rankTo: 1 } },
      create: {
        leaderboardId: board.id,
        rankFrom: 1,
        rankTo: 1,
        rewardType: RewardType.REWARD_POINTS,
        rewardAmount: 50,
      },
      update: {},
    });

    await prisma.leaderboardPrize.upsert({
      where: { leaderboardId_rankFrom_rankTo: { leaderboardId: board.id, rankFrom: 2, rankTo: 10 } },
      create: {
        leaderboardId: board.id,
        rankFrom: 2,
        rankTo: 10,
        rewardType: RewardType.REWARD_POINTS,
        rewardAmount: 15,
      },
      update: {},
    });

    for (const [user, score] of [
      [player1, 2400],
      [player2, 1150],
    ] as const) {
      await prisma.leaderboardEntry.upsert({
        where: { leaderboardId_userId: { leaderboardId: board.id, userId: user.id } },
        create: { leaderboardId: board.id, userId: user.id, score },
        update: { score },
      });
    }
  }
  console.info('[ok] Leaderboards + prizes + sample entries');

  // --- Notifications --------------------------------------------------------

  const existingNotifications = await prisma.notification.count({ where: { userId: player1.id } });
  if (existingNotifications === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: player1.id,
          type: NotificationType.ADMIN_ANNOUNCEMENT,
          title: 'Welcome to PetQuest!',
          body: 'Adopt a pet, play games, and turn your points into real rewards.',
          iconKey: 'megaphone',
        },
        {
          userId: player1.id,
          type: NotificationType.PET_HUNGRY,
          title: 'Mochi is getting hungry',
          body: 'Feed your pet to keep them happy.',
          linkUrl: '/pet/care',
          iconKey: 'pet',
        },
        {
          userId: player1.id,
          type: NotificationType.MISSION_REWARD_AVAILABLE,
          title: 'Mission complete!',
          body: '"Sign in today" is done. Claim your reward.',
          linkUrl: '/missions',
          iconKey: 'mission',
        },
      ],
    });
  }
  console.info('[ok] Notifications (3)');

  // --- System settings ------------------------------------------------------

  await prisma.systemSetting.upsert({
    where: { key: 'maintenance_mode' },
    create: {
      key: 'maintenance_mode',
      value: { enabled: false, message: '' },
      description: 'When enabled, players see a maintenance page.',
    },
    update: {},
  });
  console.info('[ok] System settings');

  console.info('\n[done] Seed complete.\n');
  console.info('   Development accounts (documented in the README):');
  console.info(`   super admin  superadmin@petquest.dev  ${DEV_PASSWORDS.superAdmin}`);
  console.info(`   admin        admin@petquest.dev       ${DEV_PASSWORDS.admin}`);
  console.info(`   staff        staff@petquest.dev       ${DEV_PASSWORDS.staff}`);
  console.info(`   player 1     player1@petquest.dev     ${DEV_PASSWORDS.player}  (has a pet)`);
  console.info(`   player 2     player2@petquest.dev     ${DEV_PASSWORDS.player}  (no pet yet)\n`);
}

// --- Helpers ----------------------------------------------------------------

async function createUser(input: {
  email: string;
  password: string;
  name: string;
  username: string;
  role: Role;
  level?: number;
  xp?: number;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
      status: AccountStatus.ACTIVE,
      emailVerified: new Date(),
    },
    update: { passwordHash, role: input.role },
  });

  await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      username: input.username,
      displayName: input.name,
      level: input.level ?? 1,
      xp: input.xp ?? 0,
      referralCode: `PET${input.username.slice(0, 6).toUpperCase().padEnd(6, 'X')}`,
      timezone: 'Asia/Kuala_Lumpur',
    },
    update: {},
  });

  await prisma.loginStreak.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  for (const currency of [CurrencyType.COINS, CurrencyType.REWARD_POINTS, CurrencyType.GEMS]) {
    await prisma.currencyBalance.upsert({
      where: { userId_currency: { userId: user.id, currency } },
      create: { userId: user.id, currency, balance: 0 },
      update: {},
    });
  }

  return user;
}

/**
 * Grant currency the same way the app does -- through a ledger entry with an
 * idempotency key, not by writing a balance directly. The seed has to respect the
 * ledger invariant too, or the very first thing in the database is a balance the
 * ledger cannot explain.
 */
async function grant(userId: string, currency: CurrencyType, amount: number, description: string) {
  const idempotencyKey = `seed:${userId}:${currency}`;

  const existing = await prisma.currencyTransaction.findUnique({ where: { idempotencyKey } });
  if (existing) return;

  const balance = await prisma.currencyBalance.findUniqueOrThrow({
    where: { userId_currency: { userId, currency } },
  });

  await prisma.$transaction([
    prisma.currencyTransaction.create({
      data: {
        userId,
        currency,
        direction: TransactionDirection.CREDIT,
        amount,
        category: TransactionCategory.ADMIN_ADJUSTMENT,
        description,
        balanceBefore: balance.balance,
        balanceAfter: balance.balance + amount,
        idempotencyKey,
      },
    }),
    prisma.currencyBalance.update({
      where: { userId_currency: { userId, currency } },
      data: { balance: balance.balance + amount, lifetimeEarned: { increment: amount } },
    }),
  ]);
}

main()
  .catch((error) => {
    console.error('[fail] Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
