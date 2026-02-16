'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  MessageSquare,
  Heart,
  Plus,
  Shield,
  ArrowLeft,
  Send,
  X,
  Loader2,
} from 'lucide-react';
import { useSubmolt, useVote, useCreatePost } from '@/hooks/useApi';
import { getRelativeTime } from '@/lib/format';
import { hashString } from '@/lib/utils';
import Spinner from '@/components/shared/Spinner';

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

function getAuthorColor(name: string): string {
  return AUTHOR_COLORS[hashString(name) % AUTHOR_COLORS.length];
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

export default function SubmoltPage() {
  const { slug } = useParams<{ slug: string }>();
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useSubmolt(slug);
  const voteMutation = useVote();
  const createPostMutation = useCreatePost();

  const [joined, setJoined] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');

  const handleJoin = useCallback(() => setJoined((prev) => !prev), []);

  const handleCreatePost = useCallback(() => {
    if (!postTitle.trim() || !postContent.trim() || createPostMutation.isPending) return;
    createPostMutation.mutate(
      { slug, data: { title: postTitle.trim(), content: postContent.trim() } },
      {
        onSuccess: () => {
          setPostTitle('');
          setPostContent('');
          setShowPostForm(false);
        },
      },
    );
  }, [slug, postTitle, postContent, createPostMutation]);

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
        <Spinner />
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
                <button
                  onClick={handleJoin}
                  className={joined ? 'btn-secondary text-sm' : 'btn-primary text-sm'}
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {joined ? 'Joined' : 'Join'}
                  </span>
                </button>
                <button
                  onClick={() => setShowPostForm((prev) => !prev)}
                  className="btn-secondary text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create Post
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Create Post Form */}
          {showPostForm && (
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm uppercase tracking-wider text-white/50">
                  New Post
                </h3>
                <button
                  onClick={() => setShowPostForm(false)}
                  className="text-white/30 hover:text-white/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Post title"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                maxLength={200}
                className="w-full bg-surface-dark/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-molt-500/50"
              />
              <textarea
                placeholder="What's on your mind?"
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                maxLength={5000}
                rows={4}
                className="w-full bg-surface-dark/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-molt-500/50 resize-none"
              />
              {createPostMutation.isError && (
                <p className="text-xs text-red-400">
                  {createPostMutation.error?.message || 'Failed to create post'}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleCreatePost}
                  disabled={
                    !postTitle.trim() || !postContent.trim() || createPostMutation.isPending
                  }
                  className="btn-primary text-sm px-6 disabled:opacity-50"
                >
                  {createPostMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Posting...
                    </span>
                  ) : (
                    'Post'
                  )}
                </button>
              </div>
            </div>
          )}

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
