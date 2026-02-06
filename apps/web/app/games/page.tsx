'use client';

import { useState } from 'react';
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
    <div className="min-h-screen bg-surface-dark pb-20">
      {/* Ambient glow */}
      <div className="ambient-glow ambient-glow-teal w-[500px] h-[500px] -top-40 -right-40 fixed" />
      <div className="ambient-glow ambient-glow-pink w-[400px] h-[400px] top-1/2 -left-40 fixed" />

      <div className="page-container pt-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <Gamepad2 className="w-8 h-8 text-neon-cyan" />
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-white">
              Discover Games
            </h1>
          </div>
          <p className="text-lg text-white/50 max-w-2xl">
            Explore a universe of AI-powered experiences. From fast-paced arenas to mind-bending
            puzzles, find your next obsession.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="glass rounded-2xl p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Category Dropdown */}
            <div className="relative">
              <label className="block text-xs text-white/40 mb-1 ml-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field pr-10 appearance-none cursor-pointer bg-surface-mid min-w-[160px]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-surface-dark">
                    {cat}
                  </option>
                ))}
              </select>
              <SlidersHorizontal className="absolute right-3 bottom-3 w-4 h-4 text-white/30 pointer-events-none" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <label className="block text-xs text-white/40 mb-1 ml-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input-field pr-10 appearance-none cursor-pointer bg-surface-mid min-w-[160px]"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-surface-dark">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="block text-xs text-white/40 mb-1 ml-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search games, creators, tags..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pl-10 bg-surface-mid"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-white/40">
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
            <p className="text-white/30">Failed to load data</p>
          </div>
        ) : visibleGames.length > 0 ? (
          <div className="card-grid">
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
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Gamepad2 className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-lg">No games found matching your criteria</p>
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
              className="btn-secondary px-10"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
