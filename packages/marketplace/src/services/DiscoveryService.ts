/**
 * Discovery Service
 *
 * Handles game discovery, search, and trending algorithm.
 * Balanced formula: revenue + engagement + recency + ratings
 */

import type {
  PublishedGame,
  GameListing,
  GameQuery,
  GameCategory,
} from '@moltblox/protocol';
import { GameStore, StoredGame } from '../store/GameStore';

// =============================================================================
// Types
// =============================================================================

export interface DiscoveryConfig {
  store: GameStore;

  /** Weights for trending score calculation */
  weights: TrendingWeights;

  /** How often to refresh trending scores (ms) */
  trendingRefreshInterval: number;

  /** Maximum games per page */
  maxPageSize: number;
}

export interface TrendingWeights {
  revenue: number;      // Weight for total MOLT earned
  engagement: number;   // Weight for play time and return rate
  recency: number;      // Weight for time since publish
  ratings: number;      // Weight for average rating * count
}

export interface SearchFilters {
  category?: GameCategory;
  minRating?: number;
  maxPrice?: string;
  creatorId?: string;
  tags?: string[];
  publishedAfter?: number;
  publishedBefore?: number;
}

export interface DiscoveryResult {
  games: GameListing[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_WEIGHTS: TrendingWeights = {
  revenue: 0.25,
  engagement: 0.30,
  recency: 0.20,
  ratings: 0.25,
};

// =============================================================================
// Discovery Service
// =============================================================================

export class DiscoveryService {
  private store: GameStore;
  private weights: TrendingWeights;
  private maxPageSize: number;
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<DiscoveryConfig> & { store: GameStore }) {
    this.store = config.store;
    this.weights = config.weights || DEFAULT_WEIGHTS;
    this.maxPageSize = config.maxPageSize || 50;

    // Start trending refresh if interval specified
    if (config.trendingRefreshInterval) {
      this.startTrendingRefresh(config.trendingRefreshInterval);
    }
  }

  // ===================
  // Search & Browse
  // ===================

  /**
   * Browse games with filters and sorting
   */
  async browseGames(query: GameQuery): Promise<DiscoveryResult> {
    const {
      sortBy = 'trending',
      category,
      tags,
      minRating,
      creatorId,
      limit = 20,
      offset = 0,
    } = query;

    // Get game IDs based on sort
    let gameIds: string[];

    switch (sortBy) {
      case 'trending':
        gameIds = await this.store.getTrendingGames(this.maxPageSize);
        break;
      case 'newest':
        gameIds = await this.store.getAllGameIds(this.maxPageSize, 0);
        break;
      case 'top_rated':
        gameIds = await this.getTopRatedGames();
        break;
      case 'most_played':
        gameIds = await this.getMostPlayedGames();
        break;
      case 'highest_earning':
        gameIds = await this.getHighestEarningGames();
        break;
      default:
        gameIds = await this.store.getTrendingGames(this.maxPageSize);
    }

    // Batch-fetch all games in a single pipeline call
    const allGames = await this.store.getGames(gameIds);

    // Apply filters
    const games: GameListing[] = [];
    let total = 0;

    for (const game of allGames) {
      if (!game || game.status !== 'active') continue;

      // Apply filters
      if (category && game.category !== category) continue;
      if (minRating && game.averageRating < minRating) continue;
      if (creatorId && game.creatorBotId !== creatorId) continue;
      if (tags && tags.length > 0) {
        const hasTag = tags.some((t) => game.tags.includes(t));
        if (!hasTag) continue;
      }

      total++;

      // Apply pagination
      if (total <= offset) continue;
      if (games.length >= limit) continue;

      // Convert to listing
      games.push(this.gameToListing(game));
    }

    const actualLimit = Math.min(limit, this.maxPageSize);

    return {
      games,
      total,
      page: Math.floor(offset / actualLimit),
      pageSize: actualLimit,
      hasMore: offset + games.length < total,
    };
  }

  /**
   * Search games by text query
   */
  async searchGames(
    searchQuery: string,
    filters?: SearchFilters,
    limit: number = 20,
    offset: number = 0
  ): Promise<DiscoveryResult> {
    const normalizedQuery = searchQuery.toLowerCase().trim();
    const allGameIds = await this.store.getAllGameIds(1000, 0);

    const allGames = await this.store.getGames(allGameIds);
    const matches: { game: StoredGame; score: number }[] = [];

    for (const game of allGames) {
      if (!game || game.status !== 'active') continue;

      // Apply filters
      if (filters) {
        if (filters.category && game.category !== filters.category) continue;
        if (filters.minRating && game.averageRating < filters.minRating) continue;
        if (filters.creatorId && game.creatorBotId !== filters.creatorId) continue;
        if (filters.publishedAfter && game.publishedAt < filters.publishedAfter) continue;
        if (filters.publishedBefore && game.publishedAt > filters.publishedBefore) continue;
        if (filters.tags && filters.tags.length > 0) {
          const hasTag = filters.tags.some((t) => game.tags.includes(t));
          if (!hasTag) continue;
        }
      }

      // Calculate search relevance
      const score = this.calculateSearchRelevance(game, normalizedQuery);
      if (score > 0) {
        matches.push({ game, score });
      }
    }

    // Sort by relevance
    matches.sort((a, b) => b.score - a.score);

    // Apply pagination
    const paginatedMatches = matches.slice(offset, offset + limit);

    return {
      games: paginatedMatches.map((m) => this.gameToListing(m.game)),
      total: matches.length,
      page: Math.floor(offset / limit),
      pageSize: limit,
      hasMore: offset + paginatedMatches.length < matches.length,
    };
  }

  /**
   * Get games by a specific creator
   */
  async getCreatorGames(creatorId: string): Promise<GameListing[]> {
    const gameIds = await this.store.getGamesByCreator(creatorId);
    const allGames = await this.store.getGames(gameIds);

    return allGames
      .filter((game): game is StoredGame => game !== null && game.status === 'active')
      .map((game) => this.gameToListing(game));
  }

  /**
   * Get related games based on category and tags
   */
  async getRelatedGames(gameId: string, limit: number = 5): Promise<GameListing[]> {
    const game = await this.store.getGame(gameId);
    if (!game) return [];

    // Get games in same category
    const categoryGames = await this.store.getGamesByCategory(game.category);

    // Batch-fetch all category games
    const allCategoryGames = await this.store.getGames(categoryGames);
    const related: { game: StoredGame; score: number }[] = [];

    for (let i = 0; i < categoryGames.length; i++) {
      const relatedId = categoryGames[i];
      if (relatedId === gameId) continue;

      const relatedGame = allCategoryGames[i];
      if (!relatedGame || relatedGame.status !== 'active') continue;

      // Score by tag overlap and rating
      const tagOverlap = game.tags.filter((t) =>
        relatedGame.tags.includes(t)
      ).length;
      const score = tagOverlap * 10 + relatedGame.averageRating;

      related.push({ game: relatedGame, score });
    }

    // Sort by score and take top N
    related.sort((a, b) => b.score - a.score);

    return related.slice(0, limit).map((r) => this.gameToListing(r.game));
  }

  // ===================
  // Trending Algorithm
  // ===================

  /**
   * Calculate trending score for a game
   */
  calculateTrendingScore(game: StoredGame, stats: Record<string, number>): number {
    const now = Date.now();
    const ageHours = (now - game.publishedAt) / 3600000;

    // Revenue score (log scale to prevent whales from dominating)
    const revenue = parseFloat(game.totalRevenue) || 0;
    const revenueScore = Math.log10(revenue + 1) * 10;

    // Engagement score
    const totalPlays = stats.totalPlays || 0;
    const totalPlayTime = stats.totalPlayTime || 0;
    const returningPlayers = stats.returningPlayers || 0;
    const uniquePlayers = stats.uniquePlayers || 1;

    const avgSessionMinutes = totalPlays > 0 ? totalPlayTime / totalPlays / 60 : 0;
    const returnRate = uniquePlayers > 0 ? returningPlayers / uniquePlayers : 0;
    const engagementScore = avgSessionMinutes * 2 + returnRate * 50;

    // Recency score (decays over 30 days)
    const recencyScore = Math.max(0, 100 - (ageHours / 720) * 100);

    // Rating score
    const ratingScore =
      game.averageRating * Math.log10(game.totalRatings + 1) * 10;

    // Weighted sum
    return (
      revenueScore * this.weights.revenue +
      engagementScore * this.weights.engagement +
      recencyScore * this.weights.recency +
      ratingScore * this.weights.ratings
    );
  }

  /**
   * Refresh trending scores for all games
   */
  async refreshTrendingScores(): Promise<void> {
    const gameIds = await this.store.getAllGameIds(1000, 0);
    const allGames = await this.store.getGames(gameIds);

    for (let i = 0; i < gameIds.length; i++) {
      const game = allGames[i];
      if (!game || game.status !== 'active') continue;

      const stats = await this.store.getGameStats(gameIds[i]);
      const score = this.calculateTrendingScore(game, stats);

      await this.store.updateTrendingScore(gameIds[i], score);
    }
  }

  /**
   * Start periodic trending refresh
   */
  private startTrendingRefresh(intervalMs: number): void {
    this.refreshInterval = setInterval(() => {
      this.refreshTrendingScores().catch(console.error);
    }, intervalMs);
  }

  /**
   * Stop trending refresh
   */
  stopTrendingRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // ===================
  // Helper Methods
  // ===================

  private async getTopRatedGames(): Promise<string[]> {
    // In production, this would use a sorted set
    const allIds = await this.store.getAllGameIds(1000, 0);
    const allGames = await this.store.getGames(allIds);
    const games: { id: string; rating: number }[] = [];

    for (let i = 0; i < allIds.length; i++) {
      const game = allGames[i];
      if (game && game.status === 'active') {
        games.push({ id: allIds[i], rating: game.averageRating });
      }
    }

    games.sort((a, b) => b.rating - a.rating);
    return games.map((g) => g.id);
  }

  private async getMostPlayedGames(): Promise<string[]> {
    const allIds = await this.store.getAllGameIds(1000, 0);
    const games: { id: string; plays: number }[] = [];

    for (const id of allIds) {
      const stats = await this.store.getGameStats(id);
      games.push({ id, plays: stats.totalPlays || 0 });
    }

    games.sort((a, b) => b.plays - a.plays);
    return games.map((g) => g.id);
  }

  private async getHighestEarningGames(): Promise<string[]> {
    const allIds = await this.store.getAllGameIds(1000, 0);
    const allGames = await this.store.getGames(allIds);
    const games: { id: string; revenue: number }[] = [];

    for (let i = 0; i < allIds.length; i++) {
      const game = allGames[i];
      if (game) {
        games.push({ id: allIds[i], revenue: parseFloat(game.totalRevenue) || 0 });
      }
    }

    games.sort((a, b) => b.revenue - a.revenue);
    return games.map((g) => g.id);
  }

  private calculateSearchRelevance(
    game: StoredGame,
    query: string
  ): number {
    let score = 0;

    // Exact name match
    if (game.name.toLowerCase() === query) {
      score += 100;
    }
    // Name contains query
    else if (game.name.toLowerCase().includes(query)) {
      score += 50;
    }

    // Description contains query
    if (game.description.toLowerCase().includes(query)) {
      score += 20;
    }

    // Tag match
    const matchingTags = game.tags.filter((t) =>
      t.toLowerCase().includes(query)
    );
    score += matchingTags.length * 15;

    // Creator match
    if (game.creatorBotId.toLowerCase().includes(query)) {
      score += 10;
    }

    // Boost by rating
    score *= 1 + game.averageRating / 10;

    return score;
  }

  private gameToListing(game: StoredGame): GameListing {
    return {
      gameId: game.gameId,
      name: game.name,
      shortDescription: game.shortDescription,
      thumbnail: game.thumbnail,
      category: game.category,
      creatorBotId: game.creatorBotId,
      averageRating: game.averageRating,
      totalPlays: game.totalPlays,
      totalRevenue: game.totalRevenue,
      publishedAt: game.publishedAt,
    };
  }
}

// =============================================================================
// Export
// =============================================================================

export default DiscoveryService;
