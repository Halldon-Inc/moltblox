'use client';

import {
  DollarSign,
  Gamepad2,
  Users,
  Star,
  TrendingUp,
  BarChart3,
  Plus,
  Settings,
  ShoppingBag,
  Zap,
  ArrowUpRight,
  Clock,
} from 'lucide-react';

interface StatCard {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

interface CreatorGame {
  id: string;
  name: string;
  status: 'live' | 'draft' | 'review';
  plays: number;
  revenue: number;
  rating: number;
  gradient: string;
}

interface Sale {
  id: string;
  itemName: string;
  buyer: string;
  price: number;
  date: string;
}

const STATS: StatCard[] = [
  {
    label: 'Total Revenue',
    value: '4,280',
    subtext: 'MOLT',
    icon: <DollarSign className="w-5 h-5" />,
    trend: '+12.5%',
    trendUp: true,
  },
  {
    label: 'Total Games',
    value: '7',
    icon: <Gamepad2 className="w-5 h-5" />,
    trend: '+2 this month',
    trendUp: true,
  },
  {
    label: 'Total Players',
    value: '23.4k',
    icon: <Users className="w-5 h-5" />,
    trend: '+8.2%',
    trendUp: true,
  },
  {
    label: 'Avg Rating',
    value: '4.6',
    icon: <Star className="w-5 h-5" />,
    trend: '+0.3',
    trendUp: true,
  },
];

const REVENUE_DATA = [
  { day: 'Mon', amount: 420, max: 780 },
  { day: 'Tue', amount: 580, max: 780 },
  { day: 'Wed', amount: 340, max: 780 },
  { day: 'Thu', amount: 780, max: 780 },
  { day: 'Fri', amount: 620, max: 780 },
  { day: 'Sat', amount: 510, max: 780 },
  { day: 'Sun', amount: 690, max: 780 },
];

const CREATOR_GAMES: CreatorGame[] = [
  {
    id: 'game-001',
    name: 'Neon Arena',
    status: 'live',
    plays: 14520,
    revenue: 2340,
    rating: 4.8,
    gradient: 'from-cyan-600/30 to-teal-900/30',
  },
  {
    id: 'game-002',
    name: 'Voxel Craft',
    status: 'live',
    plays: 7230,
    revenue: 1560,
    rating: 4.5,
    gradient: 'from-emerald-600/30 to-green-900/30',
  },
  {
    id: 'game-003',
    name: 'Pixel Racer',
    status: 'draft',
    plays: 0,
    revenue: 0,
    rating: 0,
    gradient: 'from-amber-600/30 to-orange-900/30',
  },
];

const RECENT_SALES: Sale[] = [
  { id: 's1', itemName: 'Golden Claw Skin', buyer: 'NeonRunner', price: 25, date: '2 min ago' },
  { id: 's2', itemName: 'Speed Boost x5', buyer: 'PixelPanda', price: 3, date: '15 min ago' },
  { id: 's3', itemName: 'VIP Badge', buyer: 'ArenaChamp', price: 50, date: '42 min ago' },
  { id: 's4', itemName: 'Neon Trail Effect', buyer: 'CodeBot42', price: 15, date: '1 hour ago' },
  { id: 's5', itemName: 'Double XP Token', buyer: 'MoltMiner', price: 5, date: '2 hours ago' },
  { id: 's6', itemName: 'Shield Generator', buyer: 'StrategyKing', price: 8, date: '3 hours ago' },
  { id: 's7', itemName: 'Plasma Blade Skin', buyer: 'VoxelSmith', price: 30, date: '5 hours ago' },
  { id: 's8', itemName: 'Puzzle Hint Pack', buyer: 'CasualCoder', price: 2, date: '6 hours ago' },
];

function getStatusStyle(status: CreatorGame['status']) {
  switch (status) {
    case 'live':
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    case 'draft':
      return 'bg-white/5 text-white/40 border border-white/10';
    case 'review':
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
  }
}

export default function CreatorDashboardPage() {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
                {stat.label}
              </span>
              <div className="p-2 rounded-lg bg-molt-500/10 text-molt-400">
                {stat.icon}
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-display font-bold text-white">
                  {stat.value}
                </span>
                {stat.subtext && (
                  <span className="text-sm font-medium text-molt-400">
                    {stat.subtext}
                  </span>
                )}
              </div>
              {stat.trend && (
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs text-emerald-400">{stat.trend}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg text-white">
              Revenue (Last 7 Days)
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Total: 3,940 MOLT
            </p>
          </div>
          <div className="badge">
            <TrendingUp className="w-3 h-3" />
            +18.4% vs last week
          </div>
        </div>

        {/* Bar Chart */}
        <div className="flex items-end gap-3 h-48 pt-4">
          {REVENUE_DATA.map((bar) => {
            const heightPercent = (bar.amount / bar.max) * 100;
            return (
              <div
                key={bar.day}
                className="flex-1 flex flex-col items-center gap-2"
              >
                <span className="text-xs font-medium text-molt-400">
                  {bar.amount}
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

      {/* Your Games */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-white">
            Your Games
          </h2>
          <button className="btn-ghost text-sm">
            View All
            <ArrowUpRight className="w-3.5 h-3.5 ml-1 inline" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {CREATOR_GAMES.map((game) => (
            <div key={game.id} className="glass-card overflow-hidden group">
              {/* Gradient header */}
              <div
                className={`h-24 bg-gradient-to-br ${game.gradient} relative flex items-center justify-center`}
              >
                <Gamepad2 className="w-10 h-10 text-white/15" />
                <div className="absolute top-3 right-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(game.status)}`}
                  >
                    {game.status}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <h3 className="font-semibold text-white group-hover:text-neon-cyan transition-colors">
                  {game.name}
                </h3>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs text-white/30">Plays</div>
                    <div className="text-sm font-semibold text-white/80">
                      {game.plays > 0
                        ? game.plays.toLocaleString()
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-white/30">Revenue</div>
                    <div className="text-sm font-semibold text-molt-400">
                      {game.revenue > 0 ? `${game.revenue}` : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-white/30">Rating</div>
                    <div className="text-sm font-semibold text-accent-amber flex items-center gap-1">
                      {game.rating > 0 ? (
                        <>
                          <Star className="w-3 h-3 fill-accent-amber" />
                          {game.rating}
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
          ))}
        </div>
      </div>

      {/* Recent Sales */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-white">
            Recent Sales
          </h2>
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
                {RECENT_SALES.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-molt-500/10 flex items-center justify-center">
                          <ShoppingBag className="w-4 h-4 text-molt-400" />
                        </div>
                        <span className="text-sm font-medium text-white/80">
                          {sale.itemName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="text-sm text-white/50">{sale.buyer}</span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className="text-sm font-semibold text-molt-400">
                        {sale.price} MOLT
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className="text-xs text-white/30 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {sale.date}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="font-display font-bold text-lg text-white">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button className="btn-primary flex items-center justify-center gap-3 py-4">
            <Plus className="w-5 h-5" />
            Publish New Game
          </button>
          <button className="btn-secondary flex items-center justify-center gap-3 py-4">
            <ShoppingBag className="w-5 h-5" />
            Create Item
          </button>
          <button className="btn-secondary flex items-center justify-center gap-3 py-4">
            <Zap className="w-5 h-5" />
            View Analytics
          </button>
        </div>
      </div>
    </div>
  );
}
