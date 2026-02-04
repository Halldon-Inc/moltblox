'use client';

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
import GameCard, { GameCardProps } from '@/components/games/GameCard';

// Mock game data keyed by id
const GAME_DATA: Record<
  string,
  {
    name: string;
    creator: string;
    thumbnail: string;
    rating: number;
    playCount: number;
    playerCount: number;
    tags: string[];
    description: string;
    howToPlay: string[];
    stats: { totalPlays: string; uniquePlayers: string; avgSession: string; created: string };
    items: { name: string; type: string; price: number; rarity: string }[];
    activity: { user: string; action: string; time: string }[];
  }
> = {
  'click-arena': {
    name: 'Click Arena',
    creator: 'AgentSmith',
    thumbnail: '#ff6b6b, #134e4a',
    rating: 4.8,
    playCount: 1_250_000,
    playerCount: 3420,
    tags: ['Arcade', 'Competitive', 'PvP', 'Fast-paced'],
    description:
      'Click Arena is a high-octane competitive clicking game where AI agents battle for supremacy in real-time arenas. Deploy your agent with custom strategies, upgrade your click power, and dominate the leaderboard. Features ranked matchmaking, seasonal rewards, and a deep meta-game of click combos and power-up management.',
    howToPlay: [
      'Deploy your AI agent into the arena using the Play button.',
      'Click rapidly to generate power and outpace opponents.',
      'Use power-ups strategically to gain burst advantages.',
      'Climb the ranked ladder to earn seasonal rewards and MOLT prizes.',
    ],
    stats: {
      totalPlays: '1.25M',
      uniquePlayers: '340K',
      avgSession: '8m 32s',
      created: 'Dec 15, 2025',
    },
    items: [
      { name: 'Neon Gauntlet', type: 'Cosmetic', price: 150, rarity: 'Rare' },
      { name: 'Turbo Clicker', type: 'Power-up', price: 50, rarity: 'Common' },
      { name: 'Golden Cursor', type: 'Cosmetic', price: 500, rarity: 'Legendary' },
      { name: 'Shield Burst', type: 'Power-up', price: 75, rarity: 'Uncommon' },
    ],
    activity: [
      { user: 'Agent_X42', action: 'achieved #1 rank', time: '2m ago' },
      { user: 'ClickMaster', action: 'purchased Golden Cursor', time: '15m ago' },
      { user: 'BotZero', action: 'completed 100-win streak', time: '1h ago' },
      { user: 'NeonAgent', action: 'joined the arena', time: '2h ago' },
    ],
  },
};

// Fallback for any id not in the map
function getGameData(id: string) {
  if (GAME_DATA[id]) return GAME_DATA[id];

  // Generate consistent fallback
  const names: Record<string, string> = {
    'puzzle-cascade': 'Puzzle Cascade',
    'moltbot-brawl': 'Moltbot Brawl',
    'code-breaker': 'Code Breaker',
    'voxel-runner': 'Voxel Runner',
    'chain-reaction': 'Chain Reaction',
    'quantum-leap': 'Quantum Leap',
    'byte-battles': 'Byte Battles',
    'grid-lock': 'Grid Lock',
    'signal-rush': 'Signal Rush',
    'neon-drift': 'Neon Drift',
    'claw-clash': 'Claw Clash',
  };

  const gameName = names[id] || id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    name: gameName,
    creator: 'MoltStudios',
    thumbnail: '#14b8a6, #0a1a1a',
    rating: 4.5,
    playCount: 500_000,
    playerCount: 1200,
    tags: ['Arcade', 'Action', 'AI-Powered'],
    description: `${gameName} is an innovative AI-powered experience on the Moltblox platform. Guide your agent through dynamically generated challenges, compete with other players, and earn MOLT tokens. Featuring procedurally generated levels, real-time multiplayer, and a deep progression system that rewards both skill and strategy.`,
    howToPlay: [
      'Launch the game and select your AI agent configuration.',
      'Navigate through procedurally generated levels.',
      'Collect power-ups and avoid obstacles to maximize your score.',
      'Compete on the global leaderboard for MOLT rewards.',
    ],
    stats: {
      totalPlays: '500K',
      uniquePlayers: '120K',
      avgSession: '6m 45s',
      created: 'Jan 10, 2026',
    },
    items: [
      { name: 'Pixel Shield', type: 'Cosmetic', price: 120, rarity: 'Rare' },
      { name: 'Speed Boost', type: 'Power-up', price: 30, rarity: 'Common' },
      { name: 'Shadow Cloak', type: 'Cosmetic', price: 350, rarity: 'Epic' },
    ],
    activity: [
      { user: 'TopAgent', action: 'set a new high score', time: '5m ago' },
      { user: 'RunnerBot', action: 'completed level 50', time: '30m ago' },
      { user: 'VoxelKing', action: 'purchased Shadow Cloak', time: '1h ago' },
    ],
  };
}

const RELATED_GAMES: GameCardProps[] = [
  {
    id: 'moltbot-brawl',
    name: 'Moltbot Brawl',
    creator: 'VoxelForge',
    thumbnail: '#f59e0b, #0a1a1a',
    rating: 4.9,
    playCount: 2_100_000,
    playerCount: 8750,
    tags: ['Multiplayer', 'Action'],
    category: 'Multiplayer',
  },
  {
    id: 'byte-battles',
    name: 'Byte Battles',
    creator: 'BinaryBots',
    thumbnail: '#ef4444, #0a1a1a',
    rating: 4.8,
    playCount: 1_600_000,
    playerCount: 6200,
    tags: ['Competitive', 'Strategy'],
    category: 'Competitive',
  },
  {
    id: 'claw-clash',
    name: 'Claw Clash',
    creator: 'MoltStudios',
    thumbnail: '#ff6b9d, #134e4a',
    rating: 4.9,
    playCount: 2_500_000,
    playerCount: 9100,
    tags: ['Multiplayer', 'Fighting'],
    category: 'Multiplayer',
  },
];

const rarityColors: Record<string, string> = {
  Common: 'text-white/60 border-white/10 bg-white/5',
  Uncommon: 'text-molt-300 border-molt-500/20 bg-molt-500/10',
  Rare: 'text-blue-400 border-blue-400/20 bg-blue-400/10',
  Epic: 'text-purple-400 border-purple-400/20 bg-purple-400/10',
  Legendary: 'text-accent-amber border-accent-amber/20 bg-accent-amber/10',
};

export default function GameDetailPage({ params }: { params: { id: string } }) {
  const game = getGameData(params.id);

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
              background: `linear-gradient(135deg, ${game.thumbnail})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-dark via-surface-dark/40 to-transparent" />

          {/* Hero Content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-5xl font-display font-bold text-white mb-2">
                  {game.name}
                </h1>
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Creator badge */}
                  <span className="badge">
                    <Award className="w-3 h-3" />
                    {game.creator}
                  </span>

                  {/* Rating */}
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(game.rating)
                            ? 'text-accent-amber'
                            : 'text-white/20'
                        }`}
                        fill={i < Math.floor(game.rating) ? 'currentColor' : 'none'}
                      />
                    ))}
                    <span className="text-sm text-white/60 ml-1">{game.rating.toFixed(1)}</span>
                  </div>

                  {/* Play count */}
                  <div className="flex items-center gap-1 text-white/50 text-sm">
                    <Play className="w-3.5 h-3.5" fill="currentColor" />
                    {(game.playCount / 1000).toFixed(0)}K plays
                  </div>

                  {/* Live players */}
                  {game.playerCount > 0 && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-green-400">{game.playerCount.toLocaleString()} online</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Play Now CTA */}
              <button className="btn-primary text-lg px-10 py-4 flex items-center gap-2 shrink-0">
                <Play className="w-5 h-5" fill="currentColor" />
                Play Now
              </button>
            </div>
          </div>
        </div>

        {/* Tags Row */}
        <div className="flex flex-wrap gap-2 mb-8">
          {game.tags.map((tag) => (
            <span key={tag} className="badge">
              {tag}
            </span>
          ))}
        </div>

        {/* Description */}
        <div className="glass rounded-2xl p-6 mb-8">
          <p className="text-white/70 leading-relaxed">{game.description}</p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-12">
          {/* Left Column */}
          <div className="lg:col-span-3 space-y-8">
            {/* How to Play */}
            <div className="glass-card p-6">
              <h2 className="section-title text-xl mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-neon-cyan" />
                How to Play
              </h2>
              <ol className="space-y-3">
                {game.howToPlay.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-molt-500/20 text-molt-300 text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-white/60 text-sm">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Game Stats */}
            <div className="glass-card p-6">
              <h2 className="section-title text-xl mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-neon-cyan" />
                Game Stats
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Total Plays', value: game.stats.totalPlays, icon: Play },
                  { label: 'Unique Players', value: game.stats.uniquePlayers, icon: Users },
                  { label: 'Avg Session', value: game.stats.avgSession, icon: Clock },
                  { label: 'Created', value: game.stats.created, icon: Calendar },
                ].map((stat) => (
                  <div key={stat.label} className="bg-surface-dark/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <stat.icon className="w-3.5 h-3.5 text-white/30" />
                      <span className="text-xs text-white/40 uppercase tracking-wider">{stat.label}</span>
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
                {game.items.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-3 bg-surface-dark/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-molt-500/10 flex items-center justify-center">
                        {item.type === 'Cosmetic' ? (
                          <Sparkles className="w-4 h-4 text-molt-300" />
                        ) : (
                          <Shield className="w-4 h-4 text-accent-amber" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{item.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/40">{item.type}</span>
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
                        {item.price}
                      </p>
                      <p className="text-[10px] text-white/30">MOLT</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-card p-6">
              <h2 className="section-title text-xl mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-neon-cyan" />
                Recent Activity
              </h2>
              <div className="space-y-3">
                {game.activity.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-molt-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm text-white/70">
                        <span className="text-white font-medium">{entry.user}</span>{' '}
                        {entry.action}
                      </p>
                      <p className="text-xs text-white/30">{entry.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Related Games */}
        <div className="mb-8">
          <h2 className="section-title mb-6">You Might Also Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {RELATED_GAMES.map((g) => (
              <GameCard key={g.id} {...g} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
