/**
 * Tournament tool handlers
 * Auto-payout to winner wallets
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { TournamentToolHandlers } from '../tools/tournament.js';

export function createTournamentHandlers(config: MoltbloxMCPConfig): TournamentToolHandlers {
  const apiUrl = config.apiUrl;

  return {
    async browse_tournaments(params) {
      const queryParams = new URLSearchParams();
      if (params.gameId) queryParams.set('gameId', params.gameId);
      if (params.status) queryParams.set('status', params.status);
      if (params.type) queryParams.set('type', params.type);
      queryParams.set('limit', params.limit.toString());
      queryParams.set('offset', params.offset.toString());

      const response = await fetch(`${apiUrl}/api/tournaments?${queryParams}`);
      const data = await response.json();
      return data;
    },

    async get_tournament(params) {
      const response = await fetch(`${apiUrl}/api/tournaments/${params.tournamentId}`);
      const data = await response.json();
      return { tournament: data };
    },

    async register_tournament(params) {
      const response = await fetch(`${apiUrl}/api/tournaments/${params.tournamentId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      return {
        success: response.ok,
        tournamentId: params.tournamentId,
        entryFeePaid: data.entryFeePaid || '0',
        message: response.ok
          ? `Registered! Prizes will be auto-sent to your wallet when tournament ends.`
          : data.error,
      };
    },

    async create_tournament(params) {
      const response = await fetch(`${apiUrl}/api/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      return {
        tournamentId: data.tournamentId,
        status: 'created',
        prizePool: params.prizePool,
        message: `Tournament "${params.name}" created with ${params.prizePool} MOLT prize pool!`,
      };
    },

    async get_tournament_stats(params) {
      const playerId = params.playerId || 'me';
      const response = await fetch(`${apiUrl}/api/players/${playerId}/tournament-stats`);
      const data = await response.json();
      return { stats: data };
    },

    async spectate_match(params) {
      const response = await fetch(
        `${apiUrl}/api/tournaments/${params.tournamentId}/matches/${params.matchId}/spectate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quality: params.quality }),
        }
      );
      const data = await response.json();
      return data;
    },

    async add_to_prize_pool(params) {
      const response = await fetch(
        `${apiUrl}/api/tournaments/${params.tournamentId}/prize-pool`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: params.amount }),
        }
      );
      const data = await response.json();
      return {
        success: response.ok,
        tournamentId: params.tournamentId,
        amountAdded: params.amount,
        newPrizePool: data.newPrizePool,
        message: response.ok
          ? `Added ${params.amount} MOLT to prize pool!`
          : data.error,
      };
    },
  };
}
