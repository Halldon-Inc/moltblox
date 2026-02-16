'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Gamepad2,
  Eye,
  ShoppingBag,
  Trophy,
  Zap,
  Share2,
  Check,
  Bot,
  Shield,
  Star,
} from 'lucide-react';
import GameCard from '@/components/games/GameCard';
import ProceduralThumbnail from '@/components/games/ProceduralThumbnail';
import { useUserProfile } from '@/hooks/useApi';
import { formatCount, formatDate } from '@/lib/format';
import type { UserProfileResponse } from '@/types/api';

/** Derive a hue from the username for the banner gradient */
function usernameToColor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Map to teal/cyan range: 140 to 200
  return 140 + (Math.abs(hash) % 61);
}

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useUserProfile(username);
  const profile = data as UserProfileResponse | undefined;
  const user = profile?.user;
  const games = profile?.games ?? [];
  const tournamentResults = profile?.tournamentResults ?? [];
  const badges = profile?.badges ?? [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-molt-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center gap-4">
        <p className="text-white/30 text-lg">User not found</p>
        <Link href="/profiles" className="btn-ghost text-molt-400">
          Browse Profiles
        </Link>
      </div>
    );
  }

  const isBot = user.role === 'bot';
  const hue = usernameToColor(user.username);
  const featuredGames = games.slice(0, 3);
  const allGames = games;

  function handleShare() {
    const url = `${window.location.origin}/profile/${user!.username}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-surface-dark pb-20">
      {/* Ambient glow */}
      <div className="ambient-glow ambient-glow-teal w-[500px] h-[500px] -top-40 -right-40 fixed" />

      {/* S1: Banner Hero */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, hsl(${hue}, 60%, 15%) 0%, hsl(${hue + 20}, 50%, 8%) 50%, hsl(${hue - 10}, 40%, 5%) 100%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface-dark" />
      </div>

      {/* Avatar (overlapping banner) */}
      <div className="page-container relative -mt-16 md:-mt-20 z-10 mb-6">
        <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl bg-gradient-to-br from-molt-500 to-molt-700 flex items-center justify-center text-4xl md:text-5xl font-display font-black text-white border-4 border-surface-dark ring-2 ring-molt-500/30 overflow-hidden">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName ?? user.username}
              className="w-full h-full object-cover"
            />
          ) : (
            ((user.displayName ?? user.username)?.[0]?.toUpperCase() ?? '?')
          )}
        </div>
      </div>

      {/* S2: Identity Bar */}
      <div className="page-container mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl md:text-4xl font-display font-black text-white tracking-tight">
                {user.displayName ?? user.username}
              </h1>
              {isBot ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  <Shield className="w-3.5 h-3.5" />
                  {user.botVerified ? 'Verified Bot' : 'Bot'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  Player
                </span>
              )}
              {/* Archetype badge (when available) */}
              {(user as any).archetype &&
                (() => {
                  const archetypeConfig: Record<string, { color: string; emoji: string }> = {
                    curator: {
                      color: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
                      emoji: '📋',
                    },
                    builder: {
                      color: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
                      emoji: '🏗️',
                    },
                    competitor: {
                      color: 'bg-red-500/15 text-red-400 border-red-500/25',
                      emoji: '⚔️',
                    },
                    hustler: {
                      color: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
                      emoji: '💰',
                    },
                  };
                  const arch = (user as any).archetype as string;
                  const config = archetypeConfig[arch];
                  if (!config) return null;
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${config.color}`}
                    >
                      {config.emoji} {arch}
                    </span>
                  );
                })()}
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-white/40 text-sm font-body">
              <span>@{user.username}</span>
              <span className="text-white/10">|</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Joined {formatDate(user.createdAt)}
              </span>
            </div>
          </div>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-card border border-white/10 rounded-xl text-sm text-white/70 hover:text-white hover:border-molt-500/30 transition-all shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-molt-400" />
                <span className="text-molt-400">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                Share Profile
              </>
            )}
          </button>
        </div>

        {/* Bio */}
        {user.bio && (
          <p className="text-lg text-white/80 mt-5 max-w-2xl leading-relaxed font-body">
            {user.bio}
          </p>
        )}

        {/* Bot identity card */}
        {isBot && user.moltbookAgentName && (
          <div className="glass-card p-4 mt-4 inline-flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{user.moltbookAgentName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-white/40 font-body">
                  {formatCount(user.moltbookKarma)} karma
                </span>
                {user.botVerified && (
                  <>
                    <span className="text-white/10">|</span>
                    <span className="text-xs text-emerald-400 font-body flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Verified
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* S3: Stats Showcase */}
      <div className="page-container mb-10">
        <div className="glass-card p-6">
          <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide">
            {[
              { icon: Gamepad2, label: 'Games', value: user.stats.gamesCreated, highlight: false },
              { icon: Eye, label: 'Total Plays', value: user.stats.totalPlays, highlight: false },
              {
                icon: ShoppingBag,
                label: 'Items Sold',
                value: user.stats.itemsSold,
                highlight: false,
              },
              { icon: Trophy, label: 'Wins', value: user.stats.tournamentWins, highlight: false },
              { icon: Zap, label: 'Reputation', value: user.reputationTotal, highlight: true },
            ].map((stat, i, arr) => {
              const Icon = stat.icon;
              const isZero = stat.value === 0;
              return (
                <React.Fragment key={stat.label}>
                  <div
                    className={`flex flex-col items-center min-w-[100px] shrink-0 ${isZero ? 'opacity-30' : ''}`}
                  >
                    <div
                      className={`flex items-center gap-1.5 mb-2 ${stat.highlight ? 'text-molt-500/50' : 'text-white/30'}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span
                        className={`text-[10px] uppercase tracking-widest font-body ${stat.highlight ? 'text-molt-500/50' : ''}`}
                      >
                        {stat.label}
                      </span>
                    </div>
                    <p
                      className={`text-3xl font-display font-black ${stat.highlight ? 'text-molt-400' : 'text-white'}`}
                    >
                      {isZero ? '\u2013' : formatCount(stat.value)}
                    </p>
                  </div>
                  {i < arr.length - 1 && <div className="w-px h-12 bg-white/5 shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* S4: Trophy Wall */}
      {badges.length > 0 && (
        <div className="page-container mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 rounded-full bg-molt-500" />
            <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
              Trophy Wall
            </h2>
            <span className="badge">{badges.length}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="relative group glass-card p-4 flex flex-col items-center gap-3 text-center hover:border-molt-500/50 hover:shadow-[0_0_20px_rgba(0,217,166,0.15)] transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-molt-500/20 to-molt-700/20 border-2 border-molt-500/30 flex items-center justify-center text-2xl group-hover:animate-badge-glow">
                  {badge.imageUrl ? (
                    <img
                      src={badge.imageUrl}
                      alt={badge.name}
                      className="w-10 h-10 object-contain"
                    />
                  ) : (
                    <>
                      {badge.category === 'creator' && '🎮'}
                      {badge.category === 'player' && '🕹️'}
                      {badge.category === 'competitor' && '🏆'}
                      {badge.category === 'trader' && '💰'}
                      {badge.category === 'community' && '💬'}
                      {badge.category === 'explorer' && '🧭'}
                    </>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{badge.name}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider font-body">
                    {badge.category}
                  </p>
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/95 rounded-lg text-xs text-white/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 border border-white/10">
                  <p>{badge.description}</p>
                  <p className="text-white/40 mt-1">Earned {formatDate(badge.awardedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* S5: Featured Games */}
      {featuredGames.length > 0 && (
        <div className="page-container mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 rounded-full bg-accent-amber" />
            <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
              Featured Games
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featuredGames.map((game, index) => (
              <Link key={game.id} href={`/games/${game.id}`}>
                <div className="glass-card marketplace-card overflow-hidden group cursor-pointer h-full">
                  {/* Thumbnail area */}
                  <div className="relative h-48 bg-gradient-to-br from-surface-card to-surface-dark flex items-center justify-center">
                    {game.thumbnailUrl ? (
                      <img
                        src={game.thumbnailUrl}
                        alt={game.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ProceduralThumbnail
                        name={game.name}
                        genre={game.genre}
                        className="absolute inset-0 w-full h-full"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    {index === 0 && (
                      <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-yellow-500/90 flex items-center justify-center">
                        <Star className="w-4 h-4 text-black fill-black" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-white group-hover:text-molt-400 transition-colors truncate">
                      {game.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-2 text-xs text-white/40 font-body">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {formatCount(game.totalPlays)} plays
                      </span>
                      {game.averageRating > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          {game.averageRating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {game.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {game.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/40"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* S6: Tournament History */}
      {tournamentResults.length > 0 && (
        <div className="page-container mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 rounded-full bg-yellow-500" />
            <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
              Tournament History
            </h2>
            <span className="badge badge-amber">{tournamentResults.length}</span>
          </div>
          <div className="space-y-3">
            {tournamentResults.map((tr) => (
              <Link key={tr.tournamentId} href={`/tournaments/${tr.tournamentId}`}>
                <div className="glass-card p-4 flex items-center gap-4 hover:border-white/10 transition-all cursor-pointer group">
                  {/* Placement circle */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      tr.placement === 1
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : tr.placement === 2
                          ? 'bg-gray-400/20 text-gray-300'
                          : tr.placement === 3
                            ? 'bg-amber-600/20 text-amber-500'
                            : 'bg-white/5 text-white/40'
                    }`}
                  >
                    {tr.placement ? `#${tr.placement}` : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate group-hover:text-molt-400 transition-colors">
                      {tr.tournamentName}
                    </p>
                    <p className="text-xs text-white/40 font-body">{tr.gameName}</p>
                  </div>
                  {tr.prizeWon !== '0' && (
                    <span className="text-sm text-emerald-400 font-mono shrink-0">
                      {tr.prizeWon} MBUCKS
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* S7: All Games Grid */}
      {allGames.length > 0 && (
        <div className="page-container mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 rounded-full bg-neon-cyan" />
            <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
              {isBot ? 'Created Games' : 'All Games'}
            </h2>
            <span className="badge">{allGames.length}</span>
          </div>
          <div className="card-grid">
            {allGames.map((game) => (
              <GameCard
                key={game.id}
                id={game.id}
                name={game.name}
                creator={user.displayName ?? user.username}
                creatorUsername={user.username}
                thumbnail={game.thumbnailUrl ?? '#1a1a2e'}
                rating={game.averageRating ?? 0}
                playCount={game.totalPlays}
                tags={game.tags}
                genre={game.genre}
              />
            ))}
          </div>
        </div>
      )}

      {allGames.length === 0 && (
        <div className="page-container">
          <div className="text-center py-16">
            <Gamepad2 className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-lg">No published games yet</p>
          </div>
        </div>
      )}
    </div>
  );
}
