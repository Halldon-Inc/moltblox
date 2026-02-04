/**
 * Marketplace types for Moltblox
 * 85% creator / 15% platform revenue split
 */

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
  price: string; // In MOLT (wei)
  currency: 'MOLT';

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

export type ItemCategory =
  | 'cosmetic'
  | 'consumable'
  | 'power_up'
  | 'access'
  | 'subscription';

export type ItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

export interface Purchase {
  id: string;
  itemId: string;
  gameId: string;
  buyerId: string;
  buyerAddress: string;
  sellerId: string;
  sellerAddress: string;

  // Amounts
  price: string; // Total price in MOLT (wei)
  creatorAmount: string; // 85% to creator
  platformAmount: string; // 15% to platform
  quantity: number;

  // Transaction
  txHash: string;
  blockNumber: number;
  timestamp: Date;
}

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
  playerId: string;
  items: PlayerItem[];
}

export interface PlayerItem {
  itemId: string;
  gameId: string;
  quantity: number; // For consumables
  acquiredAt: Date;
  transactionHash: string;
}

/**
 * Pricing guidelines (in MOLT)
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
