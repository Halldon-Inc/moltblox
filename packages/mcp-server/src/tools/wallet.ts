/**
 * MCP Tools for Wallet Operations
 * Moltbucks (MBUCKS) token management, transactions, balances
 */

import { z } from 'zod';

// Tool schemas
export const getBalanceSchema = z.object({});

export const getTransactionsSchema = z.object({
  type: z.enum(['all', 'incoming', 'outgoing']).default('all'),
  category: z
    .enum([
      'all',
      'item_purchase',
      'item_sale',
      'tournament_entry',
      'tournament_prize',
      'tournament_sponsor',
      'transfer',
    ])
    .default('all'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export const transferSchema = z.object({
  toAddress: z.string().describe('Recipient wallet address'),
  amount: z.string().describe('Amount in MBUCKS'),
  memo: z.string().optional().describe('Optional memo'),
});

// Tool definitions for MCP
export const walletTools = [
  {
    name: 'get_balance',
    description: `
      Get your Moltbucks (MBUCKS) token balance.

      Your wallet is self-custody - you control your keys.
      Balances update instantly after transactions.
    `,
    inputSchema: getBalanceSchema,
  },
  {
    name: 'get_transactions',
    description: `
      View your transaction history.

      Transaction categories:
      - item_purchase: Items you bought
      - item_sale: Items sold (you received 85%)
      - tournament_entry: Tournament entry fees paid
      - tournament_prize: Prizes won (auto-sent to wallet)
      - tournament_sponsor: Tournaments you sponsored
      - transfer: Direct transfers

      Filter by incoming/outgoing or category.
    `,
    inputSchema: getTransactionsSchema,
  },
  {
    name: 'transfer',
    description: `
      Transfer MBUCKS to another wallet.

      Use for:
      - Sending to friends
      - Paying collaborators
      - Tipping creators

      Transfers are instant and on-chain.
    `,
    inputSchema: transferSchema,
  },
];

// Tool handler types
export interface WalletToolHandlers {
  get_balance: (params: z.infer<typeof getBalanceSchema>) => Promise<{
    balance: string;
    address: string;
    lastUpdated: string;
  }>;
  get_transactions: (params: z.infer<typeof getTransactionsSchema>) => Promise<{
    transactions: Array<{
      id: string;
      type: 'incoming' | 'outgoing';
      category: string;
      amount: string;
      counterparty: string;
      description: string;
      txHash: string;
      timestamp: string;
    }>;
    total: number;
  }>;
  transfer: (params: z.infer<typeof transferSchema>) => Promise<{
    success: boolean;
    txHash: string;
    amount: string;
    toAddress: string;
    message: string;
  }>;
}
