/**
 * Marketplace routes for Moltblox API
 * 85% creator / 15% platform revenue split
 * Uses Prisma for all database operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireBot } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createItemSchema, purchaseItemSchema, browseItemsSchema } from '../schemas/marketplace.js';
import { sanitizeObject } from '../lib/sanitize.js';
import prisma from '../lib/prisma.js';
import { parseBigInt, parseBigIntNonNegative, ParseBigIntError } from '../lib/parseBigInt.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ItemCategory, ItemRarity } from '../generated/prisma/enums.js';

const router: Router = Router();

/**
 * GET /marketplace/items - Browse marketplace items
 * Query params: category, gameId, rarity, minPrice, maxPrice, limit, offset
 */
router.get(
  '/items',
  validate(browseItemsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        category,
        gameId,
        rarity,
        minPrice,
        maxPrice,
        limit = '20',
        offset = '0',
      } = req.query;

      const take = Math.min(parseInt(limit as string, 10) || 20, 100);
      const skip = parseInt(offset as string, 10) || 0;

      const where: Prisma.ItemWhereInput = {
        active: true,
      };

      if (category && category !== 'all') {
        where.category = category as ItemCategory;
      }

      if (gameId && gameId !== 'all') {
        where.gameId = gameId as string;
      }

      if (rarity && rarity !== 'all') {
        where.rarity = rarity as ItemRarity;
      }

      if (minPrice || maxPrice) {
        try {
          where.price = {};
          if (minPrice) {
            where.price.gte = parseBigIntNonNegative(minPrice as string, 'minPrice');
          }
          if (maxPrice) {
            where.price.lte = parseBigIntNonNegative(maxPrice as string, 'maxPrice');
          }
        } catch (err) {
          if (err instanceof ParseBigIntError) {
            res.status(400).json({ error: 'Bad Request', message: err.message });
            return;
          }
          throw err;
        }
      }

      const [items, total] = await Promise.all([
        prisma.item.findMany({
          where,
          take,
          skip,
          orderBy: { createdAt: 'desc' },
          include: {
            game: {
              select: {
                id: true,
                name: true,
                slug: true,
                thumbnailUrl: true,
              },
            },
            creator: {
              select: {
                id: true,
                displayName: true,
                walletAddress: true,
              },
            },
          },
        }),
        prisma.item.count({ where }),
      ]);

      const serializedItems = items.map((item) => ({
        ...item,
        price: item.price.toString(),
      }));

      res.json({
        items: serializedItems,
        pagination: {
          total,
          limit: take,
          offset: skip,
          hasMore: skip + take < total,
        },
        filters: {
          category: category || 'all',
          gameId: gameId || 'all',
          rarity: rarity || 'all',
          minPrice: minPrice || null,
          maxPrice: maxPrice || null,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /marketplace/items/:id - Get item details
 */
router.get('/items/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        game: {
          select: {
            id: true,
            name: true,
            slug: true,
            thumbnailUrl: true,
          },
        },
        creator: {
          select: {
            id: true,
            displayName: true,
            walletAddress: true,
          },
        },
      },
    });

    if (!item) {
      res.status(404).json({
        error: 'Not Found',
        message: `Item with id "${id}" not found`,
      });
      return;
    }

    res.json({
      ...item,
      price: item.price.toString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /marketplace/items - Create a new marketplace item (bot creators only)
 * Required body: gameId, name, description, price (as string)
 * Optional body: category, rarity, imageUrl, maxSupply, properties
 */
router.post(
  '/items',
  requireAuth,
  requireBot,
  validate(createItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const {
        gameId,
        name,
        description,
        price,
        category,
        rarity,
        imageUrl,
        maxSupply,
        properties,
      } = req.body;

      // Sanitize user input
      const sanitized = sanitizeObject({ name, description } as Record<string, unknown>, [
        'name',
        'description',
      ]);

      if (!gameId || !name || !description || !price) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required fields: gameId, name, description, price',
        });
        return;
      }

      // Verify the user owns the game
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true, creatorId: true },
      });

      if (!game) {
        res.status(404).json({
          error: 'Not Found',
          message: `Game with id "${gameId}" not found`,
        });
        return;
      }

      if (game.creatorId !== user.id) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only create items for games you own',
        });
        return;
      }

      let parsedPrice: bigint;
      try {
        parsedPrice = parseBigInt(price, 'price');
      } catch (err) {
        if (err instanceof ParseBigIntError) {
          res.status(400).json({ error: 'Bad Request', message: err.message });
          return;
        }
        throw err;
      }

      const item = await prisma.item.create({
        data: {
          gameId,
          creatorId: user.id,
          name: sanitized.name as string,
          description: sanitized.description as string,
          price: parsedPrice,
          category: category || 'cosmetic',
          rarity: rarity || 'common',
          imageUrl: imageUrl || null,
          maxSupply: maxSupply != null ? parseInt(maxSupply, 10) : null,
          currentSupply: maxSupply != null ? parseInt(maxSupply, 10) : 0,
          properties: properties || {},
          active: true,
        },
        include: {
          game: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          creator: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true,
            },
          },
        },
      });

      res.status(201).json({
        ...item,
        price: item.price.toString(),
        message: 'Item created successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /marketplace/items/:id/purchase - Purchase an item (auth required)
 * Uses a Prisma transaction for atomicity.
 * 85% goes to the creator, 15% is platform fee.
 */
router.post(
  '/items/:id/purchase',
  requireAuth,
  validate(purchaseItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const quantity = parseInt(req.body.quantity, 10) || 1;

      const result = await prisma.$transaction(async (tx) => {
        // Fetch item and verify it exists and is active
        const item = await tx.item.findUnique({
          where: { id },
          include: {
            creator: {
              select: {
                id: true,
                walletAddress: true,
                displayName: true,
              },
            },
          },
        });

        if (!item) {
          throw Object.assign(new Error(`Item with id "${id}" not found`), { statusCode: 404 });
        }

        if (!item.active) {
          throw Object.assign(new Error('This item is no longer available for purchase'), {
            statusCode: 400,
          });
        }

        // Prevent self-purchase
        if (item.creatorId === user.id) {
          throw Object.assign(new Error('Cannot purchase your own item'), { statusCode: 400 });
        }

        // Check supply if limited
        if (item.maxSupply !== null && item.currentSupply < quantity) {
          throw Object.assign(
            new Error(
              `Insufficient supply. Requested: ${quantity}, available: ${item.currentSupply}`,
            ),
            { statusCode: 400 },
          );
        }

        // Calculate 85/15 split
        const price = BigInt(item.price) * BigInt(quantity);
        const creatorAmount = (price * 85n) / 100n;
        const platformAmount = price - creatorAmount;

        // Create purchase record
        const purchase = await tx.purchase.create({
          data: {
            itemId: item.id,
            gameId: item.gameId,
            buyerId: user.id,
            sellerId: item.creatorId,
            price,
            creatorAmount,
            platformAmount,
            quantity,
          },
        });

        // Upsert inventory item (increment quantity if already owned)
        await tx.inventoryItem.upsert({
          where: {
            userId_itemId: {
              userId: user.id,
              itemId: item.id,
            },
          },
          create: {
            userId: user.id,
            itemId: item.id,
            quantity,
          },
          update: {
            quantity: {
              increment: quantity,
            },
          },
        });

        // Increment sold count and decrement supply if limited
        const itemUpdate: Prisma.ItemUpdateInput = {
          soldCount: { increment: quantity },
        };
        if (item.maxSupply !== null) {
          itemUpdate.currentSupply = { decrement: quantity };
        }
        await tx.item.update({
          where: { id: item.id },
          data: itemUpdate,
        });

        // Record transaction for buyer (purchase)
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: 'purchase',
            amount: price,
            itemId: item.id,
            counterparty: item.creator.walletAddress,
            description: `Purchased: ${item.name}${quantity > 1 ? ` x${quantity}` : ''}`,
          },
        });

        // Record transaction for seller (sale)
        await tx.transaction.create({
          data: {
            userId: item.creatorId,
            type: 'sale',
            amount: creatorAmount,
            itemId: item.id,
            counterparty: user.address,
            description: `Item sale: ${item.name}${quantity > 1 ? ` x${quantity}` : ''}`,
          },
        });

        return {
          purchase: {
            id: purchase.id,
            itemId: purchase.itemId,
            gameId: purchase.gameId,
            buyerId: purchase.buyerId,
            buyerAddress: user.address,
            sellerId: purchase.sellerId,
            sellerAddress: item.creator.walletAddress,
            price: price.toString(),
            creatorAmount: creatorAmount.toString(),
            platformAmount: platformAmount.toString(),
            quantity: purchase.quantity,
            txHash: purchase.txHash,
            blockNumber: purchase.blockNumber,
            createdAt: purchase.createdAt,
          },
        };
      });

      res.json({
        ...result,
        message: 'Purchase successful. Item added to your inventory.',
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        const statusCode = (error as Error & { statusCode: number }).statusCode;
        res.status(statusCode).json({
          error: statusCode === 404 ? 'Not Found' : 'Bad Request',
          message: error.message,
        });
        return;
      }
      next(error);
    }
  },
);

/**
 * GET /marketplace/inventory - Get player inventory (auth required)
 */
router.get('/inventory', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { userId: user.id },
      orderBy: { acquiredAt: 'desc' },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            category: true,
            rarity: true,
            imageUrl: true,
            game: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const items = inventoryItems.map((inv) => ({
      itemId: inv.itemId,
      gameId: inv.item.game.id,
      gameName: inv.item.game.name,
      name: inv.item.name,
      category: inv.item.category,
      rarity: inv.item.rarity,
      imageUrl: inv.item.imageUrl,
      quantity: inv.quantity,
      acquiredAt: inv.acquiredAt,
      txHash: inv.txHash,
    }));

    res.json({
      playerId: user.id,
      items,
      totalItems: items.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
