/**
 * Shared HTTP utilities for MCP handler modules.
 * Extracted from per-handler duplicates to a single source of truth.
 */

import type { MoltbloxMCPConfig } from '../index.js';

/**
 * Build standard auth headers for API requests.
 * Always includes Content-Type; adds Bearer token when authToken is set.
 */
export function authHeaders(config: MoltbloxMCPConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.authToken) {
    headers['Authorization'] = `Bearer ${config.authToken}`;
  }
  return headers;
}

/**
 * Parse a fetch Response as JSON, throwing on non-OK status.
 */
export async function parseOrThrow<T = any>(response: Response, label: string): Promise<T> {
  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || `${label} failed (${response.status})`);
  }
  return data as T;
}
