'use client';

import { Wallet, ArrowUpRight, ArrowDownLeft, Coins, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useReadContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useWallet, useTransactions } from '@/hooks/useApi';

const MOLTBUCKS_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function formatOnChainBalance(raw: bigint | undefined): string {
  if (raw === undefined) return '0.00';
  const divisor = BigInt(10 ** 18);
  const whole = raw / divisor;
  const remainder = raw % divisor;
  const decimal = remainder.toString().padStart(18, '0').slice(0, 4);
  return `${whole.toLocaleString()}.${decimal}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function WalletPage() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { data: walletData } = useWallet();
  const { data: txData, isLoading: txLoading } = useTransactions({ limit: 10 });

  const moltbucksAddress = process.env.NEXT_PUBLIC_MOLTBUCKS_ADDRESS as `0x${string}` | undefined;

  const {
    data: onChainBalance,
    isLoading: balanceLoading,
    isError: balanceError,
  } = useReadContract({
    address: moltbucksAddress,
    abi: MOLTBUCKS_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address && !!moltbucksAddress,
    },
  });

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="ambient-glow ambient-glow-teal w-[600px] h-[600px] -top-60 left-1/3 fixed" />
        <div className="glass-card p-10 text-center max-w-md">
          <Wallet className="w-12 h-12 text-molt-400 mx-auto mb-4" />
          <h2 className="font-display font-bold text-xl text-white mb-2">Connect Wallet</h2>
          <p className="text-white/50 text-sm mb-6">
            Connect your wallet to view your MBUCKS balance and transaction history.
          </p>
          <button onClick={() => openConnectModal?.()} className="btn-primary px-8 py-3">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const platformBalance = walletData?.balance ?? walletData?.wallet?.balance ?? null;
  const transactions = txData?.transactions ?? [];

  return (
    <div className="min-h-screen bg-surface-dark pb-20">
      <div className="ambient-glow ambient-glow-teal w-[600px] h-[600px] -top-60 left-1/3 fixed" />

      <div className="page-container pt-24">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-8 flex items-center gap-3">
          <Wallet className="w-8 h-8 text-molt-400" />
          Wallet
        </h1>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* On-Chain MBUCKS Balance */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4 text-accent-amber" />
              <span className="text-xs text-white/40 uppercase tracking-wider">
                On-Chain MBUCKS
              </span>
            </div>
            {balanceLoading ? (
              <div className="flex items-center gap-2 mt-2">
                <Loader2 className="w-5 h-5 animate-spin text-molt-400" />
                <span className="text-white/40 text-sm">Loading balance...</span>
              </div>
            ) : balanceError || !moltbucksAddress ? (
              <div className="mt-2">
                <p className="font-display font-bold text-2xl text-white/30">--</p>
                <p className="text-xs text-white/30 mt-1">
                  {!moltbucksAddress ? 'Contract not configured' : 'Unable to fetch balance'}
                </p>
              </div>
            ) : (
              <div className="mt-2">
                <p className="font-display font-bold text-3xl text-white">
                  {formatOnChainBalance(onChainBalance as bigint | undefined)}
                </p>
                <p className="text-xs text-white/30 mt-1">MBUCKS</p>
              </div>
            )}
            {address && (
              <p className="text-[10px] text-white/20 mt-3 font-mono truncate">{address}</p>
            )}
          </div>

          {/* Platform Balance */}
          {platformBalance !== null && (
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="w-4 h-4 text-molt-300" />
                <span className="text-xs text-white/40 uppercase tracking-wider">
                  Platform Balance
                </span>
              </div>
              <div className="mt-2">
                <p className="font-display font-bold text-3xl text-white">
                  {Number(platformBalance).toLocaleString()}
                </p>
                <p className="text-xs text-white/30 mt-1">MBUCKS</p>
              </div>
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="glass-card p-6">
          <h2 className="section-title text-xl mb-4">Transaction History</h2>
          {txLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-molt-400" />
            </div>
          ) : transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx: any) => {
                const isCredit =
                  tx.type === 'credit' || tx.type === 'deposit' || tx.type === 'reward';
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-surface-dark/50 rounded-xl border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isCredit ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="w-4 h-4 text-green-400" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {tx.description || tx.type || 'Transaction'}
                        </p>
                        <p className="text-[10px] text-white/30">
                          {tx.createdAt ? formatDate(tx.createdAt) : ''}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`font-display font-bold text-sm ${
                        isCredit ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                      {tx.amount} MBUCKS
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-white/30 text-center py-8">No transactions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
