/**
 * Prize distribution calculator for Moltblox tournaments
 * Calculates prize amounts for each participant based on standings and distribution rules
 */

import type { PrizeDistribution } from '@moltblox/protocol';

/** Result of prize calculation for a single player */
export interface PrizeResult {
  playerId: string;
  placement: number;
  prizeAmount: string; // In MBUCKS (wei as string)
  percentage: number;
}

/** Default prize distribution percentages */
export const DEFAULT_DISTRIBUTION: PrizeDistribution = {
  first: 50,
  second: 25,
  third: 15,
  participation: 10,
};

/**
 * Calculate prizes for all participants in a tournament.
 *
 * @param prizePool - Total prize pool in MBUCKS (wei as string)
 * @param distribution - Prize distribution percentages
 * @param standings - Array of player IDs in order of placement (index 0 = 1st place)
 * @returns Array of PrizeResult for each participant
 */
export function calculatePrizes(
  prizePool: string,
  distribution: PrizeDistribution,
  standings: string[],
): PrizeResult[] {
  if (standings.length === 0) {
    return [];
  }

  const totalPool = BigInt(prizePool);
  const results: PrizeResult[] = [];

  // Validate distribution totals 100
  const totalPercentage =
    distribution.first + distribution.second + distribution.third + distribution.participation;
  if (totalPercentage !== 100) {
    throw new Error(`Prize distribution must total 100%, got ${totalPercentage}%`);
  }

  // Handle special cases with fewer than 4 participants
  if (standings.length === 1) {
    // Solo winner takes all
    results.push({
      playerId: standings[0],
      placement: 1,
      prizeAmount: totalPool.toString(),
      percentage: 100,
    });
    return results;
  }

  if (standings.length === 2) {
    // Two players: redistribute 3rd/participation into 1st and 2nd
    const firstPct =
      distribution.first +
      Math.floor(distribution.third / 2) +
      Math.floor(distribution.participation / 2);
    const secondPct = 100 - firstPct;

    results.push({
      playerId: standings[0],
      placement: 1,
      prizeAmount: calculateAmount(totalPool, firstPct).toString(),
      percentage: firstPct,
    });
    results.push({
      playerId: standings[1],
      placement: 2,
      prizeAmount: calculateAmount(totalPool, secondPct).toString(),
      percentage: secondPct,
    });
    return results;
  }

  if (standings.length === 3) {
    // Three players: redistribute participation into top 3
    const extraEach = Math.floor(distribution.participation / 3);
    const remainder = distribution.participation - extraEach * 3;

    const firstPct = distribution.first + extraEach + remainder;
    const secondPct = distribution.second + extraEach;
    const thirdPct = distribution.third + extraEach;

    results.push({
      playerId: standings[0],
      placement: 1,
      prizeAmount: calculateAmount(totalPool, firstPct).toString(),
      percentage: firstPct,
    });
    results.push({
      playerId: standings[1],
      placement: 2,
      prizeAmount: calculateAmount(totalPool, secondPct).toString(),
      percentage: secondPct,
    });
    results.push({
      playerId: standings[2],
      placement: 3,
      prizeAmount: calculateAmount(totalPool, thirdPct).toString(),
      percentage: thirdPct,
    });
    return results;
  }

  // Standard case: 4+ participants
  // 1st place
  results.push({
    playerId: standings[0],
    placement: 1,
    prizeAmount: calculateAmount(totalPool, distribution.first).toString(),
    percentage: distribution.first,
  });

  // 2nd place
  results.push({
    playerId: standings[1],
    placement: 2,
    prizeAmount: calculateAmount(totalPool, distribution.second).toString(),
    percentage: distribution.second,
  });

  // 3rd place
  results.push({
    playerId: standings[2],
    placement: 3,
    prizeAmount: calculateAmount(totalPool, distribution.third).toString(),
    percentage: distribution.third,
  });

  // Participation pool split evenly among remaining participants
  const remainingPlayers = standings.slice(3);
  if (remainingPlayers.length > 0) {
    const participationPool = calculateAmount(totalPool, distribution.participation);
    const perPlayer = participationPool / BigInt(remainingPlayers.length);
    const participationRemainder = participationPool - perPlayer * BigInt(remainingPlayers.length);

    for (let i = 0; i < remainingPlayers.length; i++) {
      // Give any remainder wei to the 4th place finisher
      const bonus = i === 0 ? participationRemainder : 0n;
      const pct = distribution.participation / remainingPlayers.length;

      results.push({
        playerId: remainingPlayers[i],
        placement: i + 4,
        prizeAmount: (perPlayer + bonus).toString(),
        percentage: Math.round(pct * 100) / 100,
      });
    }
  }

  return results;
}

/**
 * Calculate a BigInt amount from a total pool and a percentage.
 * Uses integer math to avoid floating point issues.
 *
 * @param totalPool - Total pool in wei
 * @param percentage - Percentage (0-100)
 * @returns Amount in wei
 */
function calculateAmount(totalPool: bigint, percentage: number): bigint {
  return (totalPool * BigInt(percentage)) / 100n;
}

/**
 * Validate that a prize distribution is valid.
 *
 * @param distribution - Distribution to validate
 * @returns true if valid, throws otherwise
 */
export function validateDistribution(distribution: PrizeDistribution): boolean {
  const { first, second, third, participation } = distribution;

  if (first < 0 || second < 0 || third < 0 || participation < 0) {
    throw new Error('All distribution percentages must be non-negative');
  }

  const total = first + second + third + participation;
  if (total !== 100) {
    throw new Error(`Distribution must total 100%, got ${total}%`);
  }

  if (first < second) {
    throw new Error('First place prize must be >= second place prize');
  }

  if (second < third) {
    throw new Error('Second place prize must be >= third place prize');
  }

  return true;
}
