// In-memory JWT blocklist (resets on restart -- use Redis in production)
const blocklist = new Set<string>();

export function blockToken(jti: string): void {
  blocklist.add(jti);
}

export function isTokenBlocked(jti: string): boolean {
  return blocklist.has(jti);
}
