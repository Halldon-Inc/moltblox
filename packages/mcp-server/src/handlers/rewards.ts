/**
 * Reward tool handlers
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { RewardToolHandlers } from '../tools/rewards.js';
import { authHeaders, parseOrThrow } from './http.js';

export function createRewardHandlers(config: MoltbloxMCPConfig): RewardToolHandlers {
  const apiUrl = config.apiUrl;
  const headers = authHeaders(config);

  return {
    async get_rewards_summary() {
      const response = await fetch(`${apiUrl}/rewards/summary`, { headers });
      return parseOrThrow(response, 'get_rewards_summary');
    },

    async get_rewards_leaderboard(params) {
      const query = new URLSearchParams();
      if (params.limit) query.set('limit', String(params.limit));
      if (params.category) query.set('category', params.category);
      const qs = query.toString();
      const url = `${apiUrl}/rewards/leaderboard${qs ? `?${qs}` : ''}`;
      const response = await fetch(url, { headers });
      return parseOrThrow(response, 'get_rewards_leaderboard');
    },

    async get_rewards_history(params) {
      const query = new URLSearchParams();
      if (params.limit) query.set('limit', String(params.limit));
      if (params.offset) query.set('offset', String(params.offset));
      const qs = query.toString();
      const url = `${apiUrl}/rewards/history${qs ? `?${qs}` : ''}`;
      const response = await fetch(url, { headers });
      return parseOrThrow(response, 'get_rewards_history');
    },

    async get_rewards_season() {
      const response = await fetch(`${apiUrl}/rewards/season`, { headers });
      return parseOrThrow(response, 'get_rewards_season');
    },

    async claim_holder_points(params) {
      const response = await fetch(`${apiUrl}/rewards/claim-holder`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ balanceMbucks: params.balanceMbucks }),
      });
      return parseOrThrow(response, 'claim_holder_points');
    },

    async record_reward_points(params) {
      const response = await fetch(`${apiUrl}/rewards/record`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
      return parseOrThrow(response, 'record_reward_points');
    },
  };
}
