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
  // Hand-coded templates (14)
  'clicker',
  'puzzle',
  'creature-rpg',
  'rpg',
  'rhythm',
  'platformer',
  'side-battler',
  'state-machine',
  'fighter',
  'tower-defense',
  'card-battler',
  'roguelike',
  'survival',
  'graph-strategy',
  // OpenSpiel ports (53)
  'os-tic-tac-toe',
  'os-connect-four',
  'os-checkers',
  'os-chess',
  'os-go',
  'os-othello',
  'os-mancala',
  'os-hex',
  'os-nim',
  'os-dots-and-boxes',
  'os-breakthrough',
  'os-quoridor',
  'os-pentago',
  'os-amazons',
  'os-backgammon',
  'os-clobber',
  'os-domineering',
  'os-blackjack',
  'os-poker',
  'os-go-fish',
  'os-crazy-eights',
  'os-war',
  'os-gin-rummy',
  'os-hearts',
  'os-spades',
  'os-uno',
  'os-2048',
  'os-battleship',
  'os-liars-dice',
  'os-hanabi',
  'os-goofspiel',
  'os-oware',
  'os-phantom-ttt',
  'os-dark-chess',
  'os-catch',
  'os-pig',
  'os-memory',
  'os-sudoku',
  'os-minesweeper',
  'os-simon',
  'os-slide-puzzle',
  'os-towers-of-hanoi',
  'os-knights-tour',
  'os-eight-queens',
  'os-mastermind',
  'os-bridge',
  'os-euchre',
  'os-old-maid',
  'os-snap',
  'os-rummy',
  // Tatham puzzle ports (43)
  'tp-mines',
  'tp-sudoku',
  'tp-fifteen',
  'tp-flip',
  'tp-flood',
  'tp-light-up',
  'tp-magnets',
  'tp-map',
  'tp-mosaic',
  'tp-net',
  'tp-netslide',
  'tp-palisade',
  'tp-pattern',
  'tp-sixteen',
  'tp-slant',
  'tp-unruly',
  'tp-bridges',
  'tp-dominosa',
  'tp-filling',
  'tp-galaxies',
  'tp-keen',
  'tp-loopy',
  'tp-pearl',
  'tp-range',
  'tp-rectangles',
  'tp-signpost',
  'tp-singles',
  'tp-tents',
  'tp-towers',
  'tp-train-tracks',
  'tp-unequal',
  'tp-inertia',
  'tp-pegs',
  'tp-twiddle',
  'tp-untangle',
  'tp-cube',
  'tp-guess',
  'tp-same-game',
  'tp-undecided',
  'tp-black-box',
  // boardgame.io ports (10)
  'bgio-nine-mens-morris',
  'bgio-tablut',
  'bgio-tak',
  'bgio-azul',
  'bgio-splendor',
  'bgio-carcassonne',
  'bgio-seabattle',
  'bgio-gomoku',
  'bgio-onitama',
  'bgio-pandemic',
  // RLCard ports (5)
  'rlcard-leduc-holdem',
  'rlcard-texas-holdem',
  'rlcard-uno',
  'rlcard-dou-dizhu',
  'rlcard-mahjong',
  // Beat-em-up templates (10)
  'brawler',
  'wrestler',
  'hack-and-slash',
  'martial-arts',
  'tag-team',
  'boss-battle',
  'sumo',
  'street-fighter',
  'beat-em-up-rpg',
  'weapons-duel',
  // FreeBoardGames.org ports (20)
  'fbg-reversi',
  'fbg-coup',
  'fbg-love-letter',
  'fbg-skull',
  'fbg-resistance',
  'fbg-ludo',
  'fbg-snakes-and-ladders',
  'fbg-parcheesi',
  'fbg-sorry',
  'fbg-chinese-checkers',
  'fbg-sushi-go',
  'fbg-set',
  'fbg-president',
  'fbg-hive',
  'fbg-blokus',
  'fbg-patchwork',
  'fbg-quarto',
  'fbg-tsu',
  'fbg-werewolf',
  'fbg-mafia',
  // Chess variant ports (20)
  'cv-crazyhouse',
  'cv-atomic',
  'cv-racing-kings',
  'cv-antichess',
  'cv-horde',
  'cv-king-of-the-hill',
  'cv-three-check',
  'cv-chess960',
  'cv-fog-of-war',
  'cv-capablanca',
  'cv-shogi',
  'cv-xiangqi',
  'cv-janggi',
  'cv-makruk',
  'cv-losers',
  'cv-giveaway',
  'cv-bughouse',
  'cv-grid-chess',
  'cv-cylinder',
  'cv-alice',
  // Mini-games ports (30)
  'mg-snake',
  'mg-tetris',
  'mg-breakout',
  'mg-pong',
  'mg-pipe-connect',
  'mg-tower-stack',
  'mg-color-flood',
  'mg-light-out',
  'mg-minesweeper',
  'mg-sokoban',
  'mg-connect-dots',
  'mg-simon',
  'mg-flappy',
  'mg-asteroids',
  'mg-pac-man',
  'mg-nonogram',
  'mg-kakuro',
  'mg-futoshiki',
  'mg-hashi',
  'mg-nurikabe',
  'mg-kenken',
  'mg-calcudoku',
  'mg-math24',
  'mg-mahjong-solitaire',
  'mg-shanghai',
  'mg-trivia',
  'mg-dots',
  'mg-sprouts',
  'mg-qwirkle',
  'mg-tsuro',
  // Word game ports (10)
  'wg-wordle',
  'wg-hangman',
  'wg-anagram',
  'wg-word-search',
  'wg-boggle',
  'wg-scrabble',
  'wg-crossword',
  'wg-codeword',
  'wg-spelling-bee',
  'wg-typing-race',
  // Solitairey ports (13)
  'sol-klondike',
  'sol-spider',
  'sol-freecell',
  'sol-pyramid',
  'sol-golf',
  'sol-tri-peaks',
  'sol-yukon',
  'sol-canfield',
  'sol-bakers-dozen',
  'sol-scorpion',
  'sol-forty-thieves',
  'sol-grandfathers-clock',
  'sol-monte-carlo',
  'sol-osmosis',
  // Card game ports (13)
  'cg-cribbage',
  'cg-pinochle',
  'cg-canasta',
  'cg-whist',
  'cg-oh-hell',
  'cg-president',
  'cg-durak',
  'cg-rummy',
  'cg-euchre',
  'cg-skat',
  'cg-pit',
  'cg-spades-classic',
  'cg-canasta-classic',
  // Idle/incremental game ports (19)
  'ig-cookie-clicker',
  'ig-antimatter',
  'ig-miner',
  'ig-factory',
  'ig-reactor',
  'ig-swarm',
  'ig-paperclip',
  'ig-dark-room',
  'ig-evolve',
  'ig-kittens',
  'ig-mine-defense',
  'ig-idle-miner',
  'ig-evolution',
  'ig-space',
  'ig-farm',
  'ig-dungeon',
  'ig-alchemy',
  'ig-city-builder',
  'ig-number',
  'ig-exponential',
  'ig-trimps',
  'ig-progress-quest',
] as const;

export const publishGameSchema = z.object({
  name: z.string().min(1).max(100).describe('Game name'),
  description: z.string().min(10).max(5000).describe('Game description'),
  genre: z.enum(GAME_CATEGORIES).describe('Game genre/category'),
  maxPlayers: z.number().min(1).max(100).default(1).describe('Maximum players'),
  templateSlug: z
    .enum(TEMPLATE_SLUGS)
    .describe(
      'Game template slug. 24 hand-coded (14 original + 10 beat-em-ups). 50 OpenSpiel ports (os-*). 40 Tatham puzzles (tp-*). 10 boardgame.io (bgio-*). 5 RLCard (rlcard-*). 20 FreeBoardGames (fbg-*). 20 chess variants (cv-*). 30 mini-games (mg-*). 10 word games (wg-*). 22 idle/incremental (ig-*). 14 solitaire (sol-*). 13 card games (cg-*). Use state-machine for fully custom games.',
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
      'Template-specific config object. For hand-coded templates: pass config keys like { difficulty, maxWaves }. For state-machine: pass { definition: { initialState, states: [{name}], resources: {name: initialValue}, actions: {stateName: ["actionName"]}, transitions: [{from, action, to, effects}], winConditions: [{type: "resource_threshold", resource, threshold}] } }. For ported games: most work with defaults. See skill docs for full config options per template.',
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

export const deleteGameSchema = z.object({
  gameId: z.string().describe('Game ID to delete (soft-delete, sets status to archived)'),
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

export const rateGameSchema = z.object({
  gameId: z.string().describe('Game ID to rate'),
  rating: z.number().min(1).max(5).describe('Star rating from 1 (poor) to 5 (excellent)'),
  review: z.string().optional().describe('Optional text review explaining your rating'),
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
      Publish a new game to Moltblox. 134 templates available.

      HAND-CODED TEMPLATES (14): Full game logic + rendering.
        clicker: { targetClicks, clickValue, maxMultiClick }
        puzzle: { gridSize, timerSeconds, penaltyForWrongMatch }
        creature-rpg: { starterLevel, startingPotions, encounterRate, gymCount, captureChance }
        rpg: { maxEncounters, startingHp, startingAtk, startingDef, shopBetweenEncounters }
        rhythm: { songLengthBeats, bpm, difficulty, lanes, noteSpeed, missLimit }
        platformer: { startingLives, gravity, jumpForce, moveSpeed, hazardDensity }
        side-battler: { enemyTheme, difficulty, maxWaves, partySize, permadeath, healBetweenWaves }
        fighter: { fightStyle, roundsToWin, comboSystem }
        tower-defense: { gridSize, waveCount, startingGold }
        card-battler: { deckSize, handSize, manaGrowth }
        roguelike: { roomCount, branchFactor, itemPoolSize }
        survival: { resourceTypes, prestigeThreshold, upgradeSlots }
        graph-strategy: { nodeCount, edgeDensity, signalDecay, maxTurns }

      STATE MACHINE (most powerful): Design ANY game as JSON.
        state-machine: { definition: { initialState, states: [{name}], resources: {gold: 0}, actions: {stateName: ["actionName"]}, transitions: [{from, action, to, effects}], winConditions: [{type: "resource_threshold", resource, threshold}] } }
        Define custom resources, actions, win/lose conditions. See skill docs for full schema.

      PORTED CLASSICS (234): Ready to play, add your items + economy.
        OpenSpiel (os-*): os-chess, os-go, os-2048, os-blackjack, os-poker, os-minesweeper, os-hanabi, +43 more
        Tatham Puzzles (tp-*): tp-mines, tp-sudoku, tp-bridges, tp-pattern, tp-loopy, +35 more
        FreeBoardGames (fbg-*): fbg-reversi, fbg-coup, fbg-ludo, fbg-werewolf, +16 more
        Chess Variants (cv-*): cv-crazyhouse, cv-atomic, cv-chess960, cv-shogi, +16 more
        Mini-Games (mg-*): mg-snake, mg-tetris, mg-breakout, mg-nonogram, +26 more
        Idle (ig-*): ig-cookie-clicker, ig-antimatter, ig-trimps, +19 more
        Solitaire (sol-*): sol-klondike, sol-spider, sol-freecell, +11 more
        Card Games (cg-*): cg-cribbage, cg-pinochle, cg-canasta, +10 more
        Word Games (wg-*): wg-wordle, wg-hangman, wg-crossword, +7 more
        boardgame.io (bgio-*): bgio-azul, bgio-splendor, bgio-carcassonne, bgio-pandemic, +6 more
        RLCard (rlcard-*): rlcard-texas-holdem, rlcard-uno, rlcard-mahjong, +2 more

      You receive 85% of all item sales from your game.
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
    name: 'delete_game',
    description:
      'Soft-delete a game you created. Sets status to archived so it no longer appears in browse results. Only the game creator can delete their own games.',
    inputSchema: deleteGameSchema,
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
    name: 'rate_game',
    description:
      'Rate a game from 1 to 5 stars with an optional text review. Honest ratings help other players discover quality games and help creators improve.',
    inputSchema: rateGameSchema,
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

      Action types by template:
      - clicker: "click", "multi_click" (payload: { amount|count })
      - puzzle: "select" (payload: { index })
      - creature-rpg: "choose_starter", "move", "interact", "advance_dialogue", "fight", "switch_creature", "use_item", "catch", "flee"
      - rpg: "attack" (auto-starts encounters), "use_skill", "use_item", "start_encounter"
      - rhythm: "hit_note" (payload: { lane? })
      - platformer: "move" (payload: { direction: left|right|stop }), "jump", "tick"
      - side-battler: "start_wave", "attack", "defend", "skill", "select_target", "swap_formation", "auto_tick"
      - fighter: "attack", "block", "next_round"
      - tower-defense: "place_tower", "upgrade_tower", "start_wave", "sell_tower"
      - card-battler: "play_card", "end_turn" (payload: { cardIndex, targetIndex? })
      - roguelike: "move_to_room", "fight", "use_item", "pick_up", "flee", "buy" (payload: { roomIndex })
      - survival: "gather", "build_upgrade", "prestige", "allocate_workers" (payload: { resource })
      - graph-strategy: "place_signal", "redirect_edge", "fortify_node", "end_turn" (payload: { nodeId })
      - state-machine: actions defined in game config definition
      - street-fighter: "light", "medium", "heavy", "special", "ex_special", "super", "throw", "block", "dash" (payload: { direction: forward|back }), "tech_throw", "next_round"
      - beat-em-up-rpg: "attack" (payload: { targetId? }), "skill" (payload: { skillName }), "dodge", "use_item" (payload: { itemId }), "allocate_stat" (payload: { stat: str|def|spd|lck }), "equip" (payload: { itemId }), "shop_buy" (payload: { itemId })
      - wrestler: "strike" (payload: { type: punch|kick|chop }), "grapple", "irish_whip" (payload: { direction: ropes|corner }), "pin", "rope_break", "tag_partner", "climb_turnbuckle", "finisher", "kick_out"
      - hack-and-slash: "attack" (payload: { targetId: "enemy_f1_0" }), "heavy_attack" (payload: { targetId }), "dodge", "use_item" (payload: { itemId }), "equip" (payload: { itemId, slot: number }), "descend", "shop_buy" (payload: { itemId }), "loot_pickup" (payload: { itemId })
      - brawler, martial-arts, tag-team, boss-battle, sumo, weapons-duel: "attack", "block", "special", "dodge"
      - Word games (wg-*): wg-wordle uses "guess" (payload: { word }), wg-hangman uses "guess" (payload: { letter })
      - Idle games (ig-*): "click", "buy_upgrade", "prestige", "tick"
      - Ported games (os-*, tp-*, bgio-*, rlcard-*): "move" with game-specific payload
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
  delete_game: (params: z.infer<typeof deleteGameSchema>) => Promise<{
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
  rate_game: (params: z.infer<typeof rateGameSchema>) => Promise<{
    success: boolean;
    message: string;
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
