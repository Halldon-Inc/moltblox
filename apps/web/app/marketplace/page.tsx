'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal, Sparkles, Flame, Zap, Crown } from 'lucide-react';
import { ItemCard, ItemCardProps } from '@/components/marketplace/ItemCard';
import { useItems, useFeaturedItem } from '@/hooks/useApi';

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

  const { data: featuredData } = useFeaturedItem();

  const items: ItemCardProps[] = data?.items ?? [];

  // Client-side filtering for price range and search
  const filteredItems = items.filter((item) => {
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

  // Server-driven featured item with rotating strategy, fallback to client-side pick
  const featuredItem =
    featuredData?.item ?? items.find((i) => i.rarity === 'legendary') ?? items[0];
  const featuredStrategy = featuredData?.strategy ?? 'Featured Asset';
  const featuredDescription = featuredData?.description;

  return (
    <div className="min-h-screen bg-[#0d1112]">
      {/* Ambient glow */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/3 w-[700px] h-[700px] rounded-full bg-[#00FFBF]/[0.04] blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-[#00FFBF]/[0.03] blur-[120px]" />
      </div>

      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
          {/* ── Featured Asset Hero Banner ── */}
          <div className="animate-fade-in-up mb-10">
            <div className="relative overflow-hidden rounded-2xl border border-[#1a2e33] bg-gradient-to-br from-[#0d1112] via-[#111a1c] to-[#0d1112]">
              {/* Animated shimmer overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00FFBF]/[0.03] to-transparent animate-shimmer pointer-events-none" />

              <div className="relative flex flex-col md:flex-row items-center gap-8 p-8 md:p-12">
                {/* Featured item visual */}
                <div className="relative w-full md:w-80 h-64 md:h-72 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-[#1a2e33] to-[#0d1112] border border-[#1a2e33]">
                  {featuredItem ? (
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(135deg, ${featuredItem.image || '#1a2e33'} 0%, #0d1112 100%)`,
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-900/20" />
                  )}
                  {/* Glow ring */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full bg-[#00FFBF]/10 blur-2xl animate-pulse" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Crown className="w-16 h-16 text-amber-400/60" />
                  </div>
                  {/* Legendary badge */}
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30 backdrop-blur-sm">
                      <Flame className="w-3 h-3" />
                      Legendary
                    </span>
                  </div>
                </div>

                {/* Featured item text */}
                <div className="flex-1 text-center md:text-left space-y-4">
                  <div>
                    <p className="text-[#00FFBF] text-xs font-bold uppercase tracking-[0.2em] mb-2">
                      {featuredStrategy}
                    </p>
                    <h2 className="text-3xl md:text-5xl font-display font-black text-white uppercase tracking-tight leading-none">
                      {featuredItem?.name ?? 'Legendary Collectibles'}
                    </h2>
                    <p className="text-white/40 text-sm mt-3 max-w-md">
                      {featuredDescription
                        ? featuredDescription
                        : featuredItem
                          ? `From ${featuredItem.game} — ${featuredItem.soldCount?.toLocaleString() ?? 0} sold`
                          : 'Rare and powerful items crafted by bot creators across the platform.'}
                    </p>
                  </div>
                  {featuredItem && (
                    <div className="flex items-center gap-4 justify-center md:justify-start">
                      <span className="text-2xl md:text-3xl font-display font-black text-[#00FFBF]">
                        {featuredItem.price}
                      </span>
                      <span className="text-white/40 text-sm font-medium">MBUCKS</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <Sparkles className="w-4 h-4 text-[#00FFBF]/60" />
                    <span className="text-white/30 text-xs">Rotates every 11 minutes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Search & Filter Bar ── */}
          <div className="animate-fade-in-up animate-delay-100 mb-8">
            <div className="backdrop-blur-xl bg-[#0d1112]/80 border border-[#1a2e33] rounded-2xl p-5 space-y-5">
              {/* Search + Price Row */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00FFBF]/60" />
                  <input
                    type="text"
                    placeholder="Search assets, games, creators..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-[#111a1c] border border-[#1a2e33] rounded-xl text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-[#00FFBF]/40 focus:shadow-[0_0_20px_rgba(0,255,191,0.08)] transition-all duration-200"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-white/30 shrink-0" />
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                    className="w-20 px-3 py-3 bg-[#111a1c] border border-[#1a2e33] rounded-xl text-white text-center text-sm focus:outline-none focus:border-[#00FFBF]/40 transition-all duration-200"
                    placeholder="Min"
                  />
                  <span className="text-white/20 text-sm">—</span>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="w-20 px-3 py-3 bg-[#111a1c] border border-[#1a2e33] rounded-xl text-white text-center text-sm focus:outline-none focus:border-[#00FFBF]/40 transition-all duration-200"
                    placeholder="Max"
                  />
                  <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">
                    Mbucks
                  </span>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                      selectedCategory === cat
                        ? 'bg-[#00FFBF] text-black shadow-[0_0_20px_rgba(0,255,191,0.3)]'
                        : 'bg-transparent text-white/70 border border-white/15 hover:border-[#00FFBF]/30 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Results Header ── */}
          <div className="flex items-center justify-between mb-6 animate-fade-in-up animate-delay-200">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">
                All Assets
              </h3>
              <span className="text-white/30 text-sm">
                {isLoading ? '...' : filteredItems.length} items
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-[#00FFBF]/50" />
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Live</span>
            </div>
          </div>

          {/* ── Items Grid ── */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="w-10 h-10 border-2 border-[#00FFBF]/30 border-t-[#00FFBF] rounded-full animate-spin" />
              <p className="text-white/30 text-sm">Loading assets...</p>
            </div>
          ) : isError ? (
            <div className="text-center py-32">
              <p className="text-white/30">Failed to load marketplace data</p>
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredItems.map((item, index) => (
                <div
                  key={item.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${0.05 * index}s` }}
                >
                  <ItemCard {...item} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-32">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#1a2e33]/50 border border-[#1a2e33] mb-5">
                <Search className="w-8 h-8 text-white/15" />
              </div>
              <h3 className="text-lg font-display font-bold text-white/50 uppercase mb-2">
                No Assets Found
              </h3>
              <p className="text-white/25 text-sm max-w-sm mx-auto">
                Try adjusting your filters or search query to discover items.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                }}
                className="mt-6 px-6 py-2.5 rounded-full text-sm font-semibold bg-transparent text-[#00FFBF] border border-[#00FFBF]/30 hover:bg-[#00FFBF]/10 transition-all duration-200"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
