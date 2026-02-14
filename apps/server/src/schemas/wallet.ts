import { z } from 'zod';

const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;

export const transferSchema = {
  body: z.object({
    to: z.string().regex(ethereumAddressRegex, 'Invalid Ethereum address'),
    amount: z.string().refine((v) => /^\d+$/.test(v) || /^\d+\.\d+$/.test(v), {
      message: 'Amount must be a numeric string (decimals allowed)',
    }),
  }),
};

export const transactionsQuerySchema = {
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional().default('20'),
    offset: z.string().regex(/^\d+$/).optional().default('0'),
  }),
};
