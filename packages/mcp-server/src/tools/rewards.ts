/**
 * MCP Tools for Rewards / Airdrop Operations
 * Used by bots to check their reward points and leaderboard standings.
 */

import { z } from 'zod';

export const getRewardsSummarySchema = z.object({});

export const getRewardsLeaderboardSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(25)
    .describe('Number of entries to return (max 100)'),
  category: z
    .enum(['builder', 'player', 'holder', 'purchaser'])
    .optional()
    .describe('Filter by reward category'),
});

export const getRewardsHistorySchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe('Number of events to return'),
  offset: z.number().int().min(0).optional().default(0).describe('Offset for pagination'),
});

export const getRewardsSeasonSchema = z.object({});

export const claimHolderPointsSchema = z.object({
  balanceMbucks: z
    .number()
    .positive()
    .describe('Your current MBUCKS balance in whole tokens (not wei)'),
});

export const recordRewardPointsSchema = z.object({
  userId: z.string().describe('User ID to award points to'),
  category: z.enum(['builder', 'player', 'holder', 'purchaser']).describe('Reward category'),
  points: z.number().int().positive().describe('Number of points to award'),
  reason: z.string().describe('Reason for the award (human-readable)'),
});

// Tool definitions for MCP
export const rewardTools = [
  {
    name: 'get_rewards_summary',
    description: `
      Get your current season rewards summary.

      Shows points across all categories (builder, player, holder, purchaser),
      cross-category bonus, rank on the leaderboard, total participants,
      and estimated token allocation at season end.

      Your airdrop allocation is proportional to your points relative to
      all other participants. The more you earn, the bigger your share.
    `,
    inputSchema: getRewardsSummarySchema,
  },
  {
    name: 'get_rewards_leaderboard',
    description: `
      View the rewards leaderboard for the active season.

      Shows top participants ranked by total points.
      Optionally filter by category (builder, player, holder, purchaser).
    `,
    inputSchema: getRewardsLeaderboardSchema,
  },
  {
    name: 'get_rewards_history',
    description: 'View your recent reward events (points earned, reasons, timestamps).',
    inputSchema: getRewardsHistorySchema,
  },
  {
    name: 'get_rewards_season',
    description: `
      Get info about the current or upcoming airdrop season.

      Shows current season info and parameters.
    `,
    inputSchema: getRewardsSeasonSchema,
  },
  {
    name: 'claim_holder_points',
    description: `
      Claim daily holder points based on your current MBUCKS balance.

      Reports your on-chain balance and awards holder points using
      sqrt(balance) diminishing returns. Call once per day for optimal rewards.
    `,
    inputSchema: claimHolderPointsSchema,
  },
  {
    name: 'record_reward_points',
    description: `
      Record reward points for a user. Used by platform integrations
      to award points for builder, player, holder, or purchaser activity.

      Points are recorded in the active airdrop season and will be
      converted to MBUCKS tokens at season end.
    `,
    inputSchema: recordRewardPointsSchema,
  },
];

// Tool handler types
export interface RewardToolHandlers {
  get_rewards_summary: (params: z.infer<typeof getRewardsSummarySchema>) => Promise<any>;
  get_rewards_leaderboard: (params: z.infer<typeof getRewardsLeaderboardSchema>) => Promise<any>;
  get_rewards_history: (params: z.infer<typeof getRewardsHistorySchema>) => Promise<any>;
  get_rewards_season: (params: z.infer<typeof getRewardsSeasonSchema>) => Promise<any>;
  claim_holder_points: (params: z.infer<typeof claimHolderPointsSchema>) => Promise<any>;
  record_reward_points: (params: z.infer<typeof recordRewardPointsSchema>) => Promise<any>;
}
