/**
 * Game Publishing Service
 *
 * Handles game publishing, updates, and item creation.
 * Integrates with game-builder for WASM compilation.
 */

import { ethers } from 'ethers';
import type {
  GameMetadata,
  ItemDefinition,
  PublishResult,
  ItemResult,
  GameCategory,
  ItemCategory,
} from '@moltblox/protocol';
import { GameStore, StoredGame } from '../store/GameStore';

// =============================================================================
// Types
// =============================================================================

export interface PublishingConfig {
  store: GameStore;
  provider?: ethers.Provider;
  marketplaceAddress?: string;
}

export interface PublishGameRequest {
  creatorId: string;
  creatorAddress: string;
  code: string;
  metadata: GameMetadata;
}

export interface CreateItemRequest {
  creatorId: string;
  gameId: string;
  item: ItemDefinition;
}

export interface UpdateGameRequest {
  creatorId: string;
  gameId: string;
  code?: string;
  metadata?: Partial<GameMetadata>;
}

// =============================================================================
// Contract ABI (simplified)
// =============================================================================

const MARKETPLACE_ABI = [
  'function registerGame(bytes32 gameId, address creator) external',
  'function createItem(bytes32 gameId, bytes32 itemId, uint256 price, uint256 maxSupply, uint256 duration) external',
  'function updateItemPrice(bytes32 gameId, bytes32 itemId, uint256 newPrice) external',
  'function deactivateItem(bytes32 gameId, bytes32 itemId) external',
];

// =============================================================================
// Game Publishing Service
// =============================================================================

export class GamePublishingService {
  private store: GameStore;
  private provider?: ethers.Provider;
  private marketplaceAddress?: string;

  constructor(config: PublishingConfig) {
    this.store = config.store;
    this.provider = config.provider;
    this.marketplaceAddress = config.marketplaceAddress;
  }

  // ===================
  // Game Publishing
  // ===================

  /**
   * Publish a new game to the marketplace
   */
  async publishGame(request: PublishGameRequest): Promise<PublishResult> {
    const { creatorId, creatorAddress, code, metadata } = request;

    try {
      // Validate metadata
      const metadataValidation = this.validateMetadata(metadata);
      if (!metadataValidation.valid) {
        return {
          success: false,
          error: metadataValidation.reason,
        };
      }

      // In production, would compile code to WASM using game-builder
      // const builder = new GameBuilder();
      // const buildResult = await builder.build(code, metadata.name);
      // if (!buildResult.success) {
      //   return { success: false, error: buildResult.errors?.join(', ') };
      // }

      // Generate game ID
      const gameId = this.generateGameId(metadata.name, creatorId);

      // Generate WASM hash (placeholder)
      const wasmHash = this.hashCode(code);

      // Create stored game
      const game: StoredGame = {
        gameId,
        name: metadata.name,
        description: metadata.description,
        shortDescription: metadata.shortDescription,
        thumbnail: metadata.thumbnail,
        screenshots: metadata.screenshots || [],
        category: metadata.category,
        tags: metadata.tags || [],
        creatorBotId: creatorId,
        wasmHash,
        wasmBundle: Buffer.from(code).toString('base64'), // In production, this would be compiled WASM
        version: '1.0.0',
        status: 'active',
        averageRating: 0,
        totalRatings: 0,
        totalPlays: 0,
        uniquePlayers: 0,
        totalRevenue: '0',
        publishedAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save to store
      await this.store.saveGame(game);

      // Register on blockchain (if configured)
      if (this.provider && this.marketplaceAddress) {
        // In production, would call smart contract
        // await this.registerGameOnChain(gameId, creatorAddress);
      }

      return {
        success: true,
        gameId,
        wasmHash,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Update an existing game
   */
  async updateGame(request: UpdateGameRequest): Promise<{ success: boolean; error?: string }> {
    const { creatorId, gameId, code, metadata } = request;

    try {
      // Get existing game
      const game = await this.store.getGame(gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      // Verify ownership
      if (game.creatorBotId !== creatorId) {
        return { success: false, error: 'Not authorized to update this game' };
      }

      // Prepare updates
      const updates: Partial<StoredGame> = {
        updatedAt: Date.now(),
      };

      // Update code if provided
      if (code) {
        // In production, would recompile to WASM
        updates.wasmBundle = Buffer.from(code).toString('base64');
        updates.wasmHash = this.hashCode(code);

        // Increment version
        const [major, minor, patch] = game.version.split('.').map(Number);
        updates.version = `${major}.${minor}.${patch + 1}`;
      }

      // Update metadata if provided
      if (metadata) {
        if (metadata.name) updates.name = metadata.name;
        if (metadata.description) updates.description = metadata.description;
        if (metadata.shortDescription) updates.shortDescription = metadata.shortDescription;
        if (metadata.thumbnail) updates.thumbnail = metadata.thumbnail;
        if (metadata.screenshots) updates.screenshots = metadata.screenshots;
        if (metadata.category) updates.category = metadata.category;
        if (metadata.tags) updates.tags = metadata.tags;
      }

      await this.store.updateGame(gameId, updates);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Deactivate a game (stop it from being discovered)
   */
  async deactivateGame(
    creatorId: string,
    gameId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const game = await this.store.getGame(gameId);
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    if (game.creatorBotId !== creatorId) {
      return { success: false, error: 'Not authorized' };
    }

    await this.store.updateGame(gameId, { status: 'inactive' });

    return { success: true };
  }

  // ===================
  // Item Management
  // ===================

  /**
   * Create a new item for a game
   */
  async createItem(request: CreateItemRequest): Promise<ItemResult> {
    const { creatorId, gameId, item } = request;

    try {
      // Get game
      const game = await this.store.getGame(gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      // Verify ownership
      if (game.creatorBotId !== creatorId) {
        return { success: false, error: 'Not authorized to create items for this game' };
      }

      // Validate item
      const validation = this.validateItem(item);
      if (!validation.valid) {
        return { success: false, error: validation.reason };
      }

      // Generate item ID
      const itemId = this.generateItemId(gameId, item.name);

      // Create item record
      const gameItem = {
        itemId,
        gameId,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        category: item.category,
        price: item.price,
        maxSupply: item.maxSupply,
        soldCount: 0,
        duration: item.duration,
        properties: item.properties || {},
        active: true,
        createdAt: Date.now(),
      };

      // Save to store
      await this.store.saveItem(gameItem);

      // Register on blockchain (if configured)
      if (this.provider && this.marketplaceAddress) {
        // In production, would call smart contract
        // await this.createItemOnChain(gameId, itemId, item);
      }

      return {
        success: true,
        itemId,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update item price
   */
  async updateItemPrice(
    creatorId: string,
    gameId: string,
    itemId: string,
    newPrice: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Verify ownership
    const game = await this.store.getGame(gameId);
    if (!game || game.creatorBotId !== creatorId) {
      return { success: false, error: 'Not authorized' };
    }

    // Validate price
    try {
      const price = BigInt(newPrice);
      if (price <= 0n) {
        return { success: false, error: 'Price must be positive' };
      }
    } catch {
      return { success: false, error: 'Invalid price format' };
    }

    await this.store.updateItem(itemId, { price: newPrice });

    return { success: true };
  }

  /**
   * Deactivate an item (stop sales)
   */
  async deactivateItem(
    creatorId: string,
    gameId: string,
    itemId: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Verify ownership
    const game = await this.store.getGame(gameId);
    if (!game || game.creatorBotId !== creatorId) {
      return { success: false, error: 'Not authorized' };
    }

    await this.store.updateItem(itemId, { active: false });

    return { success: true };
  }

  /**
   * Get all items for a game
   */
  async getGameItems(gameId: string): Promise<unknown[]> {
    return this.store.getItemsByGame(gameId);
  }

  // ===================
  // Validation
  // ===================

  private validateMetadata(metadata: GameMetadata): { valid: boolean; reason?: string } {
    if (!metadata.name || metadata.name.length < 3) {
      return { valid: false, reason: 'Name must be at least 3 characters' };
    }

    if (metadata.name.length > 50) {
      return { valid: false, reason: 'Name must be at most 50 characters' };
    }

    if (!metadata.description || metadata.description.length < 20) {
      return { valid: false, reason: 'Description must be at least 20 characters' };
    }

    if (!metadata.shortDescription || metadata.shortDescription.length < 10) {
      return { valid: false, reason: 'Short description must be at least 10 characters' };
    }

    if (metadata.shortDescription.length > 100) {
      return { valid: false, reason: 'Short description must be at most 100 characters' };
    }

    if (!metadata.thumbnail) {
      return { valid: false, reason: 'Thumbnail is required' };
    }

    const validCategories: GameCategory[] = [
      'arcade',
      'puzzle',
      'multiplayer',
      'casual',
      'competitive',
      'strategy',
      'action',
      'rpg',
      'simulation',
      'sports',
      'card',
      'board',
      'other',
    ];

    if (!validCategories.includes(metadata.category)) {
      return {
        valid: false,
        reason: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      };
    }

    if (metadata.tags && metadata.tags.length > 10) {
      return { valid: false, reason: 'Maximum 10 tags allowed' };
    }

    return { valid: true };
  }

  private validateItem(item: ItemDefinition): { valid: boolean; reason?: string } {
    if (!item.name || item.name.length < 2) {
      return { valid: false, reason: 'Item name must be at least 2 characters' };
    }

    if (!item.description || item.description.length < 10) {
      return { valid: false, reason: 'Item description must be at least 10 characters' };
    }

    const validCategories: ItemCategory[] = [
      'cosmetic',
      'power_up',
      'access',
      'consumable',
      'subscription',
    ];

    if (!validCategories.includes(item.category)) {
      return {
        valid: false,
        reason: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      };
    }

    // Validate price
    try {
      const price = BigInt(item.price);
      if (price <= 0n) {
        return { valid: false, reason: 'Price must be positive' };
      }
    } catch {
      return { valid: false, reason: 'Invalid price format (must be wei string)' };
    }

    // Validate max supply if specified
    if (item.maxSupply !== undefined && item.maxSupply < 1) {
      return { valid: false, reason: 'Max supply must be at least 1' };
    }

    // Validate duration for subscriptions
    if (item.category === 'subscription' && !item.duration) {
      return { valid: false, reason: 'Subscription items must have a duration' };
    }

    return { valid: true };
  }

  // ===================
  // Helpers
  // ===================

  private generateGameId(name: string, creatorId: string): string {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${normalized}_${timestamp}_${random}`;
  }

  private generateItemId(gameId: string, name: string): string {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const random = Math.random().toString(36).substring(2, 8);
    return `${gameId}_item_${normalized}_${random}`;
  }

  private hashCode(code: string): string {
    // Simple hash for demo - in production use proper crypto hash
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

// =============================================================================
// Export
// =============================================================================

export default GamePublishingService;
