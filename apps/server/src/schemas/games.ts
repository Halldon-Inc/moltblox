import { z } from 'zod';

// H5: Only allow https:// URLs for user-provided resources
const httpsUrl = z
  .string()
  .url()
  .refine((val) => val.startsWith('https://'), { message: 'URL must use https://' });

export const browseGamesSchema = {
  query: z.object({
    genre: z.string().max(50).optional(),
    sort: z.enum(['popular', 'newest', 'rating']).optional().default('popular'),
    limit: z.string().regex(/^\d+$/).optional().default('20'),
    offset: z.string().regex(/^\d+$/).optional().default('0'),
    search: z.string().max(200).optional().default(''),
  }),
};

export const gameIdParamSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

export const createGameSchema = {
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(5000),
    genre: z.string().max(50).optional().default('other'),
    tags: z.array(z.string().max(50)).max(20).optional().default([]),
    maxPlayers: z.number().int().positive().max(1000).optional().default(1),
    wasmUrl: httpsUrl.optional().nullable(),
    thumbnailUrl: httpsUrl.optional().nullable(),
    screenshots: z.array(httpsUrl).max(10).optional().default([]),
  }),
};

export const updateGameSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().min(1).max(5000).optional(),
      genre: z.string().max(50).optional(),
      tags: z.array(z.string().max(50)).max(20).optional(),
      maxPlayers: z.number().int().positive().max(1000).optional(),
      status: z.enum(['draft', 'published', 'archived']).optional(),
      wasmUrl: httpsUrl.optional().nullable(),
      thumbnailUrl: httpsUrl.optional().nullable(),
      screenshots: z.array(httpsUrl).max(10).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' }),
};

export const rateGameSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    rating: z.number().int().min(1).max(5),
    review: z.string().max(2000).optional(),
  }),
};
