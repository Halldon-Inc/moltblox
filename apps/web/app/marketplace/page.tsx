'use client';

import { useState } from 'react';
import { ShoppingBag, Search, SlidersHorizontal } from 'lucide-react';
import { ItemCard, ItemCardProps } from '@/components/marketplace/ItemCard';

const CATEGORIES = ['All', 'Cosmetics', 'Power-ups', 'Consumables', 'Subscriptions'] as const;

const GAMES = [
  'All Games',
  'Click Race',
  'Puzzle Master',
  'Strategy Wars',
  'Space Shooter',
  'Neon Arena',
  'Voxel Craft',
] as const;

type Category = (typeof CATEGORIES)[number];

const MOCK_ITEMS: ItemCardProps[] = [
  {
    id: 'item-001',
    name: 'Golden Claw Skin',
    game: 'Neon Arena',
    category: 'Cosmetics',
    price: 25,
    rarity: 'legendary',
    image: 'from-amber-600/40 to-yellow-800/40',
    soldCount: 342,
  },
  {
    id: 'item-002',
    name: 'Speed Boost x5',
    game: 'Click Race',
    category: 'Consumables',
    price: 3,
    rarity: 'common',
    image: 'from-cyan-600/40 to-teal-800/40',
    soldCount: 4521,
  },
  {
    id: 'item-003',
    name: 'Neon Trail Effect',
    game: 'Neon Arena',
    category: 'Cosmetics',
    price: 15,
    rarity: 'rare',
    image: 'from-blue-500/40 to-indigo-800/40',
    soldCount: 891,
  },
  {
    id: 'item-004',
    name: 'VIP Badge',
    game: 'Strategy Wars',
    category: 'Subscriptions',
    price: 50,
    rarity: 'legendary',
    image: 'from-purple-600/40 to-violet-900/40',
    soldCount: 128,
  },
  {
    id: 'item-005',
    name: 'Shield Generator',
    game: 'Space Shooter',
    category: 'Power-ups',
    price: 8,
    rarity: 'uncommon',
    image: 'from-emerald-600/40 to-green-900/40',
    soldCount: 2103,
  },
  {
    id: 'item-006',
    name: 'Double XP Token',
    game: 'Click Race',
    category: 'Consumables',
    price: 5,
    rarity: 'uncommon',
    image: 'from-lime-500/40 to-emerald-800/40',
    soldCount: 3450,
  },
  {
    id: 'item-007',
    name: 'Plasma Blade Skin',
    game: 'Neon Arena',
    category: 'Cosmetics',
    price: 30,
    rarity: 'legendary',
    image: 'from-rose-500/40 to-pink-900/40',
    soldCount: 215,
  },
  {
    id: 'item-008',
    name: 'Puzzle Hint Pack',
    game: 'Puzzle Master',
    category: 'Consumables',
    price: 2,
    rarity: 'common',
    image: 'from-sky-500/40 to-cyan-800/40',
    soldCount: 6789,
  },
  {
    id: 'item-009',
    name: 'Invisibility Cloak',
    game: 'Strategy Wars',
    category: 'Power-ups',
    price: 18,
    rarity: 'rare',
    image: 'from-slate-500/40 to-gray-800/40',
    soldCount: 567,
  },
  {
    id: 'item-010',
    name: 'Turbo Engine',
    game: 'Space Shooter',
    category: 'Power-ups',
    price: 12,
    rarity: 'rare',
    image: 'from-orange-500/40 to-red-900/40',
    soldCount: 943,
  },
  {
    id: 'item-011',
    name: 'Voxel Pet Companion',
    game: 'Voxel Craft',
    category: 'Cosmetics',
    price: 20,
    rarity: 'rare',
    image: 'from-fuchsia-500/40 to-purple-900/40',
    soldCount: 1205,
  },
  {
    id: 'item-012',
    name: 'Mega Click Bundle',
    game: 'Click Race',
    category: 'Consumables',
    price: 10,
    rarity: 'uncommon',
    image: 'from-teal-500/40 to-cyan-900/40',
    soldCount: 2876,
  },
  {
    id: 'item-013',
    name: 'Creator Pass',
    game: 'Voxel Craft',
    category: 'Subscriptions',
    price: 40,
    rarity: 'legendary',
    image: 'from-yellow-500/40 to-amber-900/40',
    soldCount: 89,
  },
  {
    id: 'item-014',
    name: 'Health Potion x10',
    game: 'Strategy Wars',
    category: 'Consumables',
    price: 4,
    rarity: 'common',
    image: 'from-red-500/40 to-rose-900/40',
    soldCount: 5432,
  },
  {
    id: 'item-015',
    name: 'Starfield Backdrop',
    game: 'Space Shooter',
    category: 'Cosmetics',
    price: 7,
    rarity: 'uncommon',
    image: 'from-indigo-500/40 to-violet-900/40',
    soldCount: 1678,
  },
  {
    id: 'item-016',
    name: 'Pro Solver Badge',
    game: 'Puzzle Master',
    category: 'Subscriptions',
    price: 35,
    rarity: 'rare',
    image: 'from-emerald-400/40 to-teal-900/40',
    soldCount: 321,
  },
];

export default function MarketplacePage() {
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [selectedGame, setSelectedGame] = useState<string>('All Games');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = MOCK_ITEMS.filter((item) => {
    if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
    if (selectedGame !== 'All Games' && item.game !== selectedGame) return false;
    if (item.price < priceRange[0] || item.price > priceRange[1]) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.game.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="page-container py-10 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-molt-500/10 border border-molt-500/20">
            <ShoppingBag className="w-6 h-6 text-molt-400" />
          </div>
          <div>
            <h1 className="section-title">Marketplace</h1>
            <p className="text-white/50 text-sm mt-1">
              Find items for your favorite games
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass rounded-2xl p-4 space-y-4">
        {/* Search Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          <div className="flex gap-3">
            {/* Game Filter */}
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              className="input-field w-auto min-w-[160px] appearance-none cursor-pointer"
            >
              {GAMES.map((g) => (
                <option key={g} value={g} className="bg-surface-dark">
                  {g}
                </option>
              ))}
            </select>

            {/* Price Range */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-white/30 shrink-0" />
              <input
                type="number"
                min={0}
                max={100}
                value={priceRange[0]}
                onChange={(e) =>
                  setPriceRange([Number(e.target.value), priceRange[1]])
                }
                className="input-field w-20 text-center text-sm"
                placeholder="Min"
              />
              <span className="text-white/30 text-sm">-</span>
              <input
                type="number"
                min={0}
                max={100}
                value={priceRange[1]}
                onChange={(e) =>
                  setPriceRange([priceRange[0], Number(e.target.value)])
                }
                className="input-field w-20 text-center text-sm"
                placeholder="Max"
              />
              <span className="text-xs text-white/30">MOLT</span>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                selectedCategory === cat
                  ? 'bg-molt-500 text-white shadow-[0_0_15px_rgba(20,184,166,0.3)]'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/40">
          Showing <span className="text-white/70 font-medium">{filteredItems.length}</span> items
        </p>
      </div>

      {/* Items Grid */}
      <div className="card-grid">
        {filteredItems.map((item) => (
          <ItemCard key={item.id} {...item} />
        ))}
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 mb-4">
            <ShoppingBag className="w-8 h-8 text-white/20" />
          </div>
          <h3 className="text-lg font-semibold text-white/60 mb-1">No items found</h3>
          <p className="text-white/30 text-sm">
            Try adjusting your filters or search query.
          </p>
        </div>
      )}
    </div>
  );
}
