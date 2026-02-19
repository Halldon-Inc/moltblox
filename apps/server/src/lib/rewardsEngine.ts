/**
 * Rewards engine for Moltblox season-based airdrop system.
 * Calculates points using sqrt() diminishing returns,
 * awards events across 4 categories + cross-category bonus.
 */

import prisma from './prisma.js';
import type { Prisma } from '../generated/prisma/client.js';

// ─── Scoring helpers ────────────────────────────────────

/**
 * Sqrt-based diminishing returns.
 * score = basePoints * sqrt(count) ensures whales can't dominate linearly.
 */
function sqrtScore(count: number, basePoints: number): number {
  if (count <= 0) return 0;
  return Math.floor(basePoints * Math.sqrt(count));
}

// ─── Point recording ────────────────────────────────────

interface AwardPointsInput {
  userId: string;
  category: 'builder' | 'player' | 'holder' | 'purchaser' | 'bonus';
  points: number;
  reason: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Record a reward event for a user in the current active season.
 * Returns the created event or null if no active season.
 */
export async function awardPoints(input: AwardPointsInput) {
  const season = await getActiveSeason();
  if (!season) return null;

  const event = await prisma.rewardEvent.create({
    data: {
      userId: input.userId,
      seasonId: season.id,
      category: input.category,
      points: input.points,
      reason: input.reason,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  return event;
}

// ─── Builder scoring ────────────────────────────────────

/**
 * Award builder points when a game gets played.
 * Uses sqrt(uniquePlayers) for diminishing returns.
 */
export async function awardBuilderPoints(creatorId: string, gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { uniquePlayers: true, name: true, totalPlays: true },
  });
  if (!game) return null;

  // Points based on sqrt of unique players (not total plays)
  const points = sqrtScore(game.uniquePlayers, 10);
  if (points <= 0) return null;

  return awardPoints({
    userId: creatorId,
    category: 'builder',
    points,
    reason: `Game "${game.name}" reached ${game.uniquePlayers} unique players`,
    metadata: { gameId, uniquePlayers: game.uniquePlayers, totalPlays: game.totalPlays },
  });
}

// ─── Player scoring ─────────────────────────────────────

/**
 * Award player points when a game session completes.
 * Points for session completion + diversity bonus for playing multiple games.
 */
export async function awardPlayerPoints(userId: string, gameId: string) {
  // Count distinct games this user has played
  const distinctGames = await prisma.gameSessionPlayer.findMany({
    where: { userId },
    select: { session: { select: { gameId: true } } },
    distinct: ['sessionId'],
  });

  const uniqueGameIds = new Set(distinctGames.map((sp) => sp.session.gameId));
  const diversityCount = uniqueGameIds.size;

  // Base points for completing a session + sqrt diversity bonus
  const sessionPoints = 5;
  const diversityBonus = sqrtScore(diversityCount, 3);
  const total = sessionPoints + diversityBonus;

  return awardPoints({
    userId,
    category: 'player',
    points: total,
    reason: `Completed game session (${diversityCount} unique games played)`,
    metadata: { gameId, diversityCount },
  });
}

// ─── Holder scoring ─────────────────────────────────────

/**
 * Award holder points based on current on-chain balance.
 * Uses sqrt(balance_in_mbucks) for diminishing returns.
 * Called periodically (e.g. daily cron or manual trigger).
 */
export async function awardHolderPoints(userId: string, balanceMbucks: number) {
  if (balanceMbucks <= 0) return null;

  // sqrt of balance in whole MBUCKS tokens (not wei)
  const points = sqrtScore(Math.floor(balanceMbucks), 1);
  if (points <= 0) return null;

  return awardPoints({
    userId,
    category: 'holder',
    points,
    reason: `Holding ${Math.floor(balanceMbucks)} MBUCKS`,
    metadata: { balanceMbucks: Math.floor(balanceMbucks) },
  });
}

// ─── Purchaser scoring ──────────────────────────────────

/**
 * Award purchaser points when a user buys an in-game item with MBUCKS.
 * sqrt(total_purchases) for diminishing returns.
 */
export async function awardPurchaserPoints(userId: string, purchaseId: string) {
  const totalPurchases = await prisma.purchase.count({ where: { buyerId: userId } });

  const points = sqrtScore(totalPurchases, 5);
  if (points <= 0) return null;

  return awardPoints({
    userId,
    category: 'purchaser',
    points,
    reason: `In-game purchase #${totalPurchases}`,
    metadata: { purchaseId, totalPurchases },
  });
}

// ─── Cross-category bonus ───────────────────────────────

/**
 * Award cross-category bonus points.
 * Users active in 2+ categories get up to 1.6x bonus.
 * Called at season end during snapshot.
 */
export async function calculateCrossCategoryBonus(userId: string, seasonId: string) {
  const categoryPoints = await prisma.rewardEvent.groupBy({
    by: ['category'],
    where: { userId, seasonId, category: { not: 'bonus' } },
    _sum: { points: true },
  });

  const activeCategories = categoryPoints.filter((c) => (c._sum.points ?? 0) > 0).length;

  // Bonus multiplier: 2 categories = 1.1x, 3 = 1.3x, 4 = 1.6x
  const multipliers: Record<number, number> = { 2: 0.1, 3: 0.3, 4: 0.6 };
  const bonusRate = multipliers[activeCategories] ?? 0;
  if (bonusRate <= 0) return null;

  const totalBasePoints = categoryPoints.reduce((sum, c) => sum + (c._sum.points ?? 0), 0);
  const bonusPoints = Math.floor(totalBasePoints * bonusRate);
  if (bonusPoints <= 0) return null;

  return awardPoints({
    userId,
    category: 'bonus',
    points: bonusPoints,
    reason: `Cross-category bonus (${activeCategories} categories, ${Math.round(bonusRate * 100)}%)`,
    metadata: { activeCategories, bonusRate },
  });
}

// ─── User summary ───────────────────────────────────────

export interface RewardsSummary {
  userId: string;
  seasonId: string;
  seasonName: string;
  seasonNumber: number;
  builderPoints: number;
  playerPoints: number;
  holderPoints: number;
  purchaserPoints: number;
  bonusPoints: number;
  totalPoints: number;
  rank: number;
  totalParticipants: number;
  estimatedTokens: string;
}

/**
 * Get a user's full rewards summary for the active season.
 */
export async function getUserRewardsSummary(userId: string): Promise<RewardsSummary | null> {
  const season = await getActiveSeason();
  if (!season) return null;

  // Get user's points by category
  const categoryPoints = await prisma.rewardEvent.groupBy({
    by: ['category'],
    where: { userId, seasonId: season.id },
    _sum: { points: true },
  });

  const pointsMap: Record<string, number> = {};
  for (const c of categoryPoints) {
    pointsMap[c.category] = c._sum.points ?? 0;
  }

  const builderPoints = pointsMap['builder'] ?? 0;
  const playerPoints = pointsMap['player'] ?? 0;
  const holderPoints = pointsMap['holder'] ?? 0;
  const purchaserPoints = pointsMap['purchaser'] ?? 0;
  const bonusPoints = pointsMap['bonus'] ?? 0;
  const totalPoints = builderPoints + playerPoints + holderPoints + purchaserPoints + bonusPoints;

  // Weighted total for ranking
  const weightedTotal =
    builderPoints * (season.weightBuilder / 100) +
    playerPoints * (season.weightPlayer / 100) +
    holderPoints * (season.weightHolder / 100) +
    purchaserPoints * (season.weightPurchaser / 100) +
    bonusPoints;

  // Get rank: count users with more weighted points
  const allUserPoints = await prisma.rewardEvent.groupBy({
    by: ['userId'],
    where: { seasonId: season.id },
    _sum: { points: true },
  });

  const totalParticipants = allUserPoints.length;

  // Sort by total points descending to find rank
  const sorted = allUserPoints
    .map((u) => ({ userId: u.userId, total: u._sum.points ?? 0 }))
    .sort((a, b) => b.total - a.total);

  const rank = sorted.findIndex((u) => u.userId === userId) + 1 || totalParticipants + 1;

  // Estimate tokens: (user_weighted / total_all_weighted) * season token pool
  const totalAllPoints = sorted.reduce((sum, u) => sum + u.total, 0);
  let estimatedTokens = '0';
  if (totalAllPoints > 0 && season.tokenPool > BigInt(0)) {
    const share = weightedTotal / totalAllPoints;
    const tokens = Number(season.tokenPool) * share;
    estimatedTokens = Math.floor(tokens).toString();
  }

  return {
    userId,
    seasonId: season.id,
    seasonName: season.name,
    seasonNumber: season.number,
    builderPoints,
    playerPoints,
    holderPoints,
    purchaserPoints,
    bonusPoints,
    totalPoints,
    rank,
    totalParticipants,
    estimatedTokens,
  };
}

// ─── Leaderboard ────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  totalPoints: number;
  builderPoints: number;
  playerPoints: number;
  holderPoints: number;
  purchaserPoints: number;
}

export async function getRewardsLeaderboard(
  limit: number = 25,
  category?: 'builder' | 'player' | 'holder' | 'purchaser',
): Promise<LeaderboardEntry[]> {
  const season = await getActiveSeason();
  if (!season) return [];

  const where: any = { seasonId: season.id };
  if (category) where.category = category;

  const userPoints = await prisma.rewardEvent.groupBy({
    by: ['userId'],
    where,
    _sum: { points: true },
    orderBy: { _sum: { points: 'desc' } },
    take: limit,
  });

  if (userPoints.length === 0) return [];

  // Fetch user display names
  const userIds = userPoints.map((u) => u.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, username: true, walletAddress: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  // If no category filter, also get per-category breakdowns
  const breakdowns = new Map<string, Record<string, number>>();
  if (!category) {
    const allEvents = await prisma.rewardEvent.groupBy({
      by: ['userId', 'category'],
      where: { seasonId: season.id, userId: { in: userIds } },
      _sum: { points: true },
    });
    for (const e of allEvents) {
      if (!breakdowns.has(e.userId)) breakdowns.set(e.userId, {});
      breakdowns.get(e.userId)![e.category] = e._sum.points ?? 0;
    }
  }

  return userPoints.map((u, i) => {
    const user = userMap.get(u.userId);
    const bd = breakdowns.get(u.userId) ?? {};
    return {
      rank: i + 1,
      userId: u.userId,
      displayName:
        user?.displayName || user?.username || user?.walletAddress?.slice(0, 10) || 'Unknown',
      totalPoints: u._sum.points ?? 0,
      builderPoints: bd['builder'] ?? 0,
      playerPoints: bd['player'] ?? 0,
      holderPoints: bd['holder'] ?? 0,
      purchaserPoints: bd['purchaser'] ?? 0,
    };
  });
}

// ─── Season snapshot ───────────────────────────────────

/**
 * Take a final snapshot of the active season.
 * Creates SeasonAllocation records for every participant,
 * calculates cross-category bonuses, and marks season as distributing.
 *
 * Returns the number of participants snapshotted.
 */
export async function snapshotSeason(seasonId: string) {
  const season = await prisma.airdropSeason.findUnique({
    where: { id: seasonId },
  });
  if (!season || season.status !== 'active') return null;

  // Get all participants grouped by userId
  const allUsers = await prisma.rewardEvent.groupBy({
    by: ['userId'],
    where: { seasonId },
    _sum: { points: true },
  });

  if (allUsers.length === 0) return { participants: 0 };

  // Get per-category breakdowns for all users at once
  const allEvents = await prisma.rewardEvent.groupBy({
    by: ['userId', 'category'],
    where: { seasonId },
    _sum: { points: true },
  });

  const breakdowns = new Map<string, Record<string, number>>();
  for (const e of allEvents) {
    if (!breakdowns.has(e.userId)) breakdowns.set(e.userId, {});
    breakdowns.get(e.userId)![e.category] = e._sum.points ?? 0;
  }

  // Award cross-category bonuses for all participants
  for (const u of allUsers) {
    await calculateCrossCategoryBonus(u.userId, seasonId);
  }

  // Re-query after bonuses are awarded
  const finalEvents = await prisma.rewardEvent.groupBy({
    by: ['userId', 'category'],
    where: { seasonId },
    _sum: { points: true },
  });

  const finalBreakdowns = new Map<string, Record<string, number>>();
  for (const e of finalEvents) {
    if (!finalBreakdowns.has(e.userId)) finalBreakdowns.set(e.userId, {});
    finalBreakdowns.get(e.userId)![e.category] = e._sum.points ?? 0;
  }

  // Calculate weighted totals for token allocation
  const userWeighted: Array<{ userId: string; weighted: number; bd: Record<string, number> }> = [];
  let totalWeighted = 0;

  for (const u of allUsers) {
    const bd = finalBreakdowns.get(u.userId) ?? {};
    const weighted =
      (bd['builder'] ?? 0) * (season.weightBuilder / 100) +
      (bd['player'] ?? 0) * (season.weightPlayer / 100) +
      (bd['holder'] ?? 0) * (season.weightHolder / 100) +
      (bd['purchaser'] ?? 0) * (season.weightPurchaser / 100) +
      (bd['bonus'] ?? 0);

    userWeighted.push({ userId: u.userId, weighted, bd });
    totalWeighted += weighted;
  }

  // Create SeasonAllocation records
  for (const uw of userWeighted) {
    const share = totalWeighted > 0 ? uw.weighted / totalWeighted : 0;
    const tokensAllocated =
      totalWeighted > 0 ? BigInt(Math.floor(Number(season.tokenPool) * share)) : BigInt(0);

    const totalPoints =
      (uw.bd['builder'] ?? 0) +
      (uw.bd['player'] ?? 0) +
      (uw.bd['holder'] ?? 0) +
      (uw.bd['purchaser'] ?? 0) +
      (uw.bd['bonus'] ?? 0);

    await prisma.seasonAllocation.upsert({
      where: { seasonId_userId: { seasonId, userId: uw.userId } },
      create: {
        seasonId,
        userId: uw.userId,
        builderPoints: uw.bd['builder'] ?? 0,
        playerPoints: uw.bd['player'] ?? 0,
        holderPoints: uw.bd['holder'] ?? 0,
        purchaserPoints: uw.bd['purchaser'] ?? 0,
        bonusPoints: uw.bd['bonus'] ?? 0,
        totalPoints,
        tokensAllocated,
      },
      update: {
        builderPoints: uw.bd['builder'] ?? 0,
        playerPoints: uw.bd['player'] ?? 0,
        holderPoints: uw.bd['holder'] ?? 0,
        purchaserPoints: uw.bd['purchaser'] ?? 0,
        bonusPoints: uw.bd['bonus'] ?? 0,
        totalPoints,
        tokensAllocated,
      },
    });
  }

  // Mark season as distributing
  await prisma.airdropSeason.update({
    where: { id: seasonId },
    data: { status: 'distributing' },
  });

  return { participants: allUsers.length };
}

// ─── Season helpers ─────────────────────────────────────

export async function getActiveSeason() {
  return prisma.airdropSeason.findFirst({
    where: { status: 'active' },
    orderBy: { number: 'desc' },
  });
}

export async function getCurrentOrUpcomingSeason() {
  return prisma.airdropSeason.findFirst({
    where: { status: { in: ['active', 'upcoming'] } },
    orderBy: { number: 'asc' },
  });
}

export async function getSeasonInfo(seasonId?: string) {
  if (seasonId) {
    return prisma.airdropSeason.findUnique({ where: { id: seasonId } });
  }
  return getActiveSeason();
}

/**
 * Get a user's reward event history for the current season.
 */
export async function getUserRewardHistory(userId: string, limit: number = 50, offset: number = 0) {
  const season = await getActiveSeason();
  if (!season) return { events: [], total: 0 };

  const [events, total] = await Promise.all([
    prisma.rewardEvent.findMany({
      where: { userId, seasonId: season.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        category: true,
        points: true,
        reason: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.rewardEvent.count({ where: { userId, seasonId: season.id } }),
  ]);

  return { events, total };
}
