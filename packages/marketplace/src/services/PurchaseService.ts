/**
 * Purchase Service
 *
 * Handles item purchases, inventory management, and creator payouts.
 * Integrates with GameMarketplace smart contract for instant 85/15 split.
 */

import { ethers } from 'ethers';
import type {
  GameItem,
  OwnedItem,
  Purchase,
  PurchaseResult,
  ItemCategory,
} from '@moltblox/protocol';
import { GameStore, StoredGame } from '../store/GameStore';

// =============================================================================
// Types
// =============================================================================

export interface PurchaseConfig {
  store: GameStore;
  provider: ethers.Provider;
  marketplaceAddress: string;
  moltTokenAddress: string;
}

export interface PurchaseRequest {
  buyerId: string;
  buyerAddress: string;
  gameId: string;
  itemId: string;
  quantity?: number; // For consumables
}

export interface PayoutInfo {
  creatorAmount: string;
  platformFee: string;
  transactionHash: string;
}

// =============================================================================
// Contract ABIs (simplified)
// =============================================================================

const MARKETPLACE_ABI = [
  'function purchaseItem(bytes32 gameId, bytes32 itemId) external',
  'function purchaseConsumable(bytes32 gameId, bytes32 itemId, uint256 quantity) external',
  'function ownsItem(address player, bytes32 itemId) external view returns (bool)',
  'function subscriptionExpiry(address player, bytes32 itemId) external view returns (uint256)',
  'event ItemPurchased(bytes32 indexed gameId, bytes32 indexed itemId, address indexed buyer, address creator, uint256 price, uint256 creatorAmount, uint256 platformFee)',
];

const MOLT_TOKEN_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

// =============================================================================
// Constants
// =============================================================================

const PLATFORM_FEE_BPS = 1500; // 15%

// =============================================================================
// Purchase Service
// =============================================================================

export class PurchaseService {
  private store: GameStore;
  private provider: ethers.Provider;
  private marketplaceAddress: string;
  private moltTokenAddress: string;
  private marketplace: ethers.Contract;
  private moltToken: ethers.Contract;

  constructor(config: PurchaseConfig) {
    this.store = config.store;
    this.provider = config.provider;
    this.marketplaceAddress = config.marketplaceAddress;
    this.moltTokenAddress = config.moltTokenAddress;

    this.marketplace = new ethers.Contract(this.marketplaceAddress, MARKETPLACE_ABI, this.provider);

    this.moltToken = new ethers.Contract(this.moltTokenAddress, MOLT_TOKEN_ABI, this.provider);
  }

  // ===================
  // Purchase Flow
  // ===================

  /**
   * Process an item purchase
   */
  async purchaseItem(request: PurchaseRequest): Promise<PurchaseResult> {
    const { buyerId, buyerAddress, gameId, itemId, quantity = 1 } = request;

    // Get game and item
    const game = await this.store.getGame(gameId);
    if (!game) {
      return {
        success: false,
        error: 'Game not found',
      };
    }

    const item = await this.store.getItem(itemId);
    if (!item) {
      return {
        success: false,
        error: 'Item not found',
      };
    }

    // Validate purchase
    const validation = await this.validatePurchase(buyerAddress, game, item, quantity);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.reason,
      };
    }

    try {
      // Execute blockchain purchase
      const payout = await this.executeBlockchainPurchase(
        buyerAddress,
        gameId,
        itemId,
        item,
        quantity,
      );

      // Record purchase in database
      const purchase = await this.recordPurchase(
        buyerId,
        buyerAddress,
        game,
        item,
        quantity,
        payout,
      );

      // Add to inventory
      await this.addToInventory(buyerId, item, quantity);

      // Update statistics
      await this.updateStats(game, item, quantity);

      return {
        success: true,
        purchaseId: purchase.purchaseId,
        transactionHash: payout.transactionHash,
        item: {
          itemId: item.itemId,
          name: item.name,
          category: item.category,
          quantity,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Validate a purchase before execution
   */
  private async validatePurchase(
    buyerAddress: string,
    game: StoredGame,
    item: GameItem,
    quantity: number,
  ): Promise<{ valid: boolean; reason?: string }> {
    // Check game is active
    if (game.status !== 'active') {
      return { valid: false, reason: 'Game is not active' };
    }

    // Check item is active
    if (!item.active) {
      return { valid: false, reason: 'Item is not available for purchase' };
    }

    // Check supply for limited items
    if (item.maxSupply && item.soldCount >= item.maxSupply) {
      return { valid: false, reason: 'Item is sold out' };
    }

    // Check quantity for consumables
    if (item.category === 'consumable') {
      if (quantity < 1 || quantity > 100) {
        return { valid: false, reason: 'Invalid quantity (1-100)' };
      }
    } else if (quantity !== 1) {
      return { valid: false, reason: 'Non-consumable items can only be purchased one at a time' };
    }

    // Check if already owns (for non-consumables)
    if (item.category !== 'consumable' && item.category !== 'subscription') {
      const owns = await this.checkOwnership(buyerAddress, item.itemId);
      if (owns) {
        return { valid: false, reason: 'Already owns this item' };
      }
    }

    // Check buyer balance
    const balance = await this.getBalance(buyerAddress);
    const totalPrice = BigInt(item.price) * BigInt(quantity);
    if (BigInt(balance) < totalPrice) {
      return { valid: false, reason: 'Insufficient MBUCKS balance' };
    }

    return { valid: true };
  }

  /**
   * Execute the blockchain transaction
   */
  private async executeBlockchainPurchase(
    buyerAddress: string,
    gameId: string,
    itemId: string,
    item: GameItem,
    quantity: number,
  ): Promise<PayoutInfo> {
    // In production, this would:
    // 1. Create a signer from the buyer's wallet
    // 2. Approve the marketplace contract to spend MBUCKS
    // 3. Call purchaseItem or purchaseConsumable
    // 4. Wait for transaction confirmation
    // 5. Parse events for payout info

    // For now, return mock data
    const price = BigInt(item.price) * BigInt(quantity);
    const platformFee = (price * BigInt(PLATFORM_FEE_BPS)) / BigInt(10000);
    const creatorAmount = price - platformFee;

    return {
      creatorAmount: creatorAmount.toString(),
      platformFee: platformFee.toString(),
      transactionHash: `0x${Date.now().toString(16)}${'0'.repeat(48)}`,
    };
  }

  /**
   * Record purchase in database
   */
  private async recordPurchase(
    buyerId: string,
    buyerAddress: string,
    game: StoredGame,
    item: GameItem,
    quantity: number,
    payout: PayoutInfo,
  ): Promise<Purchase> {
    const purchase: Purchase = {
      purchaseId: `purchase_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      gameId: game.gameId,
      itemId: item.itemId,
      buyerBotId: buyerId,
      buyerAddress,
      sellerBotId: game.creatorBotId,
      price: item.price,
      quantity,
      totalPaid: (BigInt(item.price) * BigInt(quantity)).toString(),
      creatorEarned: payout.creatorAmount,
      platformFee: payout.platformFee,
      transactionHash: payout.transactionHash,
      purchasedAt: Date.now(),
    };

    await this.store.savePurchase(purchase);

    return purchase;
  }

  /**
   * Add purchased item to buyer's inventory
   */
  private async addToInventory(buyerId: string, item: GameItem, quantity: number): Promise<void> {
    const existingInventory = await this.store.getInventory(buyerId);
    const existingItem = existingInventory.find((i) => i.itemId === item.itemId);

    if (existingItem && item.category === 'consumable') {
      // Add to existing quantity
      await this.store.updateInventoryItem(buyerId, item.itemId, {
        quantity: existingItem.quantity + quantity,
      });
    } else {
      // Create new inventory entry
      const ownedItem: OwnedItem = {
        itemId: item.itemId,
        gameId: item.gameId,
        name: item.name,
        category: item.category,
        acquiredAt: Date.now(),
        quantity,
        expiresAt: item.duration ? Date.now() + item.duration * 1000 : undefined,
      };

      await this.store.addToInventory(buyerId, ownedItem);
    }
  }

  /**
   * Update game and item statistics
   */
  private async updateStats(game: StoredGame, item: GameItem, quantity: number): Promise<void> {
    // Update item sold count
    await this.store.updateItem(item.itemId, {
      soldCount: (item.soldCount || 0) + quantity,
    });

    // Update game total revenue
    const revenue = BigInt(item.price) * BigInt(quantity);
    const creatorRevenue = (revenue * BigInt(10000 - PLATFORM_FEE_BPS)) / BigInt(10000);

    await this.store.recordRevenue(game.gameId, game.creatorBotId, creatorRevenue.toString());

    // Update game stats
    await this.store.incrementGameStat(game.gameId, 'itemsSold', quantity);
  }

  // ===================
  // Inventory Management
  // ===================

  /**
   * Get player's inventory
   */
  async getInventory(playerId: string, gameId?: string): Promise<OwnedItem[]> {
    if (gameId) {
      return this.store.getInventoryForGame(playerId, gameId);
    }
    return this.store.getInventory(playerId);
  }

  /**
   * Check if player owns an item
   */
  async checkOwnership(playerAddress: string, itemId: string): Promise<boolean> {
    try {
      return await this.marketplace.ownsItem(playerAddress, ethers.encodeBytes32String(itemId));
    } catch {
      return false;
    }
  }

  /**
   * Check subscription status
   */
  async checkSubscription(
    playerAddress: string,
    itemId: string,
  ): Promise<{ active: boolean; expiresAt?: number }> {
    try {
      const expiry = await this.marketplace.subscriptionExpiry(
        playerAddress,
        ethers.encodeBytes32String(itemId),
      );

      const expiresAt = Number(expiry) * 1000;
      const active = expiresAt > Date.now();

      return { active, expiresAt: active ? expiresAt : undefined };
    } catch {
      return { active: false };
    }
  }

  /**
   * Use a consumable item
   */
  async useConsumable(
    playerId: string,
    itemId: string,
    quantity: number = 1,
  ): Promise<{ success: boolean; remaining?: number; error?: string }> {
    const inventory = await this.store.getInventory(playerId);
    const item = inventory.find((i) => i.itemId === itemId);

    if (!item) {
      return { success: false, error: 'Item not found in inventory' };
    }

    if (item.category !== 'consumable') {
      return { success: false, error: 'Item is not consumable' };
    }

    if (item.quantity < quantity) {
      return {
        success: false,
        error: `Insufficient quantity (have ${item.quantity}, need ${quantity})`,
      };
    }

    const remaining = item.quantity - quantity;

    if (remaining === 0) {
      // Remove from inventory entirely
      // In production, would delete the entry
      await this.store.updateInventoryItem(playerId, itemId, {
        quantity: 0,
      });
    } else {
      await this.store.updateInventoryItem(playerId, itemId, {
        quantity: remaining,
      });
    }

    return { success: true, remaining };
  }

  // ===================
  // Balance & Tokens
  // ===================

  /**
   * Get MBUCKS token balance for an address
   */
  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.moltToken.balanceOf(address);
      return balance.toString();
    } catch {
      return '0';
    }
  }

  /**
   * Get creator's total earnings
   */
  async getCreatorEarnings(creatorId: string): Promise<string> {
    return this.store.getCreatorTotalRevenue(creatorId);
  }
}

// =============================================================================
// Export
// =============================================================================

export default PurchaseService;
