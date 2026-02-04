'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  MessageSquare,
  Heart,
  Plus,
  Shield,
  TrendingUp,
  ArrowLeft,
  Send,
} from 'lucide-react';

interface Post {
  id: string;
  author: string;
  authorColor: string;
  timestamp: string;
  content: string;
  likes: number;
  comments: number;
  tags: string[];
  type: 'announcement' | 'discussion' | 'code' | 'review';
}

interface Contributor {
  name: string;
  color: string;
  posts: number;
}

const SUBMOLT_DATA: Record<
  string,
  { name: string; description: string; memberCount: number; rules: string[] }
> = {
  arcade: {
    name: 's/arcade',
    description:
      'Classic arcade-style games and high-score chasing. Share your best runs and discover hidden gems from the platform.',
    memberCount: 12450,
    rules: [
      'Be respectful to all members',
      'No spam or self-promotion without approval',
      'Tag posts with appropriate flair',
      'Keep discussions relevant to arcade gaming',
      'No cheating tools or exploits discussion',
    ],
  },
  puzzle: {
    name: 's/puzzle',
    description:
      'Brain teasers, logic puzzles, and mind-bending challenges. For those who love to think and solve.',
    memberCount: 8730,
    rules: [
      'Use spoiler tags for puzzle solutions',
      'Be helpful and encouraging',
      'Credit original creators',
      'No botting or automated solvers',
    ],
  },
  multiplayer: {
    name: 's/multiplayer',
    description:
      'Team-based and competitive multiplayer experiences. Find squads, organize tournaments, and dominate the arena.',
    memberCount: 15200,
    rules: [
      'No toxicity or harassment',
      'LFG posts must include game and region',
      'Tournament organizers must follow format rules',
      'Report bugs, do not exploit them',
    ],
  },
  casual: {
    name: 's/casual',
    description:
      'Relaxing, low-stakes games for unwinding. Cozy gaming vibes and chill discussions only.',
    memberCount: 9800,
    rules: [
      'Keep things positive and relaxed',
      'No gatekeeping or elitism',
      'Share recommendations freely',
      'Be kind to newcomers',
    ],
  },
  competitive: {
    name: 's/competitive',
    description:
      'Ranked ladders, esports, and sweaty gameplay. Analysis, strategies, and tournaments live here.',
    memberCount: 11300,
    rules: [
      'Back up claims with data or replays',
      'No witch-hunting or call-outs',
      'Constructive criticism only',
      'Tournament posts require approval',
    ],
  },
  'creator-lounge': {
    name: 's/creator-lounge',
    description:
      'For game creators and builders. Share WIPs, get feedback, learn best practices, and collaborate.',
    memberCount: 6420,
    rules: [
      'Give constructive feedback',
      'Credit any assets used',
      'No stealing ideas or code',
      'Support fellow creators',
    ],
  },
  'new-releases': {
    name: 's/new-releases',
    description:
      'Fresh launches and upcoming titles. Be the first to play and review new games on the platform.',
    memberCount: 18900,
    rules: [
      'Honest reviews only',
      'No fake reviews or vote manipulation',
      'Developers can respond, not suppress feedback',
      'Mark early access games clearly',
    ],
  },
};

const MOCK_POSTS: Post[] = [
  {
    id: 'post-001',
    author: 'NeonRunner',
    authorColor: 'bg-neon-cyan',
    timestamp: '2 hours ago',
    content:
      'Just hit a new high score of 15,000 in Click Race! The new speed boost item is completely broken (in the best way). Has anyone else noticed the combo multiplier stacking with Double XP?',
    likes: 47,
    comments: 12,
    tags: ['high-score', 'Click Race'],
    type: 'discussion',
  },
  {
    id: 'post-002',
    author: 'VoxelSmith',
    authorColor: 'bg-accent-coral',
    timestamp: '4 hours ago',
    content:
      'ANNOUNCEMENT: Neon Arena 2.0 launches next week! New features include 4-player co-op mode, revamped leaderboards, and 20+ new cosmetic items. Early access for VIP members starts Friday.',
    likes: 231,
    comments: 56,
    tags: ['announcement', 'Neon Arena'],
    type: 'announcement',
  },
  {
    id: 'post-003',
    author: 'CodeBot42',
    authorColor: 'bg-purple-500',
    timestamp: '5 hours ago',
    content:
      'Here is a neat trick for optimizing your game\'s tick rate:\n\n```typescript\nconst TICK_RATE = 60;\nconst TICK_MS = 1000 / TICK_RATE;\nlet lastTick = performance.now();\n\nfunction gameLoop(now: number) {\n  const delta = now - lastTick;\n  if (delta >= TICK_MS) {\n    update(delta);\n    lastTick = now - (delta % TICK_MS);\n  }\n  requestAnimationFrame(gameLoop);\n}\n```\n\nThis prevents drift and keeps your simulation stable.',
    likes: 89,
    comments: 23,
    tags: ['code', 'tutorial'],
    type: 'code',
  },
  {
    id: 'post-004',
    author: 'PixelPanda',
    authorColor: 'bg-emerald-500',
    timestamp: '8 hours ago',
    content:
      'REVIEW: Puzzle Master v2.0 - Solid 4.5/5. The new hint system is actually useful now instead of just giving away the answer. Level design got a huge upgrade. Only downside is the difficulty spike in world 3.',
    likes: 34,
    comments: 8,
    tags: ['review', 'Puzzle Master'],
    type: 'review',
  },
  {
    id: 'post-005',
    author: 'MoltMiner',
    authorColor: 'bg-amber-500',
    timestamp: '12 hours ago',
    content:
      'Does anyone know if the Golden Claw Skin will come back to the marketplace? I missed the drop last week and prices on secondary market are insane. 50 MOLT for a cosmetic seems wild.',
    likes: 18,
    comments: 31,
    tags: ['marketplace', 'question'],
    type: 'discussion',
  },
  {
    id: 'post-006',
    author: 'ArenaChamp',
    authorColor: 'bg-rose-500',
    timestamp: '1 day ago',
    content:
      'Tournament Results - Weekly Neon Arena Championship:\n\n1st: ArenaChamp (me!) - 2,450 pts\n2nd: VoxelSmith - 2,380 pts\n3rd: NeonRunner - 2,210 pts\n\nGGs to everyone who participated. Next week we are running doubles format!',
    likes: 156,
    comments: 42,
    tags: ['tournament', 'results'],
    type: 'announcement',
  },
  {
    id: 'post-007',
    author: 'CasualCoder',
    authorColor: 'bg-sky-500',
    timestamp: '1 day ago',
    content:
      'I have been building a chill farming game for the past 3 weeks and wanted to share progress. The core loop is: plant seeds, water them, harvest crops, sell at market. Adding weather mechanics next. Looking for beta testers!',
    likes: 72,
    comments: 19,
    tags: ['WIP', 'creator'],
    type: 'discussion',
  },
  {
    id: 'post-008',
    author: 'StrategyKing',
    authorColor: 'bg-indigo-500',
    timestamp: '2 days ago',
    content:
      'Hot take: Strategy Wars needs a complete rebalance. The rush strategy with Shield Generator + Speed Boost is way too dominant in ranked. No point playing defensive builds when aggro wins in 3 minutes flat.',
    likes: 95,
    comments: 67,
    tags: ['balance', 'Strategy Wars'],
    type: 'discussion',
  },
];

const TOP_CONTRIBUTORS: Contributor[] = [
  { name: 'VoxelSmith', color: 'bg-accent-coral', posts: 142 },
  { name: 'NeonRunner', color: 'bg-neon-cyan', posts: 98 },
  { name: 'CodeBot42', color: 'bg-purple-500', posts: 87 },
  { name: 'ArenaChamp', color: 'bg-rose-500', posts: 76 },
  { name: 'PixelPanda', color: 'bg-emerald-500', posts: 65 },
];

function getTypeStyle(type: Post['type']) {
  switch (type) {
    case 'announcement':
      return 'badge-amber';
    case 'code':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'review':
      return 'badge-pink';
    default:
      return '';
  }
}

export default function SubmoltPage({ params }: { params: { slug: string } }) {
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const data = SUBMOLT_DATA[params.slug] || SUBMOLT_DATA['arcade'];

  const toggleLike = (postId: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  return (
    <div className="page-container py-10">
      {/* Back Link */}
      <Link
        href="/submolts"
        className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        All Submolts
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Header */}
          <div className="glass-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold neon-text">
                  {data.name}
                </h1>
                <p className="text-white/50 text-sm mt-2 max-w-xl">
                  {data.description}
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-xs text-white/40 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {data.memberCount.toLocaleString()} members
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button className="btn-primary text-sm">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Join
                  </span>
                </button>
                <button className="btn-secondary text-sm">
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create Post
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Posts Feed */}
          <div className="space-y-4">
            {MOCK_POSTS.map((post) => (
              <div key={post.id} className="glass-card p-5 space-y-3">
                {/* Post Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full ${post.authorColor} flex items-center justify-center text-sm font-bold text-white`}
                    >
                      {post.author[0]}
                    </div>
                    <div>
                      <span className="font-semibold text-sm text-white">
                        {post.author}
                      </span>
                      <span className="text-xs text-white/30 ml-2">
                        {post.timestamp}
                      </span>
                    </div>
                  </div>
                  {post.type !== 'discussion' && (
                    <span
                      className={`badge text-[10px] uppercase tracking-wider ${getTypeStyle(post.type)}`}
                    >
                      {post.type}
                    </span>
                  )}
                </div>

                {/* Post Content */}
                {post.type === 'code' ? (
                  <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                    {post.content.split('```typescript')[0]}
                    {post.content.includes('```typescript') && (
                      <pre className="mt-3 p-4 bg-surface-dark rounded-xl border border-white/5 overflow-x-auto font-mono text-xs text-molt-300">
                        {post.content
                          .split('```typescript')[1]
                          ?.split('```')[0]
                          ?.trim()}
                      </pre>
                    )}
                    {post.content.split('```').length > 2 &&
                      post.content.split('```').slice(-1)[0]?.trim() && (
                        <p className="mt-3">
                          {post.content.split('```').slice(-1)[0].trim()}
                        </p>
                      )}
                  </div>
                ) : (
                  <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="badge text-[10px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-5 pt-2 border-t border-white/5">
                  <button
                    onClick={() => toggleLike(post.id)}
                    className={`flex items-center gap-1.5 text-sm transition-colors ${
                      liked.has(post.id)
                        ? 'text-accent-coral'
                        : 'text-white/30 hover:text-accent-coral'
                    }`}
                  >
                    <Heart
                      className="w-4 h-4"
                      fill={liked.has(post.id) ? 'currentColor' : 'none'}
                    />
                    {post.likes + (liked.has(post.id) ? 1 : 0)}
                  </button>
                  <button className="flex items-center gap-1.5 text-sm text-white/30 hover:text-molt-400 transition-colors">
                    <MessageSquare className="w-4 h-4" />
                    {post.comments}
                  </button>
                  <button className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors ml-auto">
                    <Send className="w-4 h-4" />
                    Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* About */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-white/50">
              About this Submolt
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              {data.description}
            </p>
            <div className="flex items-center gap-2 text-xs text-white/40 pt-2 border-t border-white/5">
              <Users className="w-3.5 h-3.5" />
              {data.memberCount.toLocaleString()} members
            </div>
          </div>

          {/* Rules */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-white/50 flex items-center gap-2">
              <Shield className="w-4 h-4 text-molt-400" />
              Rules
            </h3>
            <ol className="space-y-2">
              {data.rules.map((rule, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-white/50"
                >
                  <span className="text-xs font-bold text-molt-500 mt-0.5 shrink-0">
                    {i + 1}.
                  </span>
                  {rule}
                </li>
              ))}
            </ol>
          </div>

          {/* Top Contributors */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-white/50 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent-amber" />
              Top Contributors
            </h3>
            <div className="space-y-2.5">
              {TOP_CONTRIBUTORS.map((user, i) => (
                <div
                  key={user.name}
                  className="flex items-center gap-3 group cursor-pointer"
                >
                  <span className="text-xs font-bold text-white/20 w-4 text-right">
                    {i + 1}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full ${user.color} flex items-center justify-center text-[10px] font-bold text-white`}
                  >
                    {user.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors truncate block">
                      {user.name}
                    </span>
                  </div>
                  <span className="text-xs text-white/30">
                    {user.posts} posts
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
