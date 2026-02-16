import {
  MatchmakingRequest,
  MatchmakingResult,
  MatchmakingStatus,
  PlayerRating,
} from '@moltblox/protocol';
import { ELO_CONFIG } from '../ranking/EloSystem';

// =============================================================================
// Matchmaking Configuration
// =============================================================================

export const MATCHMAKING_CONFIG = {
  initialSearchRange: ELO_CONFIG.initialSearchRange, // ±100
  searchRangeExpansion: ELO_CONFIG.searchRangeExpansion, // +50 every interval
  expansionIntervalMs: 10000, // Expand every 10 seconds
  maxSearchRange: ELO_CONFIG.maxSearchRange, // ±500 max
  maxWaitTimeMs: ELO_CONFIG.maxWaitTimeMs, // 2 minutes max
  tickIntervalMs: 1000, // Check for matches every second
};

// =============================================================================
// Queue Entry
// =============================================================================

interface QueueEntry {
  request: MatchmakingRequest;
  joinedAt: number;
  currentRange: number;
  status: MatchmakingStatus;
  matchedWith?: string;
  matchId?: string;
}

// =============================================================================
// Match Callback
// =============================================================================

export interface MatchFoundCallback {
  (matchId: string, player1Id: string, player2Id: string, ratingDiff: number): void;
}

// =============================================================================
// Ranked Matchmaker
// =============================================================================

export class RankedMatchmaker {
  private queue: Map<string, QueueEntry> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;
  private onMatchFound: MatchFoundCallback | null = null;
  private matchIdCounter: number = 0;

  constructor() {
    this.startTicking();
  }

  // ===========================================================================
  // Queue Management
  // ===========================================================================

  /**
   * Add a player to the matchmaking queue
   */
  enqueue(request: MatchmakingRequest): MatchmakingResult {
    // Check if already in queue
    if (this.queue.has(request.playerId)) {
      const existing = this.queue.get(request.playerId)!;
      return {
        status: existing.status,
        matchId: existing.matchId,
        player1Id: existing.status === 'found' ? request.playerId : undefined,
        player2Id: existing.matchedWith,
        waitTimeMs: Date.now() - existing.joinedAt,
      };
    }

    const entry: QueueEntry = {
      request,
      joinedAt: Date.now(),
      currentRange: request.ratingRange || MATCHMAKING_CONFIG.initialSearchRange,
      status: 'searching',
    };

    this.queue.set(request.playerId, entry);

    // Immediately try to find a match
    const match = this.tryFindMatch(request.playerId);
    if (match) {
      return match;
    }

    return {
      status: 'searching',
      waitTimeMs: 0,
    };
  }

  /**
   * Remove a player from the queue
   */
  dequeue(playerId: string): void {
    this.queue.delete(playerId);
  }

  /**
   * Get current queue status for a player
   */
  getStatus(playerId: string): MatchmakingResult | null {
    const entry = this.queue.get(playerId);
    if (!entry) return null;

    return {
      status: entry.status,
      matchId: entry.matchId,
      player1Id: entry.status === 'found' ? playerId : undefined,
      player2Id: entry.matchedWith,
      waitTimeMs: Date.now() - entry.joinedAt,
    };
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return Array.from(this.queue.values()).filter((e) => e.status === 'searching').length;
  }

  /**
   * Get all players in queue with their wait times
   */
  getQueueInfo(): Array<{ playerId: string; rating: number; waitTimeMs: number }> {
    return Array.from(this.queue.entries())
      .filter(([_, entry]) => entry.status === 'searching')
      .map(([playerId, entry]) => ({
        playerId,
        rating: entry.request.rating,
        waitTimeMs: Date.now() - entry.joinedAt,
      }));
  }

  // ===========================================================================
  // Match Finding
  // ===========================================================================

  /**
   * Try to find a match for a specific player
   */
  private tryFindMatch(playerId: string): MatchmakingResult | null {
    const entry = this.queue.get(playerId);
    if (!entry || entry.status !== 'searching') {
      return null;
    }

    const playerRating = entry.request.rating;
    const searchRange = entry.currentRange;

    // Find best match within range
    let bestMatch: { playerId: string; ratingDiff: number } | null = null;

    for (const [otherId, otherEntry] of this.queue) {
      // Skip self and non-searching players
      if (otherId === playerId || otherEntry.status !== 'searching') {
        continue;
      }

      const otherRating = otherEntry.request.rating;
      const ratingDiff = Math.abs(playerRating - otherRating);

      // Check if within both players' search ranges
      if (ratingDiff <= searchRange && ratingDiff <= otherEntry.currentRange) {
        // Prefer closest rating
        if (!bestMatch || ratingDiff < bestMatch.ratingDiff) {
          bestMatch = { playerId: otherId, ratingDiff };
        }
      }
    }

    if (bestMatch) {
      return this.createMatch(playerId, bestMatch.playerId, bestMatch.ratingDiff);
    }

    return null;
  }

  /**
   * Create a match between two players
   */
  private createMatch(player1Id: string, player2Id: string, ratingDiff: number): MatchmakingResult {
    const matchId = this.generateMatchId();

    // Update both entries
    const entry1 = this.queue.get(player1Id)!;
    const entry2 = this.queue.get(player2Id)!;

    entry1.status = 'found';
    entry1.matchedWith = player2Id;
    entry1.matchId = matchId;

    entry2.status = 'found';
    entry2.matchedWith = player1Id;
    entry2.matchId = matchId;

    // Notify callback
    this.onMatchFound?.(matchId, player1Id, player2Id, ratingDiff);

    return {
      status: 'found',
      matchId,
      player1Id,
      player2Id,
      ratingDifference: ratingDiff,
      waitTimeMs: Date.now() - entry1.joinedAt,
    };
  }

  /**
   * Generate unique match ID
   */
  private generateMatchId(): string {
    this.matchIdCounter++;
    return `match_${Date.now()}_${this.matchIdCounter}`;
  }

  // ===========================================================================
  // Tick Processing
  // ===========================================================================

  /**
   * Start the matchmaking tick loop
   */
  private startTicking(): void {
    if (this.tickInterval) return;

    this.tickInterval = setInterval(() => {
      this.tick();
    }, MATCHMAKING_CONFIG.tickIntervalMs);
  }

  /**
   * Stop the tick loop
   */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * Process one tick of matchmaking
   */
  private tick(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [playerId, entry] of this.queue) {
      if (entry.status !== 'searching') {
        continue;
      }

      const waitTime = now - entry.joinedAt;

      // Check for timeout
      if (waitTime >= (entry.request.maxWaitMs || MATCHMAKING_CONFIG.maxWaitTimeMs)) {
        entry.status = 'timeout';
        toRemove.push(playerId);
        continue;
      }

      // Expand search range
      const expansions = Math.floor(waitTime / MATCHMAKING_CONFIG.expansionIntervalMs);
      entry.currentRange = Math.min(
        MATCHMAKING_CONFIG.initialSearchRange +
          expansions * MATCHMAKING_CONFIG.searchRangeExpansion,
        MATCHMAKING_CONFIG.maxSearchRange,
      );

      // Try to find a match
      this.tryFindMatch(playerId);
    }

    // Remove timed out entries
    for (const playerId of toRemove) {
      this.queue.delete(playerId);
    }
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  /**
   * Set callback for when a match is found
   */
  setOnMatchFound(callback: MatchFoundCallback): void {
    this.onMatchFound = callback;
  }

  /**
   * Confirm a match (both players ready)
   */
  confirmMatch(matchId: string): { player1Id: string; player2Id: string } | null {
    let player1Id: string | null = null;
    let player2Id: string | null = null;

    for (const [playerId, entry] of this.queue) {
      if (entry.matchId === matchId) {
        if (!player1Id) {
          player1Id = playerId;
        } else {
          player2Id = playerId;
          break;
        }
      }
    }

    if (player1Id && player2Id) {
      // Update status to starting
      const entry1 = this.queue.get(player1Id)!;
      const entry2 = this.queue.get(player2Id)!;
      entry1.status = 'starting';
      entry2.status = 'starting';

      return { player1Id, player2Id };
    }

    return null;
  }

  /**
   * Clear match entries after match starts
   */
  clearMatch(matchId: string): void {
    const toRemove: string[] = [];

    for (const [playerId, entry] of this.queue) {
      if (entry.matchId === matchId) {
        toRemove.push(playerId);
      }
    }

    for (const playerId of toRemove) {
      this.queue.delete(playerId);
    }
  }

  /**
   * Cancel a match (e.g., if a player disconnects)
   */
  cancelMatch(matchId: string): void {
    for (const [playerId, entry] of this.queue) {
      if (entry.matchId === matchId) {
        entry.status = 'cancelled';
        entry.matchId = undefined;
        entry.matchedWith = undefined;
      }
    }
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Estimate wait time for a player at given rating
   */
  estimateWaitTime(rating: number): number {
    // Count players within initial range
    let playersInRange = 0;
    for (const entry of this.queue.values()) {
      if (entry.status === 'searching') {
        const diff = Math.abs(rating - entry.request.rating);
        if (diff <= MATCHMAKING_CONFIG.initialSearchRange) {
          playersInRange++;
        }
      }
    }

    // Rough estimate: if players nearby, likely quick match
    // Otherwise, estimate based on expansion time needed
    if (playersInRange > 0) {
      return 5000; // 5 seconds
    }

    // Find closest player
    let closestDiff = Infinity;
    for (const entry of this.queue.values()) {
      if (entry.status === 'searching') {
        const diff = Math.abs(rating - entry.request.rating);
        if (diff < closestDiff) {
          closestDiff = diff;
        }
      }
    }

    if (closestDiff === Infinity) {
      return MATCHMAKING_CONFIG.maxWaitTimeMs; // No one in queue
    }

    // Estimate time to expand range to reach closest player
    const expansionsNeeded = Math.ceil(
      (closestDiff - MATCHMAKING_CONFIG.initialSearchRange) /
        MATCHMAKING_CONFIG.searchRangeExpansion,
    );

    return Math.min(
      expansionsNeeded * MATCHMAKING_CONFIG.expansionIntervalMs + 5000,
      MATCHMAKING_CONFIG.maxWaitTimeMs,
    );
  }

  /**
   * Clear the entire queue
   */
  clearQueue(): void {
    this.queue.clear();
  }
}
