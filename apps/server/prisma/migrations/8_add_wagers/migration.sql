-- CreateEnum
CREATE TYPE "WagerStatus" AS ENUM ('OPEN', 'LOCKED', 'SETTLED', 'CANCELLED', 'DISPUTED', 'REFUNDED');

-- CreateTable
CREATE TABLE "wagers" (
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
CREATE TABLE "spectator_bets" (
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
CREATE INDEX "wagers_gameId_idx" ON "wagers"("gameId");

-- CreateIndex
CREATE INDEX "wagers_creatorId_idx" ON "wagers"("creatorId");

-- CreateIndex
CREATE INDEX "wagers_status_idx" ON "wagers"("status");

-- CreateIndex
CREATE INDEX "spectator_bets_wagerId_idx" ON "spectator_bets"("wagerId");

-- CreateIndex
CREATE INDEX "spectator_bets_bettorId_idx" ON "spectator_bets"("bettorId");

-- AddForeignKey
ALTER TABLE "wagers" ADD CONSTRAINT "wagers_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wagers" ADD CONSTRAINT "wagers_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wagers" ADD CONSTRAINT "wagers_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spectator_bets" ADD CONSTRAINT "spectator_bets_wagerId_fkey" FOREIGN KEY ("wagerId") REFERENCES "wagers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spectator_bets" ADD CONSTRAINT "spectator_bets_bettorId_fkey" FOREIGN KEY ("bettorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
