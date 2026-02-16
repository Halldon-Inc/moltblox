'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Star,
  Users,
  Play,
  Clock,
  Calendar,
  ShoppingBag,
  Loader2,
  Check,
  Wallet,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import GameCard from '@/components/games/GameCard';
import GamePlayer from '@/components/games/GamePlayer';
import {
  useGame,
  useGameStats,
  useItems,
  useGames,
  useRateGame,
  usePurchaseItem,
} from '@/hooks/useApi';

const rarityColors: Record<string, { badge: string; text: string }> = {
  common: { badge: 'bg-gray-200 text-gray-600', text: 'text-gray-500' },
  uncommon: { badge: 'bg-green-100 text-green-700', text: 'text-green-600' },
  rare: { badge: 'bg-blue-100 text-blue-700', text: 'text-blue-600' },
  epic: { badge: 'bg-purple-100 text-purple-700', text: 'text-purple-600' },
  legendary: { badge: 'bg-amber-100 text-amber-700', text: 'text-amber-600' },
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function formatBigIntPrice(price: string | number): string {
  if (typeof price === 'number') return price.toString();
  try {
    const num = BigInt(price);
    const divisor = BigInt(10 ** 18);
    const whole = num / divisor;
    const remainder = num % divisor;
    if (remainder === BigInt(0)) return whole.toString();
    const decimal = remainder.toString().padStart(18, '0').slice(0, 2);
    return `${whole}.${decimal}`;
  } catch {
    return price;
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function ItemBuyButton({ itemId }: { itemId: string }) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const purchaseMutation = usePurchaseItem();
  const [purchased, setPurchased] = useState(false);

  const handleBuy = () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (purchaseMutation.isPending || purchased) return;
    purchaseMutation.mutate(
      { id: itemId, quantity: 1 },
      {
        onSuccess: () => {
          setPurchased(true);
          setTimeout(() => setPurchased(false), 2000);
        },
      },
    );
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleBuy}
        disabled={isConnected && purchaseMutation.isPending}
        className="px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 bg-molt-500/20 text-molt-300 hover:bg-molt-500/30 border border-molt-500/20"
      >
        {!isConnected ? (
          <>
            <Wallet className="w-3 h-3" />
            Connect
          </>
        ) : purchaseMutation.isPending ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Buying...
          </>
        ) : purchased ? (
          <>
            <Check className="w-3 h-3" />
            Bought!
          </>
        ) : (
          <>
            <ShoppingBag className="w-3 h-3" />
            Buy
          </>
        )}
      </button>
      {purchaseMutation.isError && (
        <span className="text-[10px] text-red-400">
          {purchaseMutation.error?.message || 'Failed'}
        </span>
      )}
    </div>
  );
}

export default function GameDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: game, isLoading: gameLoading, isError: gameError } = useGame(id);
  const { data: stats } = useGameStats(id);
  const { data: itemsData } = useItems({ gameId: id, limit: 4 });
  const { data: relatedData } = useGames({ limit: 3 });

  const rateMutation = useRateGame();

  const [isPlaying, setIsPlaying] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handleExit = useCallback(() => setIsPlaying(false), []);

  const handleRate = useCallback(
    (value: number) => {
      if (rateMutation.isPending) return;
      setUserRating(value);
      rateMutation.mutate({ id, rating: value }, { onSuccess: () => setRatingSubmitted(true) });
    },
    [id, rateMutation],
  );

  const isLoading = gameLoading;
  const isError = gameError;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-molt-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !game) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">Game not found</p>
          <Link href="/games" className="text-molt-500 hover:text-molt-600 transition-colors">
            Back to Games
          </Link>
        </div>
      </div>
    );
  }

  const gameName = game.name || 'Untitled Game';
  const creatorName = game.creator?.displayName || game.creator?.username || 'Unknown';
  const thumbnail = game.thumbnailUrl || '#14b8a6, #0a1a1a';
  const rating = game.averageRating ?? 0;
  const playCount = game.totalPlays ?? 0;
  const playerCount = game.uniquePlayers ?? 0;
  const tags: string[] = Array.isArray(game.tags) ? game.tags : [];
  const description = game.description || '';

  const gameStats = {
    totalPlays:
      stats?.totalPlays != null ? formatNumber(stats.totalPlays) : formatNumber(playCount),
    uniquePlayers: stats?.uniquePlayers != null ? formatNumber(stats.uniquePlayers) : '--',
    avgSession: stats?.avgSessionTime || stats?.avgSession || '--',
    created: game.createdAt ? formatDate(game.createdAt) : '--',
  };

  const items = itemsData?.items ?? [];

  const relatedGames = (relatedData?.games ?? []).filter((g: any) => g.id !== id).slice(0, 3);

  const heroBackground = game.thumbnailUrl
    ? `url(${encodeURI(game.thumbnailUrl)})`
    : `url(/images/heroes/game-detail-lava.png), linear-gradient(135deg, ${thumbnail})`;

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Full-bleed Hero */}
      <div className="relative w-full h-[50vh] md:h-[60vh] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            background: heroBackground,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* Gradient overlay fading to white */}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent" />

        {/* Hero Content - centered title at bottom */}
        <div className="absolute bottom-0 left-0 right-0 pb-12 md:pb-16 px-6">
          <h1 className="text-5xl md:text-7xl font-display font-black text-white uppercase tracking-tight drop-shadow-lg text-center">
            {gameName}
          </h1>
          <p className="text-white/80 text-center mt-2 text-lg">By @{creatorName}</p>
        </div>
      </div>

      {/* Stats / Action Bar */}
      <div className="page-container">
        <div className="flex items-center justify-between flex-wrap gap-4 py-6 border-b border-gray-200">
          <div className="flex items-center flex-wrap gap-6">
            {/* Play count */}
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Play className="w-3.5 h-3.5" fill="currentColor" />
              {formatNumber(playCount)} plays
            </div>

            {/* Unique players */}
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Users className="w-3.5 h-3.5" />
              {gameStats.uniquePlayers} players
            </div>

            {/* Rating */}
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Star className="w-3.5 h-3.5 text-accent-amber" fill="currentColor" />
              {rating.toFixed(1)}
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-gray-900 text-white text-[10px] uppercase font-bold px-3 py-1 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Play Now CTA */}
          <button
            onClick={handlePlay}
            className="btn-primary px-8 py-3 flex items-center gap-2 shrink-0 font-bold uppercase tracking-wide"
          >
            <Play className="w-4 h-4" fill="currentColor" />
            Play Now
          </button>
        </div>

        {/* Game Player */}
        {isPlaying && (
          <div className="my-8">
            <GamePlayer
              wasmUrl={game.wasmUrl || undefined}
              templateSlug={game.templateSlug || undefined}
              gameId={game.id}
              gameName={gameName}
              gameConfig={(game.config as Record<string, unknown>) || undefined}
              thumbnail={game.thumbnailUrl || undefined}
              onExit={handleExit}
            />
          </div>
        )}

        {/* Content Area - Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
          {/* Left Column - About This Game */}
          <div>
            <h2 className="text-2xl font-display font-black uppercase tracking-tight text-black mb-4">
              About This Game
            </h2>
            <p className="text-gray-600 leading-relaxed">{description}</p>
          </div>

          {/* Right Column - How to Play */}
          {game.howToPlay && Array.isArray(game.howToPlay) && game.howToPlay.length > 0 && (
            <div>
              <h2 className="text-2xl font-display font-black uppercase tracking-tight text-black mb-4">
                How to Play
              </h2>
              <ol className="space-y-4">
                {game.howToPlay.map((step: string, i: number) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-molt-500 text-white text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-gray-600 text-sm leading-relaxed pt-1">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Design Brief */}
        {game.designBrief && typeof game.designBrief === 'object' && (
          <div className="border border-gray-200 rounded-2xl p-6 mt-10">
            <h2 className="text-2xl font-display font-black uppercase tracking-tight text-black mb-4">
              Design Brief
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(game.designBrief as any).coreFantasy && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">
                    Core Fantasy
                  </span>
                  <p className="text-gray-700 mt-1">{(game.designBrief as any).coreFantasy}</p>
                </div>
              )}
              {(game.designBrief as any).coreTension && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">
                    Core Tension
                  </span>
                  <p className="text-gray-700 mt-1">{(game.designBrief as any).coreTension}</p>
                </div>
              )}
              {(game.designBrief as any).whatMakesItDifferent && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">
                    What Makes It Different
                  </span>
                  <p className="text-gray-700 mt-1">
                    {(game.designBrief as any).whatMakesItDifferent}
                  </p>
                </div>
              )}
              {(game.designBrief as any).targetEmotion && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">
                    Target Emotion
                  </span>
                  <p className="text-gray-700 mt-1">{(game.designBrief as any).targetEmotion}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rate This Game */}
        <div className="border border-gray-200 rounded-2xl p-6 mt-10">
          <h2 className="text-2xl font-display font-black uppercase tracking-tight text-black mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-accent-amber" />
            Rate This Game
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => handleRate(value)}
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  disabled={rateMutation.isPending}
                  className="transition-transform hover:scale-110 disabled:opacity-50"
                >
                  <Star
                    className={`w-7 h-7 ${
                      value <= (hoverRating || userRating) ? 'text-accent-amber' : 'text-gray-300'
                    }`}
                    fill={value <= (hoverRating || userRating) ? 'currentColor' : 'none'}
                  />
                </button>
              ))}
            </div>
            {ratingSubmitted && <span className="text-sm text-molt-500">Thanks for rating!</span>}
            {rateMutation.isError && (
              <span className="text-sm text-red-500">
                {rateMutation.error?.message || 'Rating failed'}
              </span>
            )}
          </div>
        </div>

        {/* Items Section */}
        <div className="mt-10">
          <h2 className="text-2xl font-display font-black uppercase tracking-tight text-black mb-6">
            Items
          </h2>
          <div className="space-y-4">
            {items.length > 0 ? (
              items.map((item: any) => {
                const rarity = rarityColors[item.rarity] || rarityColors.common;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-4 border-b border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-semibold text-gray-900">{item.name}</p>
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${rarity.badge}`}
                          >
                            {item.rarity}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">{item.category}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-3xl md:text-4xl font-display font-black text-black">
                          {formatBigIntPrice(item.price)}
                        </p>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">MOLT</p>
                      </div>
                      <ItemBuyButton itemId={item.id} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No items available</p>
            )}
          </div>
        </div>

        {/* Game Stats */}
        <div className="border border-gray-200 rounded-2xl p-6 mt-10">
          <h2 className="text-2xl font-display font-black uppercase tracking-tight text-black mb-4">
            Game Stats
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Plays', value: gameStats.totalPlays, icon: Play },
              { label: 'Unique Players', value: gameStats.uniquePlayers, icon: Users },
              { label: 'Avg Session', value: gameStats.avgSession, icon: Clock },
              { label: 'Created', value: gameStats.created, icon: Calendar },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-400 uppercase tracking-wider">
                    {stat.label}
                  </span>
                </div>
                <p className="font-display font-bold text-lg text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        {playerCount > 0 && (
          <div className="mt-10">
            <h2 className="text-2xl font-display font-black uppercase tracking-tight text-black mb-4">
              Recent Activity
            </h2>
            <div className="divide-y divide-gray-100">
              <div className="py-3 text-gray-600 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                {playerCount.toLocaleString()} player{playerCount !== 1 ? 's' : ''} currently online
              </div>
            </div>
          </div>
        )}

        {/* Related Games */}
        {relatedGames.length > 0 && (
          <div className="mt-12 mb-8">
            <h2 className="text-2xl font-display font-black uppercase tracking-tight text-black mb-6">
              You Might Also Like
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedGames.map((g: any) => (
                <GameCard
                  key={g.id}
                  id={g.id}
                  name={g.name}
                  creator={g.creator?.displayName || g.creator?.username || 'Unknown'}
                  thumbnail={g.thumbnailUrl || '#14b8a6, #0a1a1a'}
                  rating={g.averageRating ?? 0}
                  playCount={g.totalPlays ?? 0}
                  playerCount={g.uniquePlayers ?? 0}
                  tags={Array.isArray(g.tags) ? g.tags : []}
                  templateSlug={g.templateSlug}
                  genre={g.genre}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
