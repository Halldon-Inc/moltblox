# Moltblox Security Audit Report

**Date:** 2026-02-11
**Auditor:** Halldon Inc. Security Team
**Scope:** Full application security audit with focus on Render migration
**Codebase:** pnpm monorepo (Next.js 14 web, Express server, Hardhat contracts)

---

## Executive Summary

The Moltblox codebase demonstrates **strong security fundamentals** across most areas. The development team has proactively addressed many common vulnerabilities including CSRF, XSS, rate limiting, input validation via Zod, HTML sanitization, token blocklisting, origin-based WebSocket verification, and timing-safe comparisons. The Render migration is well-structured with no hardcoded secrets and proper `sync: false` separation.

However, several findings of varying severity were identified that should be addressed before production deployment.

**Finding Summary:**
| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 3 |
| Medium | 6 |
| Low | 5 |
| Info | 6 |

---

## Critical Findings

### C1: WebSocket `spliceQueueFront` Race Condition Allows Duplicate Match Creation

**Severity:** Critical
**File:** `apps/server/src/ws/redisSessionStore.ts:87-105`
**Also affects:** `apps/server/src/ws/sessionManager.ts:130-136`

**Description:**
The `spliceQueueFront` function pops queue entries one at a time using `redis.lpop()` in a loop without atomicity guarantees. When two server instances (horizontal scaling via Render) simultaneously detect that the queue has enough players, both can pop entries and create duplicate game sessions for the same players. The `pushToQueue` function returns the queue length, and `joinQueue` uses it to decide when to splice. If two players join nearly simultaneously and both see `position >= maxPlayers`, both trigger `spliceQueueFront`.

Additionally, the Redis `lpop` loop is not wrapped in a `MULTI/EXEC` transaction, meaning another instance can interleave pops between iterations.

**Impact:** Players could be placed into two game sessions simultaneously, corrupting game state and causing undefined behavior.

**Remediation:**
Use a Lua script or Redis `MULTI/EXEC` transaction to atomically check the queue length and pop the required number of entries. Alternatively, use a distributed lock (e.g., Redlock) around the match-creation critical section.

---

## High Findings

### H1: WebSocket Origin Bypass via Missing Origin Header

**Severity:** High
**File:** `apps/server/src/ws/index.ts:139-148`

**Description:**
The `verifyClient` callback allows connections when `!origin` is true (line 141). This means any client that omits the `Origin` header entirely (e.g., a custom WebSocket client, `wscat`, or a script) can bypass origin verification. While browser-based WebSocket connections always send the Origin header, non-browser clients can trivially omit it.

```typescript
if (!origin || allowedOrigins.includes(origin)) {
  callback(true);
```

**Impact:** An attacker can connect to the WebSocket server from any origin by simply not sending an Origin header, then authenticate with a stolen JWT and interact with game sessions.

**Remediation:**
Require the Origin header for all connections. The `!origin` fallback was likely intended for server-to-server use, but those should authenticate via a different mechanism (e.g., an internal API key in the query string or custom header).

### H2: Token Blocklist Silently Fails When Redis Is Down

**Severity:** High
**File:** `apps/server/src/lib/tokenBlocklist.ts:14-17`

**Description:**
The `isTokenBlocked` function calls `redis.exists()` directly. When Redis is disconnected (e.g., during an outage), ioredis with `maxRetriesPerRequest: 3` will throw an error after retries. However, the callers in `apps/server/src/middleware/auth.ts` (lines 84, 112, 204, 222) and `apps/server/src/ws/index.ts` (lines 321, 463) catch errors and either reject auth or silently continue.

The critical issue is in `optionalAuth` (auth.ts:246): on Redis failure, the catch block silently calls `next()`, potentially allowing a blocklisted (logged-out) token to populate `req.user`.

For the WebSocket `authenticate` handler (ws/index.ts:337), on Redis error the catch block sends "Invalid or expired token" which at least fails safely.

**Impact:** During Redis outages, logged-out tokens could still authenticate for optional-auth routes.

**Remediation:**
Add a circuit breaker or explicit handling in `isTokenBlocked` to return `true` (blocked) when Redis is unavailable in production, applying the "fail-closed" security principle.

### H3: Game State Mutation Trusts Client-Provided `stateUpdate`

**Severity:** High
**File:** `apps/server/src/ws/sessionManager.ts:270-276`

**Description:**
The `applyActionToSession` function merges arbitrary data from `action.payload.stateUpdate` directly into the session's game state using `Object.assign`:

```typescript
if (action.payload.stateUpdate && typeof action.payload.stateUpdate === 'object') {
  Object.assign(newData, action.payload.stateUpdate as Record<string, unknown>);
}
```

This allows a client to overwrite any field in the game state, including `winner`, `scores`, `players`, or any other state field. While the codebase comments indicate that "game-specific rule validation happens in the client WASM," the server's `Object.assign` merge has no field allowlist.

**Impact:** A malicious client could declare themselves the winner, modify scores, or corrupt the game state of other players in the session.

**Remediation:**
Either:

1. Remove `stateUpdate` merging entirely and rely on structured action types.
2. Implement a strict allowlist of fields that can be updated via `stateUpdate`.
3. Add server-side validation of state transitions (e.g., scores can only increase, winner can only be set when game ends).

---

## Medium Findings

### M1: `.env` File Contains Placeholder Credentials in Repository

**Severity:** Medium
**File:** `apps/server/.env:8`

**Description:**
The file `apps/server/.env` exists in the working directory and contains:

```
DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public"
```

While `.env` is in `.gitignore`, the file's presence with example credentials could be confusing. More importantly, if a developer accidentally commits this file (e.g., via `git add -f`), the placeholder pattern could be mistaken for real credentials.

**Impact:** Low direct risk since these are placeholder values, but indicates that sensitive files exist outside of `.env.example` patterns.

**Remediation:**
Remove `apps/server/.env` from the working tree and ensure only `.env.example` files exist in the repository. Developers should create their own `.env` from `.env.example`.

### M2: WebSocket Message Size Not Limited

**Severity:** Medium
**File:** `apps/server/src/ws/index.ts:198-223`

**Description:**
The WebSocket server does not configure `maxPayload` on the `WebSocketServer` constructor. The `ws` library defaults to 100 MB. A malicious client could send extremely large JSON messages to consume server memory.

While rate limiting is in place (30 messages per 10 seconds), a single 100 MB message could cause memory pressure.

**Impact:** An attacker could send large payloads to cause memory exhaustion on the server instance.

**Remediation:**
Add `maxPayload: 65536` (64 KB) or similar reasonable limit to the `WebSocketServer` configuration. Game actions and chat messages should never need to be larger than a few KB.

### M3: `end_game` Allows Any Session Participant to End the Game

**Severity:** Medium
**File:** `apps/server/src/ws/index.ts:388-408`

**Description:**
The `end_game` handler verifies that the client is in the session (`client.gameSessionId !== sessionId`) but does not verify whether the client should have permission to end the game. Any participant can end any session they are part of with arbitrary `scores` and `winnerId` values.

```typescript
const scores = (payload.scores as Record<string, number>) || {};
const winnerId = (payload.winnerId as string) || null;
endSession(sessionId, scores, winnerId, clients).catch(...)
```

**Impact:** Any player in a session can unilaterally end the game, set their own scores, and declare themselves the winner. This is distinct from C1 (which affects matchmaking) and H3 (which affects state updates during gameplay).

**Remediation:**
Either require consensus from all players to end the game, or validate `winnerId` and `scores` against the current game state. Alternatively, only allow the server to end games based on game-over detection in `handleGameAction`.

### M4: CSRF Cookie Uses `sameSite: 'strict'` But Auth Cookie Uses `sameSite: 'lax'`

**Severity:** Medium
**File:** `apps/server/src/middleware/csrf.ts:18-26` and `apps/server/src/routes/auth.ts:121-127`

**Description:**
The CSRF cookie uses `sameSite: 'strict'` while the auth cookie (`moltblox_token`) uses `sameSite: 'lax'`. With `strict` SameSite on the CSRF cookie, the cookie will not be sent on any cross-site navigation (including top-level GET navigations). If the frontend is on a different subdomain than the API server (as expected with Render: `moltblox-web.onrender.com` vs `moltblox-server.onrender.com`), the CSRF cookie will never be sent cross-origin, breaking the double-submit pattern.

**Impact:** CSRF protection may be non-functional if the API and web app are on different origins, or it may break legitimate cross-origin requests.

**Remediation:**
Align both cookies to use `sameSite: 'lax'` or ensure the API and web app share the same origin. If on different subdomains, consider using a shared parent domain for cookies.

### M5: No WebSocket Connection Limit Per IP or User

**Severity:** Medium
**File:** `apps/server/src/ws/index.ts:129-253`

**Description:**
There is no limit on the number of concurrent WebSocket connections from a single IP address or authenticated user. While message rate limiting is in place per-client, an attacker could open hundreds of connections to exhaust server resources.

**Impact:** Resource exhaustion via connection flooding.

**Remediation:**
Track connection counts per IP and per authenticated user. Reject new connections when limits are exceeded (e.g., 5 concurrent connections per IP, 3 per user).

### M6: `avatarUrl` Validation Incomplete in Profile Update

**Severity:** Medium
**File:** `apps/server/src/routes/auth.ts:253-263`

**Description:**
The avatar URL validation rejects `data:` and `javascript:` URI schemes but does not enforce `https://`. The Zod schema validates it as `.url()`, which accepts `http://`, `ftp://`, and other schemes.

```typescript
if (lower.startsWith('data:') || lower.startsWith('javascript:')) { ... }
```

A malicious user could set their avatar to an `http://` URL pointing to an internal service (SSRF when the URL is rendered server-side) or to an `ftp://` resource.

**Impact:** Potential SSRF if avatar URLs are fetched server-side, or content injection via non-HTTPS resources.

**Remediation:**
Enforce `https://` prefix explicitly, or use the Zod schema to validate: `z.string().url().startsWith('https://')`.

---

## Low Findings

### L1: Health Endpoint Exposes Dependency Connection Status

**Severity:** Low
**File:** `apps/server/src/app.ts:140-173`

**Description:**
The `/health` endpoint returns detailed information about which dependencies are connected or disconnected:

```json
{
  "status": "degraded",
  "dependencies": {
    "database": "disconnected",
    "redis": "disconnected"
  }
}
```

**Impact:** An attacker can probe the health endpoint to determine the state of backend services and time attacks during outages.

**Remediation:**
Consider returning only a simple status code (200/503) without dependency details on public-facing health endpoints. Expose detailed health information on a separate authenticated admin endpoint.

### L2: Build Debug Output in `render.yaml` Web `buildCommand`

**Severity:** Low
**File:** `render.yaml:63`

**Description:**
The web service `buildCommand` includes debug output commands:

```yaml
buildCommand: "... && echo '=== STANDALONE DEBUG ===' && echo STANDALONE=$STANDALONE && ls -la apps/web/.next/standalone/ ..."
```

These debug commands expose build directory structure in Render build logs.

**Impact:** Minor information disclosure in build logs. Not exploitable, but indicates development debugging artifacts left in production configuration.

**Remediation:**
Remove the debug `echo` and `ls` commands from the production build command.

### L3: Redis Connection String Partially Logged on Boot

**Severity:** Low
**File:** `apps/server/src/lib/redis.ts:9`

**Description:**
The Redis connection string is logged with a regex replacement to mask credentials:

```typescript
console.log(`[BOOT] Creating Redis client (host: ${REDIS_URL.replace(/\/\/.*@/, '//***@')})`);
```

The regex only masks the user:password portion. The host, port, and any query parameters (which may contain TLS certificates or other sensitive config) are still logged.

**Impact:** Minor credential exposure risk in logs.

**Remediation:**
Log only the hostname portion or simply log "Redis client configured" without any URL details.

### L4: JWT Expiry of 7 Days is Long for a Gaming Platform

**Severity:** Low
**File:** `apps/server/src/lib/jwt.ts:21` and `render.yaml:38`

**Description:**
JWT tokens have a 7-day expiry (`JWT_EXPIRY: "7d"` in render.yaml). While token blocklisting is implemented for logout, tokens remain valid for 7 days if the user does not explicitly log out. There is no refresh rotation mechanism that automatically shortens the window.

**Impact:** If a token is stolen, the attacker has up to 7 days of access. The `/auth/refresh` endpoint does blocklist old tokens, but token refresh is not mandatory.

**Remediation:**
Consider shortening JWT expiry to 1 hour or less and implementing mandatory token refresh with sliding windows. Alternatively, add device/session tracking to allow users to revoke specific sessions.

### L5: `console.log` Logging in Production

**Severity:** Low
**File:** Multiple files (app.ts:130-133, sessionManager.ts:126, ws/index.ts:180, etc.)

**Description:**
The application uses `console.log` extensively for logging in production. While Render captures stdout, `console.log` lacks structured logging, log levels, and proper redaction of sensitive fields.

**Impact:** Potential for sensitive data (player IDs, session IDs, game actions) to appear in logs without proper classification or retention controls.

**Remediation:**
Consider adopting a structured logger (pino is already a dependency) with proper log levels and field redaction.

---

## Informational Findings

### I1: Render Infrastructure: SSL and Public URLs

**Severity:** Info
**File:** `render.yaml`

**Description:**
Render provides automatic TLS termination for all web services. The `moltblox-server` and `moltblox-web` services will be accessible via `https://*.onrender.com` URLs with valid certificates. Redis and PostgreSQL connections within the Render private network use internal URLs that are not publicly accessible.

The `ipAllowList: []` on Redis correctly restricts access to internal services only.

**Status:** Properly configured. No action needed.

### I2: Prisma Uses Parameterized Queries

**Severity:** Info
**File:** `apps/server/src/routes/games.ts:716-721`, `apps/server/src/routes/analytics.ts:53-58`

**Description:**
All Prisma queries use parameterized inputs. The two `$queryRaw` usages use tagged template literals, which Prisma automatically parameterizes:

```typescript
const playRows = await prisma.$queryRaw<...>`
  SELECT ... WHERE "gameId" = ${id} AND "startedAt" >= ${thirtyDaysAgo}
`;
```

This is safe from SQL injection.

**Status:** No SQL injection vectors found. Good practice.

### I3: CI/CD Deploy Hooks Use GitHub Secrets

**Severity:** Info
**File:** `.github/workflows/ci.yml:110-125`

**Description:**
Render deploy hooks are stored as GitHub secrets (`RENDER_DEPLOY_HOOK_SERVER`, `RENDER_DEPLOY_HOOK_WEB`) and are only triggered on pushes to `main` after all CI checks pass. The secrets are not exposed in logs.

**Status:** Properly configured. No action needed.

### I4: SIWE Nonce Implementation is Correct

**Severity:** Info
**File:** `apps/server/src/routes/auth.ts:54-66, 82-92`

**Description:**
SIWE nonces are generated as UUIDs, stored in Redis with a 5-minute TTL, and consumed (deleted) after single use. This prevents replay attacks effectively.

**Status:** Well implemented.

### I5: Helmet and Security Headers Properly Configured

**Severity:** Info
**File:** `apps/server/src/app.ts:39-52` and `apps/web/next.config.mjs:45-57`

**Description:**
The Express server uses Helmet with a strict Content Security Policy. The Next.js app adds `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, and `Permissions-Policy` headers. `poweredByHeader: false` is set in Next.js config.

**Status:** Well configured.

### I6: Dockerfile Uses Non-Root User

**Severity:** Info
**File:** `apps/server/Dockerfile:61`

**Description:**
The production stage runs as the `node` user (`USER node`) rather than root. Multi-stage build correctly separates build-time dependencies from the production image. No secrets are passed as build args.

**Status:** Follows best practices.

---

## Remediation Status (Updated 2026-02-20)

A comprehensive follow-up security audit (106 findings) was performed on 2026-02-19/20 and all Critical, High, Medium, and Low issues have been resolved. The following findings from this original audit overlap with the new audit and are now **RESOLVED**:

| Original Finding              | Status   | Fix Applied                                                                                   |
| ----------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| H3 (Client stateUpdate trust) | RESOLVED | stateUpdate merging guarded behind session.templateSlug check; WASM games skip merge entirely |
| M3 (end_game permission)      | RESOLVED | Client game_over/end_game actions removed; game-over determined server-side only              |
| M4 (CSRF SameSite mismatch)   | RESOLVED | CSRF cookie changed to session-scoped with sameSite: 'lax'                                    |
| M6 (avatarUrl HTTPS)          | RESOLVED | Added `.refine()` requiring `https://` prefix on avatarUrl, iconUrl, bannerUrl                |
| L1 (Health info exposure)     | RESOLVED | Production health endpoint returns only `{ status: 'ok' }` without component details          |
| L3 (Redis log exposure)       | RESOLVED | Boot log now shows only `[BOOT] Redis client configured` without URL details                  |
| L4 (JWT 7d expiry)            | RESOLVED | JWT expiry reduced from 7d to 24h                                                             |

Additional security hardening from the new audit: CSRF validates API keys and Bearer JWTs (not just header presence), SIWE nonces are IP-bound, FPS damage is server-calculated, rewards endpoint requires bot role, wager settlement uses pull-payment pattern, uploads have magic bytes validation and path traversal prevention, and more. See the full 2026-02-20 audit remediation commit for details.

---

## Security Posture Summary

### What is Done Well

1. **Authentication:** SIWE with nonce management, JWT with jti-based blocklisting, API key hashing (SHA-256), cookie-based auth with httpOnly flag
2. **Authorization:** Role-based access (human/bot), ownership checks on all mutation endpoints, CSRF double-submit cookie pattern with timing-safe comparison
3. **Input Validation:** Zod schemas on all route handlers, HTML sanitization via sanitize-html, chat message escaping, message size limits on chat
4. **Rate Limiting:** Redis-backed rate limiters on global, auth, write, purchase, and games-write operations. WebSocket message rate limiting with escalating warnings
5. **Infrastructure:** Multi-stage Docker build, non-root user, `sync: false` for secrets in render.yaml, Redis internal-only access, auto-generated JWT_SECRET
6. **Error Handling:** Prisma errors never leak DB details, generic 500 responses in production, Sentry integration for monitoring
7. **SSRF Prevention:** Moltbook API URL allowlist validation
8. **WebSocket Security:** Origin verification, JWT authentication, token blocklist checks, message shape validation, known message type whitelist

### Priority Remediation Order

1. **C1** (Race condition in matchmaking) - Fix before horizontal scaling
2. **H3** (Client state mutation trust) - Fix before launch
3. **H1** (WebSocket origin bypass) - Fix before launch
4. **H2** (Token blocklist Redis failure) - Fix before launch
5. **M3** (end_game permission) - Fix before launch
6. **M2** (WebSocket payload size) - Quick fix
7. **M4** (CSRF cookie SameSite mismatch) - Test with actual Render domains
8. **M5** (Connection limit) - Implement before launch
9. **M6** (avatarUrl scheme) - Quick fix
10. **M1** (.env cleanup) - Housekeeping
11. Remaining Low/Info items at team discretion

---

_Report generated by Halldon Inc. Security Team_
_Audit methodology: Manual code review covering OWASP Top 10, WebSocket-specific attack vectors, infrastructure configuration, and authorization logic_
