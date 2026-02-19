# Moltblox Performance Audit

**Date**: 2026-02-11
**Auditor**: perf-auditor (Claude Opus 4.6)
**Scope**: Bundle size, rendering, game engine, server queries, WebSocket, Redis, fonts, third-party impact

---

## Executive Summary

The Moltblox codebase is architecturally sound but has **12 high-impact** and **10 medium-impact** performance issues. The largest wins come from (1) splitting the 80KB CreatureRPGRenderer out of the main bundle, (2) reducing RainbowKit/wagmi initial payload, (3) adding Redis pipelining to the session store, and (4) converting static pages to ISR. Combined, these changes could cut First Load JS by ~40KB and reduce TTFB on listing pages by 200-500ms.

---

## Finding Index

| #   | Impact | Area        | Summary                                                                    |
| --- | ------ | ----------- | -------------------------------------------------------------------------- |
| P1  | HIGH   | Bundle      | CreatureRPGRenderer.tsx is 80KB, loaded eagerly via game-builder transpile |
| P2  | HIGH   | Bundle      | SideBattlerRenderer.tsx is 54KB with inline sprite data                    |
| P3  | HIGH   | Bundle      | RainbowKit + wagmi + WalletConnect in root layout (all pages)              |
| P4  | HIGH   | Bundle      | Sentry Replay SDK loaded on every page (replaysSessionSampleRate: 0.1)     |
| P5  | HIGH   | Bundle      | All 7 game templates exported from @moltblox/game-builder index barrel     |
| P6  | HIGH   | Server      | Redis SCAN loop in findPlayerInQueues/removeFromQueues is O(N\*M)          |
| P7  | HIGH   | Server      | No Redis pipeline in spliceQueueFront (N sequential lpop calls)            |
| P8  | HIGH   | Server      | Session state stored as single JSON blob (full rewrite on every action)    |
| P9  | HIGH   | Prisma      | Tournament browse includes full `game` relation (all columns)              |
| P10 | HIGH   | Prisma      | Analytics playerSessionCounts groupBy loads all into memory                |
| P11 | HIGH   | Static      | Homepage is 'use client' with client-side data fetching                    |
| P12 | HIGH   | Static      | Games listing, marketplace, tournaments all client-rendered                |
| P13 | MEDIUM | Fonts       | 5 font files loaded as TTF (no WOFF2 compression)                          |
| P14 | MEDIUM | Fonts       | No font preload hints in layout.tsx                                        |
| P15 | MEDIUM | Game Engine | combatLog array grows unbounded in all game templates                      |
| P16 | MEDIUM | Game Engine | BaseGame.handleAction copies events array on every action                  |
| P17 | MEDIUM | Game Engine | CreatureRPGGame.handleMove allocates new objects on every step             |
| P18 | MEDIUM | WebSocket   | rateLimitMap never evicts entries for disconnected clients                 |
| P19 | MEDIUM | WebSocket   | JSON.stringify/parse on every message (no binary protocol)                 |
| P20 | MEDIUM | Images      | Hero images on landing page not using blur placeholder                     |
| P21 | MEDIUM | CSS         | Multiple infinite animations active on landing page simultaneously         |
| P22 | LOW    | Prisma      | Missing select in tournament game include (fetches all columns)            |

---

## Detailed Findings

### P1: CreatureRPGRenderer.tsx is 80KB [HIGH]

**File**: `apps/web/components/games/renderers/CreatureRPGRenderer.tsx`
**Current state**: 79,616 bytes. This single component is larger than many entire React applications. It is imported via the game template system and transpiled into the web bundle via `transpilePackages`. Even though the renderer is only needed on the `/games/play/creature-rpg` route, the `@moltblox/game-builder` barrel export means the entire game-builder package (including all 7 game classes) gets transpiled and potentially included in any chunk that imports the package.

**Proposed optimization**:

1. Lazy-load each renderer component with `next/dynamic` instead of static imports.
2. Split `CreatureRPGRenderer` into sub-components (BattleView, OverworldView, StarterSelect, DialogueBox). Each phase is self-contained.
3. Move the inline map rendering data (already in `creature-rpg-maps.ts`) and consider chunking the 600-row map arrays to load-on-demand.

**Estimated improvement**: ~60-80KB less in the main JS bundle for non-game pages.

---

### P2: SideBattlerRenderer.tsx + sprite data is 68KB [HIGH]

**File**: `apps/web/components/games/renderers/SideBattlerRenderer.tsx` (53,712 bytes) + `side-battler-sprites.ts` (14,161 bytes)
**Current state**: Sprite pixel arrays (WARRIOR_PIXELS, MAGE_PIXELS, etc.) are stored as TypeScript arrays of palette indices. These are large constant arrays that inflate the JS bundle.

**Proposed optimization**:

1. Move sprite data to static PNG assets or compressed binary files loaded at runtime via `fetch()`.
2. Use `next/dynamic` to lazy-load SideBattlerRenderer only when the user navigates to that specific game.
3. Consider generating sprites as `<canvas>` offscreen at load time from a compact binary format rather than shipping pixel arrays as JS.

**Estimated improvement**: ~50-60KB less in the shared chunk.

---

### P3: RainbowKit + wagmi + WalletConnect loaded globally [HIGH]

**File**: `apps/web/app/layout.tsx:7-10`, `apps/web/components/providers/Web3Provider.tsx`
**Current state**: `Web3Provider` is loaded with `dynamic({ ssr: false })` which is good, but the component itself imports RainbowKit CSS (`@rainbow-me/rainbowkit/styles.css`), wagmi config, and the full WalletConnect provider tree. These are loaded on EVERY page, including read-only pages like `/terms`, `/privacy`, and `/games` (browse).

RainbowKit + wagmi + viem + WalletConnect typically add 150-250KB of JS to the client bundle (gzipped: ~50-80KB).

**Proposed optimization**:

1. Move `Web3Provider` wrapping to only pages that need wallet interaction (`/wallet`, `/creator/dashboard`, `/marketplace` item purchase, `/games/[id]` with play).
2. For pages that only need to DISPLAY wallet state (e.g., Navbar connect button), use a lighter context that lazy-loads the full provider on first connect attempt.
3. Consider `@rainbow-me/rainbowkit` tree-shaking: import only `ConnectButton` and `darkTheme`, not the full kit.

**Estimated improvement**: ~40-60KB less First Load JS on non-wallet pages.

---

### P4: Sentry Replay SDK loaded globally [HIGH]

**File**: `apps/web/instrumentation-client.ts:8`
**Current state**: `replaysSessionSampleRate: 0.1` and `replaysOnErrorSampleRate: 1.0` means the Sentry Replay SDK (~40KB gzipped) is always loaded, even though it only records 10% of sessions. The replay SDK includes DOM mutation observers and network interception.

**Proposed optimization**:

1. Use Sentry's lazy-loading for Replay: `Sentry.replayIntegration({ lazyLoadReplay: true })`.
2. Or conditionally load the replay integration only after the page is interactive (using `requestIdleCallback`).
3. Keep `replaysOnErrorSampleRate: 1.0` but use lazy replay so the SDK loads only after an error occurs.

**Estimated improvement**: ~40KB less initial JS load for 90% of sessions.

---

### P5: game-builder barrel export ships all 7 game classes [HIGH]

**File**: `packages/game-builder/src/index.ts`
**Current state**: The index file re-exports all 7 game templates (ClickerGame, PuzzleGame, CreatureRPGGame, RPGGame, RhythmGame, PlatformerGame, SideBattlerGame). Because `next.config.mjs` has `transpilePackages: ['@moltblox/game-builder']`, webpack may include all game logic in chunks that only need one game.

CreatureRPGGame alone is 65KB of source. SideBattlerGame is 52KB. Combined, the 7 templates are ~175KB of TypeScript logic.

**Proposed optimization**:

1. Use subpath exports in `package.json`: `"@moltblox/game-builder/creature-rpg"` etc.
2. Each renderer already imports the specific game class. Change to deep imports: `import { CreatureRPGGame } from '@moltblox/game-builder/examples/CreatureRPGGame'`.
3. Alternatively, configure webpack `sideEffects: false` in the game-builder package.json to enable tree-shaking.

**Estimated improvement**: Each game page only loads its own template class (~10-65KB) instead of all 7 (~175KB).

---

### P6: Redis SCAN loop in findPlayerInQueues/removeFromQueues [HIGH]

**File**: `apps/server/src/ws/redisSessionStore.ts:121-137, 143-178`
**Current state**: Both `findPlayerInQueues` and `removeFromQueues` use Redis SCAN + LRANGE on every matching key to find a player. For each queue key found, it fetches the entire list and iterates through entries. With 100 active queues of 50 players each, this is 5,000 JSON.parse operations per call.

**Proposed optimization**:

1. Add a Redis Hash `player-queues` mapping `playerId -> gameId` (similar to `player-sessions`). Set on push, delete on remove.
2. `findPlayerInQueues` becomes a single `HGET player-queues playerId` (O(1)).
3. `removeFromQueues` becomes `HGET` + `LREM` on the specific queue key (O(N) for one list, not O(N\*M)).

**Estimated improvement**: O(1) lookup vs O(N\*M) scan. Under load with 100 queues, this is 1000x faster.

---

### P7: No Redis pipeline in spliceQueueFront [HIGH]

**File**: `apps/server/src/ws/redisSessionStore.ts:97-105`
**Current state**: `spliceQueueFront` calls `redis.lpop()` in a sequential loop, making N round-trips to Redis for N entries. With `count=2` (typical match), this is 2 round-trips, but could be worse for larger matches.

**Proposed optimization**:

1. Use Redis LPOP with count argument (Redis 6.2+): `redis.call('LPOP', key, count)` to pop multiple in one command.
2. Alternatively, use a Lua script or `redis.pipeline()` to batch the pops.
3. Also applies to the `cleanupAllSessions` function which deletes keys one batch at a time but could use `redis.pipeline()` for each batch.

**Estimated improvement**: 50% reduction in Redis round-trips during matchmaking.

---

### P8: Session state stored as single JSON blob [HIGH]

**File**: `apps/server/src/ws/redisSessionStore.ts:196-207`
**Current state**: `setSession` serializes the entire `ActiveSessionData` object to a single Redis key on every game action. This includes `actionHistory` (up to 500 entries) and `events` array. For CreatureRPG games, the state includes full map data, party creatures with all stats, and combat logs.

A single session could easily be 10-50KB of JSON. On every player action, this entire blob is serialized, sent to Redis, and deserialized on the next read.

**Proposed optimization**:

1. Use Redis Hashes instead of a single JSON key: store individual fields (`gameState`, `playerIds`, `currentTurn`, etc.) as hash fields.
2. Use `HSET` to update only the changed field instead of rewriting the entire blob.
3. Move `actionHistory` to a separate Redis List (RPUSH per action, LRANGE for replay).
4. Cap `events` array and move historical events to a separate key.

**Estimated improvement**: 5-10x less Redis bandwidth per action. Reduced serialization overhead.

---

### P9: Tournament browse includes full game relation [HIGH]

**File**: `apps/server/src/routes/tournaments.ts:83-94`
**Current state**: The tournament list endpoint includes `game: true`, which fetches ALL columns of the associated Game model for every tournament in the result. The Game model has large fields (description, screenshots array, wasmUrl, etc.) that are not needed for a browse listing.

**Proposed optimization**:

```
include: {
  game: {
    select: {
      id: true,
      name: true,
      slug: true,
      thumbnailUrl: true,
      genre: true,
    }
  }
}
```

**Estimated improvement**: 60-80% smaller response payloads on tournament listings.

---

### P10: Analytics playerSessionCounts groupBy loads all into memory [HIGH]

**File**: `apps/server/src/routes/games.ts:771-780`
**Current state**: The analytics endpoint runs `prisma.gameSessionPlayer.groupBy({ by: ['userId'] })` which fetches every unique player who ever played the game into memory, then counts them in JavaScript. For a popular game with 100K unique players, this loads 100K rows into Node.js memory.

**Proposed optimization**:

1. Use raw SQL with `COUNT(DISTINCT ...)`:

```sql
SELECT
  COUNT(DISTINCT "userId") AS total_unique,
  COUNT(DISTINCT CASE WHEN cnt > 1 THEN "userId" END) AS returning
FROM (
  SELECT "userId", COUNT(*) AS cnt
  FROM "game_session_players" gsp
  JOIN "game_sessions" gs ON gsp."sessionId" = gs.id
  WHERE gs."gameId" = $1
  GROUP BY "userId"
) sub
```

2. Or use two separate aggregate queries instead of loading all rows.

**Estimated improvement**: Constant memory usage regardless of player count. 10-100x faster for popular games.

---

### P11: Homepage is entirely client-rendered [HIGH]

**File**: `apps/web/app/page.tsx:1`
**Current state**: The homepage has `'use client'` at the top and fetches game data via `useGames()` and `usePlatformStats()` hooks. This means:

1. The server sends an empty shell.
2. The browser downloads JS, hydrates React, then makes API calls.
3. Users see a loading spinner during data fetch.

This is the WORST pattern for the most important page of the site: empty initial HTML, no SEO, slow perceived load.

**Proposed optimization**:

1. Convert to a Server Component that fetches data server-side.
2. Use React Server Components for the static parts (hero, stats grid).
3. Keep `useGames` for the trending games section as a client component island.
4. The hero section, bento grid, and metadata should be server-rendered for instant display and SEO.

**Estimated improvement**: 1-3 second faster perceived load (LCP). Full SEO indexing. Smaller client JS.

---

### P12: Listing pages are all client-rendered [HIGH]

**File**: `apps/web/app/games/page.tsx`, `apps/web/app/marketplace/page.tsx`, `apps/web/app/tournaments/page.tsx`
**Current state**: All listing pages use `'use client'` and fetch data via React Query hooks. Same problem as P11: empty HTML, spinner on load, no SEO.

**Proposed optimization**:

1. Fetch initial page data server-side and pass as props.
2. Use ISR (Incremental Static Regeneration) with `revalidate: 60` for the games list, marketplace items, and tournaments.
3. Keep client-side filtering/search as interactive client components.

**Estimated improvement**: Instant content on first paint. SEO for game/tournament pages. Reduced server load via caching.

---

### P13: Fonts loaded as TTF (no WOFF2) [MEDIUM]

**File**: `apps/web/app/globals.css:6-45`
**Current state**: All 5 font faces reference `.ttf` files. TTF files are significantly larger than WOFF2 (typically 2-3x). For PP Watch and PP Neue Montreal Mono, this could mean 200-500KB of uncompressed font data.

`font-display: swap` is correctly set, which prevents FOIT. Good.

**Proposed optimization**:

1. Convert all TTF files to WOFF2 using a tool like `woff2_compress`.
2. Update `@font-face` declarations to use `format('woff2')`.
3. WOFF2 typically achieves 30-50% compression over TTF.

**Estimated improvement**: 100-300KB less font download.

---

### P14: No font preload hints [MEDIUM]

**File**: `apps/web/app/layout.tsx`
**Current state**: No `<link rel="preload" as="font">` hints in the layout. The browser discovers font files only when CSS is parsed and a matching rule is encountered, causing a waterfall.

**Proposed optimization**:
Add preload hints for the most critical font weights (PP Watch Regular/Semibold for headlines, PP Neue Montreal Mono Regular for body):

```tsx
<link rel="preload" href="/fonts/pp-watch/PPWatch-Semibold.woff2" as="font" type="font/woff2" crossOrigin="" />
<link rel="preload" href="/fonts/pp-neue-montreal/PPNeueMontrealMono-Regular.woff2" as="font" type="font/woff2" crossOrigin="" />
```

**Estimated improvement**: 100-200ms faster font rendering on first visit.

---

### P15: combatLog grows unbounded in game templates [MEDIUM]

**File**: `packages/game-builder/src/examples/CreatureRPGGame.ts`, `SideBattlerGame.ts`
**Current state**: `data.combatLog.push(...)` is called on every action, hit, miss, status effect, level up, etc. The array is never trimmed. In a long CreatureRPG session (100+ encounters), this array could hold 500+ strings. Each time the state is serialized (for WebSocket broadcast, Redis storage, client render), the entire log is included.

**Proposed optimization**:

1. Cap `combatLog` to the most recent 50 entries using a ring buffer approach.
2. `data.combatLog.push(msg); if (data.combatLog.length > 50) data.combatLog.shift();`
3. Archive older entries separately if replay is needed.

**Estimated improvement**: Bounded memory usage. Faster serialization per action.

---

### P16: BaseGame.handleAction copies events array every call [MEDIUM]

**File**: `packages/game-builder/src/BaseGame.ts:141-142`
**Current state**: `return { ...result, newState: this.state, events: [...this.events] }` creates a new array copy of all events on every action. Events accumulate over the game lifetime.

**Proposed optimization**:

1. Clear events after each action return (the caller already has the copy).
2. Or use a `drainEvents()` method that returns and clears the array.
3. `const events = this.events; this.events = []; return { ...result, events };`

**Estimated improvement**: Eliminates O(N) array copy per action. Prevents event accumulation.

---

### P17: CreatureRPGGame.handleMove allocates on every step [MEDIUM]

**File**: `packages/game-builder/src/examples/CreatureRPGGame.ts:1055-1075`
**Current state**: Every movement action creates new `BattleState` objects (on encounter), new `Creature` objects (via `rollEncounter` -> `createCreature`), and performs `NPC_DEFS.find()` and `WARPS.find()` linear scans on every move.

**Proposed optimization**:

1. Pre-compute NPC positions as a Map keyed by `"mapId:x:y"` instead of linear scan.
2. Pre-compute warp points as a Map keyed by `"mapId:x:y"`.
3. These lookups happen on EVERY movement action and are currently O(N).

**Estimated improvement**: O(1) NPC/warp lookups instead of O(N). Measurable for server-side game execution.

---

### P18: rateLimitMap never evicts disconnected clients [MEDIUM]

**File**: `apps/server/src/ws/index.ts:44, 162, 233`
**Current state**: The `rateLimitMap` deletes entries on disconnect (`rateLimitMap.delete(clientId)`), which is correct. However, if a client disconnects without the `close` event firing (e.g., network drop), the heartbeat timer cleans up from `clients` map but the rate limit map entry for the playerId may persist. Over time with many connections, this map grows.

**Proposed optimization**:

1. Add periodic cleanup of stale entries in `rateLimitMap` (e.g., remove entries older than 5 minutes with no activity).
2. Or use a WeakRef-based approach tied to the client object lifecycle.

**Estimated improvement**: Prevents slow memory growth under sustained load.

---

### P19: WebSocket uses JSON for all messages [MEDIUM]

**File**: `apps/server/src/ws/index.ts:213, sessionManager.ts`
**Current state**: Every WebSocket message is JSON.stringify on send, JSON.parse on receive. For high-frequency game actions (e.g., PlatformerGame tick actions at 60fps), this creates significant serialization overhead.

**Proposed optimization**:

1. For game state updates (the most frequent messages), consider using MessagePack or a binary protocol.
2. Alternatively, send delta updates instead of full state on each action.
3. The SpectatorHub in `packages/engine` already has a `StateDelta` concept: adopt this in the WS layer.

**Estimated improvement**: 30-60% less bandwidth for game state updates. Faster parse times.

---

### P20: Hero images missing blur placeholder [MEDIUM]

**File**: `apps/web/app/page.tsx:31-37`
**Current state**: The hero `<Image>` uses `priority` (good) but no `placeholder="blur"` or `blurDataURL`. On slow connections, the hero area is blank until the large image loads.

**Proposed optimization**:

1. Generate base64 blur placeholders for hero images using `plaiceholder` or Next.js static import.
2. Add `placeholder="blur"` and `blurDataURL` to the hero Image components.

**Estimated improvement**: Perceived instant load for hero section (progressive rendering).

---

### P21: Multiple infinite CSS animations on landing page [MEDIUM]

**File**: `apps/web/app/globals.css:274-290`, `apps/web/app/page.tsx:71-72,89-90,105-106`
**Current state**: The bento grid uses `animate-float-slow` (6s infinite animation) on three `<Image>` elements simultaneously. Combined with `animate-fade-in-up`, `animate-scale-in`, and other animations, the landing page has 8+ simultaneous animations running.

Each CSS animation triggers compositor layer creation and continuous repaints. On lower-end devices, this causes dropped frames and increased power consumption.

**Proposed optimization**:

1. Use `will-change: transform` on animated elements to promote to compositor layers.
2. Consider using `transform: translateZ(0)` to force GPU compositing.
3. Stop animations when elements are offscreen using IntersectionObserver.
4. Reduce the number of simultaneously animated elements: the float animation on 3 large images is the main offender.

**Estimated improvement**: Smoother scrolling, 20-40% less GPU usage on landing page.

---

### P22: Tournament game include fetches all columns [LOW]

**File**: `apps/server/src/routes/tournaments.ts:83`
**Current state**: `include: { game: true }` fetches every column of the Game model including description, wasmUrl, screenshots[], etc. Only name, slug, thumbnailUrl, and genre are typically needed for tournament listing cards.

**Proposed optimization**: Use `select` instead of `include: true`:

```typescript
game: {
  select: { id: true, name: true, slug: true, thumbnailUrl: true, genre: true }
}
```

**Estimated improvement**: Smaller SQL query, less data transfer from DB.

---

## Summary Table

| Category               | High   | Medium | Low   | Total  |
| ---------------------- | ------ | ------ | ----- | ------ |
| Bundle / First Load JS | 5      | 0      | 0     | 5      |
| Server / Redis         | 3      | 2      | 0     | 5      |
| Prisma / DB            | 2      | 0      | 1     | 3      |
| Static / ISR           | 2      | 0      | 0     | 2      |
| Game Engine            | 0      | 3      | 0     | 3      |
| Fonts                  | 0      | 2      | 0     | 2      |
| CSS / Images           | 0      | 2      | 0     | 2      |
| **Total**              | **12** | **9**  | **1** | **22** |

## Priority Recommendations (in order of impact/effort ratio)

1. **P11+P12**: Convert homepage and listing pages to server components with ISR. Biggest UX win, moderate effort.
2. **P5**: Add `sideEffects: false` to game-builder package.json and use deep imports. Quick fix, large bundle savings.
3. **P1+P2**: Lazy-load game renderers with `next/dynamic`. Each renderer only loads on its route.
4. **P6+P7**: Add `player-queues` Redis Hash and pipeline spliceQueueFront. Critical for scale.
5. **P13**: Convert fonts to WOFF2. One-time conversion, permanent savings.
6. **P9+P22**: Add `select` to tournament game includes. Trivial fix.
7. **P4**: Enable lazy Sentry Replay. One-line config change.
8. **P3**: Scope Web3Provider to wallet-requiring pages. Moderate refactor.
9. **P8**: Migrate session storage from JSON blob to Redis Hashes. Larger refactor, high scaling benefit.
10. **P10**: Replace groupBy with raw SQL aggregate. Quick fix for analytics endpoint.
