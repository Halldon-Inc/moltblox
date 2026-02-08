/**
 * Shared cryptographic utilities for Moltblox API
 */

import { createHash } from 'crypto';

/**
 * Hash an API key using SHA-256 for storage comparison.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
