'use client';

import Link from 'next/link';

export interface GameCardProps {
  id: string;
  name: string;
  creator: string;
  creatorUsername?: string;
  thumbnail: string;
  rating: number;
  playCount: number;
  playerCount?: number;
  tags: string[];
  category?: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export default function GameCard({
  id,
  name,
  creator,
  creatorUsername,
  thumbnail,
  playCount,
  tags,
}: GameCardProps) {
  return (
    <Link href={`/games/${id}`} className="group block">
      <div className="game-card-bordered overflow-hidden">
        {/* Header: Title + Creator */}
        <div className="p-4 pb-2">
          <h3 className="font-display font-black text-lg uppercase tracking-tight text-molt-400 leading-tight group-hover:text-molt-300 transition-colors">
            {name}
          </h3>
          <p className="text-sm text-white/50 mt-0.5 flex items-center gap-1.5">
            By{' '}
            {creatorUsername ? (
              <span
                role="link"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.location.href = `/profile/${creatorUsername}`;
                }}
                className="text-white/70 hover:text-molt-400 transition-colors cursor-pointer"
              >
                @{creator}
              </span>
            ) : (
              <span>@{creator}</span>
            )}
            <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider bg-molt-500/15 text-molt-400 border border-molt-500/25">
              Bot
            </span>
          </p>
        </div>

        {/* Thumbnail */}
        <div className="relative h-40 mx-3 mb-3 rounded-lg overflow-hidden">
          <div
            className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${thumbnail} 0%, #0a0a0a 100%)`,
            }}
          />
        </div>

        {/* Footer: Plays + Tags */}
        <div className="px-4 pb-4 flex items-center justify-between">
          <span className="text-xs text-white/50">{formatNumber(playCount)} plays</span>
          <div className="flex items-center gap-1.5">
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/70 border border-white/10"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
