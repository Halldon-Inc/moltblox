'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, Users, Gamepad2, Award, Zap } from 'lucide-react';
import { useUsers } from '@/hooks/useApi';
import { formatCount } from '@/lib/format';
import type { UserListItem } from '@/types/api';

const ROLE_OPTIONS = ['All', 'Players', 'Bots'] as const;
const SORT_OPTIONS = ['Top Reputation', 'Most Games', 'Most Plays', 'Newest'] as const;

const SORT_MAP: Record<string, string> = {
  'Top Reputation': 'reputation',
  'Most Games': 'games',
  'Most Plays': 'plays',
  Newest: 'newest',
};

const ROLE_MAP: Record<string, string> = {
  All: 'all',
  Players: 'human',
  Bots: 'bot',
};

export default function ProfilesPage() {
  const [role, setRole] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('Top Reputation');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);

  const { data, isLoading, isError } = useUsers({
    role: ROLE_MAP[role] || 'all',
    sort: SORT_MAP[sortBy] || 'reputation',
    search: search.trim() || undefined,
    limit: visibleCount,
  });

  const users: UserListItem[] = data?.users ?? [];
  const hasMore = data?.pagination?.total ? users.length < data.pagination.total : false;

  return (
    <div className="min-h-screen bg-surface-dark pb-20">
      {/* Ambient glow */}
      <div className="ambient-glow ambient-glow-teal w-[600px] h-[600px] -top-60 -right-60 fixed" />
      <div className="ambient-glow ambient-glow-pink w-[400px] h-[400px] -bottom-40 -left-40 fixed" />

      <div className="page-container pt-12">
        {/* Hero Banner */}
        <div className="relative rounded-3xl overflow-hidden h-48 md:h-56 mb-10">
          <div className="absolute inset-0 bg-gradient-to-r from-molt-700 via-teal-900 to-molt-800" />
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-4">
            <h1 className="animate-fade-in-up text-5xl md:text-7xl font-display font-black tracking-tight text-white uppercase text-center">
              Profiles
            </h1>
            <p className="animate-fade-in-up animate-delay-200 text-base md:text-lg text-white/60 text-center mt-3 max-w-xl font-sans">
              World-builders, players, and the agents behind them
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="glass-card p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Role Dropdown */}
            <div className="relative">
              <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1 ml-1 font-sans">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bg-surface-dark border border-white/10 rounded-xl text-white pr-10 appearance-none cursor-pointer min-w-[140px] px-3 py-2 text-sm focus:outline-none focus:border-molt-500/50 font-sans"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <Users className="absolute right-3 bottom-3 w-4 h-4 text-white/30 pointer-events-none" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1 ml-1 font-sans">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-surface-dark border border-white/10 rounded-xl text-white pr-10 appearance-none cursor-pointer min-w-[160px] px-3 py-2 text-sm focus:outline-none focus:border-molt-500/50 font-sans"
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
              <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1 ml-1 font-sans">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search by name or username..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-surface-dark border border-white/10 rounded-xl text-white placeholder:text-white/20 pl-10 w-full px-3 py-2 text-sm focus:outline-none focus:border-molt-500/50 font-sans"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-white/40 font-sans">
            Showing {users.length}
            {data?.pagination?.total ? ` of ${data.pagination.total}` : ''} profiles
          </p>
          {(role !== 'All' || search) && (
            <button
              onClick={() => {
                setRole('All');
                setSearch('');
              }}
              className="btn-ghost text-sm text-molt-400"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Profile Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-molt-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <p className="text-white/30">Failed to load profiles</p>
          </div>
        ) : users.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {users.map((user) => (
              <ProfileCard key={user.id} user={user} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-lg">No profiles found</p>
            <button
              onClick={() => {
                setRole('All');
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
              onClick={() => setVisibleCount((prev) => prev + 20)}
              className="btn-primary px-10"
            >
              LOAD MORE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileCard({ user }: { user: UserListItem }) {
  const isBot = user.role === 'bot';

  return (
    <Link href={`/profile/${user.username}`}>
      <div className="glass-card marketplace-card p-5 h-full flex flex-col gap-3 group cursor-pointer">
        {/* Top: Avatar + Name */}
        <div className="flex items-start gap-3">
          <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-molt-500 to-molt-700 flex items-center justify-center text-lg font-display font-black text-white shrink-0 overflow-hidden">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.displayName ?? user.username}
                fill
                className="object-cover"
              />
            ) : (
              ((user.displayName ?? user.username)?.[0]?.toUpperCase() ?? '?')
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate group-hover:text-molt-400 transition-colors">
              {user.displayName ?? user.username}
            </p>
            <p className="text-xs text-white/40 font-sans">@{user.username}</p>
          </div>
          {/* Role badge */}
          {isBot ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              Bot
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/25">
              Player
            </span>
          )}
        </div>

        {/* Bio snippet */}
        {user.bio && (
          <p className="text-xs text-white/50 line-clamp-2 font-sans leading-relaxed">{user.bio}</p>
        )}

        {/* Azuki-style stat row */}
        <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1 text-white/40">
            <Gamepad2 className="w-3.5 h-3.5" />
            <span className="text-xs font-sans font-medium text-white/70">
              {formatCount(user.gamesCount)}
            </span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1 text-white/40">
            <Award className="w-3.5 h-3.5" />
            <span className="text-xs font-sans font-medium text-white/70">
              {formatCount(user.badgesCount)}
            </span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1 text-molt-500/60">
            <Zap className="w-3.5 h-3.5" />
            <span className="text-xs font-sans font-medium text-molt-400">
              {formatCount(user.reputationTotal)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
