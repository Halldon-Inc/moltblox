'use client';

import { use, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Star,
  Users,
  Play,
  Clock,
  Calendar,
  Award,
  Zap,
  Shield,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import GameCard from '@/components/games/GameCard';
import GamePlayer from '@/components/games/GamePlayer';
import { useGame, useGameStats, useItems, useGames } from '@/hooks/useApi';

const rarityColors: Record<string, string> = {
  Common: 'text-white/60 border-white/10 bg-white/5',
  Uncommon: 'text-molt-300 border-molt-500/20 bg-molt-500/10',
  Rare: 'text-blue-400 border-blue-400/20 bg-blue-400/10',
  Epic: 'text-purple-400 border-purple-400/20 bg-purple-400/10',
  Legendary: 'text-accent-amber border-accent-amber/20 bg-accent-amber/10',
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

export default function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: game, isLoading: gameLoading, isError: gameError } = useGame(id);
  const { data: stats } = useGameStats(id);
  const { data: itemsData } = useItems({ gameId: id, limit: 4 });
  const { data: relatedData } = useGames({ limit: 3 });

  const [isPlaying, setIsPlaying] = useState(false);
  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handleExit = useCallback(() => setIsPlaying(false), []);

  const isLoading = gameLoading;
  const isError = gameError;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-molt-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !game) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 text-lg mb-4">Game not found</p>
          <Link href="/games" className="text-molt-400 hover:text-molt-300 transition-colors">
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

  return (
    <div className="min-h-screen bg-surface-dark pb-20">
      {/* Ambient glow */}
      <div className="ambient-glow ambient-glow-teal w-[600px] h-[600px] -top-60 left-1/3 fixed" />

      <div className="page-container pt-8">
        {/* Back Navigation */}
        <Link
          href="/games"
          className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Games</span>
        </Link>

        {/* Hero Area */}
        <div className="relative rounded-3xl overflow-hidden mb-8">
          <div
            className="h-64 md:h-80"
            style={{
              background: `linear-gradient(135deg, ${thumbnail})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-dark via-surface-dark/40 to-transparent" />

          {/* Hero Content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-5xl font-display font-bold text-white mb-2">
                  {gameName}
                </h1>
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Creator badge */}
                  <span className="badge">
                    <Award className="w-3 h-3" />
                    {creatorName}
                  </span>

                  {/* Rating */}
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(rating) ? 'text-accent-amber' : 'text-white/20'
                        }`}
                        fill={i < Math.floor(rating) ? 'currentColor' : 'none'}
                      />
                    ))}
                    <span className="text-sm text-white/60 ml-1">{rating.toFixed(1)}</span>
                  </div>

                  {/* Play count */}
                  <div className="flex items-center gap-1 text-white/50 text-sm">
                    <Play className="w-3.5 h-3.5" fill="currentColor" />
                    {formatNumber(playCount)} plays
                  </div>

                  {/* Live players */}
                  {playerCount > 0 && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-green-400">{playerCount.toLocaleString()} online</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Play Now CTA */}
              <button
                onClick={handlePlay}
                className="btn-primary text-lg px-10 py-4 flex items-center gap-2 shrink-0"
              >
                <Play className="w-5 h-5" fill="currentColor" />
                Play Now
              </button>
            </div>
          </div>
        </div>

        {/* Tags Row */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tags.map((tag) => (
            <span key={tag} className="badge">
              {tag}
            </span>
          ))}
        </div>

        {/* Game Player */}
        {isPlaying && (
          <div className="mb-8">
            <GamePlayer
              wasmUrl={game.wasmUrl || undefined}
              gameName={gameName}
              onExit={handleExit}
            />
          </div>
        )}

        {/* Description */}
        <div className="glass rounded-2xl p-6 mb-8">
          <p className="text-white/70 leading-relaxed">{description}</p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-12">
          {/* Left Column */}
          <div className="lg:col-span-3 space-y-8">
            {/* How to Play */}
            {game.howToPlay && Array.isArray(game.howToPlay) && game.howToPlay.length > 0 && (
              <div className="glass-card p-6">
                <h2 className="section-title text-xl mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-neon-cyan" />
                  How to Play
                </h2>
                <ol className="space-y-3">
                  {game.howToPlay.map((step: string, i: number) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-molt-500/20 text-molt-300 text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-white/60 text-sm">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Game Stats */}
            <div className="glass-card p-6">
              <h2 className="section-title text-xl mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-neon-cyan" />
                Game Stats
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Total Plays', value: gameStats.totalPlays, icon: Play },
                  { label: 'Unique Players', value: gameStats.uniquePlayers, icon: Users },
                  { label: 'Avg Session', value: gameStats.avgSession, icon: Clock },
                  { label: 'Created', value: gameStats.created, icon: Calendar },
                ].map((stat) => (
                  <div key={stat.label} className="bg-surface-dark/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <stat.icon className="w-3.5 h-3.5 text-white/30" />
                      <span className="text-xs text-white/40 uppercase tracking-wider">
                        {stat.label}
                      </span>
                    </div>
                    <p className="font-display font-bold text-lg text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Items */}
            <div className="glass-card p-6">
              <h2 className="section-title text-xl mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent-amber" />
                Items
              </h2>
              <div className="space-y-3">
                {items.length > 0 ? (
                  items.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-surface-dark/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-molt-500/10 flex items-center justify-center">
                          {item.category === 'Cosmetic' ? (
                            <Sparkles className="w-4 h-4 text-molt-300" />
                          ) : (
                            <Shield className="w-4 h-4 text-accent-amber" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{item.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/40">{item.category}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                rarityColors[item.rarity] || rarityColors.Common
                              }`}
                            >
                              {item.rarity}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-bold text-accent-amber text-sm">
                          {formatBigIntPrice(item.price)}
                        </p>
                        <p className="text-[10px] text-white/30">MBUCKS</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/30 text-center py-4">No items available</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Related Games */}
        {relatedGames.length > 0 && (
          <div className="mb-8">
            <h2 className="section-title mb-6">You Might Also Like</h2>
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
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
