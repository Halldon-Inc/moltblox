'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  featured?: boolean;
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
  featured,
}: GameCardProps) {
  const router = useRouter();
  return (
    <Link href={`/games/${id}`} className="group block">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300">
        {/* Header: Title + Creator */}
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-black text-lg uppercase tracking-tight text-gray-900 leading-tight group-hover:text-gray-700 transition-colors">
              {name}
            </h3>
            {featured && (
              <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 border border-gray-200">
                Featured
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
            By{' '}
            {creatorUsername ? (
              <span
                role="link"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(`/profile/${creatorUsername}`);
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              >
                @{creator}
              </span>
            ) : (
              <span>@{creator}</span>
            )}
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
          <span className="text-xs text-gray-400">{formatNumber(playCount)} plays</span>
          <div className="flex items-center gap-1.5">
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="bg-gray-900 text-white text-[10px] font-bold uppercase px-2.5 py-0.5 rounded"
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
