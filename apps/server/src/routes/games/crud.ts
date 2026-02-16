/**
 * Game CRUD routes (create, read, update, delete, publish)
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma.js';
import { requireAuth, requireBot } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  gameIdParamSchema,
  gameLookupParamSchema,
  createGameSchema,
  updateGameSchema,
  deleteGameSchema,
} from '../../schemas/games.js';
import { sanitize, sanitizeObject } from '../../lib/sanitize.js';
import { requireGameOwnership } from '../../lib/utils.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { gamesWriteLimiter, serializeGame, slugify } from './_shared.js';

const router: Router = Router();

/**
 * POST /games/:id/publish - Convenience endpoint to publish a game
 */
router.post(
  '/:id/publish',
  gamesWriteLimiter,
  requireAuth,
  requireBot,
  validate(gameIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const existing = await requireGameOwnership<{ creatorId: string; status: string }>(
        id,
        user.id,
        { status: true },
      );

      if (existing.status === 'published') {
        res.status(400).json({ error: 'BadRequest', message: 'Game is already published' });
        return;
      }

      const game = await prisma.game.update({
        where: { id },
        data: { status: 'published', publishedAt: new Date() },
        include: {
          creator: {
            select: { username: true, displayName: true, walletAddress: true },
          },
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          reputationCreator: { increment: 5 },
          reputationTotal: { increment: 5 },
        },
      });

      res.json({ ...serializeGame(game), message: 'Game published successfully' });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /games/:id - Get game details
 */
router.get(
  '/:id',
  validate(gameLookupParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const param = req.params.id;

      const game = await prisma.game.findFirst({
        where: { OR: [{ id: param }, { slug: param }] },
        include: {
          creator: {
            select: {
              username: true,
              displayName: true,
              walletAddress: true,
            },
          },
        },
      });

      if (!game) {
        res.status(404).json({ error: 'NotFound', message: 'Game not found' });
        return;
      }

      res.json(serializeGame(game));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /games - Publish a new game (bot creators only)
 */
router.post(
  '/',
  gamesWriteLimiter,
  requireAuth,
  requireBot,
  validate(createGameSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const {
        name,
        description,
        genre,
        tags,
        maxPlayers,
        wasmUrl,
        templateSlug,
        thumbnailUrl,
        screenshots,
        config,
        designBrief,
      } = req.body;

      const sanitized = sanitizeObject({ name, description } as Record<string, unknown>, [
        'name',
        'description',
      ]);

      const slug = slugify(name);

      let game;
      try {
        game = await prisma.game.create({
          data: {
            name: sanitized.name as string,
            slug,
            description: sanitized.description as string,
            creatorId: user.id,
            genre: genre || 'other',
            tags: tags || [],
            maxPlayers: maxPlayers || 1,
            wasmUrl: wasmUrl || null,
            templateSlug: templateSlug || null,
            thumbnailUrl: thumbnailUrl || null,
            screenshots: screenshots || [],
            config: config || undefined,
            designBrief: designBrief || undefined,
            status: 'draft',
          },
          include: {
            creator: {
              select: {
                username: true,
                displayName: true,
                walletAddress: true,
              },
            },
          },
        });
      } catch (err: unknown) {
        if (err instanceof Error && 'code' in err && (err as any).code === 'P2002') {
          res
            .status(409)
            .json({ error: 'Conflict', message: 'A game with this name already exists' });
          return;
        }
        throw err;
      }

      res.status(201).json({
        ...serializeGame(game),
        message: 'Game created successfully. Upload your WASM bundle to publish.',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /games/:id - Update a game (bot creators only)
 */
router.put(
  '/:id',
  gamesWriteLimiter,
  requireAuth,
  requireBot,
  validate(updateGameSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      await requireGameOwnership(id, user.id);

      const {
        name,
        description,
        genre,
        tags,
        maxPlayers,
        status,
        wasmUrl,
        templateSlug,
        thumbnailUrl,
        screenshots,
        config,
        designBrief,
      } = req.body;

      // Sanitize name and description if provided
      const fieldsToSanitize: Record<string, unknown> = {};
      const keys: string[] = [];
      if (name !== undefined) {
        fieldsToSanitize.name = name;
        keys.push('name');
      }
      if (description !== undefined) {
        fieldsToSanitize.description = description;
        keys.push('description');
      }
      const sanitized = keys.length > 0 ? sanitizeObject(fieldsToSanitize, keys) : {};

      const data: Prisma.GameUpdateInput = {};
      if (name !== undefined) {
        data.name = sanitized.name as string;
        data.slug = slugify(name);
      }
      if (description !== undefined) data.description = sanitized.description as string;
      if (genre !== undefined) data.genre = genre;
      if (tags !== undefined) data.tags = tags;
      if (maxPlayers !== undefined) data.maxPlayers = maxPlayers;
      if (status !== undefined) {
        data.status = status;
        if (status === 'published') {
          data.publishedAt = new Date();
        }
      }
      if (wasmUrl !== undefined) data.wasmUrl = wasmUrl;
      if (templateSlug !== undefined) data.templateSlug = templateSlug;
      if (thumbnailUrl !== undefined) data.thumbnailUrl = thumbnailUrl;
      if (screenshots !== undefined) data.screenshots = screenshots;
      if (config !== undefined) data.config = config;
      if (designBrief !== undefined) data.designBrief = designBrief;

      let game;
      try {
        game = await prisma.game.update({
          where: { id },
          data,
          include: {
            creator: {
              select: {
                username: true,
                displayName: true,
                walletAddress: true,
              },
            },
          },
        });
      } catch (err: unknown) {
        if (err instanceof Error && 'code' in err && (err as any).code === 'P2002') {
          res
            .status(409)
            .json({ error: 'Conflict', message: 'A game with this name already exists' });
          return;
        }
        throw err;
      }

      // Reward reputation when a game is published
      if (status === 'published') {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            reputationCreator: { increment: 5 },
            reputationTotal: { increment: 5 },
          },
        });
      }

      res.json({
        ...serializeGame(game),
        message: 'Game updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /games/:id - Soft-delete a game (creator only)
 * Sets status to 'archived' so the game no longer appears in browse results.
 */
router.delete(
  '/:id',
  gamesWriteLimiter,
  requireAuth,
  requireBot,
  validate(deleteGameSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const existing = await requireGameOwnership<{ creatorId: string; status: string }>(
        id,
        user.id,
        { status: true },
      );

      if (existing.status === 'archived') {
        res.status(400).json({ error: 'BadRequest', message: 'Game is already deleted' });
        return;
      }

      // Block deletion while active sessions exist
      const activeSessions = await prisma.gameSession.count({
        where: { gameId: id, status: { in: ['waiting', 'active'] } },
      });

      if (activeSessions > 0) {
        res.status(409).json({
          error: 'Conflict',
          message: `Cannot delete game with ${activeSessions} active session(s). Wait for sessions to end first.`,
        });
        return;
      }

      await prisma.game.update({
        where: { id },
        data: { status: 'archived' },
      });

      res.json({ message: 'Game deleted' });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
