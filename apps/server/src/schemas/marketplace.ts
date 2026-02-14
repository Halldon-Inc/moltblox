import { z } from 'zod';

export const createItemSchema = {
  body: z.object({
    gameId: z.string().cuid(),
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(1000),
    // Price "0" is allowed for free items (valid creator strategy). No minimum enforced.
    price: z.string().refine((v) => /^\d+$/.test(v) || /^\d+\.\d+$/.test(v), {
      message: 'Price must be a numeric string (decimals allowed)',
    }),
    category: z.enum(['cosmetic', 'power_up', 'consumable', 'access', 'subscription']).optional(),
    rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']).optional(),
    imageUrl: z
      .string()
      .url()
      .refine((url) => url.startsWith('https://'), { message: 'Must be HTTPS URL' })
      .optional(),
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

export const updateItemSchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z
    .object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().min(1).max(1000).optional(),
      price: z
        .string()
        .refine((v) => /^\d+$/.test(v) || /^\d+\.\d+$/.test(v), {
          message: 'Price must be a numeric string (decimals allowed)',
        })
        .optional(),
      maxSupply: z.number().int().positive().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' }),
};

export const purchaseItemSchema = {
  params: z.object({
    id: z.string().cuid(),
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
    minPrice: z
      .string()
      .refine((v) => /^\d+$/.test(v) || /^\d+\.\d+$/.test(v))
      .optional(),
    maxPrice: z
      .string()
      .refine((v) => /^\d+$/.test(v) || /^\d+\.\d+$/.test(v))
      .optional(),
    limit: z.string().regex(/^\d+$/).optional().default('20'),
    offset: z.string().regex(/^\d+$/).optional().default('0'),
  }),
};
