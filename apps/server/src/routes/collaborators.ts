/**
 * Collaborator routes for multi-bot game collaboration
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireBot } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  gameIdParamSchema,
  addCollaboratorSchema,
  collaboratorParamsSchema,
  updateCollaboratorSchema,
} from '../schemas/collaborators.js';
import prisma from '../lib/prisma.js';
import type { CollaboratorRole } from '../generated/prisma/client.js';

const router: Router = Router();

/**
 * GET /games/:gameId/collaborators - List collaborators for a game (public)
 */
router.get(
  '/:gameId/collaborators',
  validate(gameIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gameId } = req.params;

      const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true },
      });

      if (!game) {
        res.status(404).json({ error: 'Not found', message: 'Game not found' });
        return;
      }

      const collaborators = await prisma.gameCollaborator.findMany({
        where: { gameId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              walletAddress: true,
              role: true,
            },
          },
        },
        orderBy: { addedAt: 'asc' },
      });

      res.json({ gameId, collaborators });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /games/:gameId/collaborators - Add a collaborator (owner only, bot auth)
 */
router.post(
  '/:gameId/collaborators',
  requireAuth,
  requireBot,
  validate(addCollaboratorSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gameId } = req.params;
      const user = req.user!;
      const { userId, role, canEditCode, canEditMeta, canCreateItems, canPublish } = req.body;

      // Verify game exists and requester is the owner
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true, creatorId: true },
      });

      if (!game) {
        res.status(404).json({ error: 'Not found', message: 'Game not found' });
        return;
      }

      if (game.creatorId !== user.id) {
        res
          .status(403)
          .json({ error: 'Forbidden', message: 'Only the game owner can add collaborators' });
        return;
      }

      // Cannot add yourself as collaborator
      if (userId === user.id) {
        res
          .status(400)
          .json({ error: 'Validation error', message: 'Cannot add yourself as a collaborator' });
        return;
      }

      // Verify target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, displayName: true },
      });

      if (!targetUser) {
        res.status(404).json({ error: 'Not found', message: 'Target user not found' });
        return;
      }

      // Check if already a collaborator
      const existing = await prisma.gameCollaborator.findUnique({
        where: { gameId_userId: { gameId, userId } },
      });

      if (existing) {
        res
          .status(409)
          .json({ error: 'Conflict', message: 'User is already a collaborator on this game' });
        return;
      }

      const collaborator = await prisma.gameCollaborator.create({
        data: {
          gameId,
          userId,
          role: role || 'contributor',
          canEditCode: canEditCode ?? false,
          canEditMeta: canEditMeta ?? true,
          canCreateItems: canCreateItems ?? false,
          canPublish: canPublish ?? false,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              walletAddress: true,
              role: true,
            },
          },
        },
      });

      res.status(201).json({
        ...collaborator,
        message: 'Collaborator added successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /games/:gameId/collaborators/:userId - Remove a collaborator (owner only)
 */
router.delete(
  '/:gameId/collaborators/:userId',
  requireAuth,
  requireBot,
  validate(collaboratorParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gameId, userId } = req.params;
      const user = req.user!;

      // Verify game exists and requester is the owner
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true, creatorId: true },
      });

      if (!game) {
        res.status(404).json({ error: 'Not found', message: 'Game not found' });
        return;
      }

      if (game.creatorId !== user.id) {
        res
          .status(403)
          .json({ error: 'Forbidden', message: 'Only the game owner can remove collaborators' });
        return;
      }

      // Verify collaborator exists
      const collaborator = await prisma.gameCollaborator.findUnique({
        where: { gameId_userId: { gameId, userId } },
      });

      if (!collaborator) {
        res.status(404).json({ error: 'Not found', message: 'Collaborator not found' });
        return;
      }

      await prisma.gameCollaborator.delete({
        where: { gameId_userId: { gameId, userId } },
      });

      res.json({ message: 'Collaborator removed successfully' });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /games/:gameId/collaborators/:userId - Update collaborator permissions (owner only)
 */
router.patch(
  '/:gameId/collaborators/:userId',
  requireAuth,
  requireBot,
  validate(updateCollaboratorSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gameId, userId } = req.params;
      const user = req.user!;
      const { role, canEditCode, canEditMeta, canCreateItems, canPublish } = req.body;

      // Verify game exists and requester is the owner
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true, creatorId: true },
      });

      if (!game) {
        res.status(404).json({ error: 'Not found', message: 'Game not found' });
        return;
      }

      if (game.creatorId !== user.id) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Only the game owner can update collaborator permissions',
        });
        return;
      }

      // Verify collaborator exists
      const existing = await prisma.gameCollaborator.findUnique({
        where: { gameId_userId: { gameId, userId } },
      });

      if (!existing) {
        res.status(404).json({ error: 'Not found', message: 'Collaborator not found' });
        return;
      }

      const data: {
        role?: CollaboratorRole;
        canEditCode?: boolean;
        canEditMeta?: boolean;
        canCreateItems?: boolean;
        canPublish?: boolean;
      } = {};
      if (role !== undefined) data.role = role as CollaboratorRole;
      if (canEditCode !== undefined) data.canEditCode = canEditCode;
      if (canEditMeta !== undefined) data.canEditMeta = canEditMeta;
      if (canCreateItems !== undefined) data.canCreateItems = canCreateItems;
      if (canPublish !== undefined) data.canPublish = canPublish;

      const updated = await prisma.gameCollaborator.update({
        where: { gameId_userId: { gameId, userId } },
        data,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              walletAddress: true,
              role: true,
            },
          },
        },
      });

      res.json({
        ...updated,
        message: 'Collaborator permissions updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
