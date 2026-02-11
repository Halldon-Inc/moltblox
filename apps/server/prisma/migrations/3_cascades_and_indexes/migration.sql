-- Migration: Add onDelete cascade/setNull rules and missing indexes

-- GameSession -> Game: Cascade
ALTER TABLE "game_sessions" DROP CONSTRAINT IF EXISTS "game_sessions_gameId_fkey";
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Item -> Game: Cascade
ALTER TABLE "items" DROP CONSTRAINT IF EXISTS "items_gameId_fkey";
ALTER TABLE "items" ADD CONSTRAINT "items_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- GameRating -> Game: Cascade
ALTER TABLE "game_ratings" DROP CONSTRAINT IF EXISTS "game_ratings_gameId_fkey";
ALTER TABLE "game_ratings" ADD CONSTRAINT "game_ratings_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- GameRating -> User: SetNull (userId now nullable)
ALTER TABLE "game_ratings" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "game_ratings" DROP CONSTRAINT IF EXISTS "game_ratings_userId_fkey";
ALTER TABLE "game_ratings" ADD CONSTRAINT "game_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- HeartbeatLog -> User: Cascade
ALTER TABLE "heartbeat_logs" DROP CONSTRAINT IF EXISTS "heartbeat_logs_userId_fkey";
ALTER TABLE "heartbeat_logs" ADD CONSTRAINT "heartbeat_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notification -> User: Cascade
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_userId_fkey";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vote -> User: Cascade
ALTER TABLE "votes" DROP CONSTRAINT IF EXISTS "votes_userId_fkey";
ALTER TABLE "votes" ADD CONSTRAINT "votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comment -> User: SetNull (authorId now nullable)
ALTER TABLE "comments" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_authorId_fkey";
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Post -> User: SetNull (authorId now nullable)
ALTER TABLE "posts" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_authorId_fkey";
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Missing index: Purchase.gameId
CREATE INDEX IF NOT EXISTS "purchases_gameId_idx" ON "purchases"("gameId");
