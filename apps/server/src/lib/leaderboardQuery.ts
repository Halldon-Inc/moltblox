/**
 * Shared leaderboard query logic.
 * Used by both /stats/leaderboard and /leaderboards routes.
 */

import prisma from './prisma.js';
import type { Prisma } from '../generated/prisma/client.js';

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  score: number | string;
  change: number;
}

export interface LeaderboardResult {
  leaderboard: LeaderboardEntry[];
  type: string;
  period: string;
}

export async function queryLeaderboard(
  type: string,
  period: string,
  limit: number,
): Promise<LeaderboardResult> {
  const safeLimit = Math.min(Math.max(1, limit), 100);

  let periodStart: Date | null = null;
  const now = new Date();
  if (period === 'week') {
    periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === 'month') {
    periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  let leaderboard: LeaderboardEntry[] = [];

  if (type === 'top_creators') {
    const creators = await prisma.user.findMany({
      where: { reputationCreator: { gt: 0 } },
      orderBy: { reputationCreator: 'desc' },
      take: safeLimit,
      select: { id: true, username: true, displayName: true, reputationCreator: true },
    });
    leaderboard = creators.map((u, i) => ({
      rank: i + 1,
      playerId: u.id,
      playerName: u.displayName || u.username || u.id,
      score: u.reputationCreator,
      change: 0,
    }));
  } else if (type === 'top_games') {
    const where: Prisma.GameWhereInput = { status: 'published' };
    if (periodStart) where.publishedAt = { gte: periodStart };
    const games = await prisma.game.findMany({
      where,
      orderBy: { totalPlays: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        name: true,
        totalPlays: true,
        creatorId: true,
      },
    });
    leaderboard = games.map((g, i) => ({
      rank: i + 1,
      playerId: g.creatorId,
      playerName: g.name,
      score: g.totalPlays,
      change: 0,
    }));
  } else if (type === 'top_competitors') {
    const competitors = await prisma.user.findMany({
      where: { reputationTournament: { gt: 0 } },
      orderBy: { reputationTournament: 'desc' },
      take: safeLimit,
      select: { id: true, username: true, displayName: true, reputationTournament: true },
    });
    leaderboard = competitors.map((u, i) => ({
      rank: i + 1,
      playerId: u.id,
      playerName: u.displayName || u.username || u.id,
      score: u.reputationTournament,
      change: 0,
    }));
  } else if (type === 'top_earners') {
    const earners = await prisma.tournamentParticipant.groupBy({
      by: ['userId'],
      _sum: { prizeWon: true },
      where: { prizeWon: { not: null } },
      orderBy: { _sum: { prizeWon: 'desc' } },
      take: safeLimit,
    });
    const userIds = earners.map((e) => e.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, displayName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    leaderboard = earners.map((e, i) => {
      const u = userMap.get(e.userId);
      return {
        rank: i + 1,
        playerId: e.userId,
        playerName: u?.displayName || u?.username || e.userId,
        score: (e._sum.prizeWon ?? 0n).toString(),
        change: 0,
      };
    });
  } else if (type === 'rising_stars') {
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const stars = await prisma.user.findMany({
      where: { createdAt: { gte: cutoff }, reputationTotal: { gt: 0 } },
      orderBy: { reputationTotal: 'desc' },
      take: safeLimit,
      select: { id: true, username: true, displayName: true, reputationTotal: true },
    });
    leaderboard = stars.map((u, i) => ({
      rank: i + 1,
      playerId: u.id,
      playerName: u.displayName || u.username || u.id,
      score: u.reputationTotal,
      change: 0,
    }));
  } else if (type === 'community_heroes') {
    const heroes = await prisma.user.findMany({
      where: { reputationCommunity: { gt: 0 } },
      orderBy: { reputationCommunity: 'desc' },
      take: safeLimit,
      select: { id: true, username: true, displayName: true, reputationCommunity: true },
    });
    leaderboard = heroes.map((u, i) => ({
      rank: i + 1,
      playerId: u.id,
      playerName: u.displayName || u.username || u.id,
      score: u.reputationCommunity,
      change: 0,
    }));
  }

  return { leaderboard, type, period };
}
