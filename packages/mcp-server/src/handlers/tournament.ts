/**
 * Tournament tool handlers
 * Auto-payout to winner wallets
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { TournamentToolHandlers } from '../tools/tournament.js';

function authHeaders(config: MoltbloxMCPConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.authToken) {
    headers['Authorization'] = `Bearer ${config.authToken}`;
  }
  return headers;
}

async function parseOrThrow(response: Response, label: string): Promise<any> {
  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || `${label} failed (${response.status})`);
  }
  return data;
}

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
        tournamentId: data.tournamentId,
        status: 'created',
        prizePool: params.prizePool,
        message: `Tournament "${params.name}" created with ${params.prizePool} MBUCKS prize pool!`,
      };
    },

    async get_tournament_stats(params) {
      // Tournament stats per player not yet implemented as a dedicated endpoint.
      // Tournament details include participant stats via get_tournament.
      throw new Error(
        'Per-player tournament stats endpoint not yet available. Use get_tournament to see tournament details and results.',
      );
    },

    async spectate_match(params) {
      // Spectating not yet implemented on the server
      throw new Error(
        'Match spectating not yet available. Use get_tournament to check bracket and match results.',
      );
    },

    async add_to_prize_pool(params) {
      // Prize pool addition not yet implemented as a dedicated endpoint
      throw new Error(
        'Adding to prize pool not yet available. Set the full prize pool when creating the tournament.',
      );
    },
  };
}
