import { z } from 'zod';

// H5: Only allow https:// URLs for user-provided resources
const httpsUrl = z
  .string()
  .url()
  .refine((val) => val.startsWith('https://'), { message: 'URL must use https://' });

const templateSlugValues = [
  // Hand-coded templates
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
  'fps',
  'worms',
  // OpenSpiel ports: board games
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
  // OpenSpiel ports: card games
  'os-blackjack',
  'os-poker',
  'os-go-fish',
  'os-crazy-eights',
  'os-war',
  'os-gin-rummy',
  'os-hearts',
  'os-spades',
  'os-uno',
  // OpenSpiel ports: strategy / abstract
  'os-2048',
  'os-battleship',
  'os-liars-dice',
  'os-hanabi',
  // OpenSpiel ports: additional games
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
  // Tatham puzzle ports: grid logic
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
  // Tatham puzzle ports: constraint puzzles
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
  // Tatham puzzle ports: movement and spatial
  'tp-inertia',
  'tp-pegs',
  'tp-twiddle',
  'tp-untangle',
  'tp-cube',
  'tp-guess',
  'tp-same-game',
  'tp-undecided',
  'tp-black-box',
  // boardgame.io ports
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
  // RLCard ports
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
  // Solitairey ports (14)
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
  // Idle/incremental game ports (22)
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

export { templateSlugValues as TEMPLATE_SLUG_VALUES };

const templateSlugField = z.enum(templateSlugValues).optional().nullable();

export const browseGamesSchema = {
  query: z.object({
    genre: z.string().max(50).optional(),
    sort: z
      .enum(['popular', 'newest', 'rating', 'trending', 'featured'])
      .optional()
      .default('popular'),
    limit: z.string().regex(/^\d+$/).optional().default('20'),
    offset: z.string().regex(/^\d+$/).optional().default('0'),
    page: z.string().regex(/^\d+$/).optional(),
    search: z.string().max(200).optional().default(''),
    templateSlug: z
      .string()
      .max(50)
      .transform((v) => v?.toLowerCase())
      .optional(),
  }),
};

export const gameIdParamSchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
};

export const gameLookupParamSchema = {
  params: z.object({
    id: z.string().min(1).max(100),
  }),
};

export const createGameSchema = {
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(5000),
    genre: z.string().max(50).optional().default('other'),
    tags: z.array(z.string().max(50)).max(20).optional().default([]),
    maxPlayers: z.number().int().positive().max(1000).optional().default(1),
    wasmUrl: httpsUrl.optional().nullable(),
    templateSlug: templateSlugField,
    thumbnailUrl: httpsUrl.optional().nullable(),
    screenshots: z.array(httpsUrl).max(10).optional().default([]),
    config: z
      .record(z.unknown())
      .optional()
      .nullable()
      .refine(
        (val) => {
          if (typeof val !== 'object' || val === null) return true;
          const keys = Object.keys(val);
          return !keys.some((k) => ['__proto__', 'constructor', 'prototype'].includes(k));
        },
        { message: 'Invalid object keys' },
      ),
    designBrief: z
      .object({
        coreFantasy: z.string().max(500).optional(),
        coreTension: z.string().max(500).optional(),
        whatMakesItDifferent: z.string().max(500).optional(),
        targetEmotion: z.string().max(200).optional(),
      })
      .optional()
      .nullable(),
  }),
};

export const updateGameSchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z
    .object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().min(1).max(5000).optional(),
      genre: z.string().max(50).optional(),
      tags: z.array(z.string().max(50)).max(20).optional(),
      maxPlayers: z.number().int().positive().max(1000).optional(),
      // Prisma GameStatus has 5 values: draft, review, published, suspended, archived
      // Only 3 are user-settable via API; review and suspended are platform-managed
      status: z.enum(['draft', 'published', 'archived']).optional(),
      wasmUrl: httpsUrl.optional().nullable(),
      templateSlug: templateSlugField,
      thumbnailUrl: httpsUrl.optional().nullable(),
      screenshots: z.array(httpsUrl).max(10).optional(),
      config: z
        .record(z.unknown())
        .optional()
        .nullable()
        .refine(
          (val) => {
            if (typeof val !== 'object' || val === null) return true;
            const keys = Object.keys(val);
            return !keys.some((k) => ['__proto__', 'constructor', 'prototype'].includes(k));
          },
          { message: 'Invalid object keys' },
        ),
      designBrief: z
        .object({
          coreFantasy: z.string().max(500).optional(),
          coreTension: z.string().max(500).optional(),
          whatMakesItDifferent: z.string().max(500).optional(),
          targetEmotion: z.string().max(200).optional(),
        })
        .optional()
        .nullable(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' }),
};

export const rateGameSchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    rating: z.number().int().min(1).max(5),
    review: z.string().max(2000).optional(),
  }),
};

export const deleteGameSchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
};

export const recordPlaySchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    scores: z.record(z.number()).optional(),
  }),
};

export const startSessionSchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
};

export const sessionParamsSchema = {
  params: z.object({
    id: z.string().cuid(),
    sessionId: z.string().cuid(),
  }),
};

export const spectateQuerySchema = {
  params: z.object({
    id: z.string().cuid(),
  }),
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional().default('10'),
  }),
};

export const submitActionSchema = {
  params: z.object({
    id: z.string().cuid(),
    sessionId: z.string().cuid(),
  }),
  body: z
    .object({
      type: z.string().min(1).max(100).optional(),
      actionType: z.string().min(1).max(100).optional(),
      payload: z
        .record(z.unknown())
        .default({})
        .refine(
          (val) => {
            if (typeof val !== 'object' || val === null) return true;
            const keys = Object.keys(val);
            return !keys.some((k) => ['__proto__', 'constructor', 'prototype'].includes(k));
          },
          { message: 'Invalid object keys' },
        ),
    })
    .refine((data) => data.type || data.actionType, {
      message: 'Either type or actionType is required',
    })
    .transform((data) => ({
      type: data.type || data.actionType!,
      payload: data.payload,
    })),
};
