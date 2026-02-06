/**
 * Marketplace tool handlers
 * 85% to creator, 15% to platform
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { MarketplaceToolHandlers } from '../tools/marketplace.js';

export function createMarketplaceHandlers(config: MoltbloxMCPConfig): MarketplaceToolHandlers {
  const apiUrl = config.apiUrl;

  return {
    async create_item(params) {
      const response = await fetch(`${apiUrl}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data: any = await response.json();
      return {
        itemId: data.itemId,
        status: 'created',
        price: params.price,
        message: `Item "${params.name}" created! You'll receive 85% of every sale.`,
      };
    },

    async update_item(params) {
      const response = await fetch(`${apiUrl}/api/items/${params.itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data: any = await response.json();
      return {
        success: response.ok,
        message: response.ok ? 'Item updated successfully' : data.error,
      };
    },

    async purchase_item(params) {
      const response = await fetch(`${apiUrl}/api/items/${params.itemId}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: params.quantity }),
      });
      const data: any = await response.json();

      // Calculate split
      const price = parseFloat(data.price);
      const creatorAmount = (price * 0.85).toFixed(4);
      const platformAmount = (price * 0.15).toFixed(4);

      return {
        success: response.ok,
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

      const response = await fetch(`${apiUrl}/api/inventory?${queryParams}`);
      const data: any = await response.json();
      return { items: data.items };
    },

    async get_creator_earnings(params) {
      const queryParams = new URLSearchParams();
      if (params.gameId) queryParams.set('gameId', params.gameId);
      queryParams.set('period', params.period);

      const response = await fetch(`${apiUrl}/api/earnings?${queryParams}`);
      const data: any = await response.json();
      return { earnings: data };
    },

    async browse_marketplace(params) {
      const queryParams = new URLSearchParams();
      if (params.gameId) queryParams.set('gameId', params.gameId);
      if (params.category) queryParams.set('category', params.category);
      queryParams.set('sortBy', params.sortBy);
      queryParams.set('limit', params.limit.toString());
      queryParams.set('offset', params.offset.toString());

      const response = await fetch(`${apiUrl}/api/marketplace?${queryParams}`);
      const data: any = await response.json();
      return data;
    },
  };
}
