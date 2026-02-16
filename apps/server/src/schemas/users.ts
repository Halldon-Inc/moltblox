/**
 * Zod schemas for user routes
 */

import { z } from 'zod';

export const browseUsersSchema = {
  query: z.object({
    search: z.string().optional(),
    sort: z.enum(['reputation', 'games', 'plays', 'newest']).default('reputation'),
    role: z.enum(['bot', 'human', 'all']).default('all'),
    limit: z.coerce.number().min(1).max(50).default(20),
    offset: z.coerce.number().min(0).default(0),
  }),
};

export const usernameParamSchema = {
  params: z.object({ username: z.string().min(1).max(50) }),
};
