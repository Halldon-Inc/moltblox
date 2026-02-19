# Moltblox Code Quality Audit Report

**Date:** 2026-02-11
**Scope:** Full codebase review with focus on Render migration, Redis session store, WebSocket architecture, and monorepo health.
**Auditor:** Claude Opus 4.6 (code-reviewer)

## Summary

The codebase is well-structured with solid fundamentals: strict TypeScript, Zod validation, CSRF protection, rate limiting, and proper error handling. The Render migration is cleanly implemented. The findings below are ordered by severity.

---

## Critical

### CQ-01: spliceQueueFront is not atomic in Redis (race condition)

**File:** `apps/server/src/ws/redisSessionStore.ts:97-105`

The function uses a sequential loop of individual `lpop` calls to dequeue matched players. Between two separate `lpop` commands, a concurrent server instance could also pop the same queue, resulting in a match with fewer than `maxPlayers` or duplicate pops across instances.

```typescript
for (let i = 0; i < count; i++) {
  const raw = await redis.lpop(key);
  if (!raw) break;
  results.push(JSON.parse(raw) as QueueEntry);
}
```

The JSDoc comment says "Uses a Redis transaction to pop atomically" but the implementation does not use a transaction (`multi/exec`) or a Lua script.

**Impact:** In multi-instance deployments (Render horizontal scaling), two server instances processing the same queue simultaneously can pull overlapping players, creating broken sessions.

**Recommendation:** Use a Lua script or `redis.multi()` pipeline to atomically pop `count` items in a single round-trip.

---

### CQ-02: Player-session mapping functions are exported but never used

**File:** `apps/server/src/ws/redisSessionStore.ts:229-257`

`setPlayerSession`, `getPlayerSession`, and `deletePlayerSession` are defined and exported but never imported or called anywhere in the codebase (confirmed by grep). This means player-to-session mapping is never populated in Redis.

**Impact:** If these were intended to support cross-instance session rejoin (finding which session a player belongs to), that feature is silently broken. The `rejoinSession` function in `sessionManager.ts` requires the caller to already know the `sessionId`, so it works, but there is no way to discover a player's session from a different server instance.

**Recommendation:** Either wire these functions into `createSession`/`endSession`/`leaveSession`/`handleDisconnect` to maintain the mapping, or remove them as dead code.

---

## High

### CQ-03: buildCommand in render.yaml contains debug output

**File:** `render.yaml:63`

The web service buildCommand includes debug `echo` and `find` statements that will run on every production build:

```yaml
buildCommand: "NODE_ENV=development HUSKY=0 pnpm install ... && echo '=== STANDALONE DEBUG ===' && echo STANDALONE=$STANDALONE && ls -la apps/web/.next/standalone/ 2>/dev/null || echo 'NO standalone dir' && find apps/web/.next/standalone -name 'server.js' -type f 2>/dev/null || echo 'NO server.js found'"
```

**Impact:** Adds noise to build logs. The `find` command could slow down builds slightly. More importantly, it signals unfinished migration work.

**Recommendation:** Remove all debug echo/ls/find statements. The build should be:

```yaml
buildCommand: 'NODE_ENV=development HUSKY=0 pnpm install --frozen-lockfile && pnpm build --filter=@moltblox/web...'
```

---

### CQ-04: `cleanupAllSessions` is exported but never called

**File:** `apps/server/src/ws/redisSessionStore.ts:296-332`

The cleanup function is defined but never invoked. Meanwhile, `index.ts:136` marks stale DB sessions as abandoned on boot, but the corresponding Redis session/queue keys are not cleaned.

**Impact:** After a server crash, stale Redis keys from the previous instance persist until their TTL expires (24 hours for sessions, 1 hour for queues). The `player-sessions` hash has no TTL at all, so it grows indefinitely.

**Recommendation:** Call `cleanupAllSessions(redis)` during the boot sequence in `index.ts`, after the stale DB session cleanup.

---

### CQ-05: events array in ActiveSessionData grows unbounded

**File:** `apps/server/src/ws/sessionManager.ts:329`

While `actionHistory` is bounded to `MAX_ACTION_HISTORY` (500 entries), the `events` array on the session has no such limit:

```typescript
session.events.push(...events);
```

Each action generates 1-2 events. Over a long game, this array grows without bound, increasing the size of every Redis write (`JSON.stringify(session)`) and read.

**Impact:** Memory bloat in Redis; increasingly slow serialization/deserialization. For active games with hundreds of turns, this could become a performance bottleneck.

**Recommendation:** Apply the same bounded-history pattern: keep only the last N events (e.g., 500), or flush older events to the database.

---

### CQ-06: No test coverage for redisSessionStore

**File:** `apps/server/src/__tests__/` (missing `redisSessionStore.test.ts`)

Grep confirms no test file imports from `redisSessionStore.ts`. The Redis session layer is completely untested. This is the most critical new code from the Render migration.

**Impact:** Bugs in queue operations, session TTL, cleanup, and pub/sub go undetected.

**Recommendation:** Add unit tests with a mock Redis client covering at minimum: `pushToQueue`/`spliceQueueFront` atomicity, `getSession`/`setSession` serialization roundtrip, TTL verification, `findPlayerInQueues` scan logic, and in-memory fallback behavior.

---

## Medium

### CQ-07: Leftover Vercel configuration file

**File:** `apps/web/vercel.json`

A complete Vercel config file still exists after migrating to Render:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "cd ../.. && pnpm build --filter=@moltblox/web",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "outputDirectory": ".next"
}
```

**Impact:** Confusing for contributors. If someone accidentally deploys to Vercel, this config would take effect.

**Recommendation:** Delete `apps/web/vercel.json`.

---

### CQ-08: Stale Vercel references in documentation

**Files:**

- `docs/moltblox-prd-remaining.md:72` references "Set up Vercel project"
- `docs/moltblox-prd-remaining.md:310` references "Hosting (Vercel + Railway)"
- `docs/session-log-2026-02-04.md:101` references "Vercel + Railway + Neon + Upstash"

**Impact:** Misleading documentation after Render migration.

**Recommendation:** Update docs to reflect Render hosting.

---

### CQ-09: Dockerfile copies full root node_modules into production image

**File:** `apps/server/Dockerfile:57`

```dockerfile
COPY --from=build /app/node_modules /app/node_modules
```

This copies the entire root `node_modules` (including devDependencies from the build stage) into the production image. The comment says "hoisted dependencies" but pnpm's strict node_modules structure means this includes build-only packages.

**Impact:** Significantly larger production Docker image than necessary (potentially hundreds of MB of dev dependencies).

**Recommendation:** Add a production-only install step in the final stage, or use `pnpm deploy` to create a pruned production directory.

---

### CQ-10: Redis `lazyConnect` requires explicit connect, but tokenBlocklist uses Redis immediately

**File:** `apps/server/src/lib/redis.ts:22` and `apps/server/src/lib/tokenBlocklist.ts`

Redis is created with `lazyConnect: true`, and `redis.connect()` is called during boot in `index.ts:112`. However, `tokenBlocklist.ts` (imported during module loading via `auth.ts`) uses `redis.set` and `redis.exists` directly. If any auth route is hit between module load and the explicit `connect()` call, Redis commands will queue silently.

With ioredis `lazyConnect`, commands issued before `connect()` are queued and sent once connected. This is technically fine, but if `connect()` fails, those queued commands will also fail, and the error path in `index.ts:113` says "rate limiting and token blocklist will not work" but the server continues. Those queued commands will reject, potentially causing unhandled promise rejections.

**Impact:** If Redis is down at boot, authentication attempts will throw unhandled errors from the blocklist check.

**Recommendation:** Wrap `isTokenBlocked` calls in try/catch that default to `false` when Redis is unavailable, matching the fallback pattern used in `redisSessionStore.ts`.

---

### CQ-11: `findPlayerInQueues` does full SCAN + LRANGE on every queue call

**File:** `apps/server/src/ws/redisSessionStore.ts:121-137`

This function scans ALL `mq:*` keys and reads every element of every queue to find a single player. Called on every `joinQueue` invocation.

**Impact:** O(total_queued_players) per join operation. With many active queues, this becomes a performance bottleneck.

**Recommendation:** Maintain a separate Redis Set or Hash (`queued-players`) mapping `playerId` to `gameId`, updated atomically with `pushToQueue` and `removeFromQueues`.

---

### CQ-12: `removeFromQueues` has similar O(N) scanning issue

**File:** `apps/server/src/ws/redisSessionStore.ts:143-179`

Same SCAN + LRANGE pattern as `findPlayerInQueues`.

**Impact:** Same O(total_queued_players) concern on every disconnect.

**Recommendation:** Same as CQ-11: maintain a player-to-queue index.

---

### CQ-13: WebSocket test duplicates entire handleMessage implementation

**File:** `apps/server/src/__tests__/ws.test.ts:198-396`

The test file re-implements the entire `handleMessage` function from `ws/index.ts` (approximately 200 lines) rather than importing and testing the actual code. The duplicated code is missing the `reconnect` message type (lines 90-101 vs. ws/index.ts lines 46-57).

**Impact:** Tests pass even if the real implementation diverges. The test validates its own copy, not the production code. This is a false-confidence risk.

**Recommendation:** Refactor to test the actual `handleMessage` from `ws/index.ts` by extracting it as a testable export, or start the real WebSocket server in the test.

---

### CQ-14: `player-sessions` Redis hash has no TTL

**File:** `apps/server/src/ws/redisSessionStore.ts:238`

```typescript
await redis.hset('player-sessions', playerId, sessionId);
```

This hash never expires. Individual entries are not deleted unless `deletePlayerSession` is called (which itself is never called, per CQ-02).

**Impact:** Unbounded growth of the `player-sessions` key in Redis.

**Recommendation:** Either use individual keys with TTL (`player-session:{playerId}` with `EX`) or ensure `deletePlayerSession` is called on session end/player disconnect.

---

## Low

### CQ-15: `as any` usage in production source code

**Files:**

- `apps/server/src/routes/games.ts:293` and `:404` for Prisma error code access
- `apps/server/src/middleware/validate.ts:11` and `:14` for req.params/query casting

**Impact:** Bypasses TypeScript's type safety.

**Recommendation:** For Prisma errors, use a type guard like `isPrismaError(err)` that checks for `code` property. For validate.ts, use proper Express type augmentation.

---

### CQ-16: `NODE_ENV=development` in render.yaml web buildCommand

**File:** `render.yaml:63`

Setting `NODE_ENV=development` during build is necessary to install devDependencies (per the memory note about pnpm skipping devDeps). However, this means Next.js builds in development mode by default, which disables optimizations.

**Impact:** The `pnpm build` command for Next.js should still use production mode internally (Next.js respects its own config), but this could cause confusion and should be explicitly documented.

**Recommendation:** Consider using `--prod=false` flag on `pnpm install` instead, and letting `NODE_ENV` be production for the build step itself: `pnpm install --frozen-lockfile --prod=false && NODE_ENV=production pnpm build --filter=@moltblox/web...`

---

### CQ-17: Missing `rejoinSession` in the `reconnect` message type in test

**File:** `apps/server/src/__tests__/ws.test.ts:90-101`

The `VALID_MESSAGE_TYPES` set in the test file is missing `'reconnect'`, which was added to `ws/index.ts`. This means the test's duplicated routing logic would reject reconnect messages as "unknown".

**Impact:** Reconnection flow is untested.

**Recommendation:** Add `'reconnect'` to the test's `VALID_MESSAGE_TYPES`, or better yet, fix CQ-13 to test the real implementation.

---

### CQ-18: Turbo pipeline missing `db:generate` in build dependencies

**File:** `turbo.json`

The `build` task depends on `^build` (workspace dependencies), but the server's `build` script runs `prisma generate && tsc`. Turbo has no visibility into the Prisma generate step as a cacheable task.

**Impact:** Turbo's caching may produce stale builds if the Prisma schema changes but Turbo's hash does not include `prisma/schema.prisma` as an input.

**Recommendation:** Add `db:generate` as a separate Turbo task with explicit inputs (`prisma/schema.prisma`) and make `build` depend on it for the server package.

---

### CQ-19: Health check returns 200 even when Redis is down

**File:** `apps/server/src/app.ts:160-163`

The health endpoint returns `ok` (200) as long as the database is reachable, regardless of Redis status. Redis failure is only reflected in the `dependencies.redis` field.

**Impact:** Render's health check (configured at `/health`) will consider the service healthy even when Redis is down, meaning rate limiting, token blocklist, and session state are all non-functional.

**Recommendation:** Consider returning `degraded` (503) when Redis is down too, or at minimum document this as a known limitation for Render's health check configuration.

---

### CQ-20: WebSocket pnpm overrides in root package.json

**File:** `package.json:48-51`

```json
"overrides": {
  "glob@>=10.2.0 <10.5.0": ">=10.5.0",
  "axios@<=1.13.4": ">=1.13.5"
}
```

These overrides patch known CVEs which is good practice. However, they should be periodically reviewed to ensure the upstream packages have released fixes that make overrides unnecessary.

**Impact:** Low risk; overrides are appropriate security patches.

**Recommendation:** Add a comment noting which CVEs these address and review quarterly.

---

## Info

### CQ-21: Server Dockerfile uses `npx prisma migrate deploy` at runtime

**File:** `apps/server/Dockerfile:64`

Running migrations at container start is a common pattern but has risks: if two instances start simultaneously (Render scale-up), both will attempt to run migrations concurrently.

**Recommendation:** Consider running migrations as a separate Render job or pre-deploy hook instead of at container start.

---

### CQ-22: `strict: true` in tsconfig.base.json

The monorepo enforces strict TypeScript, which is excellent. All packages inherit from `tsconfig.base.json` with `strict: true`, `forceConsistentCasingInFileNames: true`, and modern ESM (`NodeNext` module resolution).

---

### CQ-23: Good error handling patterns throughout

The codebase consistently uses:

- `AppError` hierarchy with proper HTTP status codes
- Sentry integration for error tracking
- DB error sanitization (never leaks Prisma details)
- Timing-safe CSRF comparison
- Graceful shutdown with timeout fallback

---

### CQ-24: Solid WebSocket security

The WS layer implements:

- Origin validation against CORS_ORIGIN
- JWT authentication with blocklist support
- Per-client rate limiting with progressive warnings
- HTML sanitization for chat messages
- Message shape validation before routing
- Auth-gated message types

---

### CQ-25: Well-structured monorepo

The Turborepo configuration is clean with proper `dependsOn` chains, cache outputs, and persistent dev tasks. The pnpm workspace config correctly includes apps, packages, and contracts.

---

## Findings Summary

| Severity | Count | IDs                        |
| -------- | ----- | -------------------------- |
| Critical | 2     | CQ-01, CQ-02               |
| High     | 4     | CQ-03, CQ-04, CQ-05, CQ-06 |
| Medium   | 8     | CQ-07 through CQ-14        |
| Low      | 6     | CQ-15 through CQ-20        |
| Info     | 5     | CQ-21 through CQ-25        |

**Top 3 priorities for remediation:**

1. **CQ-01** (Critical): Make `spliceQueueFront` truly atomic with a Lua script or multi/exec
2. **CQ-06** (High): Add test coverage for `redisSessionStore.ts`
3. **CQ-05** (High): Bound the `events` array in `ActiveSessionData`
