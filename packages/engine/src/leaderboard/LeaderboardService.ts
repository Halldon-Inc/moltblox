import {
  LeaderboardEntry,
  LeaderboardSnapshot,
  LeaderboardUpdate,
  PlayerRating,
  EloChange,
  RankTier,
} from '@moltblox/protocol';
import { getRankTier } from '../ranking/EloSystem';

// =============================================================================
// Redis Interface (abstract for dependency injection)
// =============================================================================

export interface RedisClient {
  // Sorted set operations
  zadd(key: string, score: number, member: string): Promise<number>;
  zrevrank(key: string, member: string): Promise<number | null>;
  zscore(key: string, member: string): Promise<string | null>;
  zrevrange(key: string, start: number, stop: number): Promise<string[]>;
  zrevrangeWithScores(
    key: string,
    start: number,
    stop: number,
  ): Promise<Array<{ member: string; score: number }>>;
  zcard(key: string): Promise<number>;

  // Hash operations
  hset(key: string, field: string, value: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, ...fields: string[]): Promise<number>;

  // Set operations
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;

  // Pub/Sub
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, callback: (message: string) => void): void;
}

// =============================================================================
// Redis Keys
// =============================================================================

const KEYS = {
  LEADERBOARD: 'moltblox:leaderboard',
  PLAYER_DATA: 'moltblox:player:', // + playerId
  ONLINE_PLAYERS: 'moltblox:online',
  IN_MATCH_PLAYERS: 'moltblox:in_match',
  LEADERBOARD_CHANNEL: 'moltblox:leaderboard:updates',
};

// =============================================================================
// Leaderboard Service
// =============================================================================

export class LeaderboardService {
  private redis: RedisClient;
  private subscribers: Set<(update: LeaderboardUpdate) => void> = new Set();
  private cacheSnapshot: LeaderboardSnapshot | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5000; // 5 second cache

  constructor(redis: RedisClient) {
    this.redis = redis;
    this.setupSubscription();
  }

  // ===========================================================================
  // Core Leaderboard Operations
  // ===========================================================================

  /**
   * Update a player's rating in the leaderboard
   */
  async updateRating(playerId: string, rating: number): Promise<void> {
    await this.redis.zadd(KEYS.LEADERBOARD, rating, playerId);
    this.invalidateCache();
  }

  /**
   * Get a player's current rank (1-indexed)
   */
  async getPlayerRank(playerId: string): Promise<number | null> {
    const rank = await this.redis.zrevrank(KEYS.LEADERBOARD, playerId);
    return rank !== null ? rank + 1 : null;
  }

  /**
   * Get a player's current rating from leaderboard
   */
  async getPlayerRating(playerId: string): Promise<number | null> {
    const score = await this.redis.zscore(KEYS.LEADERBOARD, playerId);
    return score !== null ? parseFloat(score) : null;
  }

  /**
   * Get top N players
   */
  async getTopPlayers(count: number = 100): Promise<LeaderboardEntry[]> {
    const results = await this.redis.zrevrangeWithScores(KEYS.LEADERBOARD, 0, count - 1);

    const onlinePlayers = new Set(await this.redis.smembers(KEYS.ONLINE_PLAYERS));
    const inMatchPlayers = await this.getPlayersInMatch();

    const entries: LeaderboardEntry[] = [];

    for (let i = 0; i < results.length; i++) {
      const { member: playerId, score: rating } = results[i];
      const playerData = await this.getPlayerData(playerId);

      entries.push({
        rank: i + 1,
        playerId,
        botName: playerData?.botName || 'Unknown',
        rating: Math.round(rating),
        tier: getRankTier(rating),
        gamesPlayed: playerData?.gamesPlayed || 0,
        winRate: playerData?.winRate || 0,
        isOnline: onlinePlayers.has(playerId),
        isInMatch: inMatchPlayers.has(playerId),
        currentMatchId: inMatchPlayers.get(playerId) || null,
      });
    }

    return entries;
  }

  /**
   * Get leaderboard snapshot with caching
   */
  async getSnapshot(count: number = 100): Promise<LeaderboardSnapshot> {
    const now = Date.now();

    if (this.cacheSnapshot && this.cacheExpiry > now) {
      return this.cacheSnapshot;
    }

    const entries = await this.getTopPlayers(count);
    const totalPlayers = await this.redis.zcard(KEYS.LEADERBOARD);

    this.cacheSnapshot = {
      entries,
      totalPlayers,
      lastUpdated: now,
    };
    this.cacheExpiry = now + this.CACHE_TTL_MS;

    return this.cacheSnapshot;
  }

  /**
   * Get total number of ranked players
   */
  async getTotalPlayers(): Promise<number> {
    return this.redis.zcard(KEYS.LEADERBOARD);
  }

  // ===========================================================================
  // Player Data Operations
  // ===========================================================================

  /**
   * Store player data
   */
  async setPlayerData(playerId: string, data: PlayerRating): Promise<void> {
    await this.redis.hset(KEYS.PLAYER_DATA + playerId, 'data', JSON.stringify(data));
  }

  /**
   * Get player data
   */
  async getPlayerData(playerId: string): Promise<PlayerRating | null> {
    const data = await this.redis.hget(KEYS.PLAYER_DATA + playerId, 'data');
    if (!data) return null;

    try {
      return JSON.parse(data) as PlayerRating;
    } catch {
      return null;
    }
  }

  /**
   * Get full leaderboard entry for a player
   */
  async getPlayerEntry(playerId: string): Promise<LeaderboardEntry | null> {
    const [rank, rating, playerData] = await Promise.all([
      this.getPlayerRank(playerId),
      this.getPlayerRating(playerId),
      this.getPlayerData(playerId),
    ]);

    if (rank === null || rating === null) {
      return null;
    }

    const onlinePlayers = new Set(await this.redis.smembers(KEYS.ONLINE_PLAYERS));
    const inMatchPlayers = await this.getPlayersInMatch();

    return {
      rank,
      playerId,
      botName: playerData?.botName || 'Unknown',
      rating: Math.round(rating),
      tier: getRankTier(rating),
      gamesPlayed: playerData?.gamesPlayed || 0,
      winRate: playerData?.winRate || 0,
      isOnline: onlinePlayers.has(playerId),
      isInMatch: inMatchPlayers.has(playerId),
      currentMatchId: inMatchPlayers.get(playerId) || null,
    };
  }

  // ===========================================================================
  // Online/Match Status
  // ===========================================================================

  /**
   * Mark player as online
   */
  async setPlayerOnline(playerId: string): Promise<void> {
    await this.redis.sadd(KEYS.ONLINE_PLAYERS, playerId);
    await this.notifyStatusChange(playerId);
  }

  /**
   * Mark player as offline
   */
  async setPlayerOffline(playerId: string): Promise<void> {
    await this.redis.srem(KEYS.ONLINE_PLAYERS, playerId);
    await this.notifyStatusChange(playerId);
  }

  /**
   * Mark player as in a match
   */
  async setPlayerInMatch(playerId: string, matchId: string): Promise<void> {
    await this.redis.hset(KEYS.IN_MATCH_PLAYERS, playerId, matchId);
    await this.notifyStatusChange(playerId);
  }

  /**
   * Mark player as no longer in a match
   */
  async clearPlayerMatch(playerId: string): Promise<void> {
    await this.redis.hdel(KEYS.IN_MATCH_PLAYERS, playerId);
    await this.notifyStatusChange(playerId);
  }

  /**
   * Get all players currently in matches
   */
  private async getPlayersInMatch(): Promise<Map<string, string>> {
    const data = await this.redis.hgetall(KEYS.IN_MATCH_PLAYERS);
    return new Map(Object.entries(data));
  }

  // ===========================================================================
  // Match Result Processing
  // ===========================================================================

  /**
   * Process rating changes from a match result
   */
  async processMatchResult(changes: EloChange[]): Promise<LeaderboardUpdate> {
    const updateChanges: LeaderboardUpdate['changes'] = [];

    for (const change of changes) {
      // Get old rank before update
      const oldRank = await this.getPlayerRank(change.playerId);
      const oldRating = change.oldRating;

      // Update rating in leaderboard
      await this.updateRating(change.playerId, change.newRating);

      // Update player data
      const playerData = await this.getPlayerData(change.playerId);
      if (playerData) {
        playerData.rating = change.newRating;
        playerData.tier = getRankTier(change.newRating);
        playerData.gamesPlayed++;
        if (change.isWin) {
          playerData.wins++;
        } else {
          playerData.losses++;
        }
        playerData.winRate = playerData.wins / playerData.gamesPlayed;
        playerData.lastMatchTimestamp = change.timestamp;

        await this.setPlayerData(change.playerId, playerData);
      }

      // Get new rank after update
      const newRank = await this.getPlayerRank(change.playerId);

      if (newRank !== null) {
        let direction: 'up' | 'down' | 'new' | 'unchanged' = 'unchanged';
        if (oldRank === null) {
          direction = 'new';
        } else if (newRank < oldRank) {
          direction = 'up';
        } else if (newRank > oldRank) {
          direction = 'down';
        }

        updateChanges.push({
          playerId: change.playerId,
          oldRank,
          newRank,
          oldRating,
          newRating: change.newRating,
          direction,
        });
      }
    }

    const update: LeaderboardUpdate = {
      type: 'LEADERBOARD_UPDATE',
      changes: updateChanges,
      timestamp: Date.now(),
    };

    // Broadcast update
    await this.broadcastUpdate(update);

    return update;
  }

  // ===========================================================================
  // Real-time Updates
  // ===========================================================================

  /**
   * Subscribe to leaderboard updates
   */
  subscribe(callback: (update: LeaderboardUpdate) => void): () => void {
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Setup Redis pub/sub subscription
   */
  private setupSubscription(): void {
    this.redis.subscribe(KEYS.LEADERBOARD_CHANNEL, (message) => {
      try {
        const update = JSON.parse(message) as LeaderboardUpdate;
        this.notifySubscribers(update);
      } catch (error) {
        console.error('Failed to parse leaderboard update:', error);
      }
    });
  }

  /**
   * Broadcast update to all subscribers (via Redis pub/sub for distributed systems)
   */
  private async broadcastUpdate(update: LeaderboardUpdate): Promise<void> {
    await this.redis.publish(KEYS.LEADERBOARD_CHANNEL, JSON.stringify(update));
    this.invalidateCache();
  }

  /**
   * Notify local subscribers
   */
  private notifySubscribers(update: LeaderboardUpdate): void {
    for (const callback of this.subscribers) {
      try {
        callback(update);
      } catch (error) {
        console.error('Subscriber callback error:', error);
      }
    }
  }

  /**
   * Notify about player status change
   */
  private async notifyStatusChange(playerId: string): Promise<void> {
    const entry = await this.getPlayerEntry(playerId);
    if (!entry) return;

    const update: LeaderboardUpdate = {
      type: 'LEADERBOARD_UPDATE',
      changes: [
        {
          playerId,
          oldRank: entry.rank,
          newRank: entry.rank,
          oldRating: entry.rating ?? 0,
          newRating: entry.rating ?? 0,
          direction: 'unchanged',
        },
      ],
      timestamp: Date.now(),
    };

    this.notifySubscribers(update);
  }

  /**
   * Invalidate cache
   */
  private invalidateCache(): void {
    this.cacheSnapshot = null;
    this.cacheExpiry = 0;
  }
}
