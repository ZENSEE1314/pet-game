-- CreateEnum
CREATE TYPE "SudokuDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "SudokuStatus" AS ENUM ('ACTIVE', 'SOLVED', 'ABANDONED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MonsterElement" AS ENUM ('FIRE', 'WATER', 'EARTH', 'STORM', 'NATURE', 'ICE', 'SHADOW', 'LIGHT', 'METAL', 'COSMIC');

-- CreateEnum
CREATE TYPE "MonsterRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC');

-- CreateEnum
CREATE TYPE "PuzzlePieceSource" AS ENUM ('SUDOKU', 'EVENT', 'PROMO', 'ADMIN_GRANT');

-- AlterEnum
ALTER TYPE "GameSlug" ADD VALUE 'SUDOKU';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PUZZLE_PIECE_EARNED';
ALTER TYPE "NotificationType" ADD VALUE 'MONSTER_UNLOCKED';

-- AlterEnum
ALTER TYPE "TransactionCategory" ADD VALUE 'MONSTER_UNLOCK_REWARD';

-- CreateTable
CREATE TABLE "monsters" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "element" "MonsterElement" NOT NULL,
    "rarity" "MonsterRarity" NOT NULL,
    "archetype" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#f59e0b',
    "dropWeight" INTEGER NOT NULL DEFAULT 100,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monsters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_puzzle_pieces" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "pieceIndex" INTEGER NOT NULL,
    "source" "PuzzlePieceSource" NOT NULL DEFAULT 'SUDOKU',
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_puzzle_pieces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_monsters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "isNew" BOOLEAN NOT NULL DEFAULT true,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_monsters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sudoku_games" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "difficulty" "SudokuDifficulty" NOT NULL,
    "status" "SudokuStatus" NOT NULL DEFAULT 'ACTIVE',
    "puzzle" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "nonce" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "mistakes" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "awardedMonsterId" TEXT,
    "awardedPieceIndex" INTEGER,
    "completedMonster" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sudoku_games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monsters_slug_key" ON "monsters"("slug");

-- CreateIndex
CREATE INDEX "monsters_element_rarity_idx" ON "monsters"("element", "rarity");

-- CreateIndex
CREATE INDEX "monsters_isActive_sortOrder_idx" ON "monsters"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "user_puzzle_pieces_userId_monsterId_idx" ON "user_puzzle_pieces"("userId", "monsterId");

-- CreateIndex
CREATE UNIQUE INDEX "user_puzzle_pieces_userId_monsterId_pieceIndex_key" ON "user_puzzle_pieces"("userId", "monsterId", "pieceIndex");

-- CreateIndex
CREATE INDEX "user_monsters_userId_unlockedAt_idx" ON "user_monsters"("userId", "unlockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_monsters_userId_monsterId_key" ON "user_monsters"("userId", "monsterId");

-- CreateIndex
CREATE UNIQUE INDEX "sudoku_games_nonce_key" ON "sudoku_games"("nonce");

-- CreateIndex
CREATE INDEX "sudoku_games_userId_status_idx" ON "sudoku_games"("userId", "status");

-- CreateIndex
CREATE INDEX "sudoku_games_startedAt_idx" ON "sudoku_games"("startedAt");

-- AddForeignKey
ALTER TABLE "user_puzzle_pieces" ADD CONSTRAINT "user_puzzle_pieces_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_puzzle_pieces" ADD CONSTRAINT "user_puzzle_pieces_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "monsters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_monsters" ADD CONSTRAINT "user_monsters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_monsters" ADD CONSTRAINT "user_monsters_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "monsters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sudoku_games" ADD CONSTRAINT "sudoku_games_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
