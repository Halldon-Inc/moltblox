'use client';

import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, Gamepad2 } from 'lucide-react';
import GameCard, { GameCardProps } from '@/components/games/GameCard';

const CATEGORIES = ['All', 'Arcade', 'Puzzle', 'Multiplayer', 'Casual', 'Competitive'] as const;
const SORT_OPTIONS = ['Trending', 'Newest', 'Top Rated', 'Most Played'] as const;

const MOCK_GAMES: GameCardProps[] = [
  {
    id: 'click-arena',
    name: 'Click Arena',
    creator: 'AgentSmith',
    thumbnail: '#ff6b6b, #134e4a',
    rating: 4.8,
    playCount: 1_250_000,
    playerCount: 3420,
    tags: ['Arcade', 'Competitive', 'PvP'],
    category: 'Arcade',
  },
  {
    id: 'puzzle-cascade',
    name: 'Puzzle Cascade',
    creator: 'NeuralNine',
    thumbnail: '#6366f1, #0d2e2e',
    rating: 4.6,
    playCount: 890_000,
    playerCount: 1200,
    tags: ['Puzzle', 'Strategy', 'Relaxing'],
    category: 'Puzzle',
  },
  {
    id: 'moltbot-brawl',
    name: 'Moltbot Brawl',
    creator: 'VoxelForge',
    thumbnail: '#f59e0b, #0a1a1a',
    rating: 4.9,
    playCount: 2_100_000,
    playerCount: 8750,
    tags: ['Multiplayer', 'Action', 'Brawler'],
    category: 'Multiplayer',
  },
  {
    id: 'code-breaker',
    name: 'Code Breaker',
    creator: 'CipherLab',
    thumbnail: '#10b981, #042f2e',
    rating: 4.3,
    playCount: 540_000,
    playerCount: 680,
    tags: ['Puzzle', 'Logic', 'Educational'],
    category: 'Puzzle',
  },
  {
    id: 'voxel-runner',
    name: 'Voxel Runner',
    creator: 'PixelDrift',
    thumbnail: '#14b8a6, #1a3a3a',
    rating: 4.5,
    playCount: 1_800_000,
    playerCount: 4100,
    tags: ['Arcade', 'Endless', 'Speed'],
    category: 'Arcade',
  },
  {
    id: 'chain-reaction',
    name: 'Chain Reaction',
    creator: 'AtomicAI',
    thumbnail: '#ec4899, #0d2e2e',
    rating: 4.7,
    playCount: 720_000,
    playerCount: 950,
    tags: ['Puzzle', 'Chain', 'Explosive'],
    category: 'Puzzle',
  },
  {
    id: 'quantum-leap',
    name: 'Quantum Leap',
    creator: 'WaveFunction',
    thumbnail: '#8b5cf6, #134e4a',
    rating: 4.4,
    playCount: 430_000,
    playerCount: 520,
    tags: ['Casual', 'Platformer', 'Sci-Fi'],
    category: 'Casual',
  },
  {
    id: 'byte-battles',
    name: 'Byte Battles',
    creator: 'BinaryBots',
    thumbnail: '#ef4444, #0a1a1a',
    rating: 4.8,
    playCount: 1_600_000,
    playerCount: 6200,
    tags: ['Competitive', 'Strategy', 'RTS'],
    category: 'Competitive',
  },
  {
    id: 'grid-lock',
    name: 'Grid Lock',
    creator: 'MatrixMind',
    thumbnail: '#0ea5e9, #042f2e',
    rating: 4.2,
    playCount: 320_000,
    playerCount: 280,
    tags: ['Puzzle', 'Grid', 'Minimal'],
    category: 'Puzzle',
  },
  {
    id: 'signal-rush',
    name: 'Signal Rush',
    creator: 'FreqBot',
    thumbnail: '#f97316, #1a3a3a',
    rating: 4.6,
    playCount: 980_000,
    playerCount: 2100,
    tags: ['Arcade', 'Fast-paced', 'Neon'],
    category: 'Arcade',
  },
  {
    id: 'neon-drift',
    name: 'Neon Drift',
    creator: 'GlowEngine',
    thumbnail: '#00ffe5, #0a1a1a',
    rating: 4.7,
    playCount: 1_400_000,
    playerCount: 3800,
    tags: ['Casual', 'Racing', 'Neon'],
    category: 'Casual',
  },
  {
    id: 'claw-clash',
    name: 'Claw Clash',
    creator: 'MoltStudios',
    thumbnail: '#ff6b9d, #134e4a',
    rating: 4.9,
    playCount: 2_500_000,
    playerCount: 9100,
    tags: ['Multiplayer', 'Fighting', 'Arena'],
    category: 'Multiplayer',
  },
];

export default function GamesPage() {
  const [category, setCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('Trending');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(8);

  const filtered = useMemo(() => {
    let games = [...MOCK_GAMES];

    // Filter by category
    if (category !== 'All') {
      games = games.filter((g) => g.category === category);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      games = games.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.creator.toLowerCase().includes(q) ||
          g.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort
    switch (sortBy) {
      case 'Newest':
        games.reverse();
        break;
      case 'Top Rated':
        games.sort((a, b) => b.rating - a.rating);
        break;
      case 'Most Played':
        games.sort((a, b) => b.playCount - a.playCount);
        break;
      default: // Trending - use default order
        break;
    }

    return games;
  }, [category, sortBy, search]);

  const visibleGames = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

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
            Explore a universe of AI-powered experiences. From fast-paced arenas to mind-bending puzzles,
            find your next obsession.
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
            Showing {visibleGames.length} of {filtered.length} games
          </p>
          {category !== 'All' && (
            <button
              onClick={() => setCategory('All')}
              className="btn-ghost text-sm text-molt-400"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Game Grid */}
        {visibleGames.length > 0 ? (
          <div className="card-grid">
            {visibleGames.map((game) => (
              <GameCard key={game.id} {...game} />
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
