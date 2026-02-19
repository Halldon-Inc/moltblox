-- CreateEnum
CREATE TYPE "RewardCategory" AS ENUM ('builder', 'player', 'holder', 'purchaser', 'bonus');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('upcoming', 'active', 'distributing', 'completed');

-- CreateTable
CREATE TABLE "reward_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "category" "RewardCategory" NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airdrop_seasons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'upcoming',
    "tokenPool" BIGINT NOT NULL DEFAULT 0,
    "weightBuilder" INTEGER NOT NULL DEFAULT 25,
    "weightPlayer" INTEGER NOT NULL DEFAULT 35,
    "weightHolder" INTEGER NOT NULL DEFAULT 20,
    "weightPurchaser" INTEGER NOT NULL DEFAULT 20,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airdrop_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_allocations" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "builderPoints" INTEGER NOT NULL DEFAULT 0,
    "playerPoints" INTEGER NOT NULL DEFAULT 0,
    "holderPoints" INTEGER NOT NULL DEFAULT 0,
    "purchaserPoints" INTEGER NOT NULL DEFAULT 0,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "tokensAllocated" BIGINT NOT NULL DEFAULT 0,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    "txHash" TEXT,

    CONSTRAINT "season_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reward_events_userId_idx" ON "reward_events"("userId");

-- CreateIndex
CREATE INDEX "reward_events_seasonId_idx" ON "reward_events"("seasonId");

-- CreateIndex
CREATE INDEX "reward_events_category_idx" ON "reward_events"("category");

-- CreateIndex
CREATE INDEX "reward_events_createdAt_idx" ON "reward_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "airdrop_seasons_name_key" ON "airdrop_seasons"("name");

-- CreateIndex
CREATE UNIQUE INDEX "airdrop_seasons_number_key" ON "airdrop_seasons"("number");

-- CreateIndex
CREATE INDEX "airdrop_seasons_status_idx" ON "airdrop_seasons"("status");

-- CreateIndex
CREATE UNIQUE INDEX "season_allocations_seasonId_userId_key" ON "season_allocations"("seasonId", "userId");

-- CreateIndex
CREATE INDEX "season_allocations_seasonId_idx" ON "season_allocations"("seasonId");

-- CreateIndex
CREATE INDEX "season_allocations_userId_idx" ON "season_allocations"("userId");

-- AddForeignKey
ALTER TABLE "reward_events" ADD CONSTRAINT "reward_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_events" ADD CONSTRAINT "reward_events_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "airdrop_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_allocations" ADD CONSTRAINT "season_allocations_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "airdrop_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_allocations" ADD CONSTRAINT "season_allocations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
