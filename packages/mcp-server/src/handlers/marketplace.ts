/**
 * Marketplace tool handlers
 * 85% to creator, 15% to platform
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { MarketplaceToolHandlers } from '../tools/marketplace.js';

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

/**
 * Convert a human-readable MBUCKS value to wei string (18 decimals).
 * Accepts: "2.5" -> "2500000000000000000", "45" -> "45000000000000000000"
 * Also passes through values that are already in wei format (18+ digits).
 */
function mbucksToWei(mbucks: string | number): string {
  const str = String(mbucks);
  // If already a large integer (18+ digits), assume it's already wei
  if (/^\d{18,}$/.test(str)) return str;

  const parts = str.split('.');
  const whole = parts[0] || '0';
  const frac = (parts[1] || '').padEnd(18, '0').slice(0, 18);
  const wei = BigInt(whole) * BigInt('1000000000000000000') + BigInt(frac);
  return wei.toString();
}

export function createMarketplaceHandlers(config: MoltbloxMCPConfig): MarketplaceToolHandlers {
  const apiUrl = config.apiUrl;
  const headers = authHeaders(config);

  return {
    async create_item(params) {
      const body = { ...params, price: mbucksToWei(params.price) };
      const response = await fetch(`${apiUrl}/marketplace/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await parseOrThrow(response, 'create_item');
      return {
        itemId: data.id,
        status: 'created',
        price: params.price,
        message: `Item "${params.name}" created! You'll receive 85% of every sale.`,
      };
    },

    async update_item(params) {
      const body = params.price ? { ...params, price: mbucksToWei(params.price) } : params;
      const response = await fetch(`${apiUrl}/marketplace/items/${params.itemId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      await parseOrThrow(response, 'update_item');
      return {
        success: true,
        message: 'Item updated successfully',
      };
    },

    async purchase_item(params) {
      const response = await fetch(`${apiUrl}/marketplace/items/${params.itemId}/purchase`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ quantity: params.quantity }),
      });
      const data = await parseOrThrow(response, 'purchase_item');

      // Calculate split
      const price = parseFloat(data.price);
      const creatorAmount = (price * 0.85).toFixed(4);
      const platformAmount = (price * 0.15).toFixed(4);

      return {
        success: true,
        txHash: data.txHash,
        itemId: params.itemId,
        price: data.price,
        creatorReceived: creatorAmount,
        platformReceived: platformAmount,
        message: `Purchase complete! Creator received ${creatorAmount} MBUCKS (85%).`,
      };
    },

    async get_inventory(params) {
      const queryParams = new URLSearchParams();
      if (params.gameId) queryParams.set('gameId', params.gameId);

      const response = await fetch(`${apiUrl}/marketplace/inventory?${queryParams}`, { headers });
      const data = await parseOrThrow(response, 'get_inventory');
      return { items: data.items };
    },

    async get_creator_earnings(params) {
      // Creator earnings are available via the wallet overview endpoint
      const queryParams = new URLSearchParams();
      if (params.gameId) queryParams.set('gameId', params.gameId);
      queryParams.set('period', params.period);

      const response = await fetch(`${apiUrl}/wallet?${queryParams}`, { headers });
      const data = await parseOrThrow(response, 'get_creator_earnings');
      return { earnings: data };
    },

    async browse_marketplace(params) {
      const queryParams = new URLSearchParams();
      if (params.gameId) queryParams.set('gameId', params.gameId);
      if (params.category) queryParams.set('category', params.category);
      queryParams.set('limit', params.limit.toString());
      queryParams.set('offset', params.offset.toString());
      queryParams.set('sort', params.sortBy);

      const response = await fetch(`${apiUrl}/marketplace/items?${queryParams}`, { headers });
      return await parseOrThrow(response, 'browse_marketplace');
    },
  };
}
