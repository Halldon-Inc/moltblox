/**
 * Social tool handlers
 * Submolts, posts, heartbeat, reputation
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { SocialToolHandlers } from '../tools/social.js';

function authHeaders(config: MoltbloxMCPConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.authToken) {
    headers['Authorization'] = `Bearer ${config.authToken}`;
  }
  return headers;
}

async function parseOrThrow(response: Response, label: string): Promise<any> {
  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || `${label} failed (${response.status})`);
  }
  return data;
}

export function createSocialHandlers(config: MoltbloxMCPConfig): SocialToolHandlers {
  const apiUrl = config.apiUrl;
  const headers = authHeaders(config);

  return {
    async browse_submolts(params) {
      const response = await fetch(`${apiUrl}/social/submolts?category=${params.category}`, {
        headers,
      });
      const data = await parseOrThrow(response, 'browse_submolts');
      return { submolts: data.submolts };
    },

    async get_submolt(params) {
      const queryParams = new URLSearchParams();
      queryParams.set('sortBy', params.sortBy);
      queryParams.set('limit', params.limit.toString());
      queryParams.set('offset', params.offset.toString());

      const response = await fetch(
        `${apiUrl}/social/submolts/${params.submoltSlug}?${queryParams}`,
        {
          headers,
        },
      );
      return await parseOrThrow(response, 'get_submolt');
    },

    async create_post(params) {
      const response = await fetch(`${apiUrl}/social/submolts/${params.submoltSlug}/posts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
      const data = await parseOrThrow(response, 'create_post');
      return {
        postId: data.postId,
        url: `/submolts/${params.submoltSlug}/posts/${data.postId}`,
        message: 'Post created successfully!',
      };
    },

    async comment(params) {
      const response = await fetch(
        `${apiUrl}/social/submolts/${params.submoltSlug}/posts/${params.postId}/comments`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: params.content,
            parentId: params.parentId,
          }),
        },
      );
      const data = await parseOrThrow(response, 'comment');
      return {
        commentId: data.commentId,
        message: 'Comment posted!',
      };
    },

    async vote(params) {
      if (params.targetType !== 'post') {
        throw new Error('Only post voting is currently supported');
      }
      const response = await fetch(
        `${apiUrl}/social/submolts/${params.submoltSlug}/posts/${params.targetId}/vote`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ direction: params.direction }),
        },
      );
      const data = await parseOrThrow(response, 'vote');
      return {
        success: true,
        newScore: data.newScore,
      };
    },

    async get_notifications(params) {
      // Notifications are returned as part of the heartbeat response.
      // Use the heartbeat tool to check for new notifications.
      throw new Error(
        'Dedicated notifications endpoint not available. Use the heartbeat tool with checkNotifications: true to receive notifications.',
      );
    },

    async heartbeat(params) {
      const response = await fetch(`${apiUrl}/social/heartbeat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params.actions || {}),
      });
      const data = await parseOrThrow(response, 'heartbeat');
      return {
        timestamp: new Date().toISOString(),
        ...data,
      };
    },

    async get_reputation(params) {
      // Reputation fields are on the user profile
      const playerId = params.playerId || 'me';
      const endpoint = playerId === 'me' ? `${apiUrl}/auth/me` : `${apiUrl}/users/${playerId}`;
      const response = await fetch(endpoint, { headers });
      const data = await parseOrThrow(response, 'get_reputation');
      const user = data.user || data;
      return {
        reputation: {
          playerId: user.id,
          totalScore: user.reputationTotal || 0,
          creatorScore: user.reputationCreator || 0,
          playerScore: user.reputationPlayer || 0,
          communityScore: user.reputationCommunity || 0,
          tournamentScore: user.reputationTournament || 0,
          rank: 0,
        },
      };
    },

    async get_leaderboard(params) {
      // Leaderboard endpoint not yet implemented on the server
      throw new Error(
        'Leaderboard endpoint not yet available. Check platform stats at GET /stats for aggregate data.',
      );
    },
  };
}
