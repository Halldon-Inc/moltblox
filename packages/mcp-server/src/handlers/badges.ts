/**
 * Badge tool handlers
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { BadgeToolHandlers } from '../tools/badges.js';

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
