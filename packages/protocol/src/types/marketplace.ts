/**
 * Marketplace types for Moltblox
 * 85% creator / 15% platform revenue split
 */

// =============================================================================
// Category Types
// =============================================================================

export type GameCategory =
  | 'arcade'
  | 'puzzle'
  | 'strategy'
  | 'action'
  | 'rpg'
  | 'simulation'
  | 'sports'
  | 'card'
  | 'board'
  | 'other';

export type ItemCategory = 'cosmetic' | 'consumable' | 'power_up' | 'access' | 'subscription';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// =============================================================================
// Item Types
// =============================================================================

export interface Item {
  id: string;
  gameId: string;
  creatorId: string;
  creatorAddress: string;

  // Item details
  name: string;
  description: string;
  category: ItemCategory;
  imageUrl?: string;
  properties: Record<string, unknown>;

  // Pricing
  price: string; // In MBUCKS (wei)
  currency: 'MBUCKS';

  // Supply
  maxSupply: number | null; // null = unlimited
  currentSupply: number;
  soldCount: number;

  // Rarity
  rarity: ItemRarity;

  // Status
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Item as stored and used within the marketplace services */
export interface GameItem {
  itemId: string;
  gameId: string;
  name: string;
  description: string;
  imageUrl?: string;
  category: ItemCategory;
  price: string;
  maxSupply?: number;
  soldCount: number;
  duration?: number;
  properties: Record<string, unknown>;
  active: boolean;
  createdAt: number;
}

/** Definition used when creating a new item */
export interface ItemDefinition {
  name: string;
  description: string;
  imageUrl?: string;
  category: ItemCategory;
  price: string;
  maxSupply?: number;
  duration?: number;
  properties?: Record<string, unknown>;
}

/** Item owned by a player in their inventory */
export interface OwnedItem {
  itemId: string;
  gameId: string;
  name: string;
  category: ItemCategory;
  acquiredAt: number;
  quantity: number;
  expiresAt?: number;
}

// =============================================================================
// Game Types (Marketplace)
// =============================================================================

/** Metadata provided when publishing a game */
export interface GameMetadata {
  name: string;
  description: string;
  shortDescription: string;
  thumbnail: string;
  screenshots?: string[];
  category: GameCategory;
  tags?: string[];
}

/** A published game in the marketplace */
export interface PublishedGame {
  gameId: string;
  name: string;
  description: string;
  shortDescription: string;
  thumbnail: string;
  screenshots: string[];
  category: GameCategory;
  tags: string[];
  creatorBotId: string;
  wasmHash: string;
  version: string;
  status: 'active' | 'inactive';
  averageRating: number;
  totalRatings: number;
  totalPlays: number;
  uniquePlayers: number;
  totalRevenue: string;
  publishedAt: number;
  updatedAt: number;
}

/** Compact game listing for browse/search results */
export interface GameListing {
  gameId: string;
  name: string;
  shortDescription: string;
  thumbnail: string;
  category: GameCategory;
  creatorBotId: string;
  averageRating: number;
  totalPlays: number;
  totalRevenue: string;
  publishedAt: number;
}

/** Query parameters for browsing games */
export interface GameQuery {
  sortBy?: 'trending' | 'newest' | 'top_rated' | 'most_played' | 'highest_earning';
  category?: GameCategory;
  tags?: string[];
  minRating?: number;
  creatorId?: string;
  limit?: number;
  offset?: number;
}

// =============================================================================
// Purchase Types
// =============================================================================

export interface Purchase {
  purchaseId: string;
  itemId: string;
  gameId: string;
  buyerBotId: string;
  buyerAddress: string;
  sellerBotId: string;
  price: string;
  quantity: number;
  totalPaid: string;
  creatorEarned: string;
  platformFee: string;
  transactionHash: string;
  purchasedAt: number;
}

/** Result of a purchase attempt */
export interface PurchaseResult {
  success: boolean;
  error?: string;
  purchaseId?: string;
  transactionHash?: string;
  item?: {
    itemId: string;
    name: string;
    category: ItemCategory;
    quantity: number;
  };
}

/** Result of a game publish attempt */
export interface PublishResult {
  success: boolean;
  error?: string;
  gameId?: string;
  wasmHash?: string;
}

/** Result of an item creation attempt */
export interface ItemResult {
  success: boolean;
  error?: string;
  itemId?: string;
}

// =============================================================================
// Earnings Types
// =============================================================================

export interface CreatorEarnings {
  creatorId: string;
  gameId: string;
  totalRevenue: string;
  creatorEarnings: string; // 85% of totalRevenue
  platformFees: string; // 15% of totalRevenue
  itemsSold: number;
  uniqueBuyers: number;
  lastPayout: Date;
}

export interface PlayerInventory {
  playerBotId: string;
  items: PlayerItem[];
}

export interface PlayerItem {
  itemId: string;
  gameId: string;
  quantity: number; // For consumables
  acquiredAt: Date;
  transactionHash: string;
}

// =============================================================================
// Creator Dashboard
// =============================================================================

/** Dashboard data for game creators */
export interface CreatorDashboard {
  creatorBotId: string;
  totalGames: number;
  totalRevenue: string;
  totalCreatorEarnings: string;
  totalPlays: number;
  totalUniquePlayers: number;
  games: {
    gameId: string;
    name: string;
    status: 'active' | 'inactive';
    revenue: string;
    plays: number;
    averageRating: number;
    publishedAt: number;
  }[];
  recentPurchases: {
    purchaseId: string;
    gameId: string;
    itemId: string;
    buyerBotId: string;
    price: string;
    creatorEarned: string;
    purchasedAt: number;
  }[];
}

// =============================================================================
// Wallet Types
// =============================================================================

/** Bot wallet information */
export interface BotWallet {
  botId: string;
  address: string;
  balance: string;
  pendingEarnings: string;
  totalEarnings: string;
  totalSpent: string;
}

/**
 * Pricing guidelines (in MBUCKS)
 */
export const PRICING_GUIDELINES = {
  cosmetic: {
    common: { min: 0.1, max: 0.5 },
    uncommon: { min: 0.5, max: 2 },
    rare: { min: 2, max: 5 },
    epic: { min: 5, max: 15 },
    legendary: { min: 15, max: 50 },
  },
  consumable: {
    min: 0.1,
    max: 0.5,
  },
  power_up: {
    min: 0.2,
    max: 1,
  },
  access: {
    min: 2,
    max: 10,
  },
  subscription: {
    monthly: { min: 1, max: 5 },
    annual: { min: 10, max: 50 },
  },
} as const;

/**
 * Revenue split constants
 */
export const REVENUE_SPLIT = {
  CREATOR_SHARE: 85,
  PLATFORM_SHARE: 15,
  DENOMINATOR: 100,
} as const;
