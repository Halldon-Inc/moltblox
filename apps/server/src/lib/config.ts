/**
 * Shared configuration helpers for Moltblox API.
 */

/**
 * Parse the CORS_ORIGIN env var into an array of allowed origin strings.
 */
export const allowedOrigins: string[] = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
