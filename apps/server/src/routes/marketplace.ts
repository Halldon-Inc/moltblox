/**
 * Marketplace routes for Moltblox API
 * 85% creator / 15% platform revenue split
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /marketplace/items - Browse marketplace items
 * Query params: category, game, minPrice, maxPrice
 */
router.get('/items', (req: Request, res: Response) => {
  const {
    category = 'all',
    game = 'all',
    minPrice = '0',
    maxPrice = '999999',
  } = req.query;

  res.json({
    items: [
      {
        id: 'item-001',
        gameId: 'game-002',
        creatorId: 'creator-002',
        name: 'Golden Block Skin',
        description: 'A shimmering golden skin for your blocks in Block Clash',
        category: 'cosmetic',
        rarity: 'rare',
        price: '2000000000000000000', // 2 MOLT
        currency: 'MOLT',
        maxSupply: 500,
        currentSupply: 500,
        soldCount: 127,
        active: true,
        imageUrl: 'https://cdn.moltblox.com/items/golden-block.png',
        createdAt: '2025-02-01T10:00:00Z',
      },
      {
        id: 'item-002',
        gameId: 'game-001',
        creatorId: 'creator-001',
        name: 'Speed Boost Pack x5',
        description: 'Five speed boost consumables for Molt Runner',
        category: 'consumable',
        rarity: 'common',
        price: '300000000000000000', // 0.3 MOLT
        currency: 'MOLT',
        maxSupply: null,
        currentSupply: 0,
        soldCount: 3450,
        active: true,
        imageUrl: 'https://cdn.moltblox.com/items/speed-boost.png',
        createdAt: '2025-01-20T15:00:00Z',
      },
      {
        id: 'item-003',
        gameId: 'game-003',
        creatorId: 'creator-003',
        name: 'Legendary Puzzle Theme',
        description: 'An exclusive visual theme for Puzzle Molt with animated backgrounds',
        category: 'cosmetic',
        rarity: 'legendary',
        price: '25000000000000000000', // 25 MOLT
        currency: 'MOLT',
        maxSupply: 50,
        currentSupply: 50,
        soldCount: 12,
        active: true,
        imageUrl: 'https://cdn.moltblox.com/items/legendary-theme.png',
        createdAt: '2025-02-10T08:00:00Z',
      },
    ],
    pagination: {
      total: 3,
      limit: 20,
      offset: 0,
      hasMore: false,
    },
    filters: {
      category,
      game,
      minPrice,
      maxPrice,
    },
  });
});

/**
 * GET /marketplace/items/:id - Get item details
 */
router.get('/items/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  res.json({
    id,
    gameId: 'game-002',
    creatorId: 'creator-002',
    creatorAddress: '0xbbb222ccc333ddd444eee555fff666aaa777bbb8',
    name: 'Golden Block Skin',
    description: 'A shimmering golden skin for your blocks in Block Clash. Turns all your placed blocks into gold, with particle effects on placement.',
    category: 'cosmetic',
    rarity: 'rare',
    price: '2000000000000000000',
    currency: 'MOLT',
    maxSupply: 500,
    currentSupply: 373,
    soldCount: 127,
    active: true,
    imageUrl: 'https://cdn.moltblox.com/items/golden-block.png',
    properties: {
      effect: 'golden_glow',
      particles: true,
      animated: true,
    },
    createdAt: '2025-02-01T10:00:00Z',
    updatedAt: '2025-03-01T08:00:00Z',
  });
});

/**
 * POST /marketplace/items - Create a new marketplace item (auth required)
 */
router.post('/items', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;

  res.status(201).json({
    id: 'item-new-001',
    gameId: req.body.gameId,
    creatorId: user.id,
    creatorAddress: user.address,
    name: req.body.name || 'Untitled Item',
    description: req.body.description || '',
    category: req.body.category || 'cosmetic',
    rarity: req.body.rarity || 'common',
    price: req.body.price || '0',
    currency: 'MOLT',
    maxSupply: req.body.maxSupply || null,
    currentSupply: req.body.maxSupply || 0,
    soldCount: 0,
    active: true,
    properties: req.body.properties || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    message: 'Item created successfully',
  });
});

/**
 * POST /marketplace/items/:id/purchase - Purchase an item (auth required)
 */
router.post('/items/:id/purchase', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const totalPrice = '2000000000000000000'; // 2 MOLT
  const creatorAmount = '1700000000000000000'; // 85%
  const platformAmount = '300000000000000000'; // 15%

  res.json({
    purchase: {
      id: 'purchase-001',
      itemId: id,
      gameId: 'game-002',
      buyerId: user.id,
      buyerAddress: user.address,
      sellerId: 'creator-002',
      sellerAddress: '0xbbb222ccc333ddd444eee555fff666aaa777bbb8',
      price: totalPrice,
      creatorAmount,
      platformAmount,
      quantity: req.body.quantity || 1,
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      blockNumber: 12345678,
      timestamp: new Date().toISOString(),
    },
    message: 'Purchase successful. Item added to your inventory.',
  });
});

/**
 * GET /marketplace/inventory - Get player inventory (auth required)
 */
router.get('/inventory', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;

  res.json({
    playerId: user.id,
    items: [
      {
        itemId: 'item-001',
        gameId: 'game-002',
        name: 'Golden Block Skin',
        category: 'cosmetic',
        rarity: 'rare',
        quantity: 1,
        acquiredAt: '2025-02-15T12:00:00Z',
        transactionHash: '0xaaa111bbb222ccc333ddd444eee555fff666aaa777bbb888ccc999ddd000eee1',
      },
      {
        itemId: 'item-002',
        gameId: 'game-001',
        name: 'Speed Boost Pack x5',
        category: 'consumable',
        rarity: 'common',
        quantity: 3,
        acquiredAt: '2025-03-01T09:00:00Z',
        transactionHash: '0xfff111eee222ddd333ccc444bbb555aaa666fff777eee888ddd999ccc000bbb1',
      },
    ],
    totalItems: 2,
  });
});

export default router;
