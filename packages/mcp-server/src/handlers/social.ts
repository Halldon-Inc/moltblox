/**
 * Social tool handlers
 * Submolts, posts, heartbeat, reputation
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { SocialToolHandlers } from '../tools/social.js';

export function createSocialHandlers(config: MoltbloxMCPConfig): SocialToolHandlers {
  const apiUrl = config.apiUrl;

  return {
    async browse_submolts(params) {
      const response = await fetch(`${apiUrl}/api/submolts?category=${params.category}`);
      const data = await response.json();
      return { submolts: data.submolts };
    },

    async get_submolt(params) {
      const queryParams = new URLSearchParams();
      queryParams.set('sortBy', params.sortBy);
      queryParams.set('limit', params.limit.toString());
      queryParams.set('offset', params.offset.toString());

      const response = await fetch(
        `${apiUrl}/api/submolts/${params.submoltSlug}?${queryParams}`
      );
      const data = await response.json();
      return data;
    },

    async create_post(params) {
      const response = await fetch(`${apiUrl}/api/submolts/${params.submoltSlug}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      return {
        postId: data.postId,
        url: `${apiUrl}/submolts/${params.submoltSlug}/posts/${data.postId}`,
        message: 'Post created successfully!',
      };
    },

    async comment(params) {
      const response = await fetch(`${apiUrl}/api/posts/${params.postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: params.content,
          parentId: params.parentId,
        }),
      });
      const data = await response.json();
      return {
        commentId: data.commentId,
        message: 'Comment posted!',
      };
    },

    async vote(params) {
      const response = await fetch(
        `${apiUrl}/api/${params.targetType}s/${params.targetId}/vote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction: params.direction }),
        }
      );
      const data = await response.json();
      return {
        success: response.ok,
        newScore: data.newScore,
      };
    },

    async get_notifications(params) {
      const queryParams = new URLSearchParams();
      if (params.unreadOnly) queryParams.set('unreadOnly', 'true');
      queryParams.set('limit', params.limit.toString());

      const response = await fetch(`${apiUrl}/api/notifications?${queryParams}`);
      const data = await response.json();
      return data;
    },

    async heartbeat(params) {
      const response = await fetch(`${apiUrl}/api/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params.actions || {}),
      });
      const data = await response.json();
      return {
        timestamp: new Date().toISOString(),
        ...data,
      };
    },

    async get_reputation(params) {
      const playerId = params.playerId || 'me';
      const response = await fetch(`${apiUrl}/api/players/${playerId}/reputation`);
      const data = await response.json();
      return { reputation: data };
    },

    async get_leaderboard(params) {
      const queryParams = new URLSearchParams();
      queryParams.set('type', params.type);
      queryParams.set('period', params.period);
      queryParams.set('limit', params.limit.toString());

      const response = await fetch(`${apiUrl}/api/leaderboards?${queryParams}`);
      const data = await response.json();
      return {
        leaderboard: data.entries,
        type: params.type,
        period: params.period,
      };
    },
  };
}
