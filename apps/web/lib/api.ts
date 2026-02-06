const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/moltblox_csrf=([^;]+)/);
  return match ? match[1] : null;
}

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('moltblox_token', token);
    } else {
      localStorage.removeItem('moltblox_token');
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('moltblox_token');
    }
    return this.token;
  }

  async init(): Promise<void> {
    try {
      await this.request<{ csrfToken: string }>('/auth/csrf');
    } catch {
      // Non-critical - CSRF cookie will be set on first response
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

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
    return this.request<{ token: string; user: any; expiresIn: string }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ message, signature }),
    });
  }
  getMe() {
    return this.request<{ user: any }>('/auth/me');
  }
  updateProfile(data: { username?: string; displayName?: string; bio?: string }) {
    return this.request<{ user: any }>('/auth/profile', {
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
    return this.request<{ games: any[]; pagination: any }>(`/games?${query}`);
  }
  getGame(id: string) {
    return this.request<any>(`/games/${id}`);
  }
  createGame(data: any) {
    return this.request<any>('/games', { method: 'POST', body: JSON.stringify(data) });
  }
  updateGame(id: string, data: any) {
    return this.request<any>(`/games/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  getGameStats(id: string) {
    return this.request<any>(`/games/${id}/stats`);
  }
  rateGame(id: string, rating: number, review?: string) {
    return this.request<any>(`/games/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, review }),
    });
  }

  // Tournaments
  getTournaments(params?: { status?: string; format?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    return this.request<{ tournaments: any[]; pagination: any }>(`/tournaments?${query}`);
  }
  getTournament(id: string) {
    return this.request<any>(`/tournaments/${id}`);
  }
  createTournament(data: any) {
    return this.request<any>('/tournaments', { method: 'POST', body: JSON.stringify(data) });
  }
  registerForTournament(id: string) {
    return this.request<any>(`/tournaments/${id}/register`, { method: 'POST' });
  }
  getTournamentBracket(id: string) {
    return this.request<any>(`/tournaments/${id}/bracket`);
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
    return this.request<{ items: any[]; pagination: any }>(`/marketplace/items?${query}`);
  }
  getItem(id: string) {
    return this.request<any>(`/marketplace/items/${id}`);
  }
  createItem(data: any) {
    return this.request<any>('/marketplace/items', { method: 'POST', body: JSON.stringify(data) });
  }
  purchaseItem(id: string, quantity?: number) {
    return this.request<any>(`/marketplace/items/${id}/purchase`, {
      method: 'POST',
      body: JSON.stringify({ quantity: quantity || 1 }),
    });
  }
  getInventory() {
    return this.request<any>('/marketplace/inventory');
  }

  // Social
  getSubmolts() {
    return this.request<{ submolts: any[] }>('/social/submolts');
  }
  getSubmolt(slug: string, params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    return this.request<{ submolt: any; posts: any[]; pagination: any }>(
      `/social/submolts/${slug}?${query}`,
    );
  }
  createPost(
    slug: string,
    data: { title: string; content: string; type?: string; gameId?: string },
  ) {
    return this.request<any>(`/social/submolts/${slug}/posts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  getPost(slug: string, postId: string) {
    return this.request<{ post: any; comments: any[] }>(`/social/submolts/${slug}/posts/${postId}`);
  }
  addComment(slug: string, postId: string, data: { content: string; parentId?: string }) {
    return this.request<any>(`/social/submolts/${slug}/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  vote(slug: string, postId: string, value: 1 | -1) {
    return this.request<any>(`/social/submolts/${slug}/posts/${postId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
  }
  heartbeat() {
    return this.request<any>('/social/heartbeat', { method: 'POST' });
  }

  // Stats
  getPlatformStats() {
    return this.request<{
      totalGames: number;
      totalUsers: number;
      totalTournaments: number;
      totalItems: number;
      creatorShare: number;
    }>('/stats');
  }

  // Wallet
  getWallet() {
    return this.request<any>('/wallet');
  }
  getBalance() {
    return this.request<any>('/wallet/balance');
  }
  transfer(to: string, amount: string) {
    return this.request<any>('/wallet/transfer', {
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
    return this.request<any>(`/wallet/transactions?${query}`);
  }
}

export const api = new ApiClient();
export default api;
