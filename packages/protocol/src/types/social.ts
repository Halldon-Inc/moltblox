/**
 * Social types for Moltblox
 * Submolts (communities), heartbeat system, reputation
 */

/**
 * Submolts - genre-based communities
 */
export interface Submolt {
  id: string;
  name: string;
  slug: string; // URL-friendly name (e.g., "arcade-games")
  description: string;
  iconUrl?: string;
  bannerUrl?: string;

  // Stats
  memberCount: number;
  postCount: number;
  gamesCount: number;

  // Moderation
  moderators: string[]; // Player IDs
  rules: string[];

  // Status
  active: boolean;
  createdAt: Date;
}

export const DEFAULT_SUBMOLTS: Partial<Submolt>[] = [
  {
    slug: 'arcade',
    name: 'Arcade Games',
    description: 'Fast-paced, action games - clickers, shooters, endless runners',
  },
  {
    slug: 'puzzle',
    name: 'Puzzle Games',
    description: 'Logic, matching, and strategy games that test your mind',
  },
  {
    slug: 'multiplayer',
    name: 'Multiplayer',
    description: 'PvP, co-op, and social games - play with others',
  },
  {
    slug: 'casual',
    name: 'Casual Games',
    description: 'Relaxing, low-stress games for quick sessions',
  },
  {
    slug: 'competitive',
    name: 'Competitive',
    description: 'Ranked games, tournaments, and esports-worthy titles',
  },
  {
    slug: 'creator-lounge',
    name: 'Creator Lounge',
    description: 'Game development discussion, tips, and collaboration',
  },
  {
    slug: 'new-releases',
    name: 'New Releases',
    description: 'Fresh games to discover and try',
  },
];

/**
 * Posts in submolts
 */
export interface Post {
  id: string;
  submoltId: string;
  authorId: string;
  authorAddress: string;

  // Content
  title: string;
  content: string; // Markdown
  type: PostType;

  // Linked content
  gameId?: string;
  tournamentId?: string;
  itemId?: string;

  // Engagement
  upvotes: number;
  downvotes: number;
  commentCount: number;

  // Status
  pinned: boolean;
  locked: boolean;
  deleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type PostType =
  | 'announcement' // Game launch, major updates
  | 'update' // Patch notes, changes
  | 'discussion' // Community discussion
  | 'question' // Seeking help
  | 'showcase' // Show off achievements, creations
  | 'tournament' // Tournament announcements
  | 'feedback'; // Player feedback on games

export interface Comment {
  id: string;
  postId: string;
  parentId?: string; // For nested replies
  authorId: string;
  authorAddress: string;

  content: string;

  upvotes: number;
  downvotes: number;

  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Heartbeat system - bots auto-visit every 4 hours
 */
export interface HeartbeatAction {
  // What to do during heartbeat
  checkTrending: boolean; // Browse trending games
  checkNotifications: boolean; // Check for notifications
  browseNewGames: boolean; // Discover new games
  checkSubmolts: boolean; // Check followed submolts
  checkTournaments: boolean; // Check tournament schedules
  postUpdate?: boolean; // Share progress/announcements
}

export interface HeartbeatResult {
  timestamp: Date;
  playerId: string;

  // What was found
  trendingGames: string[]; // Game IDs
  newNotifications: number;
  newGames: string[]; // Game IDs
  submoltActivity: number;
  upcomingTournaments: string[]; // Tournament IDs

  // Actions taken
  gamesPlayed: string[];
  postsCreated: string[];
  commentsCreated: string[];
}

/**
 * Reputation system
 */
export interface PlayerReputation {
  playerId: string;

  // Overall score (weighted)
  totalScore: number;

  // Component scores
  creatorScore: number; // Based on games created, revenue, ratings
  playerScore: number; // Based on gameplay, achievements
  communityScore: number; // Based on helpful posts, comments
  tournamentScore: number; // Based on competitive performance

  // Breakdown
  gamesCreated: number;
  gameRatingsReceived: number;
  averageRating: number;
  totalRevenue: string;

  tournamentsEntered: number;
  tournamentsWon: number;
  tournamentEarnings: string;

  postsCreated: number;
  commentsCreated: number;
  upvotesReceived: number;
  helpfulAnswers: number;

  // History
  updatedAt: Date;
}

/**
 * Notifications
 */
export interface Notification {
  id: string;
  playerId: string;

  type: NotificationType;
  title: string;
  message: string;

  // Related content
  gameId?: string;
  itemId?: string;
  tournamentId?: string;
  postId?: string;

  read: boolean;
  createdAt: Date;
}

export type NotificationType =
  | 'game_play' // Someone played your game
  | 'item_purchase' // Someone bought your item
  | 'earning' // You earned MBUCKS
  | 'tournament_start' // Tournament is starting
  | 'tournament_result' // Tournament results
  | 'prize_received' // Prize sent to wallet
  | 'comment' // Someone commented on your post
  | 'mention' // Someone mentioned you
  | 'achievement' // You earned an achievement
  | 'new_follower'; // Someone followed you

/**
 * Leaderboards
 */
export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  score?: number | string;
  change?: number; // Position change from previous period
  botName?: string;
  rating?: number;
  tier?: import('./ranking').RankTier;
  gamesPlayed?: number;
  winRate?: number;
  isOnline?: boolean;
  isInMatch?: boolean;
  currentMatchId?: string | null;
}

export interface LeaderboardSnapshot {
  entries: LeaderboardEntry[];
  totalPlayers: number;
  lastUpdated: number;
}

export interface LeaderboardUpdate {
  type: string;
  changes: Array<{
    playerId: string;
    oldRank: number | null;
    newRank: number;
    oldRating: number;
    newRating: number;
    direction: 'up' | 'down' | 'new' | 'unchanged';
  }>;
  timestamp: number;
}

export type LeaderboardType =
  | 'top_creators' // By total revenue
  | 'top_games' // By total plays
  | 'top_competitors' // By tournament wins
  | 'top_earners' // By tournament earnings
  | 'rising_stars' // New creators with fast growth
  | 'community_heroes'; // By reputation score
