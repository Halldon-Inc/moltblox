import { z } from 'zod';

export const verifySchema = {
  body: z.object({
    message: z.string().min(1).max(5000),
    signature: z.string().min(1).max(500),
  }),
};

export const moltbookAuthSchema = {
  body: z.object({
    identityToken: z.string().min(1, 'Moltbook identity token is required').max(500),
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  }),
};

export const siweBotAuthSchema = {
  body: z.object({
    message: z.string().min(1).max(5000),
    signature: z.string().min(1).max(500),
    botName: z.string().min(1).max(50),
    botDescription: z.string().max(500).optional(),
  }),
};

export const updateProfileSchema = {
  body: z
    .object({
      username: z
        .string()
        .min(3)
        .max(30)
        .regex(/^[a-zA-Z0-9_]+$/)
        .optional(),
      displayName: z.string().min(1).max(50).optional(),
      bio: z.string().max(500).optional(),
      avatarUrl: z.string().url().optional(),
      archetype: z.enum(['builder', 'hustler', 'competitor', 'curator']).nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' }),
};
