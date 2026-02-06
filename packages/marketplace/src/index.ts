/**
 * @moltblox/marketplace
 *
 * Moltblox game marketplace services.
 * Handles discovery, purchases, and game publishing.
 */

// =============================================================================
// Store
// =============================================================================

export { GameStore, type GameStoreConfig, type StoredGame } from './store/GameStore.js';

// =============================================================================
// Services
// =============================================================================

export {
  DiscoveryService,
  type DiscoveryConfig,
  type TrendingWeights,
  type SearchFilters,
  type DiscoveryResult,
} from './services/DiscoveryService.js';

export {
  PurchaseService,
  type PurchaseConfig,
  type PurchaseRequest,
  type PayoutInfo,
} from './services/PurchaseService.js';

export {
  GamePublishingService,
  type PublishingConfig,
  type PublishGameRequest,
  type CreateItemRequest,
  type UpdateGameRequest,
} from './services/GamePublishingService.js';

// =============================================================================
// Marketplace Manager (Convenience wrapper)
// =============================================================================

import Redis from 'ioredis';
import { ethers } from 'ethers';
import { GameStore } from './store/GameStore.js';
import { DiscoveryService } from './services/DiscoveryService.js';
import { PurchaseService } from './services/PurchaseService.js';
import { GamePublishingService } from './services/GamePublishingService.js';

export interface MarketplaceConfig {
  /** Redis connection URL or instance */
  redis: Redis | string;

  /** Key prefix for Redis */
  keyPrefix?: string;

  /** Ethereum RPC provider URL */
  rpcUrl?: string;

  /** GameMarketplace contract address */
  marketplaceAddress?: string;

  /** MBUCKS token contract address */
  moltTokenAddress?: string;

  /** Trending score refresh interval (ms) */
  trendingRefreshInterval?: number;
}

/**
 * Marketplace Manager
 *
 * Central access point for all marketplace functionality.
 */
export class MarketplaceManager {
  public readonly store: GameStore;
  public readonly discovery: DiscoveryService;
  public readonly purchases: PurchaseService;
  public readonly publishing: GamePublishingService;

  private redis: Redis;
  private provider?: ethers.Provider;

  constructor(config: MarketplaceConfig) {
    // Setup Redis
    this.redis = typeof config.redis === 'string' ? new Redis(config.redis) : config.redis;

    // Setup Ethereum provider
    if (config.rpcUrl) {
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    }

    // Initialize store
    this.store = new GameStore({
      redis: this.redis,
      keyPrefix: config.keyPrefix || 'moltblox:',
    });

    // Initialize discovery service
    this.discovery = new DiscoveryService({
      store: this.store,
      trendingRefreshInterval: config.trendingRefreshInterval || 60000, // 1 minute
    });

    // Initialize purchase service
    this.purchases = new PurchaseService({
      store: this.store,
      provider: this.provider!,
      marketplaceAddress: config.marketplaceAddress || '',
      moltTokenAddress: config.moltTokenAddress || '',
    });

    // Initialize publishing service
    this.publishing = new GamePublishingService({
      store: this.store,
      provider: this.provider,
      marketplaceAddress: config.marketplaceAddress,
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.discovery.stopTrendingRefresh();
    await this.redis.quit();
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default MarketplaceManager;
