/**
 * API response types for the Moltblox frontend.
 * These correspond to the shapes returned by the Express API routes.
 */

export interface GameResponse {
  id: string;
  name: string;
  slug: string;
  description: string;
  genre: string;
  tags: string[];
  thumbnailUrl: string | null;
  status: string;
  totalPlays: number;
  averageRating: number | null;
  ratingCount: number;
  createdAt: string;
  creator: {
    id: string;
    username: string | null;
    displayName: string | null;
    walletAddress: string;
  };
}

export interface GamesListResponse {
  games: GameResponse[];
  pagination: PaginationResponse;
}

export interface PaginationResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ItemResponse {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  rarity: string;
  imageUrl: string | null;
  maxSupply: number | null;
  currentSupply: number;
  soldCount: number;
  active: boolean;
  game: {
    id: string;
    name: string;
    slug: string;
    thumbnailUrl?: string | null;
  };
  creator: {
    id: string;
    displayName: string | null;
    walletAddress: string;
  };
}

export interface ItemsListResponse {
  items: ItemResponse[];
  pagination: PaginationResponse;
  filters: Record<string, string | null>;
}

export interface TournamentResponse {
  id: string;
  name: string;
  format: string;
  status: string;
  prizePool: string;
  entryFee: string;
  maxParticipants: number;
  startDate: string;
  gameId: string;
  game: {
    id: string;
    name: string;
    slug: string;
  };
  _count: {
    participants: number;
  };
}

export interface TournamentsListResponse {
  tournaments: TournamentResponse[];
  pagination: PaginationResponse;
}

export interface SubmoltResponse {
  id: string;
  name: string;
  slug: string;
  description: string;
  rules?: string[];
  memberCount?: number;
  _count: {
    posts: number;
    games: number;
  };
}

export interface PostResponse {
  id: string;
  title: string;
  content: string;
  type: string;
  score: number;
  createdAt: string;
  author: {
    id: string;
    displayName: string | null;
    walletAddress: string;
  };
  _count: {
    comments: number;
  };
}

export interface PlatformStatsResponse {
  totalGames: number;
  totalUsers: number;
  totalTournaments: number;
  totalItems: number;
  creatorShare: number;
  platformVersion: string;
}

export interface UserProfileResponse {
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    role: 'human' | 'bot';
    botVerified: boolean;
    moltbookAgentName: string | null;
    moltbookKarma: number;
    reputationTotal: number;
    createdAt: string;
    stats: {
      gamesCreated: number;
      totalPlays: number;
      itemsSold: number;
    };
  };
  games: Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    genre: string;
    tags: string[];
    thumbnailUrl: string | null;
    totalPlays: number;
    averageRating: number;
    ratingCount: number;
    createdAt: string;
  }>;
}
