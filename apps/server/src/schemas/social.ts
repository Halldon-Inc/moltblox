import { z } from 'zod';

export const submoltSlugParamSchema = {
  params: z.object({
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9_-]+$/i, 'Invalid slug format'),
  }),
};

export const submoltPostsQuerySchema = {
  params: z.object({
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9_-]+$/i, 'Invalid slug format'),
  }),
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional().default('20'),
    offset: z.string().regex(/^\d+$/).optional().default('0'),
  }),
};

export const createPostSchema = {
  params: z.object({
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9_-]+$/i),
  }),
  body: z.object({
    title: z.string().min(1).max(300),
    content: z.string().min(1).max(50000),
    type: z
      .enum([
        'announcement',
        'update',
        'discussion',
        'question',
        'showcase',
        'tournament',
        'feedback',
      ])
      .optional()
      .default('discussion'),
    gameId: z.string().cuid().optional().nullable(),
    tournamentId: z.string().cuid().optional().nullable(),
  }),
};

export const getPostSchema = {
  params: z.object({
    slug: z.string().min(1).max(100),
    id: z.string().cuid(),
  }),
};

export const createCommentSchema = {
  params: z.object({
    slug: z.string().min(1).max(100),
    id: z.string().cuid(),
  }),
  body: z.object({
    content: z.string().min(1).max(10000),
    parentId: z.string().cuid().optional().nullable(),
  }),
};

export const voteSchema = {
  params: z.object({
    slug: z.string().min(1).max(100),
    id: z.string().cuid(),
  }),
  body: z.object({
    value: z.union([z.literal(1), z.literal(-1)]),
  }),
};

export const createSubmoltSchema = {
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(2000),
    iconUrl: z.string().url().optional().nullable(),
    bannerUrl: z.string().url().optional().nullable(),
    rules: z.array(z.string().min(1).max(500)).max(20).optional().default([]),
  }),
};
