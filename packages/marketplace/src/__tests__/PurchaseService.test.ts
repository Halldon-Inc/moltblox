import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock contract method fns (hoisted above mock)
const mockOwnsItem = vi.fn();
const mockPurchaseItem = vi.fn();
const mockPurchaseItems = vi.fn();
const mockBalanceOf = vi.fn();

// Track ABIs passed to Contract constructor
const contractConstructorCalls: Array<{ address: string; abi: string[] }> = [];

vi.mock('ethers', () => {
  class MockContract {
    // Instance methods are assigned dynamically based on which ABI was used
    [key: string]: unknown;

    constructor(address: string, abi: string[], _provider?: unknown) {
      contractConstructorCalls.push({ address, abi });
      const isMarketplace = abi.some((entry: string) => entry.includes('purchaseItem'));
      if (isMarketplace) {
        this.purchaseItem = mockPurchaseItem;
        this.purchaseItems = mockPurchaseItems;
        this.ownsItem = mockOwnsItem;
      } else {
        this.balanceOf = mockBalanceOf;
        this.approve = vi.fn();
        this.allowance = vi.fn();
      }
    }
  }

  return {
    ethers: {
      Contract: MockContract,
      JsonRpcProvider: class MockProvider {},
    },
  };
});

import { PurchaseService } from '../services/PurchaseService';
import type { GameStore, StoredGame } from '../store/GameStore';
import type { GameItem, OwnedItem } from '@moltblox/protocol';

function createMockStore(): GameStore {
  return {
    saveGame: vi.fn().mockResolvedValue(undefined),
    getGame: vi.fn().mockResolvedValue(null),
    getGames: vi.fn().mockResolvedValue([]),
    updateGame: vi.fn().mockResolvedValue(undefined),
    getGamesByCreator: vi.fn().mockResolvedValue([]),
    getGamesByCategory: vi.fn().mockResolvedValue([]),
    getAllGameIds: vi.fn().mockResolvedValue([]),
    saveItem: vi.fn().mockResolvedValue(undefined),
    getItem: vi.fn().mockResolvedValue(null),
    updateItem: vi.fn().mockResolvedValue(undefined),
    getItemsByGame: vi.fn().mockResolvedValue([]),
    savePurchase: vi.fn().mockResolvedValue(undefined),
    getPurchase: vi.fn().mockResolvedValue(null),
    addToInventory: vi.fn().mockResolvedValue(undefined),
    getInventory: vi.fn().mockResolvedValue([]),
    getInventoryForGame: vi.fn().mockResolvedValue([]),
    updateInventoryItem: vi.fn().mockResolvedValue(undefined),
    incrementGameStat: vi.fn().mockResolvedValue(undefined),
    getGameStats: vi.fn().mockResolvedValue({}),
    recordRevenue: vi.fn().mockResolvedValue(undefined),
    getCreatorTotalRevenue: vi.fn().mockResolvedValue('0'),
    updateTrendingScore: vi.fn().mockResolvedValue(undefined),
    getTrendingGames: vi.fn().mockResolvedValue([]),
  } as unknown as GameStore;
}

function createMockGame(overrides: Partial<StoredGame> = {}): StoredGame {
  return {
    gameId: 'game-1',
    name: 'Test Game',
    description: 'A test game',
    shortDescription: 'Test',
    thumbnail: 'https://example.com/thumb.png',
    screenshots: [],
    category: 'arcade',
    tags: [],
    creatorBotId: 'creator-1',
    wasmHash: 'abc',
    wasmBundle: 'base64',
    version: '1.0.0',
    status: 'active',
    averageRating: 0,
    totalRatings: 0,
    totalPlays: 0,
    uniquePlayers: 0,
    totalRevenue: '0',
    publishedAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as StoredGame;
}

function createMockItem(overrides: Partial<GameItem> = {}): GameItem {
  return {
    itemId: 'item-1',
    gameId: 'game-1',
    name: 'Test Item',
    description: 'A test item',
    imageUrl: 'https://example.com/item.png',
    category: 'cosmetic',
    price: '1000000000000000000',
    maxSupply: 100,
    soldCount: 0,
    active: true,
    createdAt: Date.now(),
    properties: {},
    ...overrides,
  } as GameItem;
}

describe('PurchaseService', () => {
  let store: GameStore;
  let service: PurchaseService;

  beforeEach(() => {
    store = createMockStore();
    contractConstructorCalls.length = 0;
    mockOwnsItem.mockReset();
    mockPurchaseItem.mockReset();
    mockPurchaseItems.mockReset();
    mockBalanceOf.mockReset();

    // Default: player has enough balance and does not own the item
    mockBalanceOf.mockResolvedValue(BigInt('10000000000000000000'));
    mockOwnsItem.mockResolvedValue(false);

    service = new PurchaseService({
      store,
      provider: {} as any,
      marketplaceAddress: '0xMarketplace',
      moltTokenAddress: '0xToken',
    });
  });

  describe('ABI', () => {
    it('contains purchaseItem(string) not purchaseItem(bytes32,bytes32)', () => {
      // Find the marketplace contract creation call
      const marketplaceCall = contractConstructorCalls.find((call) =>
        call.abi.some((entry: string) => entry.includes('purchaseItem')),
      );

      expect(marketplaceCall).toBeDefined();
      const abi = marketplaceCall!.abi;

      // purchaseItem uses string, not bytes32
      const purchaseSig = abi.find((entry: string) => entry.includes('purchaseItem('));
      expect(purchaseSig).toContain('string');
      expect(purchaseSig).not.toContain('bytes32');

      // ownsItem uses (address, string), not (address, bytes32)
      const ownsSig = abi.find((entry: string) => entry.includes('ownsItem'));
      expect(ownsSig).toContain('string');
      expect(ownsSig).not.toContain('bytes32');
    });
  });

  describe('purchaseItem()', () => {
    it('calls store methods and returns success with purchaseId', async () => {
      const game = createMockGame();
      const item = createMockItem();

      (store.getGame as ReturnType<typeof vi.fn>).mockResolvedValue(game);
      (store.getItem as ReturnType<typeof vi.fn>).mockResolvedValue(item);

      const result = await service.purchaseItem({
        buyerId: 'buyer-1',
        buyerAddress: '0xBuyer',
        gameId: 'game-1',
        itemId: 'item-1',
      });

      expect(result.success).toBe(true);
      expect(result.purchaseId).toBeDefined();

      // Verify the itemId passed to store methods is a string
      expect(store.savePurchase).toHaveBeenCalledTimes(1);
      const savedPurchase = (store.savePurchase as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(typeof savedPurchase.itemId).toBe('string');
      expect(savedPurchase.itemId).toBe('item-1');
    });

    it('returns error when game not found', async () => {
      (store.getGame as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (store.getItem as ReturnType<typeof vi.fn>).mockResolvedValue(createMockItem());

      const result = await service.purchaseItem({
        buyerId: 'buyer-1',
        buyerAddress: '0xBuyer',
        gameId: 'game-1',
        itemId: 'item-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Game not found');
    });
  });

  describe('checkOwnership()', () => {
    it('calls ownsItem(address, string) not (address, bytes32)', async () => {
      mockOwnsItem.mockResolvedValue(true);

      const result = await service.checkOwnership('0xPlayer', 'item-abc');

      expect(mockOwnsItem).toHaveBeenCalledWith('0xPlayer', 'item-abc');
      expect(result).toBe(true);

      // Verify arg types: first is address string, second is item ID string
      const [addr, itemId] = mockOwnsItem.mock.calls[0];
      expect(typeof addr).toBe('string');
      expect(typeof itemId).toBe('string');
    });

    it('returns false when contract call throws', async () => {
      mockOwnsItem.mockRejectedValue(new Error('Contract error'));

      const result = await service.checkOwnership('0xPlayer', 'item-abc');

      expect(result).toBe(false);
    });
  });

  describe('checkSubscription()', () => {
    it('uses off-chain inventory lookup (not contract call)', async () => {
      const now = Date.now();
      const inventory: OwnedItem[] = [
        {
          itemId: 'sub-item',
          gameId: 'game-1',
          name: 'VIP Pass',
          category: 'subscription',
          acquiredAt: now - 1000,
          quantity: 1,
          expiresAt: now + 86400000, // expires tomorrow
        },
      ];

      (store.getInventory as ReturnType<typeof vi.fn>).mockResolvedValue(inventory);

      const result = await service.checkSubscription('player-1', 'sub-item');

      // Should use store.getInventory, not any contract call
      expect(store.getInventory).toHaveBeenCalledWith('player-1');
      expect(result.active).toBe(true);
      expect(result.expiresAt).toBeDefined();

      // Verify no contract calls were made for subscription check
      expect(mockOwnsItem).not.toHaveBeenCalled();
    });

    it('returns inactive for expired subscription', async () => {
      const now = Date.now();
      const inventory: OwnedItem[] = [
        {
          itemId: 'sub-item',
          gameId: 'game-1',
          name: 'VIP Pass',
          category: 'subscription',
          acquiredAt: now - 100000,
          quantity: 1,
          expiresAt: now - 1000, // expired
        },
      ];

      (store.getInventory as ReturnType<typeof vi.fn>).mockResolvedValue(inventory);

      const result = await service.checkSubscription('player-1', 'sub-item');

      expect(result.active).toBe(false);
    });
  });

  describe('batch purchase', () => {
    it('purchaseItems ABI expects string[]', () => {
      const marketplaceCall = contractConstructorCalls.find((call) =>
        call.abi.some((entry: string) => entry.includes('purchaseItems')),
      );

      expect(marketplaceCall).toBeDefined();
      const abi = marketplaceCall!.abi;

      const batchSig = abi.find((entry: string) => entry.includes('purchaseItems'));
      expect(batchSig).toContain('string[]');
      expect(batchSig).not.toContain('bytes32');
    });
  });
});
