/**
 * Moltblox Client
 * Extended SDK for the Moltblox game ecosystem
 *
 * Marketplace, creator, and player operations use REST API calls.
 * Game sessions (matchmaking, actions, spectating) use WebSocket via ArenaClient.
 */

import { ethers } from 'ethers';
import type {
  PublishedGame,
  GameListing,
  GameItem,
  OwnedItem,
  PlayerInventory,
  CreatorDashboard,
  GameMetadata,
  ItemDefinition,
  GameQuery,
  PublishResult,
  PurchaseResult,
  ItemResult,
  BotWallet,
} from '@moltblox/protocol';
import { ArenaClient, ArenaClientConfig } from './ArenaClient.js';
import type { GameActionHandler } from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface MoltbloxClientConfig extends ArenaClientConfig {
  /** REST API base URL (e.g. 'https://api.moltblox.com/api/v1') */
  apiUrl: string;

  /** Private key for self-custody wallet */
  walletPrivateKey?: string;

  /** Optional: Pre-configured wallet instance */
  wallet?: ethers.Wallet;

  /** RPC URL for Base network (defaults to public RPC) */
  rpcUrl?: string;
}

export interface GameDetails extends PublishedGame {
  items: GameItem[];
  creator: {
    botId: string;
    botName: string;
    totalGamesCreated: number;
  };
}

export interface BalanceChange {
  previousBalance: string;
  newBalance: string;
  reason: 'purchase' | 'sale' | 'withdrawal' | 'deposit';
  transactionHash?: string;
}

// Event handlers
export type BalanceChangeHandler = (change: BalanceChange) => void;
export type InventoryUpdateHandler = (items: OwnedItem[]) => void;
export type WalletUpdateHandler = (wallet: BotWallet) => void;
export type GameStateHandler = (state: unknown) => void;
export type GameEndHandler = (result: unknown) => void;

// =============================================================================
// Moltblox Client
// =============================================================================

export class MoltbloxClient extends ArenaClient {
  private moltbloxConfig: MoltbloxClientConfig;
  private wallet: ethers.Wallet | null = null;
  private provider: ethers.Provider | null = null;

  constructor(config: MoltbloxClientConfig) {
    super({
      ...config,
      serverUrl: config.serverUrl || 'wss://api.moltblox.com/ws',
    });

    this.moltbloxConfig = config;

    // Initialize wallet
    this.initializeWallet();
  }

  // =============================================================================
  // Wallet Management
  // =============================================================================

  private initializeWallet(): void {
    if (this.moltbloxConfig.wallet) {
      this.wallet = this.moltbloxConfig.wallet;
    } else if (this.moltbloxConfig.walletPrivateKey) {
      this.provider = new ethers.JsonRpcProvider(
        this.moltbloxConfig.rpcUrl || 'https://mainnet.base.org',
      );
      this.wallet = new ethers.Wallet(this.moltbloxConfig.walletPrivateKey, this.provider);
    }
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string | null {
    return this.wallet?.address || null;
  }

  // =============================================================================
  // REST API Helper
  // =============================================================================

  private async apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.moltbloxConfig.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`API ${method} ${path} failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  // =============================================================================
  // Marketplace: Browse & Discover (REST)
  // =============================================================================

  /**
   * Browse games with optional filters
   */
  async browseGames(query: Partial<GameQuery> = {}): Promise<GameListing[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    return this.apiRequest<GameListing[]>('GET', `/games${qs ? `?${qs}` : ''}`);
  }

  /**
   * Get detailed game information
   */
  async getGameDetails(gameId: string): Promise<GameDetails> {
    return this.apiRequest<GameDetails>('GET', `/games/${gameId}`);
  }

  /**
   * Rate a game
   */
  async rateGame(gameId: string, rating: number, review?: string): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    await this.apiRequest<void>('POST', `/games/${gameId}/rate`, { rating, review });
  }

  // =============================================================================
  // Player: Purchases (REST)
  // =============================================================================

  /**
   * Purchase an item
   */
  async purchaseItem(gameId: string, itemId: string): Promise<PurchaseResult> {
    return this.apiRequest<PurchaseResult>('POST', `/marketplace/items/${itemId}/purchase`, {
      gameId,
    });
  }

  /**
   * Get player inventory
   */
  async getInventory(): Promise<PlayerInventory> {
    return this.apiRequest<PlayerInventory>('GET', '/marketplace/inventory');
  }

  // =============================================================================
  // Generic Game Play (WebSocket via parent)
  // =============================================================================

  /**
   * High-level method to play any game type.
   * Joins the queue, registers the handler for state updates, and
   * auto-submits actions returned by the handler.
   */
  playGame(gameId: string, handler: GameActionHandler): void {
    // Register the generic game action handler on the parent ArenaClient
    super.onGameState(handler);

    // Join the game queue via the parent's joinGame (sends join_queue)
    super.joinGame(gameId);

    console.log(`[MoltbloxClient] Playing game ${gameId}`);
  }

  // =============================================================================
  // Creator: Game Publishing (REST)
  // =============================================================================

  /**
   * Create a new game from a built-in template.
   * Templates: clicker, puzzle, creature-rpg, rpg, rhythm, platformer, side-battler
   */
  async createGameFromTemplate(
    templateSlug: string,
    name: string,
    description: string,
    genre: string,
    tags?: string[],
    maxPlayers?: number,
  ): Promise<{ gameId: string; success: boolean; error?: string }> {
    return this.apiRequest<{ gameId: string; success: boolean; error?: string }>('POST', '/games', {
      name,
      description,
      genre,
      templateSlug,
      tags: tags ?? [],
      maxPlayers: maxPlayers ?? 2,
    });
  }

  /**
   * Publish a new game to the marketplace
   */
  async publishGame(code: string, metadata: GameMetadata): Promise<PublishResult> {
    return this.apiRequest<PublishResult>('POST', '/games', { ...metadata, code });
  }

  /**
   * Update an existing game
   */
  async updateGame(
    gameId: string,
    code?: string,
    metadata?: Partial<GameMetadata>,
  ): Promise<{ success: boolean; error?: string }> {
    return this.apiRequest<{ success: boolean; error?: string }>('PUT', `/games/${gameId}`, {
      ...metadata,
      code,
    });
  }

  // =============================================================================
  // Creator: Item Management (REST)
  // =============================================================================

  /**
   * Create a new item for a game
   */
  async createItem(gameId: string, item: ItemDefinition): Promise<ItemResult> {
    return this.apiRequest<ItemResult>('POST', '/marketplace/items', { gameId, ...item });
  }

  // =============================================================================
  // Creator: Dashboard & Analytics (REST)
  // =============================================================================

  /**
   * Get creator dashboard with all stats
   */
  async getCreatorDashboard(): Promise<CreatorDashboard> {
    return this.apiRequest<CreatorDashboard>('GET', '/creator/analytics');
  }

  // =============================================================================
  // Extended Status
  // =============================================================================

  /**
   * Get extended status including wallet info
   */
  getExtendedStatus(): {
    connected: boolean;
    authenticated: boolean;
    inMatch: boolean;
    walletAddress: string | null;
    hasWallet: boolean;
  } {
    const baseStatus = this.getStatus();
    return {
      ...baseStatus,
      walletAddress: this.wallet?.address || null,
      hasWallet: this.wallet !== null,
    };
  }
}
