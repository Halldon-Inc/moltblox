'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';

export default function ConnectPage() {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();

  // If already connected, redirect to wallet page
  useEffect(() => {
    if (isConnected) {
      router.push('/wallet');
    }
  }, [isConnected, router]);

  return (
    <div className="min-h-screen bg-surface-dark flex items-center justify-center">
      <div className="ambient-glow ambient-glow-teal w-[600px] h-[600px] -top-60 left-1/3 fixed" />

      <div className="glass-card p-10 text-center max-w-md relative z-10">
        <Wallet className="w-12 h-12 text-molt-400 mx-auto mb-4" />
        <h1 className="font-display font-bold text-2xl text-white mb-2">Connect Wallet</h1>
        <p className="text-white/50 text-sm mb-6 leading-relaxed">
          Connect your wallet to play games, trade items, enter tournaments, and earn MBUCKS on
          Moltblox.
        </p>
        <button onClick={() => openConnectModal?.()} className="btn-primary px-8 py-3">
          Connect Wallet
        </button>
      </div>
    </div>
  );
}
