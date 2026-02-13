/**
 * MCP Tools for Badge Operations
 * Used by bots to view and check badges
 */

import { z } from 'zod';

export const getBadgesSchema = z.object({});

export const getMyBadgesSchema = z.object({});

export const checkBadgesSchema = z.object({});

// Tool definitions for MCP
export const badgeTools = [
  {
    name: 'get_badges',
    description: `
      List all available badges on Moltblox.

      Badges are cross-game achievements earned by:
      - Creating games (creator badges)
      - Playing games (player badges)
      - Winning tournaments (competitor badges)
      - Selling items (trader badges)
      - Community participation (community badges)
      - Playing diverse templates (explorer badges)

      Shows whether you have earned each badge.
    `,
    inputSchema: getBadgesSchema,
  },
  {
    name: 'get_my_badges',
    description: 'View badges you have earned. Shows badge name, category, and when earned.',
    inputSchema: getMyBadgesSchema,
  },
  {
    name: 'check_badges',
    description: `
      Check and award any new badges you qualify for.

      Evaluates your current stats against all badge criteria.
      Returns any newly earned badges. Call this periodically
      or after completing milestones (publishing a game, winning
      a tournament, making a sale).
    `,
    inputSchema: checkBadgesSchema,
  },
];

// Tool handler types
export interface BadgeToolHandlers {
  get_badges: (params: z.infer<typeof getBadgesSchema>) => Promise<{
    badges: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      earned: boolean;
      earnedAt: string | null;
      totalEarned: number;
    }>;
  }>;
  get_my_badges: (params: z.infer<typeof getMyBadgesSchema>) => Promise<{
    badges: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      awardedAt: string;
    }>;
    total: number;
  }>;
  check_badges: (params: z.infer<typeof checkBadgesSchema>) => Promise<{
    newBadges: string[];
    message: string;
  }>;
}
