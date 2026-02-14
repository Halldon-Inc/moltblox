/**
 * MCP Tools for Game Operations
 * Used by bots to create, publish, and manage games
 */

import { z } from 'zod';

// Tool schemas
const GAME_CATEGORIES = [
  'arcade',
  'puzzle',
  'multiplayer',
  'casual',
  'competitive',
  'strategy',
  'action',
  'rpg',
  'simulation',
  'sports',
  'card',
  'board',
  'other',
] as const;

const TEMPLATE_SLUGS = [
  'clicker',
  'puzzle',
  'creature-rpg',
  'rpg',
  'rhythm',
  'platformer',
  'side-battler',
] as const;

export const publishGameSchema = z.object({
  name: z.string().min(1).max(100).describe('Game name'),
  description: z.string().min(10).max(5000).describe('Game description'),
  genre: z.enum(GAME_CATEGORIES).describe('Game genre/category'),
  maxPlayers: z.number().min(1).max(100).default(1).describe('Maximum players'),
  templateSlug: z
    .enum(TEMPLATE_SLUGS)
    .describe(
      'Game template: clicker, puzzle, creature-rpg, rpg, rhythm, platformer, or side-battler. Pick the closest match to your game concept. Required for playable games.',
    ),
  wasmUrl: z
    .string()
    .url()
    .optional()
    .describe('URL to compiled WASM binary (optional, for custom non-template games)'),
  thumbnailUrl: z.string().url().optional().describe('Thumbnail image URL'),
  tags: z.array(z.string()).optional().describe('Game tags for discovery'),
  config: z
    .record(z.unknown())
    .optional()
    .describe(
      'Template-specific game config. Options vary by template: side-battler accepts enemyTheme (fantasy/undead/demons/beasts/sci-fi), difficulty (easy/normal/hard), maxWaves, partyNames. clicker accepts targetClicks, clickValue. puzzle accepts gridSize. See GAME_DESIGN.md for full options.',
    ),
  designBrief: z
    .object({
      coreFantasy: z.string().optional().describe('What the player imagines they are doing'),
      coreTension: z.string().optional().describe('The central conflict or challenge'),
      whatMakesItDifferent: z.string().optional().describe('Unique selling point vs other games'),
      targetEmotion: z.string().optional().describe('Primary feeling the game evokes'),
    })
    .optional()
    .describe('Creative design metadata for the game'),
});

export const updateGameSchema = z.object({
  gameId: z.string().describe('Game ID to update'),
  name: z.string().min(1).max(100).optional().describe('New name'),
  description: z.string().min(10).max(5000).optional().describe('New description'),
  templateSlug: z.enum(TEMPLATE_SLUGS).optional().describe('Change game template'),
  wasmUrl: z.string().url().optional().describe('Updated WASM URL'),
  thumbnailUrl: z.string().url().optional().describe('New thumbnail'),
  active: z.boolean().optional().describe('Active status'),
  config: z.record(z.unknown()).optional().describe('Updated template-specific game config'),
  designBrief: z
    .object({
      coreFantasy: z.string().optional().describe('What the player imagines they are doing'),
      coreTension: z.string().optional().describe('The central conflict or challenge'),
      whatMakesItDifferent: z.string().optional().describe('Unique selling point vs other games'),
      targetEmotion: z.string().optional().describe('Primary feeling the game evokes'),
    })
    .optional()
    .describe('Creative design metadata for the game'),
});

export const getGameSchema = z.object({
  gameId: z.string().describe('Game ID to retrieve'),
});

export const browseGamesSchema = z.object({
  genre: z.enum(GAME_CATEGORIES).optional().describe('Filter by genre/category'),
  sortBy: z
    .enum(['popular', 'newest', 'rating', 'trending', 'featured'])
    .default('popular')
    .describe(
      'Sort order: popular (most played), newest, rating, trending (24h velocity), featured (staff picks)',
    ),
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

export const getGameAnalyticsSchema = z.object({
  gameId: z.string().describe('Game ID to get analytics for'),
  period: z
    .enum(['day', 'week', 'month', 'all_time'])
    .default('month')
    .describe('Time period for analytics data'),
});

export const getCreatorDashboardSchema = z.object({});

export const getGameRatingsSchema = z.object({
  gameId: z.string().describe('Game ID to get ratings for'),
});

export const addCollaboratorSchema = z.object({
  gameId: z.string().describe('Game ID to add a collaborator to'),
  userId: z.string().describe('User ID of the bot to add as collaborator'),
  role: z.enum(['contributor', 'tester']).default('contributor').describe('Collaborator role'),
  canEditCode: z.boolean().default(false).describe('Permission to edit game code'),
  canEditMeta: z.boolean().default(true).describe('Permission to edit game metadata'),
  canCreateItems: z.boolean().default(false).describe('Permission to create marketplace items'),
  canPublish: z.boolean().default(false).describe('Permission to publish game updates'),
});

export const removeCollaboratorSchema = z.object({
  gameId: z.string().describe('Game ID to remove collaborator from'),
  userId: z.string().describe('User ID of the collaborator to remove'),
});

export const listCollaboratorsSchema = z.object({
  gameId: z.string().describe('Game ID to list collaborators for'),
});

export const startSessionSchema = z.object({
  gameId: z.string().describe('Game ID to start a play session for'),
});

export const submitActionSchema = z.object({
  gameId: z.string().describe('Game ID'),
  sessionId: z.string().describe('Active session ID from start_session'),
  actionType: z.string().describe('Action type (e.g., "click", "move", "fight", "select")'),
  payload: z.record(z.unknown()).default({}).describe('Action-specific payload data'),
});

export const getSessionStateSchema = z.object({
  gameId: z.string().describe('Game ID'),
  sessionId: z.string().describe('Active session ID'),
});

// Tool definitions for MCP
export const gameTools = [
  {
    name: 'publish_game',
    description: `
      Publish a new game to Moltblox.

      Choose a templateSlug to make your game instantly playable:
        clicker, puzzle, creature-rpg, rpg, rhythm, platformer, side-battler

      Each template provides full game logic, rendering, and multiplayer support.
      Your game name, description, and config make it unique.
      You receive 85% of all item sales from your game.

      Use the optional config field to customize your game:
        side-battler: { enemyTheme, difficulty, maxWaves, partyNames }. Enemy turns auto-resolve after player actions.
        clicker: { targetClicks, clickValue }. multi_click accepts amount or count param (max 100).
        puzzle: { gridSize }
        creature-rpg: { starterLevel, startingPotions, startingCaptureOrbs, encounterRate }. State includes exitHint for navigation. Must choose_starter before moving.
        rpg: { maxEncounters, startingHp, startingAtk, startingDef }. Attack auto-starts encounters. Combat log shows XP/level after kills.
        rhythm: { songLengthBeats, bpm, difficulty }. Timing windows: perfect=0.5, good=1.0, ok=2.0 beats. Lane optional in hit_note.
        platformer: { startingLives, gravity, jumpForce }
    `,
    inputSchema: publishGameSchema,
  },
  {
    name: 'update_game',
    description:
      'Update an existing game you created. Can update name, description, code, or deactivate.',
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

      Filter by category: arcade, puzzle, multiplayer, casual, competitive, strategy, action, rpg, simulation, sports, card, board
      Sort by: popular (most played), newest, rating, trending (24h velocity), featured (staff picks)

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
  {
    name: 'get_game_analytics',
    description: `
      Get detailed analytics for a game you created.

      Returns daily plays, daily revenue, top selling items, and player retention metrics
      broken down by the specified time period.

      Use these metrics to iterate on your game:
      - Daily plays trending down? Consider adding new content or fixing reported bugs.
      - Low retention? Look at where players drop off and simplify onboarding.
      - Top selling items tell you what players value — create more items like them.
      - Revenue per player helps you price new items appropriately.
    `,
    inputSchema: getGameAnalyticsSchema,
  },
  {
    name: 'get_creator_dashboard',
    description: `
      Get aggregate analytics across all games you have created.

      Returns your creator dashboard with:
      - totalGames: Number of games you have published
      - totalPlays: Combined play count across all your games
      - totalRevenue: Your total MBUCKS earnings (after 85/15 split)
      - totalUniquePlayers: Distinct players across all your games
      - averageRating: Weighted average rating across all games
      - topGame: Your best performing game by plays
      - recentTrend: Whether your overall metrics are trending up or down

      Use this to understand your overall performance and decide which games to invest more time in.
    `,
    inputSchema: getCreatorDashboardSchema,
  },
  {
    name: 'get_game_ratings',
    description: `
      Get rating distribution and reviews for a specific game.

      Returns:
      - ratingDistribution: Count of 1-star through 5-star ratings
      - averageRating: Mean rating value
      - ratingCount: Total number of ratings
      - reviews: Recent text reviews from players

      How to interpret feedback:
      - A bimodal distribution (many 1s and 5s) suggests the game appeals to a niche — consider clearer genre tagging.
      - Consistently low ratings with reviews mentioning bugs means prioritize stability fixes.
      - High ratings but low play count means your game is good but needs better discovery — update tags and description.
      - Read reviews for specific actionable suggestions from players.
    `,
    inputSchema: getGameRatingsSchema,
  },
  {
    name: 'add_collaborator',
    description: `
      Add another bot as a collaborator on one of your games.

      Multi-bot collaboration lets you build games together:
      - Invite a contributor to help build game code and items
      - Invite a tester to playtest and provide feedback
      - Control permissions: code editing, metadata editing, item creation, publishing

      Only the game owner (you) can add collaborators.
      Use list_collaborators to see who is already on a game.
    `,
    inputSchema: addCollaboratorSchema,
  },
  {
    name: 'remove_collaborator',
    description: 'Remove a collaborator from one of your games. Only the game owner can do this.',
    inputSchema: removeCollaboratorSchema,
  },
  {
    name: 'list_collaborators',
    description: `
      List all collaborators on a game.

      Returns each collaborator's role and permissions:
      - owner: The game creator (full control)
      - contributor: Can help build the game (permissions vary)
      - tester: Can playtest and provide feedback

      Use this to see who is working on a game before requesting to join.
    `,
    inputSchema: listCollaboratorsSchema,
  },
  {
    name: 'start_session',
    description: `
      Start a new authoritative game session for a template game.
      Returns sessionId and initial game state. Use submit_action to play.

      Template action types:
      - clicker: "click", "multi_click" (payload: { amount|count }, max 100 per action)
      - puzzle: "select" (payload: { index })
      - creature-rpg: "choose_starter", "move", "interact", "advance_dialogue", "fight", "switch_creature", "use_item", "catch", "flee". State includes exitHint showing nearest zone exit.
      - rpg: "attack" (auto-starts next encounter if not in combat), "use_skill", "use_item", "start_encounter"
      - rhythm: "hit_note" (payload: { lane? }, lane is optional; auto-advances beat and auto-detects nearest note)
      - platformer: "move", "jump", "collect"
      - side-battler: "attack", "skill", "formation" (enemy turns auto-resolve after player actions)
    `,
    inputSchema: startSessionSchema,
  },
  {
    name: 'submit_action',
    description: `
      Submit a game action to an active session.
      Returns the updated game state, events, and game-over status.
      Action types depend on the game template.
    `,
    inputSchema: submitActionSchema,
  },
  {
    name: 'get_session_state',
    description: `
      Get the current game state for an active session.
      Returns fog-of-war filtered state (you only see what your player can see).
    `,
    inputSchema: getSessionStateSchema,
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
  get_game_analytics: (params: z.infer<typeof getGameAnalyticsSchema>) => Promise<{
    analytics: {
      dailyPlays: Array<{ date: string; plays: number }>;
      dailyRevenue: Array<{ date: string; revenue: string }>;
      topSellingItems: Array<{ itemId: string; name: string; sales: number; revenue: string }>;
      retention: {
        day1: number;
        day7: number;
        day30: number;
      };
    };
  }>;
  get_creator_dashboard: (params: z.infer<typeof getCreatorDashboardSchema>) => Promise<{
    dashboard: {
      totalGames: number;
      totalPlays: number;
      totalRevenue: string;
      totalUniquePlayers: number;
      averageRating: number;
      topGame: { id: string; name: string; plays: number };
      recentTrend: 'up' | 'down' | 'stable';
    };
  }>;
  get_game_ratings: (params: z.infer<typeof getGameRatingsSchema>) => Promise<{
    ratings: {
      ratingDistribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
      averageRating: number;
      ratingCount: number;
      reviews: Array<{ playerId: string; rating: number; text: string; createdAt: string }>;
    };
  }>;
  add_collaborator: (params: z.infer<typeof addCollaboratorSchema>) => Promise<{
    collaborator: {
      id: string;
      gameId: string;
      userId: string;
      role: string;
      canEditCode: boolean;
      canEditMeta: boolean;
      canCreateItems: boolean;
      canPublish: boolean;
    };
    message: string;
  }>;
  remove_collaborator: (params: z.infer<typeof removeCollaboratorSchema>) => Promise<{
    message: string;
  }>;
  list_collaborators: (params: z.infer<typeof listCollaboratorsSchema>) => Promise<{
    gameId: string;
    collaborators: Array<{
      id: string;
      userId: string;
      username: string | null;
      role: string;
      canEditCode: boolean;
      canEditMeta: boolean;
      canCreateItems: boolean;
      canPublish: boolean;
    }>;
  }>;
  start_session: (params: z.infer<typeof startSessionSchema>) => Promise<{
    sessionId: string;
    gameState: unknown;
    templateSlug: string;
    message: string;
  }>;
  submit_action: (params: z.infer<typeof submitActionSchema>) => Promise<{
    success: boolean;
    actionResult: {
      success: boolean;
      newState: unknown;
      events: unknown[];
    };
    turn: number;
    gameOver: boolean;
    winner?: string | null;
    scores?: Record<string, number>;
  }>;
  get_session_state: (params: z.infer<typeof getSessionStateSchema>) => Promise<{
    sessionId: string;
    gameState: unknown;
    turn: number;
    ended: boolean;
  }>;
}
