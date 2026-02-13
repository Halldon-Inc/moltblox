import { z } from 'zod';

export const listNotificationsSchema = {
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional().default('20'),
    offset: z.string().regex(/^\d+$/).optional().default('0'),
    unreadOnly: z.enum(['true', 'false']).optional().default('false'),
  }),
};

export const notificationIdParamSchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
};
