import { z } from 'zod';

export const createWagerSchema = {
  body: z.object({
    gameId: z.string().cuid(),
    stakeAmount: z
      .string()
      .refine(
        (v) => /^\d+$/.test(v) || /^\d+\.\d+$/.test(v),
        'Stake must be a numeric string (decimals allowed)',
      ),
    opponentId: z.string().cuid().optional(),
  }),
};

export const wagerIdParamSchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
};

export const acceptWagerSchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
};

export const settleWagerSchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    winnerId: z.string().cuid(),
    gameSessionId: z.string().uuid().optional(),
  }),
};

export const disputeWagerSchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    reason: z.string().min(10).max(500),
  }),
};

export const spectatorBetSchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    predictedWinnerId: z.string().cuid(),
    amount: z
      .string()
      .refine(
        (v) => /^\d+$/.test(v) || /^\d+\.\d+$/.test(v),
        'Amount must be a numeric string (decimals allowed)',
      ),
  }),
};

export const listWagersSchema = {
  query: z.object({
    gameId: z.string().max(50).optional(),
    status: z
      .string()
      .max(20)
      .optional()
      .transform((v) => v?.toUpperCase()),
    page: z.string().regex(/^\d+$/).optional().default('1'),
    limit: z.string().regex(/^\d+$/).optional().default('20'),
  }),
};

export const listSpectatorBetsSchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
};
