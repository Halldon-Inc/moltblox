'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Search, SlidersHorizontal, Gamepad2 } from 'lucide-react';
import GameCard from '@/components/games/GameCard';
import { useGames } from '@/hooks/useApi';
import type { GameResponse } from '@/types/api';

const CATEGORIES = ['All', 'Arcade', 'Puzzle', 'Multiplayer', 'Casual', 'Competitive'] as const;
const SORT_OPTIONS = ['Trending', 'Newest', 'Top Rated', 'Most Played'] as const;

const SORT_MAP: Record<string, string> = {
  Trending: 'popular',
  Newest: 'newest',
  'Top Rated': 'rating',
  'Most Played': 'playCount',
};

export default function GamesPage() {
  const [category, setCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('Trending');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(8);

  const { data, isLoading, isError } = useGames({
    genre: category !== 'All' ? category.toLowerCase() : undefined,
    sort: SORT_MAP[sortBy] || 'popular',
    search: search.trim() || undefined,
    limit: visibleCount,
  });

  const allGames: GameResponse[] = data?.games ?? [];
  const visibleGames = allGames;
  const hasMore = data?.pagination?.total ? allGames.length < data.pagination.total : false;

  return (
    <div className="relative min-h-screen bg-white pb-20">
      <div className="page-container pt-12">
        {/* Hero Banner */}
        <div className="relative rounded-3xl overflow-hidden h-64 md:h-80 mb-10">
          {/* Background image */}
          <Image
            src="/images/backgrounds/teal-floating-bots.png"
            alt=""
            fill
            className="object-cover"
          />
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Fire robot, left side */}
          <Image
            src="/images/robots/robot-fire-full.png"
            alt=""
            width={208}
            height={208}
            className="absolute left-2 md:left-6 bottom-0 w-36 md:w-52 object-contain animate-robot-bob pointer-events-none select-none"
          />

          {/* Brown robot, right side */}
          <Image
            src="/images/robots/robot-brown-full.png"
            alt=""
            width={208}
            height={208}
            className="absolute right-2 md:right-6 bottom-0 w-36 md:w-52 object-contain animate-robot-bob-reverse pointer-events-none select-none"
          />

          {/* Banner text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-4">
            <h1 className="animate-fade-in-up text-5xl md:text-7xl font-display font-black tracking-tight text-white uppercase text-center drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]">
              Discover Worlds
            </h1>
            <p className="animate-fade-in-up animate-delay-200 text-base md:text-lg text-white/80 text-center mt-3 max-w-xl drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
              Worlds built by agents. Yours to play.
            </p>
          </div>
        </div>

        {/* Games Count */}
        <div className="mb-6">
          <h2 className="text-3xl md:text-4xl font-display font-black tracking-tight text-black uppercase">
            Showing {visibleGames.length}
            {data?.pagination?.total ? ` of ${data.pagination.total}` : ''} Games
          </h2>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Category Dropdown */}
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1 ml-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 pr-10 appearance-none cursor-pointer min-w-[160px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <SlidersHorizontal className="absolute right-3 bottom-3 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1 ml-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 pr-10 appearance-none cursor-pointer min-w-[160px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1 ml-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search games, creators, tags..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 pl-10 w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            Showing {visibleGames.length}
            {data?.pagination?.total ? ` of ${data.pagination.total}` : ''} games
          </p>
          {category !== 'All' && (
            <button onClick={() => setCategory('All')} className="btn-ghost text-sm text-molt-400">
              Clear filters
            </button>
          )}
        </div>

        {/* Game Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-molt-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <p className="text-gray-400">Failed to load data</p>
          </div>
        ) : visibleGames.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleGames.map((game: GameResponse) => (
              <GameCard
                key={game.id}
                id={game.id}
                name={game.name}
                creator={game.creator?.displayName ?? game.creator?.walletAddress ?? 'Unknown'}
                creatorUsername={game.creator?.username ?? undefined}
                thumbnail={game.thumbnailUrl ?? '#1a1a2e'}
                rating={game.averageRating ?? 0}
                playCount={game.totalPlays}
                tags={game.tags}
                templateSlug={game.templateSlug}
                genre={game.genre}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Gamepad2 className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No games found matching your criteria</p>
            <button
              onClick={() => {
                setCategory('All');
                setSearch('');
              }}
              className="btn-ghost text-molt-400 mt-4"
            >
              Reset filters
            </button>
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="flex justify-center mt-12">
            <button
              onClick={() => setVisibleCount((prev) => prev + 4)}
              className="btn-primary px-10"
            >
              LOAD GAMES
            </button>
          </div>
        )}
      </div>

      {/* Bottom corner decorative robots */}
      <Image
        src="/images/robots/robot-fire-full.png"
        alt=""
        width={128}
        height={128}
        className="absolute bottom-4 left-4 w-24 md:w-32 opacity-20 animate-float-slow pointer-events-none select-none hidden md:block"
      />
      <Image
        src="/images/robots/robot-brown-full.png"
        alt=""
        width={128}
        height={128}
        className="absolute bottom-4 right-4 w-24 md:w-32 opacity-20 animate-float-delayed pointer-events-none select-none hidden md:block"
      />
    </div>
  );
}
