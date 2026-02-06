'use client';

import { ShoppingBag } from 'lucide-react';

export interface ItemCardProps {
  id: string;
  name: string;
  game: string;
  category: 'Cosmetics' | 'Power-ups' | 'Consumables' | 'Subscriptions';
  price: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  image: string;
  soldCount: number;
}

const RARITY_CONFIG: Record<
  ItemCardProps['rarity'],
  { label: string; border: string; glow: string; badge: string; gradient: string }
> = {
  common: {
    label: 'Common',
    border: 'border-white/10',
    glow: '',
    badge: 'bg-white/10 text-white/60',
    gradient: 'from-gray-600/30 to-gray-800/30',
  },
  uncommon: {
    label: 'Uncommon',
    border: 'border-green-500/20',
    glow: 'shadow-[0_0_20px_rgba(34,197,94,0.15)]',
    badge: 'bg-green-500/15 text-green-400 border border-green-500/30',
    gradient: 'from-green-600/30 to-green-900/30',
  },
  rare: {
    label: 'Rare',
    border: 'border-blue-500/20',
    glow: 'shadow-[0_0_25px_rgba(59,130,246,0.2)]',
    badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    gradient: 'from-blue-600/30 to-blue-900/30',
  },
  legendary: {
    label: 'Legendary',
    border: 'border-amber-500/30',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.25)]',
    badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    gradient: 'from-amber-500/30 to-orange-900/30',
  },
};

export function ItemCard({
  id,
  name,
  game,
  category,
  price,
  rarity,
  image,
  soldCount,
}: ItemCardProps) {
  const config = RARITY_CONFIG[rarity];

  return (
    <div
      className={`
        glass-card group cursor-pointer overflow-hidden
        ${config.border} ${config.glow}
        hover:scale-[1.02] hover:-translate-y-1
      `}
    >
      {/* Thumbnail area */}
      <div
        className={`relative h-44 bg-gradient-to-br ${image} ${config.gradient} overflow-hidden`}
      >
        {/* Rarity shimmer overlay */}
        {rarity === 'legendary' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent animate-[energy-flow_3s_linear_infinite] bg-[length:200%_100%]" />
        )}
        {rarity === 'rare' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/8 to-transparent animate-[energy-flow_4s_linear_infinite] bg-[length:200%_100%]" />
        )}

        {/* Voxel decoration */}
        <div className="absolute top-4 left-4 w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm rotate-12 group-hover:rotate-45 transition-transform duration-500" />
        <div className="absolute bottom-6 right-6 w-6 h-6 rounded-md bg-white/8 backdrop-blur-sm -rotate-12 group-hover:rotate-12 transition-transform duration-500" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <ShoppingBag className="w-12 h-12 text-white/20 group-hover:text-white/30 transition-colors" />
        </div>

        {/* Rarity badge */}
        <div className="absolute top-3 right-3">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.badge}`}
          >
            {config.label}
          </span>
        </div>

        {/* Category pill */}
        <div className="absolute bottom-3 left-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-black/40 backdrop-blur-sm text-white/70">
            {category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-white group-hover:text-neon-cyan transition-colors truncate">
            {name}
          </h3>
          <p className="text-xs text-white/40 mt-0.5 truncate">{game}</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-molt-400">{price}</span>
            <span className="text-xs text-white/40 ml-1">MBUCKS</span>
          </div>
          <span className="text-xs text-white/30">{soldCount.toLocaleString()} sold</span>
        </div>

        <button className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2">
          <ShoppingBag className="w-4 h-4" />
          Buy
        </button>
      </div>
    </div>
  );
}
