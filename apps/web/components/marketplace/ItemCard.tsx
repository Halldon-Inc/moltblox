'use client';

import { useState } from 'react';
import { ShoppingBag, Loader2, Check, Wallet } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { usePurchaseItem } from '@/hooks/useApi';

export interface ItemCardProps {
  id: string;
  name: string;
  game: string | { id: string; name: string; slug?: string; thumbnailUrl?: string | null };
  category: string;
  price: number | string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  image?: string;
  imageUrl?: string | null;
  soldCount: number;
}

const RARITY_BADGE: Record<ItemCardProps['rarity'], { label: string; bg: string }> = {
  common: { label: 'Common', bg: 'bg-gray-400' },
  uncommon: { label: 'Uncommon', bg: 'bg-green-400' },
  rare: { label: 'Rare', bg: 'bg-blue-400' },
  legendary: { label: 'Legendary', bg: 'bg-yellow-400' },
};

function safeCssValue(value: string): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;
  if (/^https?:\/\//.test(value)) return `url(${encodeURI(value)})`;
  return '#1a2e33';
}

export function ItemCard({
  id,
  name,
  game,
  category,
  price,
  rarity,
  image,
  imageUrl,
  soldCount,
}: ItemCardProps) {
  const badge = RARITY_BADGE[rarity] || RARITY_BADGE.common;
  const gameName = typeof game === 'object' ? (game?.name ?? 'Unknown') : game;
  const imgSrc = image || imageUrl || '';
  const displayPrice = typeof price === 'string' ? Number(BigInt(price) / BigInt(10 ** 18)) : price;
  const purchaseMutation = usePurchaseItem();
  const [purchased, setPurchased] = useState(false);
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const handleBuy = () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (purchaseMutation.isPending || purchased) return;
    purchaseMutation.mutate(
      { id, quantity: 1 },
      {
        onSuccess: () => {
          setPurchased(true);
          setTimeout(() => setPurchased(false), 2000);
        },
      },
    );
  };

  return (
    <div className="group relative w-full bg-[#0d1112] border border-[#1a2e33] rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_20px_rgba(0,255,191,0.15)] hover:border-[#00FFBF]/60">
      {/* Rarity Badge */}
      <div className="absolute top-3 left-3 z-10">
        <span
          className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-black rounded-sm ${badge.bg}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Category pill */}
      <div className="absolute top-3 right-3 z-10">
        <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/50 bg-black/40 backdrop-blur-sm rounded-sm">
          {category}
        </span>
      </div>

      {/* Image Container */}
      <div className="aspect-square w-full bg-gradient-to-b from-[#151a1c] to-[#0d1112] relative flex items-center justify-center p-6 group-hover:from-[#1a2e33] transition-colors duration-300">
        {/* Shimmer for legendaries */}
        {rarity === 'legendary' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/[0.06] to-transparent animate-shimmer pointer-events-none" />
        )}
        {rarity === 'rare' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/[0.04] to-transparent animate-shimmer pointer-events-none" />
        )}

        {/* Item visual — uses the color/gradient from the image field */}
        <div
          className="w-full h-full rounded-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
          style={{
            background: `linear-gradient(135deg, ${safeCssValue(imgSrc || '#1a2e33')} 0%, #0d1112 100%)`,
          }}
        />
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <ShoppingBag className="w-10 h-10 text-white/10 group-hover:text-white/20 transition-colors duration-300" />
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-white font-bold text-base tracking-wide truncate group-hover:text-[#00FFBF] transition-colors duration-200">
            {name}
          </h3>
          <p className="text-gray-500 text-xs uppercase tracking-wider truncate">{gameName}</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[#00FFBF] font-mono text-xl font-bold">{displayPrice}</span>
            <span className="text-gray-600 text-xs">{soldCount.toLocaleString()} sold</span>
          </div>

          {/* Buy button — appears on hover (desktop), always visible on mobile */}
          <button
            onClick={handleBuy}
            disabled={isConnected && purchaseMutation.isPending}
            className="sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 bg-[#00FFBF] text-black font-bold px-4 py-2 rounded text-sm uppercase tracking-wide hover:bg-white disabled:opacity-50 flex items-center gap-1.5"
          >
            {!isConnected ? (
              <>
                <Wallet className="w-3.5 h-3.5" />
                Connect
              </>
            ) : purchaseMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : purchased ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Done
              </>
            ) : (
              'Buy'
            )}
          </button>
        </div>

        {purchaseMutation.isError && (
          <p className="text-xs text-red-400 text-center">
            {purchaseMutation.error?.message || 'Purchase failed'}
          </p>
        )}
      </div>
    </div>
  );
}
