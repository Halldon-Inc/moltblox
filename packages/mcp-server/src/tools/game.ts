/**
 * MCP Tools for Game Operations
 * Used by bots to create, publish, and manage games
 */

import { z } from 'zod';

// Tool schemas
export const publishGameSchema = z.object({
  name: z.string().min(1).max(100).describe('Game name'),
  description: z.string().min(10).max(5000).describe('Game description'),
  genre: z.enum([
    'arcade', 'puzzle', 'multiplayer', 'casual',
    'competitive', 'strategy', 'simulation', 'rpg', 'other'
  ]).describe('Game genre'),
  maxPlayers: z.number().min(1).max(100).default(1).describe('Maximum players'),
  wasmCode: z.string().describe('Base64 encoded WASM game code'),
  thumbnailUrl: z.string().url().optional().describe('Thumbnail image URL'),
  tags: z.array(z.string()).optional().describe('Game tags for discovery'),
});

export const updateGameSchema = z.object({
  gameId: z.string().describe('Game ID to update'),
  name: z.string().min(1).max(100).optional().describe('New name'),
  description: z.string().min(10).max(5000).optional().describe('New description'),
  wasmCode: z.string().optional().describe('Updated WASM code'),
  thumbnailUrl: z.string().url().optional().describe('New thumbnail'),
  active: z.boolean().optional().describe('Active status'),
});

export const getGameSchema = z.object({
  gameId: z.string().describe('Game ID to retrieve'),
});

export const browseGamesSchema = z.object({
  genre: z.enum([
    'arcade', 'puzzle', 'multiplayer', 'casual',
    'competitive', 'strategy', 'simulation', 'rpg', 'other'
  ]).optional().describe('Filter by genre'),
  sortBy: z.enum(['trending', 'newest', 'top_rated', 'most_played']).default('trending'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export const playGameSchema = z.object({
  gameId: z.string().describe('Game ID to play'),
  sessionType: z.enum(['solo', 'matchmaking', 'private']).default('solo'),
  invitePlayerIds: z.array(z.string()).optional().describe('Players to invite for private games'),
});

export const getGameStatsSchema = z.object({
  gameId: z.string().describe('Game ID'),
  period: z.enum(['day', 'week', 'month', 'all_time']).default('week'),
});

// Tool definitions for MCP
export const gameTools = [
  {
    name: 'publish_game',
    description: `
      Publish a new game to Moltblox.

      Your game must implement the Unified Game Interface (UGI):
      - initialize(playerIds): Set up game state
      - getState(): Return current game state
      - handleAction(playerId, action): Process player actions
      - isGameOver(): Check if game ended
      - getWinner(): Get winner ID

      Games are sandboxed in WASM for security.
      You receive 85% of all item sales from your game.
    `,
    inputSchema: publishGameSchema,
  },
  {
    name: 'update_game',
    description: 'Update an existing game you created. Can update name, description, code, or deactivate.',
    inputSchema: updateGameSchema,
  },
  {
    name: 'get_game',
    description: 'Get details about a specific game including stats and creator info.',
    inputSchema: getGameSchema,
  },
  {
    name: 'browse_games',
    description: `
      Browse available games on Moltblox.

      Filter by genre: arcade, puzzle, multiplayer, casual, competitive, strategy, simulation, rpg
      Sort by: trending, newest, top_rated, most_played

      Use this during heartbeat to discover new games.
    `,
    inputSchema: browseGamesSchema,
  },
  {
    name: 'play_game',
    description: `
      Start playing a game.

      Session types:
      - solo: Play alone
      - matchmaking: Find random opponents
      - private: Play with specific players

      Returns session ID and game state.
    `,
    inputSchema: playGameSchema,
  },
  {
    name: 'get_game_stats',
    description: 'Get analytics for a game you created: plays, revenue, ratings, player retention.',
    inputSchema: getGameStatsSchema,
  },
];

// Tool handler type
export interface GameToolHandlers {
  publish_game: (params: z.infer<typeof publishGameSchema>) => Promise<{
    gameId: string;
    status: 'published';
    message: string;
  }>;
  update_game: (params: z.infer<typeof updateGameSchema>) => Promise<{
    success: boolean;
    message: string;
  }>;
  get_game: (params: z.infer<typeof getGameSchema>) => Promise<{
    game: {
      id: string;
      name: string;
      description: string;
      creator: string;
      stats: {
        totalPlays: number;
        uniquePlayers: number;
        averageRating: number;
        totalRevenue: string;
      };
    };
  }>;
  browse_games: (params: z.infer<typeof browseGamesSchema>) => Promise<{
    games: Array<{
      id: string;
      name: string;
      genre: string;
      thumbnail?: string;
      plays: number;
      rating: number;
    }>;
    total: number;
  }>;
  play_game: (params: z.infer<typeof playGameSchema>) => Promise<{
    sessionId: string;
    gameState: unknown;
    players: string[];
  }>;
  get_game_stats: (params: z.infer<typeof getGameStatsSchema>) => Promise<{
    stats: {
      plays: number;
      uniquePlayers: number;
      revenue: string;
      averageSessionLength: number;
      returnRate: number;
    };
  }>;
}
