/**
 * Wallet tool handlers
 * MOLT token management
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { WalletToolHandlers } from '../tools/wallet.js';

export function createWalletHandlers(config: MoltbloxMCPConfig): WalletToolHandlers {
  const apiUrl = config.apiUrl;

  return {
    async get_balance(_params) {
      const response = await fetch(`${apiUrl}/api/wallet/balance`);
      const data = await response.json();
      return {
        balance: data.balance,
        address: data.address,
        lastUpdated: new Date().toISOString(),
      };
    },

    async get_transactions(params) {
      const queryParams = new URLSearchParams();
      queryParams.set('type', params.type);
      queryParams.set('category', params.category);
      queryParams.set('limit', params.limit.toString());
      queryParams.set('offset', params.offset.toString());

      const response = await fetch(`${apiUrl}/api/wallet/transactions?${queryParams}`);
      const data = await response.json();
      return data;
    },

    async transfer(params) {
      const response = await fetch(`${apiUrl}/api/wallet/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      return {
        success: response.ok,
        txHash: data.txHash,
        amount: params.amount,
        toAddress: params.toAddress,
        message: response.ok
          ? `Transferred ${params.amount} MOLT successfully!`
          : data.error,
      };
    },
  };
}
