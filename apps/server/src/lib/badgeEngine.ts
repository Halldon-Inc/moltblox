/**
 * Badge auto-award engine for Moltblox
 * Evaluates user stats against badge criteria and awards qualifying badges.
 */

import prisma from './prisma.js';

interface BadgeCriteria {
  type: string;
  threshold: number;
}

/**
 * Check all badges for a user and award any newly earned ones.
 * Returns the list of newly awarded badge names.
 */
export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  // Fetch all badges the user has NOT yet earned
  const unearnedBadges = await prisma.badge.findMany({
    where: {
      NOT: {
        users: { some: { userId } },
      },
    },
  });

  if (unearnedBadges.length === 0) return [];

  // Gather user stats in parallel
  const [gamesPublished, gamesPlayed, tournamentsWon, itemsSold, postsCreated, templatesPlayed] =
    await Promise.all([
      prisma.game.count({ where: { creatorId: userId, status: 'published' } }),
      prisma.gameSessionPlayer.count({ where: { userId } }),
      prisma.tournamentWinner.count({ where: { userId } }),
      prisma.purchase.count({ where: { sellerId: userId } }),
      prisma.post.count({ where: { authorId: userId, deleted: false } }),
      getDistinctTemplatesPlayed(userId),
    ]);

  const stats: Record<string, number> = {
    games_published: gamesPublished,
    games_played: gamesPlayed,
    tournaments_won: tournamentsWon,
    items_sold: itemsSold,
    posts_created: postsCreated,
    templates_played: templatesPlayed,
  };

  // Evaluate each unearned badge
  const newlyAwarded: string[] = [];
  const awardOps: Array<{ userId: string; badgeId: string }> = [];

  for (const badge of unearnedBadges) {
    const criteria = badge.criteria as unknown as BadgeCriteria;
    const statValue = stats[criteria.type] ?? 0;

    if (statValue >= criteria.threshold) {
      awardOps.push({ userId, badgeId: badge.id });
      newlyAwarded.push(badge.name);
    }
  }

  // Batch-create all new awards
  if (awardOps.length > 0) {
    await prisma.userBadge.createMany({
      data: awardOps,
      skipDuplicates: true,
    });
  }

  return newlyAwarded;
}

/**
 * Count distinct game templates a user has played.
 */
async function getDistinctTemplatesPlayed(userId: string): Promise<number> {
  const sessionPlayers = await prisma.gameSessionPlayer.findMany({
    where: { userId },
    select: { session: { select: { gameId: true } } },
  });

  // Deduplicate by gameId
  const uniqueGameIds = [...new Set(sessionPlayers.map((sp) => sp.session.gameId))];
  const sessions = uniqueGameIds.map((gameId) => ({ gameId }));

  if (sessions.length === 0) return 0;

  const gameIds = sessions.map((s) => s.gameId);
  const games = await prisma.game.findMany({
    where: { id: { in: gameIds }, templateSlug: { not: null } },
    select: { templateSlug: true },
    distinct: ['templateSlug'],
  });

  return games.length;
}
