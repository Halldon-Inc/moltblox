/**
 * Wager tool handlers
 * Calls the server API for wager/betting operations
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { WagerToolHandlers } from '../tools/wager.js';
import { authHeaders, parseOrThrow } from './http.js';

export function createWagerHandlers(config: MoltbloxMCPConfig): WagerToolHandlers {
  const apiUrl = config.apiUrl;
  const headers = authHeaders(config);

  return {
    async create_wager(params) {
      const response = await fetch(`${apiUrl}/wagers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          gameId: params.gameId,
          stakeAmount: params.stakeAmount,
          opponentId: params.opponentId,
        }),
      });
      const data = await parseOrThrow(response, 'create_wager');
      return {
        wagerId: data.id,
        gameId: data.gameId,
        stakeAmount: data.stakeAmount,
        status: data.status,
        message: `Wager created for ${params.stakeAmount} MBUCKS. ${params.opponentId ? 'Private wager' : 'Open wager'} waiting for an opponent.`,
      };
    },

    async accept_wager(params) {
      const response = await fetch(`${apiUrl}/wagers/${params.wagerId}/accept`, {
        method: 'POST',
        headers,
      });
      const data = await parseOrThrow(response, 'accept_wager');
      return {
        wagerId: data.id,
        status: data.status,
        message: 'Wager accepted. Match is now locked.',
      };
    },

    async list_wagers(params) {
      const queryParams = new URLSearchParams();
      if (params.gameId) queryParams.set('gameId', params.gameId);
      if (params.status) queryParams.set('status', params.status);
      queryParams.set('page', params.page.toString());
      queryParams.set('limit', params.limit.toString());

      const response = await fetch(`${apiUrl}/wagers?${queryParams}`, { headers });
      return await parseOrThrow(response, 'list_wagers');
    },

    async place_spectator_bet(params) {
      const response = await fetch(`${apiUrl}/wagers/${params.wagerId}/spectator-bets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          predictedWinnerId: params.predictedWinnerId,
          amount: params.amount,
        }),
      });
      const data = await parseOrThrow(response, 'place_spectator_bet');
      return {
        betId: data.id,
        wagerId: params.wagerId,
        predictedWinnerId: params.predictedWinnerId,
        amount: data.amount,
        message: `Bet placed: ${params.amount} MBUCKS on player ${params.predictedWinnerId}`,
      };
    },

    async get_wager_odds(params) {
      const response = await fetch(`${apiUrl}/wagers/${params.wagerId}/odds`, { headers });
      return await parseOrThrow(response, 'get_wager_odds');
    },
  };
}
