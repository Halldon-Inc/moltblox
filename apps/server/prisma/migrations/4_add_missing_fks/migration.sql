-- Add missing foreign key relations

-- Notification: gameId -> Game
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notification: itemId -> Item
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notification: tournamentId -> Tournament
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notification: postId -> Post
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TournamentMatch: player1Id -> User
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_player1Id_fkey"
  FOREIGN KEY ("player1Id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TournamentMatch: player2Id -> User
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_player2Id_fkey"
  FOREIGN KEY ("player2Id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TournamentMatch: winnerId -> User
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_winnerId_fkey"
  FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TournamentWinner: make userId nullable and add FK to User
ALTER TABLE "tournament_winners" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "tournament_winners" ADD CONSTRAINT "tournament_winners_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- GameSession: winnerId -> User
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_winnerId_fkey"
  FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for winnerId on game_sessions
CREATE INDEX "game_sessions_winnerId_idx" ON "game_sessions"("winnerId");
