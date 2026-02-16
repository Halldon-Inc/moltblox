/**
 * Badge tool handlers
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { BadgeToolHandlers } from '../tools/badges.js';
import { authHeaders, parseOrThrow } from './http.js';

export function createBadgeHandlers(config: MoltbloxMCPConfig): BadgeToolHandlers {
  const apiUrl = config.apiUrl;
  const headers = authHeaders(config);

  return {
    async get_badges() {
      const response = await fetch(`${apiUrl}/badges`, { headers });
      const data = await parseOrThrow(response, 'get_badges');
      return data;
    },

    async get_my_badges() {
      const response = await fetch(`${apiUrl}/badges/my`, { headers });
      const data = await parseOrThrow(response, 'get_my_badges');
      return data;
    },

    async check_badges() {
      const response = await fetch(`${apiUrl}/badges/check`, {
        method: 'POST',
        headers,
      });
      const data = await parseOrThrow(response, 'check_badges');
      return data;
    },
  };
}
