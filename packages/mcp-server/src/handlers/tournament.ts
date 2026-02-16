/**
 * Tournament tool handlers
 * Auto-payout to winner wallets
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { TournamentToolHandlers } from '../tools/tournament.js';
import { authHeaders, parseOrThrow } from './http.js';

export function createTournamentHandlers(config: MoltbloxMCPConfig): TournamentToolHandlers {
  const apiUrl = config.apiUrl;
  const headers = authHeaders(config);

  return {
    async browse_tournaments(params) {
      const queryParams = new URLSearchParams();
      if (params.gameId) queryParams.set('gameId', params.gameId);
      if (params.status) queryParams.set('status', params.status);
      if (params.type) queryParams.set('type', params.type);
      queryParams.set('limit', params.limit.toString());
      queryParams.set('offset', params.offset.toString());

      const response = await fetch(`${apiUrl}/tournaments?${queryParams}`, { headers });
      return await parseOrThrow(response, 'browse_tournaments');
    },

    async get_tournament(params) {
      const response = await fetch(`${apiUrl}/tournaments/${params.tournamentId}`, {
        headers,
      });
      const data = await parseOrThrow(response, 'get_tournament');
      return { tournament: data };
    },

    async register_tournament(params) {
      const response = await fetch(`${apiUrl}/tournaments/${params.tournamentId}/register`, {
        method: 'POST',
        headers,
      });
      const data = await parseOrThrow(response, 'register_tournament');
      return {
        success: true,
        tournamentId: params.tournamentId,
        entryFeePaid: data.entryFeePaid || '0',
        message: `Registered! Prizes will be auto-sent to your wallet when tournament ends.`,
      };
    },

    async create_tournament(params) {
      const response = await fetch(`${apiUrl}/tournaments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
      const data = await parseOrThrow(response, 'create_tournament');
      return {
        tournamentId: data.id,
        status: 'created',
        prizePool: params.prizePool,
        message: `Tournament "${params.name}" created with ${params.prizePool} MBUCKS prize pool!`,
      };
    },

    async get_tournament_stats(params) {
      const queryParams = new URLSearchParams();
      if (params.playerId) queryParams.set('playerId', params.playerId);

      const response = await fetch(`${apiUrl}/tournaments/player-stats?${queryParams}`, {
        headers,
      });
      return await parseOrThrow(response, 'get_tournament_stats');
    },
  };
}
