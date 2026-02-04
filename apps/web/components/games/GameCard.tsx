'use client';

import Link from 'next/link';
import { Star, Users, Play } from 'lucide-react';

export interface GameCardProps {
  id: string;
  name: string;
  creator: string;
  thumbnail: string;
  rating: number;
  playCount: number;
  playerCount?: number;
  tags: string[];
  category?: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function GameCard({
  id,
  name,
  creator,
  thumbnail,
  rating,
  playCount,
  playerCount = 0,
  tags,
}: GameCardProps) {
  return (
    <Link href={`/games/${id}`} className="group block">
      <div className="glass-card overflow-hidden hover:scale-[1.02] transition-all duration-300">
        {/* Thumbnail */}
        <div className="relative h-44 overflow-hidden">
          <div
            className="absolute inset-0 transition-transform duration-500 group-hover:scale-110"
            style={{
              background: `linear-gradient(135deg, ${thumbnail} 0%, #0a1a1a 100%)`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-dark/90 via-transparent to-transparent" />

          {/* Live player count */}
          {playerCount > 0 && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/90">{formatNumber(playerCount)} playing</span>
            </div>
          )}

          {/* Play overlay on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30">
            <div className="w-14 h-14 rounded-full bg-molt-500/90 flex items-center justify-center shadow-neon">
              <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
            </div>
          </div>

          {/* Play count overlay */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 text-xs text-white/90 backdrop-blur-sm">
            <Play className="w-3 h-3" fill="currentColor" />
            {formatNumber(playCount)}
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-display font-semibold text-white truncate group-hover:text-neon-cyan transition-colors">
            {name}
          </h3>
          <p className="text-sm text-white/40 mt-0.5">by {creator}</p>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-accent-amber" fill="currentColor" />
              <span className="text-sm text-white/70">{rating.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1 text-white/40">
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs">{formatNumber(playCount)} plays</span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="badge text-[10px] px-2 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
