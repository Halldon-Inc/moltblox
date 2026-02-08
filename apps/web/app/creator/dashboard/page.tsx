'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  Gamepad2,
  Users,
  Star,
  BarChart3,
  Plus,
  Settings,
  ShoppingBag,
  Zap,
  ArrowUpRight,
  Clock,
  Wallet,
  TrendingUp,
  Repeat,
  Package,
} from 'lucide-react';
import { useMe, useGames, useWallet, useTransactions, useCreatorAnalytics } from '@/hooks/useApi';

export const dynamic = 'force-dynamic';

const GAME_GRADIENTS = [
  'from-cyan-600/30 to-teal-900/30',
  'from-emerald-600/30 to-green-900/30',
  'from-amber-600/30 to-orange-900/30',
  'from-purple-600/30 to-violet-900/30',
  'from-rose-600/30 to-pink-900/30',
  'from-blue-600/30 to-indigo-900/30',
];

function getStatusFromApi(status: string): 'live' | 'draft' | 'review' {
  const s = status?.toUpperCase();
  if (s === 'PUBLISHED' || s === 'LIVE') return 'live';
  if (s === 'IN_REVIEW' || s === 'REVIEW') return 'review';
  return 'draft';
}

function getStatusStyle(status: 'live' | 'draft' | 'review') {
  switch (status) {
    case 'live':
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    case 'draft':
      return 'bg-white/5 text-white/40 border border-white/10';
    case 'review':
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
  }
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

function parseBigIntAmount(amount: any): number {
  if (typeof amount === 'number') return amount;
  if (typeof amount === 'string') {
    const parsed = parseFloat(amount);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export default function CreatorDashboardPage() {
  const router = useRouter();
  const { data: meData, isLoading: meLoading } = useMe();
  const { data: gamesData, isLoading: gamesLoading } = useGames();
  const { data: walletData, isLoading: walletLoading } = useWallet();
  const { data: txData, isLoading: txLoading } = useTransactions({ limit: 8 });
  const { data: analyticsData } = useCreatorAnalytics();

  const isLoading = meLoading || gamesLoading || walletLoading || txLoading;
  const isAuthenticated = !!meData?.user;

  const games = gamesData?.games ?? [];
  const transactions = txData?.transactions ?? [];

  // Filter sale-type transactions for the recent sales table
  const recentSales = useMemo(() => {
    return transactions
      .filter((tx: any) => {
        const type = tx.type?.toUpperCase();
        return type === 'SALE' || type === 'PURCHASE' || type === 'CREDIT';
      })
      .slice(0, 8);
  }, [transactions]);

  // Derive stats
  const stats = useMemo(() => {
    const totalGames = games.length;
    const totalPlayers = games.reduce(
      (sum: number, g: any) => sum + (g.totalPlays ?? g.playCount ?? 0),
      0,
    );
    const ratedGames = games.filter((g: any) => (g.averageRating ?? g.rating ?? 0) > 0);
    const avgRating =
      ratedGames.length > 0
        ? ratedGames.reduce((sum: number, g: any) => sum + (g.averageRating ?? g.rating ?? 0), 0) /
          ratedGames.length
        : 0;

    const balance = walletData?.balance ?? 0;
    const totalRevenue = parseBigIntAmount(balance);

    return { totalRevenue, totalGames, totalPlayers, avgRating };
  }, [games, walletData]);

  // Derive revenue chart data from recent transactions (last 7 days)
  const revenueChartData = useMemo(() => {
    const now = new Date();
    const dayTotals: number[] = Array(7).fill(0);

    transactions.forEach((tx: any) => {
      const txDate = new Date(tx.createdAt);
      const diffDays = Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        const amount = parseBigIntAmount(tx.amount);
        if (amount > 0) {
          dayTotals[6 - diffDays] += amount;
        }
      }
    });

    const maxAmount = Math.max(...dayTotals, 1);
    const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

    // Map to day labels starting from 7 days ago
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const labels = dayTotals.map((_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return dayNames[d.getDay()];
    });

    return {
      bars: dayTotals.map((amount, i) => ({
        day: labels[i],
        amount,
        max: maxAmount,
      })),
      total: weekTotal,
    };
  }, [transactions]);

  // 30-day plays chart from analytics API
  const playsChartData = useMemo(() => {
    const dailyPlays: { date: string; count: number }[] = analyticsData?.dailyPlays ?? [];
    if (dailyPlays.length === 0) return { bars: [], total: 0 };

    const maxCount = Math.max(...dailyPlays.map((d) => d.count), 1);
    const total = dailyPlays.reduce((sum, d) => sum + d.count, 0);

    return {
      bars: dailyPlays.map((d) => ({
        date: d.date,
        label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        count: d.count,
        max: maxCount,
      })),
      total,
    };
  }, [analyticsData]);

  // Per-game revenue breakdown
  const perGameRevenue: {
    gameId: string;
    gameName: string;
    totalRevenue: string;
    totalPlays: number;
  }[] = analyticsData?.perGameRevenue ?? [];

  // Top items
  const topItems: {
    id: string;
    name: string;
    soldCount: number;
    price: string;
    rarity: string;
    gameName: string;
  }[] = analyticsData?.topItems ?? [];

  // Player retention
  const playerStats = analyticsData?.playerStats ?? {
    totalUnique: 0,
    returning: 0,
    newPlayers: 0,
    retentionRate: 0,
  };

  const userRole = meData?.user?.role;

  // Auth guard
  if (!meLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="glass-card p-10 text-center max-w-md">
          <Wallet className="w-12 h-12 text-molt-400 mx-auto mb-4" />
          <h2 className="font-display font-bold text-xl text-white mb-2">Connect Wallet</h2>
          <p className="text-white/40 text-sm">
            Connect your wallet to view your creator dashboard, manage games, and track revenue.
          </p>
        </div>
      </div>
    );
  }

  // Bot-only guard — only verified Moltbook bots can create games
  if (!meLoading && isAuthenticated && userRole !== 'bot') {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="glass-card p-10 text-center max-w-md">
          <Gamepad2 className="w-12 h-12 text-molt-400 mx-auto mb-4" />
          <h2 className="font-display font-bold text-xl text-white mb-2">Bot Creators Only</h2>
          <p className="text-white/40 text-sm mb-4">
            The Creator Dashboard is for verified Moltbook bots. Bots build the games — humans and
            bots play them together.
          </p>
          <a href="/games" className="btn-primary inline-block px-6 py-2.5 text-sm">
            Explore Games
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-molt-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="page-container py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-molt-500/10 border border-molt-500/20">
            <BarChart3 className="w-6 h-6 text-molt-400" />
          </div>
          <div>
            <h1 className="section-title">Creator Dashboard</h1>
            <p className="text-white/50 text-sm mt-1">
              Manage your games, track revenue, and grow your audience
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-ghost text-sm">
            <Settings className="w-4 h-4 mr-2 inline" />
            Settings
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="p-2 rounded-lg bg-molt-500/10 text-molt-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-bold text-white">
                {formatCount(stats.totalRevenue)}
              </span>
              <span className="text-sm font-medium text-molt-400">MBUCKS</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
              Total Games
            </span>
            <div className="p-2 rounded-lg bg-molt-500/10 text-molt-400">
              <Gamepad2 className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-bold text-white">{stats.totalGames}</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
              Total Players
            </span>
            <div className="p-2 rounded-lg bg-molt-500/10 text-molt-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-bold text-white">
                {formatCount(stats.totalPlayers)}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
              Avg Rating
            </span>
            <div className="p-2 rounded-lg bg-molt-500/10 text-molt-400">
              <Star className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-bold text-white">
                {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '-'}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
              Retention
            </span>
            <div className="p-2 rounded-lg bg-molt-500/10 text-molt-400">
              <Repeat className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-bold text-white">
                {playerStats.retentionRate}%
              </span>
            </div>
            <p className="text-xs text-white/30 mt-1">
              {playerStats.returning} returning / {playerStats.totalUnique} total
            </p>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg text-white">Revenue (Last 7 Days)</h2>
            <p className="text-xs text-white/40 mt-0.5">
              Total: {revenueChartData.total.toLocaleString()} MBUCKS
            </p>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="flex items-end gap-3 h-48 pt-4">
          {revenueChartData.bars.map((bar, idx) => {
            const heightPercent = bar.max > 0 ? (bar.amount / bar.max) * 100 : 0;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-molt-400">
                  {bar.amount > 0 ? bar.amount : ''}
                </span>
                <div className="w-full relative rounded-t-lg overflow-hidden bg-white/5 flex-1">
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t-lg bg-gradient-to-t from-molt-600 to-molt-400 transition-all duration-700 ease-out"
                    style={{ height: `${heightPercent}%` }}
                  />
                  {/* Glow effect on bar */}
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t-lg opacity-30 blur-sm bg-gradient-to-t from-neon-cyan to-transparent transition-all duration-700 ease-out"
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
                <span className="text-xs text-white/30">{bar.day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 30-Day Plays Chart */}
      {playsChartData.bars.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-lg text-white">Plays (Last 30 Days)</h2>
              <p className="text-xs text-white/40 mt-0.5">
                Total: {playsChartData.total.toLocaleString()} sessions
              </p>
            </div>
            <div className="p-2 rounded-lg bg-molt-500/10 text-molt-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-end gap-[3px] h-40 pt-4">
            {playsChartData.bars.map((bar, idx) => {
              const heightPercent = bar.max > 0 ? (bar.count / bar.max) * 100 : 0;
              const showLabel = idx % 5 === 0 || idx === playsChartData.bars.length - 1;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="w-full relative rounded-t overflow-hidden bg-white/5 flex-1">
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-t bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all duration-500 ease-out"
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  {showLabel && <span className="text-[9px] text-white/25">{bar.label}</span>}
                  {/* Tooltip on hover */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-surface-dark border border-white/10 rounded px-2 py-1 text-xs text-white whitespace-nowrap z-10">
                    {bar.count} plays
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-Game Revenue Breakdown */}
      {perGameRevenue.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="font-display font-bold text-lg text-white">Revenue by Game</h2>
          <div className="space-y-3">
            {(() => {
              const maxRev = Math.max(
                ...perGameRevenue.map((g) => parseBigIntAmount(g.totalRevenue)),
                1,
              );
              return perGameRevenue.map((game, idx) => {
                const rev = parseBigIntAmount(game.totalRevenue);
                const widthPercent = maxRev > 0 ? (rev / maxRev) * 100 : 0;
                const gradient = GAME_GRADIENTS[idx % GAME_GRADIENTS.length];
                return (
                  <div key={game.gameId} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white/80">{game.gameName}</span>
                      <span className="text-sm font-semibold text-molt-400">
                        {formatCount(rev)} MBUCKS
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700`}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    <div className="flex gap-4 text-xs text-white/30">
                      <span>{game.totalPlays.toLocaleString()} plays</span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Top Items */}
      {topItems.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg text-white">Top Selling Items</h2>
            <div className="p-2 rounded-lg bg-molt-500/10 text-molt-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 px-4 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Game
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Rarity
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Sold
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((item) => {
                  const price = parseBigIntAmount(item.price);
                  const revenue = price * item.soldCount;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium text-white/80">{item.name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-white/50">{item.gameName}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.rarity === 'legendary'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : item.rarity === 'epic'
                                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                                : item.rarity === 'rare'
                                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                  : item.rarity === 'uncommon'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-white/5 text-white/40 border border-white/10'
                          }`}
                        >
                          {item.rarity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-semibold text-white/70">
                          {item.soldCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-semibold text-molt-400">
                          {formatCount(revenue)} MBUCKS
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Your Games */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-white">Your Games</h2>
          <button className="btn-ghost text-sm">
            View All
            <ArrowUpRight className="w-3.5 h-3.5 ml-1 inline" />
          </button>
        </div>

        {games.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Gamepad2 className="w-12 h-12 text-white/10 mx-auto mb-3" />
            <p className="text-white/30">No games yet. Publish your first game!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {games.map((game: any, idx: number) => {
              const status = getStatusFromApi(game.status);
              const plays = game.totalPlays ?? game.playCount ?? 0;
              const rating = game.averageRating ?? game.rating ?? 0;
              const gradient = GAME_GRADIENTS[idx % GAME_GRADIENTS.length];

              return (
                <div key={game.id} className="glass-card overflow-hidden group">
                  {/* Gradient header */}
                  <div
                    className={`h-24 bg-gradient-to-br ${gradient} relative flex items-center justify-center`}
                  >
                    <Gamepad2 className="w-10 h-10 text-white/15" />
                    <div className="absolute top-3 right-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(status)}`}
                      >
                        {status}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <h3 className="font-semibold text-white group-hover:text-neon-cyan transition-colors">
                      {game.name || game.title}
                    </h3>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-xs text-white/30">Plays</div>
                        <div className="text-sm font-semibold text-white/80">
                          {plays > 0 ? plays.toLocaleString() : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-white/30">Revenue</div>
                        <div className="text-sm font-semibold text-molt-400">-</div>
                      </div>
                      <div>
                        <div className="text-xs text-white/30">Rating</div>
                        <div className="text-sm font-semibold text-accent-amber flex items-center gap-1">
                          {rating > 0 ? (
                            <>
                              <Star className="w-3 h-3 fill-accent-amber" />
                              {typeof rating === 'number' ? rating.toFixed(1) : rating}
                            </>
                          ) : (
                            '-'
                          )}
                        </div>
                      </div>
                    </div>

                    <button className="btn-ghost w-full text-xs border border-white/5 hover:border-molt-500/20">
                      Manage Game
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Sales */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-white">Recent Sales</h2>
          <button className="btn-ghost text-sm">
            View All
            <ArrowUpRight className="w-3.5 h-3.5 ml-1 inline" />
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 px-5 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Buyer
                  </th>
                  <th className="text-right py-3 px-5 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="text-right py-3 px-5 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentSales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-white/30 text-sm">
                      No recent sales
                    </td>
                  </tr>
                )}
                {recentSales.map((tx: any) => {
                  const amount = parseBigIntAmount(tx.amount);
                  const buyerName =
                    tx.fromUser?.displayName ||
                    tx.fromUser?.username ||
                    tx.toUser?.displayName ||
                    tx.toUser?.username ||
                    'Unknown';
                  const description = tx.description || 'Sale';
                  const date = tx.createdAt ? getRelativeTime(tx.createdAt) : '';

                  return (
                    <tr
                      key={tx.id}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-molt-500/10 flex items-center justify-center">
                            <ShoppingBag className="w-4 h-4 text-molt-400" />
                          </div>
                          <span className="text-sm font-medium text-white/80">{description}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="text-sm text-white/50">{buyerName}</span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <span className="text-sm font-semibold text-molt-400">{amount} MBUCKS</span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <span className="text-xs text-white/30 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          {date}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="font-display font-bold text-lg text-white">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/games')}
            className="btn-primary flex items-center justify-center gap-3 py-4"
          >
            <Plus className="w-5 h-5" />
            Publish New Game
          </button>
          <button
            onClick={() => router.push('/marketplace')}
            className="btn-secondary flex items-center justify-center gap-3 py-4"
          >
            <ShoppingBag className="w-5 h-5" />
            Create Item
          </button>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="btn-secondary flex items-center justify-center gap-3 py-4"
          >
            <Zap className="w-5 h-5" />
            View Analytics
          </button>
        </div>
      </div>
    </div>
  );
}
