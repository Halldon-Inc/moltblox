/**
 * Game Store
 *
 * Redis-based storage for published games, items, and purchases.
 */

import Redis from 'ioredis';
import type {
  PublishedGame,
  GameItem,
  OwnedItem,
  Purchase,
} from '@moltblox/protocol';

// =============================================================================
// Types
// =============================================================================

export interface GameStoreConfig {
  redis: Redis;
  keyPrefix: string;
}

export interface StoredGame extends PublishedGame {
  wasmBundle: string; // Base64 encoded WASM
}

// =============================================================================
// Redis Keys
// =============================================================================

const KEYS = {
  // Games
  game: (gameId: string) => `game:${gameId}`,
  gamesByCreator: (creatorId: string) => `games:creator:${creatorId}`,
  gamesByCategory: (category: string) => `games:category:${category}`,
  allGames: 'games:all',
  trendingGames: 'games:trending',

  // Items
  item: (itemId: string) => `item:${itemId}`,
  itemsByGame: (gameId: string) => `items:game:${gameId}`,

  // Purchases
  purchase: (purchaseId: string) => `purchase:${purchaseId}`,
  purchasesByPlayer: (playerId: string) => `purchases:player:${playerId}`,
  purchasesByGame: (gameId: string) => `purchases:game:${gameId}`,

  // Player inventory
  inventory: (playerId: string) => `inventory:${playerId}`,
  inventoryByGame: (playerId: string, gameId: string) =>
    `inventory:${playerId}:game:${gameId}`,

  // Analytics
  gameStats: (gameId: string) => `stats:game:${gameId}`,
  creatorStats: (creatorId: string) => `stats:creator:${creatorId}`,

  // Revenue
  revenueDaily: (gameId: string, date: string) =>
    `revenue:${gameId}:${date}`,
  revenueCreator: (creatorId: string) => `revenue:creator:${creatorId}`,
};

// =============================================================================
// Game Store
// =============================================================================

export class GameStore {
  private redis: Redis;
  private prefix: string;

  constructor(config: GameStoreConfig) {
    this.redis = config.redis;
    this.prefix = config.keyPrefix || 'moltblox:';
  }

  private key(key: string): string {
    return `${this.prefix}${key}`;
  }

  // ===================
  // Games
  // ===================

  async saveGame(game: StoredGame): Promise<void> {
    const key = this.key(KEYS.game(game.gameId));

    await this.redis
      .multi()
      // Save game data
      .set(key, JSON.stringify(game))
      // Add to creator's games
      .sadd(this.key(KEYS.gamesByCreator(game.creatorBotId)), game.gameId)
      // Add to category
      .sadd(this.key(KEYS.gamesByCategory(game.category)), game.gameId)
      // Add to all games sorted by publish date
      .zadd(this.key(KEYS.allGames), game.publishedAt, game.gameId)
      .exec();
  }

  async getGame(gameId: string): Promise<StoredGame | null> {
    const data = await this.redis.get(this.key(KEYS.game(gameId)));
    return data ? JSON.parse(data) : null;
  }

  /**
   * Batch-fetch multiple games using a Redis pipeline to avoid N+1 queries.
   */
  async getGames(gameIds: string[]): Promise<(StoredGame | null)[]> {
    if (gameIds.length === 0) return [];
    const pipeline = this.redis.pipeline();
    for (const id of gameIds) {
      pipeline.get(this.key(KEYS.game(id)));
    }
    const results = await pipeline.exec();
    return (
      results?.map(([err, data]) => {
        if (err || !data) return null;
        return JSON.parse(data as string) as StoredGame;
      }) ?? []
    );
  }

  async updateGame(
    gameId: string,
    updates: Partial<StoredGame>
  ): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const updated = { ...game, ...updates, updatedAt: Date.now() };
    await this.redis.set(
      this.key(KEYS.game(gameId)),
      JSON.stringify(updated)
    );
  }

  async getGamesByCreator(creatorId: string): Promise<string[]> {
    return this.redis.smembers(this.key(KEYS.gamesByCreator(creatorId)));
  }

  async getGamesByCategory(category: string): Promise<string[]> {
    return this.redis.smembers(this.key(KEYS.gamesByCategory(category)));
  }

  async getAllGameIds(
    limit: number = 100,
    offset: number = 0
  ): Promise<string[]> {
    return this.redis.zrevrange(
      this.key(KEYS.allGames),
      offset,
      offset + limit - 1
    );
  }

  // ===================
  // Items
  // ===================

  async saveItem(item: GameItem): Promise<void> {
    await this.redis
      .multi()
      .set(this.key(KEYS.item(item.itemId)), JSON.stringify(item))
      .sadd(this.key(KEYS.itemsByGame(item.gameId)), item.itemId)
      .exec();
  }

  async getItem(itemId: string): Promise<GameItem | null> {
    const data = await this.redis.get(this.key(KEYS.item(itemId)));
    return data ? JSON.parse(data) : null;
  }

  async updateItem(
    itemId: string,
    updates: Partial<GameItem>
  ): Promise<void> {
    const item = await this.getItem(itemId);
    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    const updated = { ...item, ...updates };
    await this.redis.set(
      this.key(KEYS.item(itemId)),
      JSON.stringify(updated)
    );
  }

  async getItemsByGame(gameId: string): Promise<GameItem[]> {
    const itemIds = await this.redis.smembers(
      this.key(KEYS.itemsByGame(gameId))
    );

    const items: GameItem[] = [];
    for (const itemId of itemIds) {
      const item = await this.getItem(itemId);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  // ===================
  // Purchases
  // ===================

  async savePurchase(purchase: Purchase): Promise<void> {
    await this.redis
      .multi()
      .set(
        this.key(KEYS.purchase(purchase.purchaseId)),
        JSON.stringify(purchase)
      )
      .lpush(
        this.key(KEYS.purchasesByPlayer(purchase.buyerBotId)),
        purchase.purchaseId
      )
      .lpush(
        this.key(KEYS.purchasesByGame(purchase.gameId)),
        purchase.purchaseId
      )
      .exec();
  }

  async getPurchase(purchaseId: string): Promise<Purchase | null> {
    const data = await this.redis.get(this.key(KEYS.purchase(purchaseId)));
    return data ? JSON.parse(data) : null;
  }

  // ===================
  // Inventory
  // ===================

  async addToInventory(
    playerId: string,
    ownedItem: OwnedItem
  ): Promise<void> {
    const inventoryKey = this.key(KEYS.inventory(playerId));
    const gameInventoryKey = this.key(
      KEYS.inventoryByGame(playerId, ownedItem.gameId)
    );

    await this.redis
      .multi()
      .hset(inventoryKey, ownedItem.itemId, JSON.stringify(ownedItem))
      .sadd(gameInventoryKey, ownedItem.itemId)
      .exec();
  }

  async getInventory(playerId: string): Promise<OwnedItem[]> {
    const data = await this.redis.hgetall(this.key(KEYS.inventory(playerId)));

    return Object.values(data).map((item) => JSON.parse(item));
  }

  async getInventoryForGame(
    playerId: string,
    gameId: string
  ): Promise<OwnedItem[]> {
    const itemIds = await this.redis.smembers(
      this.key(KEYS.inventoryByGame(playerId, gameId))
    );

    const inventoryKey = this.key(KEYS.inventory(playerId));
    const items: OwnedItem[] = [];

    for (const itemId of itemIds) {
      const data = await this.redis.hget(inventoryKey, itemId);
      if (data) {
        items.push(JSON.parse(data));
      }
    }

    return items;
  }

  async updateInventoryItem(
    playerId: string,
    itemId: string,
    updates: Partial<OwnedItem>
  ): Promise<void> {
    const inventoryKey = this.key(KEYS.inventory(playerId));
    const data = await this.redis.hget(inventoryKey, itemId);

    if (!data) {
      throw new Error(`Item not in inventory: ${itemId}`);
    }

    const item: OwnedItem = JSON.parse(data);
    const updated = { ...item, ...updates };

    await this.redis.hset(inventoryKey, itemId, JSON.stringify(updated));
  }

  // ===================
  // Analytics
  // ===================

  async incrementGameStat(
    gameId: string,
    stat: string,
    amount: number = 1
  ): Promise<void> {
    await this.redis.hincrby(
      this.key(KEYS.gameStats(gameId)),
      stat,
      amount
    );
  }

  async getGameStats(gameId: string): Promise<Record<string, number>> {
    const data = await this.redis.hgetall(this.key(KEYS.gameStats(gameId)));

    const stats: Record<string, number> = {};
    for (const [key, value] of Object.entries(data)) {
      stats[key] = parseInt(value, 10);
    }

    return stats;
  }

  async recordRevenue(
    gameId: string,
    creatorId: string,
    amount: string
  ): Promise<void> {
    const date = new Date().toISOString().split('T')[0];

    await this.redis
      .multi()
      // Daily revenue for game
      .incrbyfloat(
        this.key(KEYS.revenueDaily(gameId, date)),
        parseFloat(amount)
      )
      // Total creator revenue
      .incrbyfloat(
        this.key(KEYS.revenueCreator(creatorId)),
        parseFloat(amount)
      )
      .exec();
  }

  async getCreatorTotalRevenue(creatorId: string): Promise<string> {
    const revenue = await this.redis.get(
      this.key(KEYS.revenueCreator(creatorId))
    );
    return revenue || '0';
  }

  // ===================
  // Trending
  // ===================

  async updateTrendingScore(
    gameId: string,
    score: number
  ): Promise<void> {
    await this.redis.zadd(this.key(KEYS.trendingGames), score, gameId);
  }

  async getTrendingGames(limit: number = 20): Promise<string[]> {
    return this.redis.zrevrange(this.key(KEYS.trendingGames), 0, limit - 1);
  }
}

// =============================================================================
// Export
// =============================================================================

export default GameStore;
