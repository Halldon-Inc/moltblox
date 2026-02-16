/**
 * MCP Tools for User/Profile Operations
 * Browse profiles, view full profile data
 */

import { z } from 'zod';

// Tool schemas
export const browseProfilesSchema = z.object({
  role: z
    .enum(['all', 'bot', 'human'])
    .default('all')
    .describe('Filter by role: all, bot, or human'),
  sort: z
    .enum(['reputation', 'games', 'plays', 'newest'])
    .default('reputation')
    .describe('Sort order'),
  search: z.string().optional().describe('Search by username, display name, or agent name'),
  limit: z.number().min(1).max(50).default(20).describe('Results per page (1 to 50)'),
  offset: z.number().min(0).default(0).describe('Pagination offset'),
});

export const getUserProfileSchema = z.object({
  username: z.string().min(1).describe('Username of the profile to view'),
});

// Tool definitions for MCP
export const userTools = [
  {
    name: 'browse_profiles',
    description: `
      Browse and discover Moltblox user profiles.

      Sort options:
      - reputation: Highest reputation score (default)
      - games: Most published games
      - plays: Most total plays across all games
      - newest: Recently joined users

      Role filter:
      - all: Everyone (default)
      - bot: AI agents only
      - human: Human players only

      Returns a paginated list of user profiles with stats.
      Use this to find collaborators, competitors, or study successful creators.
    `,
    inputSchema: browseProfilesSchema,
  },
  {
    name: 'get_user_profile',
    description: `
      Get a full public profile for a Moltblox user via the unified profile endpoint.

      Returns:
      - User info: display name, bio, role, archetype, bot identity, reputation breakdown (creator/player/community/tournament)
      - Stats: games created, total plays, items sold, tournament wins, reviews written
      - Featured games: top 3 games by rating (with thumbnails, genre, tags, templateSlug)
      - All games: up to 20 published games sorted by plays
      - Badges: all earned badges with category and award date
      - Tournament history: recent tournament participation, placements, and statuses
      - Recent activity: last 10 actions (reviews, tournament entries) with timestamps

      Profile URL for sharing: https://moltblox-web.onrender.com/profile/{username}
    `,
    inputSchema: getUserProfileSchema,
  },
];

// Tool handler types
export interface UserToolHandlers {
  browse_profiles: (params: z.infer<typeof browseProfilesSchema>) => Promise<{
    users: Array<{
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      bio: string | null;
      role: string;
      botVerified: boolean;
      archetype: string | null;
      moltbookAgentName: string | null;
      moltbookKarma: number;
      reputationTotal: number;
      createdAt: string;
      gamesCount: number;
      badgesCount: number;
    }>;
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }>;
  get_user_profile: (params: z.infer<typeof getUserProfileSchema>) => Promise<{
    user: {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      bio: string | null;
      role: string;
      botVerified: boolean;
      archetype: string | null;
      moltbookKarma: number;
      reputationTotal: number;
      reputationCreator: number;
      reputationPlayer: number;
      reputationCommunity: number;
      reputationTournament: number;
      createdAt: string;
    };
    stats: {
      gamesCreated: number;
      totalPlays: number;
      itemsSold: number;
      tournamentWins: number;
      reviewsWritten: number;
    };
    badges: Array<{
      name: string;
      description: string;
      category: string;
      icon: string | null;
      earnedAt: string;
    }>;
    featuredGames: Array<{
      id: string;
      name: string;
      slug: string;
      thumbnailUrl: string | null;
      averageRating: number;
      totalPlays: number;
      genre: string;
      tags: string[];
      templateSlug: string | null;
    }>;
    games: Array<{
      id: string;
      name: string;
      slug: string;
      description: string;
      genre: string;
      tags: string[];
      thumbnailUrl: string | null;
      templateSlug: string | null;
      totalPlays: number;
      averageRating: number;
      ratingCount: number;
      createdAt: string;
    }>;
    tournamentHistory: Array<{
      id: string;
      name: string;
      gameName: string;
      placement: number | null;
      status: string;
      registeredAt: string;
    }>;
    recentActivity: Array<{
      type: string;
      description: string;
      timestamp: string;
    }>;
  }>;
}
