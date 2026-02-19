'use client';

import { useState, useCallback } from 'react';
import { X, Coins, CheckCircle2 } from 'lucide-react';
import { SwapWidget } from '@reservoir0x/relay-kit-ui';
import { adaptViemWallet } from '@reservoir0x/relay-sdk';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useWalletClient } from 'wagmi';
import type { Token } from '@reservoir0x/relay-kit-ui';

const BASE_CHAIN_ID = 8453;
const BASE_SEPOLIA_CHAIN_ID = 84532;

function getMbucksToken(): Token | undefined {
  const addr = process.env.NEXT_PUBLIC_MOLTBUCKS_ADDRESS;
  if (!addr) return undefined;

  const isMainnet = process.env.NEXT_PUBLIC_DEFAULT_CHAIN === 'base';
  return {
    chainId: isMainnet ? BASE_CHAIN_ID : BASE_SEPOLIA_CHAIN_ID,
    address: addr,
    name: 'MBucks',
    symbol: 'MBUCKS',
    decimals: 18,
    logoURI: '/mbucks-logo.png',
  };
}

interface BuyMbucksModalProps {
  open: boolean;
  onClose: () => void;
}

export function BuyMbucksModal({ open, onClose }: BuyMbucksModalProps) {
  const { openConnectModal } = useConnectModal();
  const { data: walletClient } = useWalletClient();
  const [showSuccess, setShowSuccess] = useState(false);

  const mbucksToken = getMbucksToken();

  const handleSwapSuccess = useCallback(() => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 3000);
  }, [onClose]);

  if (!open) return null;

  if (!mbucksToken) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="glass-card p-8 max-w-sm text-center">
          <p className="text-white/50 text-sm">
            MBUCKS swaps are currently unavailable. Please try again later.
          </p>
          <button onClick={onClose} className="btn-primary mt-4 px-6 py-2">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-[420px] mx-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-surface-mid border border-white/10
                     flex items-center justify-center text-white/50 hover:text-white hover:bg-surface-light
                     transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="glass-card rounded-t-2xl rounded-b-none px-6 py-4 border-b-0">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-molt-400" />
            <h2 className="font-display font-bold text-lg text-white">Buy MBucks</h2>
          </div>
          <p className="text-white/40 text-xs mt-1">Swap any token for MBUCKS on Base</p>
        </div>

        {/* Success overlay */}
        {showSuccess && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface-dark/95 rounded-2xl border border-molt-400/30">
            <div className="relative">
              <div className="absolute inset-0 bg-molt-400/20 rounded-full blur-xl animate-glow-pulse" />
              <CheckCircle2 className="w-16 h-16 text-molt-400 relative" />
            </div>
            <p className="font-display font-bold text-xl text-white mt-4">Swap Successful!</p>
            <p className="text-white/40 text-sm mt-1">Your MBucks are on the way</p>
          </div>
        )}

        {/* Swap Widget */}
        <div className="relay-swap-container rounded-b-2xl overflow-hidden">
          <SwapWidget
            supportedWalletVMs={['evm']}
            onConnectWallet={() => openConnectModal?.()}
            wallet={walletClient ? adaptViemWallet(walletClient) : undefined}
            toToken={mbucksToken}
            lockToToken={true}
            defaultAmount="10"
            onSwapSuccess={handleSwapSuccess}
            onSwapError={(error: string) => {
              console.error('[BuyMbucks] Swap failed:', error);
            }}
          />
        </div>
      </div>
    </div>
  );
}

interface BuyMbucksButtonProps {
  variant?: 'primary' | 'navbar' | 'compact';
  className?: string;
}

export function BuyMbucksButton({ variant = 'primary', className = '' }: BuyMbucksButtonProps) {
  const [open, setOpen] = useState(false);

  const baseClasses = {
    primary: 'btn-primary flex items-center gap-2 px-6 py-3',
    navbar:
      'flex items-center gap-2 px-5 py-2 bg-[#00D9A6]/15 hover:bg-[#00D9A6]/25 text-[#00D9A6] hover:text-white text-xs font-bold tracking-wider rounded-full border border-[#00D9A6]/30 hover:border-[#00D9A6]/50 transition-all duration-200 outline-none',
    compact:
      'flex items-center gap-1.5 px-4 py-2 bg-molt-500/20 hover:bg-molt-500/30 text-molt-300 hover:text-molt-200 text-sm font-semibold rounded-lg transition-all duration-200 border border-molt-500/30',
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={`${baseClasses[variant]} ${className}`}>
        <Coins className="w-4 h-4" />
        <span>BUY MBUCKS</span>
      </button>
      <BuyMbucksModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
