/**
 * Item routes (convenience aliases for /marketplace/items)
 *
 * These routes proxy /api/v1/items/:id to /api/v1/marketplace/items/:id
 * so that testers and MCP clients can use either path.
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, requireBot } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateItemSchema, browseItemsSchema } from '../schemas/marketplace.js';
import { sanitizeObject } from '../lib/sanitize.js';
import { mbucksToWei } from '../lib/parseBigInt.js';
import type { Prisma } from '../generated/prisma/client.js';

const router: Router = Router();

/**
 * GET /items - Browse all items (alias for /marketplace/items)
 */
router.get(
  '/',
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

      const where: Prisma.ItemWhereInput = { active: true };

      if (category && category !== 'all') {
        where.category = category as Prisma.EnumItemCategoryFilter;
      }
      if (gameId && gameId !== 'all') {
        where.gameId = gameId as string;
      }
      if (rarity && rarity !== 'all') {
        where.rarity = rarity as Prisma.EnumItemRarityFilter;
      }
      if (minPrice || maxPrice) {
        try {
          where.price = {};
          if (minPrice) {
            where.price.gte = mbucksToWei(minPrice as string);
          }
          if (maxPrice) {
            where.price.lte = mbucksToWei(maxPrice as string);
          }
        } catch {
          res.status(400).json({ error: 'BadRequest', message: 'Invalid price filter value' });
          return;
        }
      }

      const [items, total] = await Promise.all([
        prisma.item.findMany({
          where,
          take,
          skip,
          orderBy: { createdAt: 'desc' },
          include: {
            game: { select: { id: true, name: true, slug: true, thumbnailUrl: true } },
            creator: { select: { id: true, displayName: true, walletAddress: true } },
          },
        }),
        prisma.item.count({ where }),
      ]);

      res.json({
        items: items.map((item) => ({ ...item, price: item.price.toString() })),
        pagination: { total, limit: take, offset: skip, hasMore: skip + take < total },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /items/:id - Get item by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        game: { select: { id: true, name: true, slug: true, thumbnailUrl: true } },
        creator: { select: { id: true, displayName: true, walletAddress: true } },
      },
    });

    if (!item) {
      res.status(404).json({ error: 'NotFound', message: `Item with id "${id}" not found` });
      return;
    }

    res.json({ ...item, price: item.price.toString() });
  } catch (error) {
    next(error);
  }
});

/**
 * Shared handler for PUT and PATCH /items/:id
 */
async function updateItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = req.user!;

    const existing = await prisma.item.findUnique({
      where: { id },
      select: { creatorId: true, currentSupply: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'NotFound', message: `Item with id "${id}" not found` });
      return;
    }

    if (existing.creatorId !== user.id) {
      res
        .status(403)
        .json({ error: 'Forbidden', message: 'You can only update items you created' });
      return;
    }

    const { name, description, price, maxSupply } = req.body;

    if (maxSupply !== undefined && existing.currentSupply > 0) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Cannot change maxSupply after items have been minted (currentSupply > 0)',
      });
      return;
    }

    const data: Prisma.ItemUpdateInput = {};

    if (name !== undefined) {
      const sanitized = sanitizeObject({ name } as Record<string, unknown>, ['name']);
      data.name = sanitized.name as string;
    }
    if (description !== undefined) {
      const sanitized = sanitizeObject({ description } as Record<string, unknown>, ['description']);
      data.description = sanitized.description as string;
    }
    if (price !== undefined) {
      try {
        const wei = mbucksToWei(price);
        if (wei < 0n) {
          res.status(400).json({ error: 'BadRequest', message: 'Price must not be negative' });
          return;
        }
        data.price = wei;
      } catch {
        res.status(400).json({ error: 'BadRequest', message: 'Invalid price value' });
        return;
      }
    }
    if (maxSupply !== undefined) {
      data.maxSupply = maxSupply;
      data.currentSupply = maxSupply;
    }

    const item = await prisma.item.update({
      where: { id },
      data,
      include: {
        game: { select: { id: true, name: true, slug: true, thumbnailUrl: true } },
        creator: { select: { id: true, displayName: true, walletAddress: true } },
      },
    });

    res.json({ ...item, price: item.price.toString(), message: 'Item updated successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /items/:id - Update an item (creator only)
 */
router.put('/:id', requireAuth, requireBot, validate(updateItemSchema), updateItemHandler);

/**
 * PATCH /items/:id - Update an item (creator only, alias for PUT)
 */
router.patch('/:id', requireAuth, requireBot, validate(updateItemSchema), updateItemHandler);

export default router;
