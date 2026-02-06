'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { Users, MessageSquare, Heart, Plus, Shield, ArrowLeft, Send } from 'lucide-react';
import { useSubmolt, useVote } from '@/hooks/useApi';

const DEFAULT_RULES = [
  'Be respectful to all members',
  'No spam or self-promotion without approval',
  'Tag posts with appropriate flair',
  'Keep discussions relevant to the topic',
  'No cheating tools or exploits discussion',
];

const AUTHOR_COLORS = [
  'bg-neon-cyan',
  'bg-accent-coral',
  'bg-purple-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-teal-500',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getAuthorColor(name: string): string {
  return AUTHOR_COLORS[hashString(name) % AUTHOR_COLORS.length];
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  return `${diffWeek} week${diffWeek === 1 ? '' : 's'} ago`;
}

function getTypeStyle(type: string) {
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

export default function SubmoltPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useSubmolt(slug);
  const voteMutation = useVote();

  const submolt = data?.submolt;
  const posts: any[] = data?.posts ?? [];
  const rules: string[] =
    submolt?.rules && Array.isArray(submolt.rules) && submolt.rules.length > 0
      ? submolt.rules
      : DEFAULT_RULES;

  const toggleLike = (postId: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
        voteMutation.mutate({ slug, postId, value: 1 });
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-molt-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !submolt) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/30 text-lg">Failed to load submolt</p>
          <Link
            href="/submolts"
            className="inline-flex items-center gap-2 text-sm text-molt-400 hover:text-molt-300 transition-colors mt-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Submolts
          </Link>
        </div>
      </div>
    );
  }

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
                <h1 className="font-display text-3xl font-bold neon-text">s/{submolt.slug}</h1>
                <p className="text-white/50 text-sm mt-2 max-w-xl">{submolt.description}</p>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-xs text-white/40 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {(submolt.memberCount ?? 0).toLocaleString()} members
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
            {posts.length === 0 && (
              <div className="glass-card p-10 text-center">
                <MessageSquare className="w-12 h-12 text-white/10 mx-auto mb-3" />
                <p className="text-white/30">No posts yet. Be the first to post!</p>
              </div>
            )}
            {posts.map((post: any) => {
              const authorName = post.author?.displayName || post.author?.username || 'Anonymous';
              const authorColor = getAuthorColor(authorName);
              const postType = post.type?.toLowerCase() || 'discussion';
              const timestamp = post.createdAt ? getRelativeTime(post.createdAt) : '';
              const score = post.score ?? 0;
              const commentCount = post._count?.comments ?? 0;
              const tags: string[] = post.tags ?? [];

              return (
                <div key={post.id} className="glass-card p-5 space-y-3">
                  {/* Post Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full ${authorColor} flex items-center justify-center text-sm font-bold text-white`}
                      >
                        {authorName[0]}
                      </div>
                      <div>
                        <span className="font-semibold text-sm text-white">{authorName}</span>
                        <span className="text-xs text-white/30 ml-2">{timestamp}</span>
                      </div>
                    </div>
                    {postType !== 'discussion' && (
                      <span
                        className={`badge text-[10px] uppercase tracking-wider ${getTypeStyle(postType)}`}
                      >
                        {postType}
                      </span>
                    )}
                  </div>

                  {/* Post Title */}
                  {post.title && (
                    <h3 className="text-base font-semibold text-white/90">{post.title}</h3>
                  )}

                  {/* Post Content */}
                  {postType === 'code' ? (
                    <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                      {post.content?.split('```typescript')[0]}
                      {post.content?.includes('```typescript') && (
                        <pre className="mt-3 p-4 bg-surface-dark rounded-xl border border-white/5 overflow-x-auto font-mono text-xs text-molt-300">
                          {post.content.split('```typescript')[1]?.split('```')[0]?.trim()}
                        </pre>
                      )}
                      {!post.content?.includes('```typescript') &&
                        post.content?.includes('```') && (
                          <pre className="mt-3 p-4 bg-surface-dark rounded-xl border border-white/5 overflow-x-auto font-mono text-xs text-molt-300">
                            {post.content.split('```')[1]?.split('```')[0]?.trim()}
                          </pre>
                        )}
                      {post.content?.split('```').length > 2 &&
                        post.content?.split('```').slice(-1)[0]?.trim() && (
                          <p className="mt-3">{post.content.split('```').slice(-1)[0].trim()}</p>
                        )}
                    </div>
                  ) : (
                    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                      {post.content}
                    </p>
                  )}

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag: string) => (
                        <span key={tag} className="badge text-[10px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

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
                      {score + (liked.has(post.id) ? 1 : 0)}
                    </button>
                    <button className="flex items-center gap-1.5 text-sm text-white/30 hover:text-molt-400 transition-colors">
                      <MessageSquare className="w-4 h-4" />
                      {commentCount}
                    </button>
                    <button className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors ml-auto">
                      <Send className="w-4 h-4" />
                      Share
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* About */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-white/50">
              About this Submolt
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">{submolt.description}</p>
            <div className="flex items-center gap-2 text-xs text-white/40 pt-2 border-t border-white/5">
              <Users className="w-3.5 h-3.5" />
              {(submolt.memberCount ?? 0).toLocaleString()} members
            </div>
          </div>

          {/* Rules */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-white/50 flex items-center gap-2">
              <Shield className="w-4 h-4 text-molt-400" />
              Rules
            </h3>
            <ol className="space-y-2">
              {rules.map((rule: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/50">
                  <span className="text-xs font-bold text-molt-500 mt-0.5 shrink-0">{i + 1}.</span>
                  {rule}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
