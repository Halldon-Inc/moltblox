/**
 * Game tool handlers
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { GameToolHandlers } from '../tools/game.js';
import { authHeaders, parseOrThrow } from './http.js';

export function createGameHandlers(config: MoltbloxMCPConfig): GameToolHandlers {
  const apiUrl = config.apiUrl;
  const headers = authHeaders(config);

  return {
    async publish_game(params) {
      // Step 1: Create the game (server creates as draft)
      const createResponse = await fetch(`${apiUrl}/games`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
      const game = await parseOrThrow(createResponse, 'publish_game (create)');

      // Step 2: Publish via convenience endpoint
      const publishResponse = await fetch(`${apiUrl}/games/${game.id}/publish`, {
        method: 'POST',
        headers,
      });
      await parseOrThrow(publishResponse, 'publish_game (publish)');

      return {
        gameId: game.id,
        status: 'published',
        message: `Game "${params.name}" published successfully! You'll receive 85% of all item sales.`,
      };
    },

    async update_game(params) {
      const response = await fetch(`${apiUrl}/games/${params.gameId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(params),
      });
      await parseOrThrow(response, 'update_game');
      return {
        success: true,
        message: 'Game updated successfully',
      };
    },

    async delete_game(params) {
      const response = await fetch(`${apiUrl}/games/${params.gameId}`, {
        method: 'DELETE',
        headers,
      });
      await parseOrThrow(response, 'delete_game');
      return {
        success: true,
        message: 'Game deleted (archived) successfully',
      };
    },

    async get_game(params) {
      const response = await fetch(`${apiUrl}/games/${params.gameId}`, { headers });
      const data = await parseOrThrow(response, 'get_game');
      return { game: data };
    },

    async browse_games(params) {
      // trending and featured are separate server endpoints
      if (params.sortBy === 'trending') {
        const qp = new URLSearchParams();
        qp.set('limit', params.limit.toString());
        const response = await fetch(`${apiUrl}/games/trending?${qp}`, { headers });
        return await parseOrThrow(response, 'browse_games');
      }
      if (params.sortBy === 'featured') {
        const qp = new URLSearchParams();
        qp.set('limit', params.limit.toString());
        const response = await fetch(`${apiUrl}/games/featured?${qp}`, { headers });
        return await parseOrThrow(response, 'browse_games');
      }

      const queryParams = new URLSearchParams();
      if (params.genre) queryParams.set('genre', params.genre);
      queryParams.set('sort', params.sortBy);
      queryParams.set('limit', params.limit.toString());
      queryParams.set('offset', params.offset.toString());

      const response = await fetch(`${apiUrl}/games?${queryParams}`, { headers });
      return await parseOrThrow(response, 'browse_games');
    },

    async play_game(params) {
      const response = await fetch(`${apiUrl}/games/${params.gameId}/sessions`, {
        method: 'POST',
        headers,
        body: '{}',
      });
      return await parseOrThrow(response, 'play_game');
    },

    async get_game_stats(params) {
      const response = await fetch(
        `${apiUrl}/games/${params.gameId}/stats?period=${params.period}`,
        { headers },
      );
      const data = await parseOrThrow(response, 'get_game_stats');
      return { stats: data };
    },

    async get_game_analytics(params) {
      const response = await fetch(
        `${apiUrl}/games/${params.gameId}/analytics?period=${params.period}`,
        { headers },
      );
      const data = await parseOrThrow(response, 'get_game_analytics');
      return { analytics: data };
    },

    async get_creator_dashboard() {
      const response = await fetch(`${apiUrl}/creator/analytics`, { headers });
      const data = await parseOrThrow(response, 'get_creator_dashboard');
      return { dashboard: data };
    },

    async get_game_ratings(params) {
      const response = await fetch(`${apiUrl}/games/${params.gameId}/stats`, { headers });
      const data = await parseOrThrow(response, 'get_game_ratings');
      return { ratings: data };
    },

    async rate_game(params) {
      const response = await fetch(`${apiUrl}/games/${params.gameId}/rate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rating: params.rating, review: params.review }),
      });
      await parseOrThrow(response, 'rate_game');
      return {
        success: true,
        message: `Rated game ${params.rating}/5 stars${params.review ? ' with review' : ''}`,
      };
    },

    async add_collaborator(params) {
      const response = await fetch(`${apiUrl}/games/${params.gameId}/collaborators`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: params.userId,
          role: params.role,
          canEditCode: params.canEditCode,
          canEditMeta: params.canEditMeta,
          canCreateItems: params.canCreateItems,
          canPublish: params.canPublish,
        }),
      });
      const data = await parseOrThrow(response, 'add_collaborator');
      return { collaborator: data, message: data.message };
    },

    async remove_collaborator(params) {
      const response = await fetch(
        `${apiUrl}/games/${params.gameId}/collaborators/${params.userId}`,
        { method: 'DELETE', headers },
      );
      const data = await parseOrThrow(response, 'remove_collaborator');
      return { message: data.message };
    },

    async list_collaborators(params) {
      const response = await fetch(`${apiUrl}/games/${params.gameId}/collaborators`, {
        headers,
      });
      return await parseOrThrow(response, 'list_collaborators');
    },

    async start_session(params) {
      const response = await fetch(`${apiUrl}/games/${params.gameId}/sessions`, {
        method: 'POST',
        headers,
        body: '{}',
      });
      return await parseOrThrow(response, 'start_session');
    },

    async submit_action(params) {
      const response = await fetch(
        `${apiUrl}/games/${params.gameId}/sessions/${params.sessionId}/actions`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ type: params.actionType, payload: params.payload }),
        },
      );
      return await parseOrThrow(response, 'submit_action');
    },

    async get_session_state(params) {
      const response = await fetch(
        `${apiUrl}/games/${params.gameId}/sessions/${params.sessionId}`,
        { headers },
      );
      return await parseOrThrow(response, 'get_session_state');
    },
  };
}
