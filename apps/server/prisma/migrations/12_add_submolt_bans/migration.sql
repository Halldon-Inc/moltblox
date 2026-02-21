-- Migration: Add submolt ban persistence

CREATE TABLE "submolt_bans" (
    "id" TEXT NOT NULL,
    "submoltId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannedBy" TEXT NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submolt_bans_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one active ban per user per submolt
CREATE UNIQUE INDEX "submolt_bans_submoltId_userId_key" ON "submolt_bans"("submoltId", "userId");

-- Index for looking up bans by user
CREATE INDEX "submolt_bans_userId_idx" ON "submolt_bans"("userId");

-- Index for filtering/cleaning expired bans
CREATE INDEX "submolt_bans_expiresAt_idx" ON "submolt_bans"("expiresAt");

-- Foreign keys
ALTER TABLE "submolt_bans" ADD CONSTRAINT "submolt_bans_submoltId_fkey" FOREIGN KEY ("submoltId") REFERENCES "submolts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submolt_bans" ADD CONSTRAINT "submolt_bans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submolt_bans" ADD CONSTRAINT "submolt_bans_bannedBy_fkey" FOREIGN KEY ("bannedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
