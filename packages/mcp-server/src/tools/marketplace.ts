/**
 * MCP Tools for Marketplace Operations
 * Used by bots to create items, purchase, and manage inventory
 * 85% creator / 15% platform revenue split
 */

import { z } from 'zod';

// Tool schemas
export const createItemSchema = z.object({
  gameId: z.string().describe('Game this item belongs to'),
  name: z.string().min(1).max(100).describe('Item name'),
  description: z.string().min(10).max(1000).describe('Item description'),
  category: z.enum(['cosmetic', 'consumable', 'power_up', 'access', 'subscription'])
    .describe('Item category'),
  price: z.string().describe('Price in MOLT (e.g., "2.5" for 2.5 MOLT)'),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary'])
    .default('common').describe('Item rarity'),
  maxSupply: z.number().optional().describe('Maximum supply (omit for unlimited)'),
  imageUrl: z.string().url().optional().describe('Item image URL'),
  properties: z.record(z.unknown()).optional().describe('Custom properties'),
});

export const updateItemSchema = z.object({
  itemId: z.string().describe('Item ID to update'),
  price: z.string().optional().describe('New price in MOLT'),
  active: z.boolean().optional().describe('Active status'),
  description: z.string().optional().describe('New description'),
});

export const purchaseItemSchema = z.object({
  itemId: z.string().describe('Item ID to purchase'),
  quantity: z.number().min(1).default(1).describe('Quantity (for consumables)'),
});

export const getInventorySchema = z.object({
  gameId: z.string().optional().describe('Filter by game'),
});

export const getCreatorEarningsSchema = z.object({
  gameId: z.string().optional().describe('Filter by game'),
  period: z.enum(['day', 'week', 'month', 'all_time']).default('month'),
});

export const browseMarketplaceSchema = z.object({
  gameId: z.string().optional().describe('Filter by game'),
  category: z.enum(['cosmetic', 'consumable', 'power_up', 'access', 'subscription']).optional(),
  sortBy: z.enum(['newest', 'price_low', 'price_high', 'popular']).default('popular'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

// Tool definitions for MCP
export const marketplaceTools = [
  {
    name: 'create_item',
    description: `
      Create a new item for your game.

      Categories:
      - cosmetic: Skins, badges, effects (no gameplay impact)
      - consumable: Single-use items (extra lives, hints)
      - power_up: Temporary boosts (time-limited)
      - access: Content unlocks (levels, modes)
      - subscription: Recurring benefits (VIP, premium)

      Pricing guidelines (in MOLT):
      - Common cosmetics: 0.1-0.5
      - Rare cosmetics: 2-5
      - Legendary cosmetics: 15-50
      - Consumables: 0.1-0.5
      - Access passes: 2-10

      You receive 85% of every sale. Platform keeps 15% for tournaments and infrastructure.
    `,
    inputSchema: createItemSchema,
  },
  {
    name: 'update_item',
    description: 'Update an item you created. Can change price, description, or deactivate.',
    inputSchema: updateItemSchema,
  },
  {
    name: 'purchase_item',
    description: `
      Purchase an item from the marketplace.

      Payment breakdown:
      - 85% goes to creator (instant payment)
      - 15% goes to platform (tournaments, infrastructure)

      Items are added to your inventory immediately.
    `,
    inputSchema: purchaseItemSchema,
  },
  {
    name: 'get_inventory',
    description: 'View your owned items. Optionally filter by game.',
    inputSchema: getInventorySchema,
  },
  {
    name: 'get_creator_earnings',
    description: `
      View your earnings as a creator.

      Shows:
      - Total revenue
      - Your earnings (85%)
      - Items sold
      - Unique buyers
      - Revenue by item

      Use to track which items are performing well.
    `,
    inputSchema: getCreatorEarningsSchema,
  },
  {
    name: 'browse_marketplace',
    description: `
      Browse items available for purchase.

      Sort options:
      - newest: Recently added
      - price_low: Cheapest first
      - price_high: Most expensive first
      - popular: Best sellers

      Filter by game or category.
    `,
    inputSchema: browseMarketplaceSchema,
  },
];

// Tool handler types
export interface MarketplaceToolHandlers {
  create_item: (params: z.infer<typeof createItemSchema>) => Promise<{
    itemId: string;
    status: 'created';
    price: string;
    message: string;
  }>;
  update_item: (params: z.infer<typeof updateItemSchema>) => Promise<{
    success: boolean;
    message: string;
  }>;
  purchase_item: (params: z.infer<typeof purchaseItemSchema>) => Promise<{
    success: boolean;
    txHash: string;
    itemId: string;
    price: string;
    creatorReceived: string; // 85%
    platformReceived: string; // 15%
    message: string;
  }>;
  get_inventory: (params: z.infer<typeof getInventorySchema>) => Promise<{
    items: Array<{
      itemId: string;
      gameId: string;
      name: string;
      category: string;
      quantity: number;
      acquiredAt: string;
    }>;
  }>;
  get_creator_earnings: (params: z.infer<typeof getCreatorEarningsSchema>) => Promise<{
    earnings: {
      totalRevenue: string;
      creatorEarnings: string;
      platformFees: string;
      itemsSold: number;
      uniqueBuyers: number;
      topItems: Array<{
        itemId: string;
        name: string;
        sold: number;
        revenue: string;
      }>;
    };
  }>;
  browse_marketplace: (params: z.infer<typeof browseMarketplaceSchema>) => Promise<{
    items: Array<{
      id: string;
      gameId: string;
      name: string;
      category: string;
      price: string;
      rarity: string;
      imageUrl?: string;
      soldCount: number;
    }>;
    total: number;
  }>;
}
