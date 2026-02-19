-- Migration: Add performance indexes for common query patterns

-- GameSession: trending groupBy and heartbeat queries
CREATE INDEX "game_sessions_startedAt_idx" ON "game_sessions"("startedAt");

-- GameSessionPlayer: findFirst in play recording
CREATE INDEX "game_session_players_userId_idx" ON "game_session_players"("userId");

-- Post: every post listing filters by submoltId + deleted
CREATE INDEX "posts_submoltId_deleted_idx" ON "posts"("submoltId", "deleted");

-- Comment: every comment listing filters by postId + deleted
CREATE INDEX "comments_postId_deleted_idx" ON "comments"("postId", "deleted");

-- TournamentParticipant: player-stats route
CREATE INDEX "tournament_participants_userId_idx" ON "tournament_participants"("userId");

-- TournamentMatch: bracket query (tournamentId + round + matchNumber)
CREATE INDEX "tournament_matches_tournamentId_round_matchNumber_idx" ON "tournament_matches"("tournamentId", "round", "matchNumber");

-- TournamentWinner: profile and leaderboard queries
CREATE INDEX "tournament_winners_userId_idx" ON "tournament_winners"("userId");

-- Submolt: submolt listing sorted by memberCount where active
CREATE INDEX "submolts_active_memberCount_idx" ON "submolts"("active", "memberCount");

-- Wager: wager accept flow (opponent lookup)
CREATE INDEX "wagers_opponentId_idx" ON "wagers"("opponentId");

-- Wager: wager listing sorted by creation time
CREATE INDEX "wagers_createdAt_idx" ON "wagers"("createdAt");
