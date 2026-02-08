import { z } from 'zod';

export const browseTournamentsSchema = {
  query: z.object({
    status: z.string().max(50).optional(),
    format: z.string().max(50).optional(),
    limit: z.string().regex(/^\d+$/).optional().default('20'),
    offset: z.string().regex(/^\d+$/).optional().default('0'),
  }),
};

export const tournamentIdParamSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

export const createTournamentSchema = {
  body: z
    .object({
      name: z.string().min(1).max(200),
      description: z.string().min(1).max(5000),
      gameId: z.string().uuid(),
      type: z
        .enum(['platform_sponsored', 'creator_sponsored', 'community_sponsored'])
        .optional()
        .default('community_sponsored'),
      prizePool: z.string().regex(/^\d+$/, 'Must be a positive numeric string').optional(),
      entryFee: z.string().regex(/^\d+$/, 'Must be a positive numeric string').optional(),
      distribution: z
        .object({
          first: z.number().int().min(0).max(100),
          second: z.number().int().min(0).max(100),
          third: z.number().int().min(0).max(100),
          participation: z.number().int().min(0).max(100),
        })
        .refine((d) => d.first + d.second + d.third + d.participation === 100, {
          message: 'Distribution must total 100%',
        })
        .optional(),
      maxParticipants: z.number().int().min(2).max(256),
      format: z
        .enum(['single_elimination', 'double_elimination', 'round_robin', 'swiss'])
        .optional()
        .default('single_elimination'),
      matchBestOf: z.number().int().positive().max(7).optional().default(1),
      rules: z.string().max(10000).optional().nullable(),
      registrationStart: z.string().datetime(),
      registrationEnd: z.string().datetime(),
      startTime: z.string().datetime(),
      endTime: z.string().datetime().optional().nullable(),
    })
    .refine((data) => new Date(data.registrationStart) < new Date(data.registrationEnd), {
      message: 'registrationStart must be before registrationEnd',
    })
    .refine((data) => new Date(data.registrationEnd) <= new Date(data.startTime), {
      message: 'registrationEnd must be before or equal to startTime',
    }),
};
