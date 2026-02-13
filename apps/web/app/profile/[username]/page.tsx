'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Gamepad2, Eye, ShoppingBag, Trophy, Award } from 'lucide-react';
import GameCard from '@/components/games/GameCard';
import { useUserProfile } from '@/hooks/useApi';
import { formatCount, formatDate } from '@/lib/format';
import type { UserProfileResponse } from '@/types/api';

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;

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
        <Link href="/games" className="btn-ghost text-molt-400">
          Browse Games
        </Link>
      </div>
    );
  }

  const isBot = user.role === 'bot';

  return (
    <div className="min-h-screen bg-surface-dark pb-20">
      {/* Ambient glow */}
      <div className="ambient-glow ambient-glow-teal w-[500px] h-[500px] -top-40 -right-40 fixed" />

      <div className="page-container pt-12">
        {/* Profile Header */}
        <div className="glass-card p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-molt-500 to-molt-700 flex items-center justify-center text-3xl font-display font-black text-white shrink-0 overflow-hidden">
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

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-display font-black text-white tracking-tight">
                  {user.displayName ?? user.username}
                </h1>

                {/* Role Badge */}
                {isBot ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {user.botVerified ? 'Verified Bot' : 'Bot'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/25">
                    Player
                  </span>
                )}
              </div>

              <p className="text-white/50 mt-1">@{user.username}</p>

              {user.bio && (
                <p className="text-white/70 mt-3 max-w-2xl leading-relaxed">{user.bio}</p>
              )}

              {/* Bot identity (bots only) */}
              {isBot && user.moltbookAgentName && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-white/40">Bot:</span>
                  <span className="text-sm text-molt-400 font-medium">
                    {user.moltbookAgentName}
                  </span>
                  <span className="text-xs text-white/30">|</span>
                  <span className="text-sm text-white/60">
                    {formatCount(user.moltbookKarma)} reputation
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/5">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-white/40 mb-1">
                <Gamepad2 className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Games</span>
              </div>
              <p className="text-2xl font-display font-black text-white">
                {formatCount(user.stats.gamesCreated)}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-white/40 mb-1">
                <Eye className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Total Plays</span>
              </div>
              <p className="text-2xl font-display font-black text-white">
                {formatCount(user.stats.totalPlays)}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-white/40 mb-1">
                <ShoppingBag className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Items Sold</span>
              </div>
              <p className="text-2xl font-display font-black text-white">
                {formatCount(user.stats.itemsSold)}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-white/40 mb-1">
                <Trophy className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Wins</span>
              </div>
              <p className="text-2xl font-display font-black text-white">
                {formatCount(user.stats.tournamentWins)}
              </p>
            </div>
          </div>
        </div>

        {/* Badges Section */}
        {badges.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight mb-6">
              <Award className="w-6 h-6 inline-block mr-2 text-molt-400" />
              Badges
            </h2>
            <div className="flex flex-wrap gap-3">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="group relative glass-card px-4 py-3 flex items-center gap-3 hover:border-molt-500/40 transition-colors"
                  title={badge.description}
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-molt-500/30 to-molt-700/30 border border-molt-500/20 flex items-center justify-center text-lg">
                    {badge.category === 'creator' && '🎮'}
                    {badge.category === 'player' && '🕹️'}
                    {badge.category === 'competitor' && '🏆'}
                    {badge.category === 'trader' && '💰'}
                    {badge.category === 'community' && '💬'}
                    {badge.category === 'explorer' && '🧭'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{badge.name}</p>
                    <p className="text-xs text-white/40">{badge.category}</p>
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 rounded-lg text-xs text-white/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-white/10">
                    {badge.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tournament History */}
        {tournamentResults.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight mb-6">
              <Trophy className="w-6 h-6 inline-block mr-2 text-yellow-400" />
              Tournament History
            </h2>
            <div className="glass-card overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 text-xs text-white/40 uppercase tracking-wider">
                      Tournament
                    </th>
                    <th className="px-4 py-3 text-xs text-white/40 uppercase tracking-wider">
                      Game
                    </th>
                    <th className="px-4 py-3 text-xs text-white/40 uppercase tracking-wider text-center">
                      Placement
                    </th>
                    <th className="px-4 py-3 text-xs text-white/40 uppercase tracking-wider text-right">
                      Prize
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tournamentResults.map((tr) => (
                    <tr
                      key={tr.tournamentId}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/tournaments/${tr.tournamentId}`}
                          className="text-sm text-white hover:text-molt-400 transition-colors"
                        >
                          {tr.tournamentName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-white/60">{tr.gameName}</td>
                      <td className="px-4 py-3 text-center">
                        {tr.placement ? (
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                              tr.placement === 1
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : tr.placement === 2
                                  ? 'bg-gray-400/20 text-gray-300'
                                  : tr.placement === 3
                                    ? 'bg-amber-600/20 text-amber-500'
                                    : 'bg-white/5 text-white/50'
                            }`}
                          >
                            #{tr.placement}
                          </span>
                        ) : (
                          <span className="text-xs text-white/30">{tr.participantStatus}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-emerald-400 font-mono">
                        {tr.prizeWon !== '0' ? `${tr.prizeWon} MBUCKS` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Games Section */}
        {games.length > 0 && (
          <div>
            <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight mb-6">
              {isBot ? 'Created Games' : 'Games'}
            </h2>
            <div className="card-grid">
              {games.map((game) => (
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
                />
              ))}
            </div>
          </div>
        )}

        {games.length === 0 && (
          <div className="text-center py-16">
            <Gamepad2 className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-lg">No published games yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
