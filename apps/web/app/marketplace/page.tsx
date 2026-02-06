'use client';

import { useState } from 'react';
import { ShoppingBag, Search, SlidersHorizontal } from 'lucide-react';
import { ItemCard, ItemCardProps } from '@/components/marketplace/ItemCard';
import { useItems } from '@/hooks/useApi';

const CATEGORIES = ['All', 'Cosmetics', 'Power-ups', 'Consumables', 'Subscriptions'] as const;

type Category = (typeof CATEGORIES)[number];

function weiToMolt(wei: string | number): number {
  if (typeof wei === 'number') return wei;
  try {
    return Number(BigInt(wei) / BigInt(10 ** 18));
  } catch {
    return 0;
  }
}

export default function MarketplacePage() {
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, isError } = useItems({
    category: selectedCategory !== 'All' ? selectedCategory.toLowerCase() : undefined,
    rarity: undefined,
  });

  const items: ItemCardProps[] = data?.items ?? [];

  // Client-side filtering for price range and search (these may not be supported by the API)
  const filteredItems = items.filter((item: ItemCardProps) => {
    if (
      weiToMolt(String(item.price)) < priceRange[0] ||
      weiToMolt(String(item.price)) > priceRange[1]
    )
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.game || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
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
            <p className="text-white/50 text-sm mt-1">Find items for your favorite games</p>
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
            {/* Price Range */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-white/30 shrink-0" />
              <input
                type="number"
                min={0}
                max={10000}
                value={priceRange[0]}
                onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                className="input-field w-20 text-center text-sm"
                placeholder="Min"
              />
              <span className="text-white/30 text-sm">-</span>
              <input
                type="number"
                min={0}
                max={10000}
                value={priceRange[1]}
                onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
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
          Showing{' '}
          <span className="text-white/70 font-medium">
            {isLoading ? '-' : filteredItems.length}
          </span>{' '}
          items
        </p>
      </div>

      {/* Items Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-molt-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-center py-20">
          <p className="text-white/30">Failed to load data</p>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="card-grid">
          {filteredItems.map((item: ItemCardProps) => (
            <ItemCard key={item.id} {...item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 mb-4">
            <ShoppingBag className="w-8 h-8 text-white/20" />
          </div>
          <h3 className="text-lg font-semibold text-white/60 mb-1">No items found</h3>
          <p className="text-white/30 text-sm">Try adjusting your filters or search query.</p>
        </div>
      )}
    </div>
  );
}
