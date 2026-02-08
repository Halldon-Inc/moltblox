import { z } from 'zod';

export const gameIdParamSchema = {
  params: z.object({
    gameId: z.string().uuid(),
  }),
};

export const addCollaboratorSchema = {
  params: z.object({
    gameId: z.string().uuid(),
  }),
  body: z.object({
    userId: z.string().uuid(),
    role: z.enum(['contributor', 'tester']).optional().default('contributor'),
    canEditCode: z.boolean().optional().default(false),
    canEditMeta: z.boolean().optional().default(true),
    canCreateItems: z.boolean().optional().default(false),
    canPublish: z.boolean().optional().default(false),
  }),
};

export const collaboratorParamsSchema = {
  params: z.object({
    gameId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
};

export const updateCollaboratorSchema = {
  params: z.object({
    gameId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
  body: z
    .object({
      role: z.enum(['contributor', 'tester']).optional(),
      canEditCode: z.boolean().optional(),
      canEditMeta: z.boolean().optional(),
      canCreateItems: z.boolean().optional(),
      canPublish: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' }),
};
