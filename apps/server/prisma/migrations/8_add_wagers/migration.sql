-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "WagerStatus" AS ENUM ('OPEN', 'LOCKED', 'SETTLED', 'CANCELLED', 'DISPUTED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "wagers" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "opponentId" TEXT,
    "stakeAmount" BIGINT NOT NULL,
    "status" "WagerStatus" NOT NULL DEFAULT 'OPEN',
    "winnerId" TEXT,
    "sessionId" TEXT,
    "txHashCreate" TEXT,
    "txHashAccept" TEXT,
    "txHashSettle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "wagers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "spectator_bets" (
    "id" TEXT NOT NULL,
    "wagerId" TEXT NOT NULL,
    "bettorId" TEXT NOT NULL,
    "predictedWinner" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "payout" BIGINT,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spectator_bets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wagers_gameId_idx" ON "wagers"("gameId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wagers_creatorId_idx" ON "wagers"("creatorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wagers_status_idx" ON "wagers"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "spectator_bets_wagerId_idx" ON "spectator_bets"("wagerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "spectator_bets_bettorId_idx" ON "spectator_bets"("bettorId");

-- AddForeignKey (idempotent: drop if exists, then add)
DO $$ BEGIN
  ALTER TABLE "wagers" ADD CONSTRAINT "wagers_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "wagers" ADD CONSTRAINT "wagers_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "wagers" ADD CONSTRAINT "wagers_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "spectator_bets" ADD CONSTRAINT "spectator_bets_wagerId_fkey" FOREIGN KEY ("wagerId") REFERENCES "wagers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "spectator_bets" ADD CONSTRAINT "spectator_bets_bettorId_fkey" FOREIGN KEY ("bettorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
