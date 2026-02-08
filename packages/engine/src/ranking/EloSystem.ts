import { PlayerRating, EloChange, RankTier, RANK_THRESHOLDS } from '@moltblox/protocol';

// =============================================================================
// ELO Configuration
// =============================================================================

export const ELO_CONFIG = {
  initialRating: 1200,
  kFactorBase: 32,
  kFactorProvisional: 64, // Higher K-factor for first 10 games
  provisionalGames: 10,
  floorRating: 100,
  ceilingRating: 3000,
  // Matchmaking
  initialSearchRange: 100,
  searchRangeExpansion: 50, // Expand every 10 seconds
  maxSearchRange: 500,
  maxWaitTimeMs: 120000, // 2 minutes
} as const;

// =============================================================================
// ELO Calculations
// =============================================================================

/**
 * Calculate expected score (probability of winning) based on ratings
 * Uses standard ELO formula: E = 1 / (1 + 10^((Rb - Ra) / 400))
 */
export function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Determine K-factor based on games played and rating
 * Higher K-factor = more volatile rating changes
 */
export function getKFactor(gamesPlayed: number, _rating: number): number {
  // Provisional players have higher K-factor for faster calibration
  if (gamesPlayed < ELO_CONFIG.provisionalGames) {
    return ELO_CONFIG.kFactorProvisional;
  }

  // Standard K-factor for established players
  return ELO_CONFIG.kFactorBase;
}

/**
 * Calculate rating change after a match
 * @param winnerRating Current rating of winner
 * @param loserRating Current rating of loser
 * @param winnerGames Games played by winner
 * @param loserGames Games played by loser
 * @returns Object with rating deltas for both players
 */
export function calculateRatingChange(
  winnerRating: number,
  loserRating: number,
  winnerGames: number,
  loserGames: number,
): { winnerDelta: number; loserDelta: number } {
  // Expected scores
  const winnerExpected = calculateExpectedScore(winnerRating, loserRating);
  const loserExpected = calculateExpectedScore(loserRating, winnerRating);

  // K-factors
  const winnerK = getKFactor(winnerGames, winnerRating);
  const loserK = getKFactor(loserGames, loserRating);

  // Actual scores (1 for win, 0 for loss)
  const winnerActual = 1;
  const loserActual = 0;

  // Rating changes
  const winnerDelta = Math.round(winnerK * (winnerActual - winnerExpected));
  const loserDelta = Math.round(loserK * (loserActual - loserExpected));

  return { winnerDelta, loserDelta };
}

/**
 * Clamp rating to valid bounds
 */
export function clampRating(rating: number): number {
  return Math.max(ELO_CONFIG.floorRating, Math.min(ELO_CONFIG.ceilingRating, rating));
}

/**
 * Determine rank tier from rating
 */
export function getRankTier(rating: number): RankTier {
  for (const [tier, thresholds] of Object.entries(RANK_THRESHOLDS)) {
    if (rating >= thresholds.min && rating <= thresholds.max) {
      return tier as RankTier;
    }
  }
  return 'bronze'; // Default fallback
}

// =============================================================================
// ELO System Class
// =============================================================================

export class EloSystem {
  /**
   * Process a match result and calculate new ratings
   * @param winnerId ID of the winning player
   * @param loserId ID of the losing player
   * @param winnerRating Current rating of winner
   * @param loserRating Current rating of loser
   * @param matchId ID of the match
   * @returns Tuple of EloChange objects for [winner, loser]
   */
  static processMatchResult(
    winnerId: string,
    loserId: string,
    winnerRating: PlayerRating,
    loserRating: PlayerRating,
    matchId: string,
  ): [EloChange, EloChange] {
    const timestamp = Date.now();

    // Calculate rating changes
    const { winnerDelta, loserDelta } = calculateRatingChange(
      winnerRating.rating,
      loserRating.rating,
      winnerRating.gamesPlayed,
      loserRating.gamesPlayed,
    );

    // Calculate new ratings (clamped)
    const newWinnerRating = clampRating(winnerRating.rating + winnerDelta);
    const newLoserRating = clampRating(loserRating.rating + loserDelta);

    // Create change records
    const winnerChange: EloChange = {
      playerId: winnerId,
      oldRating: winnerRating.rating,
      newRating: newWinnerRating,
      change: winnerDelta,
      matchId,
      opponentId: loserId,
      isWin: true,
      timestamp,
    };

    const loserChange: EloChange = {
      playerId: loserId,
      oldRating: loserRating.rating,
      newRating: newLoserRating,
      change: loserDelta,
      matchId,
      opponentId: winnerId,
      isWin: false,
      timestamp,
    };

    return [winnerChange, loserChange];
  }

  /**
   * Apply an ELO change to update a player's rating record
   */
  static applyChange(player: PlayerRating, change: EloChange): PlayerRating {
    const newRating = change.newRating;
    const isWin = change.isWin;

    return {
      ...player,
      rating: newRating,
      tier: getRankTier(newRating),
      gamesPlayed: player.gamesPlayed + 1,
      wins: isWin ? player.wins + 1 : player.wins,
      losses: isWin ? player.losses : player.losses + 1,
      winRate: (player.wins + (isWin ? 1 : 0)) / (player.gamesPlayed + 1),
      peakRating: Math.max(player.peakRating, newRating),
      currentStreak: isWin
        ? player.currentStreak >= 0
          ? player.currentStreak + 1
          : 1
        : player.currentStreak <= 0
          ? player.currentStreak - 1
          : -1,
      lastMatchTimestamp: change.timestamp,
    };
  }

  /**
   * Create a new player rating record with default values
   */
  static createNewPlayer(playerId: string, botName: string): PlayerRating {
    return {
      playerId,
      botName,
      rating: ELO_CONFIG.initialRating,
      tier: getRankTier(ELO_CONFIG.initialRating),
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      peakRating: ELO_CONFIG.initialRating,
      currentStreak: 0,
      lastMatchTimestamp: Date.now(),
    };
  }

  /**
   * Check if a player is still in provisional period
   */
  static isProvisional(player: PlayerRating): boolean {
    return player.gamesPlayed < ELO_CONFIG.provisionalGames;
  }

  /**
   * Get rating display string (e.g., "1523 Silver")
   */
  static getRatingDisplay(rating: number): string {
    const tier = getRankTier(rating);
    const tierDisplay = tier.charAt(0).toUpperCase() + tier.slice(1);
    return `${rating} ${tierDisplay}`;
  }

  /**
   * Calculate probability of player A beating player B
   */
  static getWinProbability(ratingA: number, ratingB: number): number {
    return calculateExpectedScore(ratingA, ratingB);
  }

  /**
   * Estimate rating change for a potential match
   * Useful for showing potential gains/losses before a match
   */
  static estimateChange(
    playerRating: number,
    opponentRating: number,
    playerGames: number,
  ): { ifWin: number; ifLoss: number } {
    const k = getKFactor(playerGames, playerRating);
    const expected = calculateExpectedScore(playerRating, opponentRating);

    return {
      ifWin: Math.round(k * (1 - expected)),
      ifLoss: Math.round(k * (0 - expected)),
    };
  }
}
