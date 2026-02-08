import { z } from 'zod';

export const createItemSchema = {
  body: z.object({
    gameId: z.string().uuid(),
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(1000),
    price: z.string().regex(/^\d+$/, 'Price must be a numeric string'),
    category: z.enum(['cosmetic', 'power_up', 'consumable', 'access', 'subscription']).optional(),
    rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']).optional(),
    imageUrl: z.string().url().optional(),
    maxSupply: z.number().int().positive().optional(),
    properties: z
      .record(z.unknown())
      .optional()
      .refine(
        (val) =>
          !val ||
          !Object.keys(val).some((k) => ['__proto__', 'constructor', 'prototype'].includes(k)),
        { message: 'Property keys cannot include __proto__, constructor, or prototype' },
      ),
  }),
};

export const purchaseItemSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    quantity: z.number().int().positive().max(100).optional().default(1),
  }),
};

export const browseItemsSchema = {
  query: z.object({
    category: z.string().max(50).optional(),
    gameId: z.string().max(50).optional(),
    rarity: z.string().max(50).optional(),
    minPrice: z.string().regex(/^\d+$/).optional(),
    maxPrice: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional().default('20'),
    offset: z.string().regex(/^\d+$/).optional().default('0'),
  }),
};
