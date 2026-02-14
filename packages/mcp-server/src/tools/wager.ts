/**
 * MCP Tools for Wager/Betting Operations
 * Used by bots to create, accept, and bet on 1v1 wagers
 */

import { z } from 'zod';

export const createWagerSchema = z.object({
  gameId: z.string().describe('Game ID to wager on'),
  stakeAmount: z.string().describe('Stake amount in MBUCKS (e.g. "2.5" for 2.5 MBUCKS)'),
  opponentId: z
    .string()
    .optional()
    .describe('Opponent user ID for a private wager (omit for open wager)'),
});

export const acceptWagerSchema = z.object({
  wagerId: z.string().describe('Wager ID to accept'),
});

export const listWagersSchema = z.object({
  gameId: z.string().optional().describe('Filter by game ID'),
  status: z
    .enum(['OPEN', 'LOCKED', 'SETTLED', 'CANCELLED', 'DISPUTED', 'REFUNDED'])
    .optional()
    .describe('Filter by wager status'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(20),
});

export const placeSpectatorBetSchema = z.object({
  wagerId: z.string().describe('Wager ID to bet on'),
  predictedWinnerId: z.string().describe('User ID of who you predict will win'),
  amount: z.string().describe('Bet amount in MBUCKS (e.g. "1.0" for 1 MBUCKS)'),
});

export const getWagerOddsSchema = z.object({
  wagerId: z.string().describe('Wager ID to get odds for'),
});

// Tool definitions for MCP
export const wagerTools = [
  {
    name: 'create_wager',
    description: `
      Create a 1v1 wager on a game.

      Stake amount is in MBUCKS (human-readable, e.g. "5" or "2.5").
      Both players must stake the same amount.

      Open wagers (no opponentId): anyone can accept.
      Private wagers (with opponentId): only that player can accept.

      Flow: OPEN -> LOCKED (when accepted) -> SETTLED (winner determined)
      Spectators can bet on the outcome while status is LOCKED.
    `,
    inputSchema: createWagerSchema,
  },
  {
    name: 'accept_wager',
    description: `
      Accept an open wager.

      You cannot accept your own wager.
      If the wager has a specified opponent, only that player can accept.
      Accepting locks the wager and the match begins.
    `,
    inputSchema: acceptWagerSchema,
  },
  {
    name: 'list_wagers',
    description: `
      Browse available wagers.

      Filter by game, status, or browse all.
      Status values: OPEN (awaiting opponent), LOCKED (match in progress),
      SETTLED (winner decided), CANCELLED, DISPUTED, REFUNDED.
    `,
    inputSchema: listWagersSchema,
  },
  {
    name: 'place_spectator_bet',
    description: `
      Place a spectator bet on a locked wager.

      You can bet on who you think will win.
      Bet amount is in MBUCKS (e.g. "1.0").
      Wager participants cannot place spectator bets.

      Payouts are proportional: if you bet 10 MBUCKS on the winner
      and the total pool is 100 MBUCKS with 40 MBUCKS on the winner,
      your payout = (10/40) * 100 = 25 MBUCKS.
    `,
    inputSchema: placeSpectatorBetSchema,
  },
  {
    name: 'get_wager_odds',
    description: `
      Get current betting odds for a wager.

      Returns the total bet pool, pool per side, implied odds percentage,
      and decimal odds for each participant.

      Use this to make informed spectator bets.
    `,
    inputSchema: getWagerOddsSchema,
  },
];

// Tool handler types
export interface WagerToolHandlers {
  create_wager: (params: z.infer<typeof createWagerSchema>) => Promise<{
    wagerId: string;
    gameId: string;
    stakeAmount: string;
    status: string;
    message: string;
  }>;
  accept_wager: (params: z.infer<typeof acceptWagerSchema>) => Promise<{
    wagerId: string;
    status: string;
    message: string;
  }>;
  list_wagers: (params: z.infer<typeof listWagersSchema>) => Promise<{
    wagers: Array<{
      id: string;
      gameId: string;
      creatorId: string;
      opponentId: string | null;
      stakeAmount: string;
      status: string;
      createdAt: string;
    }>;
    pagination: {
      total: number;
      page: number;
      limit: number;
      hasMore: boolean;
    };
  }>;
  place_spectator_bet: (params: z.infer<typeof placeSpectatorBetSchema>) => Promise<{
    betId: string;
    wagerId: string;
    predictedWinnerId: string;
    amount: string;
    message: string;
  }>;
  get_wager_odds: (params: z.infer<typeof getWagerOddsSchema>) => Promise<{
    wagerId: string;
    totalBetPool: string;
    totalBets: number;
    odds: Record<
      string,
      {
        pool: string;
        percentage: number;
        impliedOdds: string;
      }
    >;
  }>;
}
