/**
 * Zod validation schemas for rewards routes
 */

import { z } from 'zod';

export const getLeaderboardSchema = {
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    category: z.enum(['builder', 'player', 'holder', 'purchaser']).optional(),
  }),
};

export const getHistorySchema = {
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
};

export const recordPointsSchema = {
  body: z.object({
    userId: z.string().min(1),
    category: z.enum(['builder', 'player', 'holder', 'purchaser']),
    points: z.number().int().positive(),
    reason: z.string().min(1).max(500),
    metadata: z.record(z.unknown()).optional(),
  }),
};

export const claimHolderSchema = {
  body: z.object({
    // balanceMbucks is accepted but ignored; server reads on-chain balance
    balanceMbucks: z.number().positive().optional(),
  }),
};
