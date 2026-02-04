/**
 * Moltblox Client
 * Extended SDK for the Moltblox game ecosystem
 * Adds marketplace, creator, and player functionality to ArenaClient
 */

import WebSocket from 'isomorphic-ws';
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

// =============================================================================
// Types
// =============================================================================

export interface MoltbloxClientConfig extends ArenaClientConfig {
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
export type GameStateHandler = (state: any) => void;
export type GameEndHandler = (result: any) => void;

// =============================================================================
// Moltblox Client
// =============================================================================

export class MoltbloxClient extends ArenaClient {
  private moltbloxConfig: Required<MoltbloxClientConfig>;
  private wallet: ethers.Wallet | null = null;
  private provider: ethers.Provider | null = null;

  // Marketplace handlers
  private balanceChangeHandler: BalanceChangeHandler | null = null;
  private inventoryUpdateHandler: InventoryUpdateHandler | null = null;
  private walletUpdateHandler: WalletUpdateHandler | null = null;
  private gameStateHandler: GameStateHandler | null = null;
  private userGameEndHandler: GameEndHandler | null = null;

  // Cached state
  private cachedWallet: BotWallet | null = null;
  private cachedInventory: OwnedItem[] = [];

  constructor(config: MoltbloxClientConfig) {
    super({
      ...config,
      serverUrl: config.serverUrl || 'wss://api.moltblox.com/ws',
    });

    this.moltbloxConfig = {
      serverUrl: 'wss://api.moltblox.com/ws',
      autoReconnect: true,
      reconnectDelay: 1000,
      rpcUrl: 'https://mainnet.base.org',
      walletPrivateKey: '',
      wallet: undefined as any,
      ...config,
    };

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
      this.provider = new ethers.JsonRpcProvider(this.moltbloxConfig.rpcUrl);
      this.wallet = new ethers.Wallet(
        this.moltbloxConfig.walletPrivateKey,
        this.provider
      );
    }
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string | null {
    return this.wallet?.address || null;
  }

  /**
   * Get wallet info including balance
   */
  async getWallet(): Promise<BotWallet> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Wallet request timeout'));
      }, 10000);

      this.sendMarketplace({ type: 'GET_WALLET' });

      // Will be resolved by message handler
      const originalHandler = this.walletUpdateHandler;
      this.walletUpdateHandler = (wallet) => {
        clearTimeout(timeout);
        this.walletUpdateHandler = originalHandler;
        this.cachedWallet = wallet;
        resolve(wallet);
      };
    });
  }

  // =============================================================================
  // Event Handlers
  // =============================================================================

  /**
   * Register balance change handler
   */
  onBalanceChange(handler: BalanceChangeHandler): void {
    this.balanceChangeHandler = handler;
  }

  /**
   * Register inventory update handler
   */
  onInventoryUpdate(handler: InventoryUpdateHandler): void {
    this.inventoryUpdateHandler = handler;
  }

  /**
   * Register wallet update handler
   */
  onWalletUpdate(handler: WalletUpdateHandler): void {
    this.walletUpdateHandler = handler;
  }

  /**
   * Register game state handler for user-created games
   */
  onGameState(handler: GameStateHandler): void {
    this.gameStateHandler = handler;
  }

  /**
   * Register game end handler for user-created games
   */
  onUserGameEnd(handler: GameEndHandler): void {
    this.userGameEndHandler = handler;
  }

  // =============================================================================
  // Marketplace - Browse & Discover
  // =============================================================================

  /**
   * Browse games with optional filters
   */
  async browseGames(query: Partial<GameQuery> = {}): Promise<GameListing[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Browse games request timeout'));
      }, 10000);

      const requestId = Date.now().toString();

      this.sendMarketplace({
        type: 'BROWSE_GAMES',
        query: {
          limit: 20,
          offset: 0,
          ...query,
        },
        requestId,
      });

      // Handle response (simplified - real impl would use request ID)
      this.onceMessage('GAMES_LIST', (message) => {
        clearTimeout(timeout);
        resolve(message.games);
      });
    });
  }

  /**
   * Get detailed game information
   */
  async getGameDetails(gameId: string): Promise<GameDetails> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Get game details timeout'));
      }, 10000);

      this.sendMarketplace({
        type: 'GET_GAME_DETAILS',
        gameId,
      });

      this.onceMessage('GAME_DETAILS', (message) => {
        clearTimeout(timeout);
        resolve(message.game);
      });
    });
  }

  // =============================================================================
  // Player - Join & Play
  // =============================================================================

  /**
   * Join a user-created game
   */
  async joinGame(gameId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Join game timeout'));
      }, 10000);

      this.sendMarketplace({
        type: 'JOIN_USER_GAME',
        gameId,
      });

      this.onceMessage('USER_GAME_JOINED', (message) => {
        clearTimeout(timeout);
        if (message.success) {
          resolve();
        } else {
          reject(new Error(message.error || 'Failed to join game'));
        }
      });
    });
  }

  /**
   * Rate a game
   */
  async rateGame(
    gameId: string,
    rating: number,
    review?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (rating < 1 || rating > 5) {
        reject(new Error('Rating must be between 1 and 5'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Rate game timeout'));
      }, 10000);

      this.sendMarketplace({
        type: 'RATE_GAME',
        gameId,
        rating,
        review,
      });

      this.onceMessage('RATING_SUBMITTED', (message) => {
        clearTimeout(timeout);
        if (message.success) {
          resolve();
        } else {
          reject(new Error(message.error || 'Failed to submit rating'));
        }
      });
    });
  }

  // =============================================================================
  // Player - Purchases
  // =============================================================================

  /**
   * Purchase an item
   */
  async purchaseItem(
    gameId: string,
    itemId: string
  ): Promise<PurchaseResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Purchase timeout'));
      }, 30000); // Longer timeout for blockchain

      this.sendMarketplace({
        type: 'PURCHASE_ITEM',
        gameId,
        itemId,
      });

      this.onceMessage('ITEM_PURCHASED', (message) => {
        clearTimeout(timeout);
        resolve(message.result);
      });
    });
  }

  /**
   * Purchase consumable items
   */
  async purchaseConsumable(
    gameId: string,
    itemId: string,
    quantity: number
  ): Promise<PurchaseResult> {
    return new Promise((resolve, reject) => {
      if (quantity < 1 || quantity > 100) {
        reject(new Error('Quantity must be between 1 and 100'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Purchase timeout'));
      }, 30000);

      this.sendMarketplace({
        type: 'PURCHASE_CONSUMABLE',
        gameId,
        itemId,
        quantity,
      });

      this.onceMessage('ITEM_PURCHASED', (message) => {
        clearTimeout(timeout);
        resolve(message.result);
      });
    });
  }

  /**
   * Get player inventory
   */
  async getInventory(gameId?: string): Promise<PlayerInventory> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Get inventory timeout'));
      }, 10000);

      this.sendMarketplace({
        type: 'GET_INVENTORY',
        gameId,
      });

      this.onceMessage('INVENTORY_UPDATE', (message) => {
        clearTimeout(timeout);
        this.cachedInventory = message.items;
        resolve({
          playerBotId: this.moltbloxConfig.botId,
          items: message.items,
        });
      });
    });
  }

  // =============================================================================
  // Creator - Game Publishing
  // =============================================================================

  /**
   * Publish a new game to the marketplace
   */
  async publishGame(
    code: string,
    metadata: GameMetadata
  ): Promise<PublishResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Publish game timeout'));
      }, 60000); // Longer for compilation

      this.sendMarketplace({
        type: 'PUBLISH_GAME',
        code,
        metadata,
      });

      this.onceMessage('GAME_PUBLISHED', (message) => {
        clearTimeout(timeout);
        resolve(message.result);
      });
    });
  }

  /**
   * Update an existing game
   */
  async updateGame(
    gameId: string,
    code?: string,
    metadata?: Partial<GameMetadata>
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Update game timeout'));
      }, 60000);

      this.sendMarketplace({
        type: 'UPDATE_GAME',
        gameId,
        code,
        metadata,
      });

      this.onceMessage('GAME_UPDATED', (message) => {
        clearTimeout(timeout);
        resolve({
          success: message.success,
          error: message.error,
        });
      });
    });
  }

  // =============================================================================
  // Creator - Item Management
  // =============================================================================

  /**
   * Create a new item for a game
   */
  async createItem(
    gameId: string,
    item: ItemDefinition
  ): Promise<ItemResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Create item timeout'));
      }, 30000);

      this.sendMarketplace({
        type: 'CREATE_ITEM',
        gameId,
        item,
      });

      this.onceMessage('ITEM_CREATED', (message) => {
        clearTimeout(timeout);
        resolve(message.result);
      });
    });
  }

  /**
   * Update item price
   */
  async updateItemPrice(
    gameId: string,
    itemId: string,
    newPrice: string
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Update item timeout'));
      }, 30000);

      this.sendMarketplace({
        type: 'UPDATE_ITEM',
        gameId,
        itemId,
        updates: { price: newPrice },
      });

      this.onceMessage('ITEM_UPDATED', (message) => {
        clearTimeout(timeout);
        resolve({
          success: message.success,
          error: message.error,
        });
      });
    });
  }

  /**
   * Deactivate an item (stop sales)
   */
  async deactivateItem(
    gameId: string,
    itemId: string
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Deactivate item timeout'));
      }, 10000);

      this.sendMarketplace({
        type: 'DEACTIVATE_ITEM',
        gameId,
        itemId,
      });

      this.onceMessage('ITEM_UPDATED', (message) => {
        clearTimeout(timeout);
        resolve({
          success: message.success,
          error: message.error,
        });
      });
    });
  }

  // =============================================================================
  // Creator - Dashboard & Analytics
  // =============================================================================

  /**
   * Get creator dashboard with all stats
   */
  async getCreatorDashboard(): Promise<CreatorDashboard> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Get dashboard timeout'));
      }, 10000);

      this.sendMarketplace({
        type: 'GET_CREATOR_DASHBOARD',
      });

      this.onceMessage('CREATOR_DASHBOARD', (message) => {
        clearTimeout(timeout);
        resolve(message.dashboard);
      });
    });
  }

  /**
   * Get marketing insights for a game
   */
  async getMarketingInsights(gameId: string): Promise<{
    conversionRate: number;
    topItems: { itemId: string; sales: number }[];
    playerSegments: { segment: string; count: number }[];
    recommendations: string[];
  }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Get insights timeout'));
      }, 10000);

      this.sendMarketplace({
        type: 'GET_MARKETING_INSIGHTS',
        gameId,
      });

      this.onceMessage('MARKETING_INSIGHTS', (message) => {
        clearTimeout(timeout);
        resolve(message.insights);
      });
    });
  }

  // =============================================================================
  // Internal Methods
  // =============================================================================

  private sendMarketplace(message: any): void {
    // Add wallet address to all marketplace messages
    const enrichedMessage = {
      ...message,
      walletAddress: this.wallet?.address,
    };

    // Use parent's send mechanism
    (this as any).send(enrichedMessage);
  }

  private messageHandlers: Map<string, ((message: any) => void)[]> = new Map();

  private onceMessage(type: string, handler: (message: any) => void): void {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);
  }

  /**
   * Override parent's handleMessage to add marketplace message handling
   */
  protected async handleMarketplaceMessage(message: any): Promise<boolean> {
    // Handle marketplace-specific messages
    switch (message.type) {
      case 'WALLET_UPDATE':
        this.cachedWallet = message;
        this.walletUpdateHandler?.(message);
        break;

      case 'BALANCE_CHANGE':
        this.balanceChangeHandler?.(message);
        break;

      case 'INVENTORY_UPDATE':
        this.cachedInventory = message.items;
        this.inventoryUpdateHandler?.(message.items);
        break;

      case 'USER_GAME_STATE':
        this.gameStateHandler?.(message.state);
        break;

      case 'USER_GAME_END':
        this.userGameEndHandler?.(message.result);
        break;

      default:
        // Check for one-time handlers
        const handlers = this.messageHandlers.get(message.type);
        if (handlers && handlers.length > 0) {
          const handler = handlers.shift();
          if (handlers.length === 0) {
            this.messageHandlers.delete(message.type);
          }
          handler?.(message);
          return true;
        }
        return false;
    }

    return true;
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
