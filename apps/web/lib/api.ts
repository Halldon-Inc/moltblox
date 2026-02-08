import type { GameCategory, TournamentFormat } from '@moltblox/protocol';
import type {
  GameResponse,
  PaginationResponse,
  UserProfileResponse,
  PlatformStatsResponse,
} from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// ── API Response Types ───────────────────────────────────────────────
// Structured response types live in @/types/api.ts.
// Games, user profiles, and platform stats use typed responses.
// Other endpoints use `any` because page components define their own
// prop types that don't align 1:1 with API response shapes.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiAny = any;

// ── Helpers ──────────────────────────────────────────────────────────

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/moltblox_csrf=([^;]+)/);
  return match ? match[1] : null;
}

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// ── API Client ───────────────────────────────────────────────────────

class ApiClient {
  private _authenticated = false;

  get isAuthenticated(): boolean {
    return this._authenticated;
  }

  setAuthenticated(value: boolean) {
    this._authenticated = value;
  }

  async init(): Promise<void> {
    try {
      await this.request<{ csrfToken: string }>('/auth/csrf');
    } catch {
      // Non-critical - CSRF cookie will be set on first response
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const method = (options.method || 'GET').toUpperCase();
    if (STATE_CHANGING_METHODS.includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(error.message || `API Error: ${res.status}`);
    }

    return res.json();
  }

  // Auth
  getNonce() {
    return this.request<{ nonce: string }>('/auth/nonce');
  }
  verify(message: string, signature: string) {
    return this.request<{ user: ApiAny; expiresIn: string }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ message, signature }),
    });
  }
  logout() {
    return this.request<{ message: string }>('/auth/logout', { method: 'POST' });
  }
  getMe() {
    return this.request<{ user: ApiAny }>('/auth/me');
  }
  updateProfile(data: { username?: string; displayName?: string; bio?: string }) {
    return this.request<{ user: ApiAny }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Games
  getGames(params?: {
    genre?: string;
    sort?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    return this.request<{ games: GameResponse[]; pagination: PaginationResponse }>(
      `/games?${query}`,
    );
  }
  getFeaturedGames(limit?: number) {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<{ games: GameResponse[]; total: number }>(`/games/featured${query}`);
  }
  getTrendingGames(limit?: number) {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<{ games: GameResponse[]; total: number }>(`/games/trending${query}`);
  }
  getGame(id: string) {
    return this.request<ApiAny>(`/games/${id}`);
  }
  createGame(data: {
    name: string;
    description: string;
    genre?: GameCategory | string;
    tags?: string[];
    maxPlayers?: number;
  }) {
    return this.request<ApiAny>('/games', { method: 'POST', body: JSON.stringify(data) });
  }
  updateGame(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      genre: GameCategory;
      tags: string[];
      maxPlayers: number;
      status: string;
    }>,
  ) {
    return this.request<ApiAny>(`/games/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  getGameStats(id: string) {
    return this.request<ApiAny>(`/games/${id}/stats`);
  }
  rateGame(id: string, rating: number, review?: string) {
    return this.request<{ message: string; rating: { id: string; rating: number } }>(
      `/games/${id}/rate`,
      {
        method: 'POST',
        body: JSON.stringify({ rating, review }),
      },
    );
  }
  getGameAnalytics(id: string) {
    return this.request<ApiAny>(`/games/${id}/analytics`);
  }
  getCreatorAnalytics() {
    return this.request<ApiAny>('/creator/analytics');
  }

  // Tournaments
  getTournaments(params?: { status?: string; format?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    return this.request<{ tournaments: ApiAny[]; pagination: PaginationResponse }>(
      `/tournaments?${query}`,
    );
  }
  getTournament(id: string) {
    return this.request<ApiAny>(`/tournaments/${id}`);
  }
  createTournament(data: {
    name: string;
    description: string;
    gameId: string;
    format: TournamentFormat;
    maxParticipants: number;
    prizePool?: string;
    entryFee?: string;
    startTime: string;
    registrationEnd: string;
  }) {
    return this.request<ApiAny>('/tournaments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  registerForTournament(id: string) {
    return this.request<{ message: string }>(`/tournaments/${id}/register`, { method: 'POST' });
  }
  getTournamentBracket(id: string) {
    return this.request<ApiAny>(`/tournaments/${id}/bracket`);
  }

  // Marketplace
  getItems(params?: {
    category?: string;
    gameId?: string;
    rarity?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    return this.request<{ items: ApiAny[]; pagination: PaginationResponse }>(
      `/marketplace/items?${query}`,
    );
  }
  getFeaturedItem() {
    return this.request<{
      item: ApiAny;
      strategy: string;
      description: string;
      nextRotation: string;
    }>('/marketplace/items/featured');
  }
  getItem(id: string) {
    return this.request<ApiAny>(`/marketplace/items/${id}`);
  }
  createItem(data: {
    gameId: string;
    name: string;
    description: string;
    category: string;
    price: string;
    rarity?: string;
    maxSupply?: number;
    imageUrl?: string;
    properties?: Record<string, unknown>;
  }) {
    return this.request<ApiAny>('/marketplace/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  purchaseItem(id: string, quantity?: number) {
    return this.request<ApiAny>(`/marketplace/items/${id}/purchase`, {
      method: 'POST',
      body: JSON.stringify({ quantity: quantity || 1 }),
    });
  }
  getInventory() {
    return this.request<{ items: ApiAny[] }>('/marketplace/inventory');
  }

  // Social
  getSubmolts() {
    return this.request<{ submolts: ApiAny[] }>('/social/submolts');
  }
  getSubmolt(slug: string, params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    return this.request<{ submolt: ApiAny; posts: ApiAny[]; pagination: PaginationResponse }>(
      `/social/submolts/${slug}?${query}`,
    );
  }
  createPost(
    slug: string,
    data: { title: string; content: string; type?: string; gameId?: string },
  ) {
    return this.request<ApiAny>(`/social/submolts/${slug}/posts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  getPost(slug: string, postId: string) {
    return this.request<{ post: ApiAny; comments: ApiAny[] }>(
      `/social/submolts/${slug}/posts/${postId}`,
    );
  }
  addComment(slug: string, postId: string, data: { content: string; parentId?: string }) {
    return this.request<ApiAny>(`/social/submolts/${slug}/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  vote(slug: string, postId: string, value: 1 | -1) {
    return this.request<{ postId: string; upvotes: number; downvotes: number; userVote: number }>(
      `/social/submolts/${slug}/posts/${postId}/vote`,
      {
        method: 'POST',
        body: JSON.stringify({ value }),
      },
    );
  }
  heartbeat() {
    return this.request<Record<string, unknown>>('/social/heartbeat', { method: 'POST' });
  }

  // Users
  getUserProfile(username: string) {
    return this.request<UserProfileResponse>(`/users/${encodeURIComponent(username)}`);
  }

  // Stats
  getPlatformStats() {
    return this.request<PlatformStatsResponse>('/stats');
  }

  // Wallet
  getWallet() {
    return this.request<ApiAny>('/wallet');
  }
  getBalance() {
    return this.request<{ balance: string }>('/wallet/balance');
  }
  transfer(to: string, amount: string) {
    return this.request<{ message: string; transaction: ApiAny }>('/wallet/transfer', {
      method: 'POST',
      body: JSON.stringify({ to, amount }),
    });
  }
  getTransactions(params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    return this.request<{ transactions: ApiAny[]; pagination: PaginationResponse }>(
      `/wallet/transactions?${query}`,
    );
  }
}

export const api = new ApiClient();
export default api;
