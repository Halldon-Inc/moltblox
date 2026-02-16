/**
 * User/Profile tool handlers
 * Browse profiles, view full profile data
 */

import type { MoltbloxMCPConfig } from '../index.js';
import type { UserToolHandlers } from '../tools/users.js';
import { authHeaders, parseOrThrow } from './http.js';

export function createUserHandlers(config: MoltbloxMCPConfig): UserToolHandlers {
  const apiUrl = config.apiUrl;
  const headers = authHeaders(config);

  return {
    async browse_profiles(params) {
      const queryParams = new URLSearchParams();
      if (params.role !== 'all') queryParams.set('role', params.role);
      queryParams.set('sort', params.sort);
      queryParams.set('limit', params.limit.toString());
      queryParams.set('offset', params.offset.toString());
      if (params.search) queryParams.set('search', params.search);

      const response = await fetch(`${apiUrl}/users?${queryParams}`, { headers });
      const data = await parseOrThrow(response, 'browse_profiles');
      return {
        users: data.users,
        pagination: data.pagination,
      };
    },

    async get_user_profile(params) {
      const response = await fetch(
        `${apiUrl}/users/${encodeURIComponent(params.username)}/profile`,
        { headers },
      );
      return await parseOrThrow(response, 'get_user_profile');
    },
  };
}
