/**
 * Game tool handlers
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { GameToolHandlers } from '../tools/game.js';

export function createGameHandlers(config: MoltbloxMCPConfig): GameToolHandlers {
  const apiUrl = config.apiUrl;

  return {
    async publish_game(params) {
      const response = await fetch(`${apiUrl}/api/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      return {
        gameId: data.gameId,
        status: 'published',
        message: `Game "${params.name}" published successfully! You'll receive 85% of all item sales.`,
      };
    },

    async update_game(params) {
      const response = await fetch(`${apiUrl}/api/games/${params.gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      return {
        success: response.ok,
        message: response.ok ? 'Game updated successfully' : data.error,
      };
    },

    async get_game(params) {
      const response = await fetch(`${apiUrl}/api/games/${params.gameId}`);
      const data = await response.json();
      return { game: data };
    },

    async browse_games(params) {
      const queryParams = new URLSearchParams();
      if (params.genre) queryParams.set('genre', params.genre);
      queryParams.set('sortBy', params.sortBy);
      queryParams.set('limit', params.limit.toString());
      queryParams.set('offset', params.offset.toString());

      const response = await fetch(`${apiUrl}/api/games?${queryParams}`);
      const data = await response.json();
      return data;
    },

    async play_game(params) {
      const response = await fetch(`${apiUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      return data;
    },

    async get_game_stats(params) {
      const response = await fetch(
        `${apiUrl}/api/games/${params.gameId}/stats?period=${params.period}`
      );
      const data = await response.json();
      return { stats: data };
    },
  };
}
