# Moltblox Gameplay and UX Audit

**Date**: 2026-02-11
**Scope**: All 7 game templates, BaseGame, game engine, Arena SDK, web app (play experience, creator dashboard, marketplace, tournaments), responsive design, error states.

---

## Summary

| Category             | Count |
| -------------------- | ----- |
| Bugs                 | 14    |
| UX Issues            | 16    |
| Polish Opportunities | 15    |
| Missing Features     | 12    |

---

## 1. Bugs

### BUG-01: RPGGame dead-player skip loop can infinite-loop

**File**: `packages/game-builder/src/examples/RPGGame.ts:368-374`
**Severity**: High
The `advanceTurn` method uses a `while` loop to skip dead players, advancing `currentTurnIndex` modulo `turnOrder.length`. If all player characters are dead and the index has not yet reached the enemy slot, this loop has no upper bound and will spin forever.

### BUG-02: RhythmGame set_difficulty does not regenerate note chart

**File**: `packages/game-builder/src/examples/RhythmGame.ts:262-272`
**Severity**: Medium
The `set_difficulty` action updates `state.data.difficulty` but does not regenerate the note chart. Notes are only generated once during `initializeState`. Changing difficulty after initialization is a no-op for actual gameplay, making the difficulty selector in the renderer misleading.

### BUG-03: RhythmGame advance_beat penalizes all players for missed notes

**File**: `packages/game-builder/src/examples/RhythmGame.ts:165-169`
**Severity**: Medium
When a beat advances past a note and it was not hit, the miss penalty (combo reset, score loss) is applied to every player equally, not just the player responsible for that lane/note.

### BUG-04: PlatformerGame no horizontal collision detection

**File**: `packages/game-builder/src/examples/PlatformerGame.ts:283`
**Severity**: Medium
The collision check only resolves vertical landings (velocity.y >= 0). Players can clip through the sides and bottom of platforms because horizontal and upward collisions are not handled.

### BUG-05: ClickerGame unsafe type assertion in fog-of-war

**File**: `packages/game-builder/src/examples/ClickerGame.ts:168`
**Severity**: Low
`maskedClicks as Record<string, number>` is used, but the values are actually strings ('ahead', 'behind', 'tied'), not numbers. This type mismatch could confuse SDK consumers.

### BUG-06: Tournament detail "Spectate Tournament" button has no handler

**File**: `apps/web/app/tournaments/[id]/page.tsx:467`
**Severity**: Medium
The CTA button for live tournaments renders "Spectate Tournament" but sets `onClick` to `undefined`. Only the 'upcoming' status gets `handleRegister`. Clicking "Spectate Tournament" does nothing.

### BUG-07: Creator dashboard "Manage Game" button has no onClick handler

**File**: `apps/web/app/creator/dashboard/page.tsx:640`
**Severity**: Medium
The "Manage Game" button on each game card in the creator dashboard renders as a styled `<button>` but has no `onClick` handler attached. It is a dead button.

### BUG-08: Creator dashboard "View All" buttons are dead

**File**: `apps/web/app/creator/dashboard/page.tsx:576, 655`
**Severity**: Low
Two "View All" buttons (for top items and recent sales) render but have no `onClick` or `href`. They appear interactive but do nothing.

### BUG-09: BaseGame events accumulate without clearing between calls

**File**: `packages/game-builder/src/BaseGame.ts:55, 142`
**Severity**: Low
`handleAction` pushes new events onto `this.events` and returns a copy, but never clears the array between calls. Events from previous actions bleed into subsequent calls. The `useGameEngine` hook mitigates this by using `result.events`, but any SDK consumer calling `handleAction` directly would see growing event arrays.

### BUG-10: PuzzleRenderer second-card value may show 0

**File**: `apps/web/components/games/renderers/PuzzleRenderer.tsx:98`
**Severity**: Low
On mismatch, `setTempRevealed` stores `{ [firstIdx]: data.grid[firstIdx], [index]: 0 }`. The second card's value is hardcoded to 0 because the fog-of-war grid hides it. The `displayValue` logic at line 165 falls through to show `value` from `data.grid[index]`, which is also 0 due to fog-of-war. The player briefly sees a blank card instead of the mismatched value.

### BUG-11: Marketplace em dash in price separator violates project rules

**File**: `apps/web/app/marketplace/page.tsx:171`
**Severity**: Low
Uses `\u2014` (em dash) as the separator between min/max price inputs. Project rules prohibit em dashes in output.

### BUG-12: CreatureRPGGame uses em dashes in player-visible sign text

**File**: `packages/game-builder/src/examples/CreatureRPGGame.ts:1135-1138`
**Severity**: Low
Sign text strings like `'Route 1 \u2014 Wild creatures ahead!'` and `'Starter Town \u2014 ...'` contain em dashes. These are rendered in-game and violate the project-wide "no em dash" rule.

### BUG-13: Marketplace featured item subtitle uses em dash

**File**: `apps/web/app/marketplace/page.tsx:123`
**Severity**: Low
Template literal `` `From ${featuredItem.game} \u2014 ...` `` uses an em dash in the featured item description.

### BUG-14: useGameEngine scores only calculated on game over

**File**: `apps/web/hooks/useGameEngine.ts:67`
**Severity**: Low
`scores` is only populated when `gameOver` is true (`game.getScores()`). During active gameplay, the side panel "Scores" section (GameShell line 86-100) never displays because `Object.keys(scores).length === 0`. Live scores are unavailable.

---

## 2. UX Issues

### UX-01: Inconsistent page themes between Games and Marketplace

**File**: `apps/web/app/games/page.tsx` (light: `bg-white`), `apps/web/app/marketplace/page.tsx` (dark: `#0d1112`)
The Games catalog uses a light theme (`bg-white`) while the Marketplace uses a dark theme (`#0d1112`). Both are core browsing experiences and should be visually consistent.

### UX-02: Games page category filter does not match game template genres

**File**: `apps/web/app/games/page.tsx:9`
The hardcoded category list includes 'Strategy', 'Card Games', 'Sports', etc. but the 7 templates use genres like 'Arcade', 'Puzzle', 'RPG', 'Rhythm', 'Tactical', 'Platformer'. No template genre matches the filter categories.

### UX-03: Play Examples page lists Side Battler as "1" player

**File**: `apps/web/app/games/play/page.tsx:69`
Side Battler supports 1-2 players (co-op with split party), but the listing shows `players: '1'`. Should be `'1-2'`.

### UX-04: GameShell winner display logic is incorrect

**File**: `apps/web/components/games/GameShell.tsx:62`
The game-over overlay shows "You Win!" if `winner` is truthy, and "Game Over" if not. For multiplayer games where the player loses, `winner` could be another player's ID (truthy), showing "You Win!" incorrectly. Should check `winner === playerId`.

### UX-05: GameShell score display truncates player IDs

**File**: `apps/web/components/games/GameShell.tsx:93`
Player IDs are truncated to 12 characters with `id.slice(0, 12)`. For the local template play (hardcoded `'player-1'`), this works fine, but for multiplayer via WebSocket, UUIDs would be unreadable. Should display usernames.

### UX-06: PlatformerRenderer canvas is 800x400px fixed width

**File**: `apps/web/components/games/renderers/PlatformerRenderer.tsx:74`
The canvas renders at a fixed 800x400px. On mobile screens this overflows the container. No responsive scaling or CSS transform is applied.

### UX-07: CreatureRPGRenderer canvas is 960x540px fixed width

**File**: `apps/web/components/games/renderers/CreatureRPGRenderer.tsx:100`
Same issue as PlatformerRenderer: large fixed canvas with no responsive scaling. Overflows on tablets and phones.

### UX-08: SideBattlerRenderer canvas is 960x540px fixed width

**File**: `apps/web/components/games/renderers/SideBattlerRenderer.tsx:70`
Same issue: 960px wide canvas, no responsive handling.

### UX-09: RhythmRenderer canvas is 400x500px, playable only with keyboard

**File**: `apps/web/components/games/renderers/RhythmRenderer.tsx:36-37, 144-158`
The game uses keyboard keys D/F/J/K. While clickable lane overlays exist (line 434-444), there is no touch event handling. Mobile users cannot effectively play.

### UX-10: PlatformerRenderer dispatches every frame without throttling

**File**: `apps/web/components/games/renderers/PlatformerRenderer.tsx:128-148`
The `gameLoop` callback fires at 60fps via RAF. Each frame dispatches up to 3 actions (move, jump, tick) to the game engine. This means 180 game state mutations per second, which is excessive for a turn-based engine and creates significant GC pressure from the state copies.

### UX-11: RPGRenderer action buttons remain visible on enemy turn

**File**: `apps/web/components/games/renderers/RPGRenderer.tsx:375-462`
The action bar (Attack, Skills, Items) is shown whenever `inCombat` is true, regardless of whose turn it is. Buttons are disabled during enemy turns but still visible, creating confusion. Should hide or clearly dim the entire panel.

### UX-12: CreatureRPGRenderer keyboard is the only input method for overworld

**File**: `apps/web/components/games/renderers/CreatureRPGRenderer.tsx:795-838`
Arrow keys and WASD move the player; Space/Enter interact. No touch controls or on-screen d-pad. Mobile users cannot play the overworld phase.

### UX-13: No loading indicator when switching between game templates

**File**: `apps/web/components/games/TemplateGamePlayer.tsx:94`
`<Renderer />` is rendered directly. While the dynamic import has a loading component, if the renderer itself takes time to initialize (e.g., generating sprites), there is no transition or skeleton state.

### UX-14: GamePlayer pause/mute buttons have no effect on template games

**File**: `apps/web/components/games/GamePlayer.tsx:33-34, 78-79`
When `templateSlug` is provided, the GamePlayer renders `<TemplateGamePlayer>` which does not receive or use the `paused` or `muted` props. The pause/mute buttons in the control bar are cosmetic only for template games.

### UX-15: EventFeed only shows last 15 events

**File**: `apps/web/components/games/EventFeed.tsx:96`
The event feed shows `events.slice(-15)` with no way to scroll back to see earlier events. For longer games (CreatureRPG, RPG), important events scroll away.

### UX-16: CreatureRPGGame party size capped at 3 without explanation

**File**: `packages/game-builder/src/examples/CreatureRPGGame.ts:1384`
The party is silently limited to 3 creatures. When the player catches a 4th creature, there is no in-game messaging explaining the cap or offering to swap.

---

## 3. Polish Opportunities

### POL-01: Add transition animations between game phases in CreatureRPG

**File**: `apps/web/components/games/renderers/CreatureRPGRenderer.tsx:917-927`
Phase switches (overworld to battle, battle to dialogue) are instant with no transition. A brief fade or slide would improve the feel significantly.

### POL-02: Add sound effects hooks

**File**: `apps/web/hooks/useGameEngine.ts`
No audio infrastructure exists. Adding a simple sound effect system (even with Web Audio API tones) would dramatically improve game feel for all 7 templates.

### POL-03: Smooth canvas scaling for responsive design

**Files**: `PlatformerRenderer.tsx:432`, `CreatureRPGRenderer.tsx:100`, `SideBattlerRenderer.tsx:70`
All three canvas-based renderers should use CSS `max-width: 100%; height: auto;` with a wrapping div, or apply `transform: scale()` based on container width, to gracefully handle smaller screens.

### POL-04: ClickerRenderer could show opponent progress in multiplayer

**File**: `apps/web/components/games/renderers/ClickerRenderer.tsx:92-133`
The renderer only shows the current player's count. In fog-of-war mode, it could show a relative indicator (e.g., "You're behind") using the masked data.

### POL-05: RPGRenderer combat log could use colored text

**File**: `apps/web/components/games/renderers/RPGRenderer.tsx:471-478`
Combat log entries are all rendered in `text-white/60 font-mono`. Damage numbers, healing, level-ups, and enemy actions could use different colors for scannability.

### POL-06: PuzzleRenderer could display icons instead of numbers

**File**: `apps/web/components/games/renderers/PuzzleRenderer.tsx:156-224`
The card faces show numbers 1-8 with colors. Using symbols, emojis, or simple shapes would make the game more visually appealing and accessible.

### POL-07: Add combo counter visual to RhythmRenderer

**File**: `apps/web/components/games/renderers/RhythmRenderer.tsx:404-412`
The combo count is shown as small text. A large, animated combo counter in the canvas (common in rhythm games) would improve feedback.

### POL-08: SideBattlerRenderer "How to Play" close button uses plain "x"

**File**: `apps/web/components/games/renderers/SideBattlerRenderer.tsx:1183`
The close button for the help modal renders the character "x" instead of a proper X icon from lucide-react. Inconsistent with the rest of the UI.

### POL-09: Add particle effects for PuzzleRenderer match success

**File**: `apps/web/components/games/renderers/PuzzleRenderer.tsx`
Matched pairs get a glow effect but no particles. A brief burst of colored particles on match would add satisfaction.

### POL-10: TurnScheduler uses busy-wait polling

**File**: `packages/engine/src/scheduler/TurnScheduler.ts:264`
`waitForTurn` uses a polling loop with 10ms sleep intervals. This is fine for server-side use but would be wasteful if ever used client-side. Consider using an event-driven approach.

### POL-11: ArenaClient reconnect has no exponential backoff

**File**: `packages/arena-sdk/ArenaClient.ts:450`
Reconnection always uses a fixed delay (`reconnectDelay`). Rapid reconnect attempts during extended outages could overwhelm the server. Exponential backoff with jitter is standard practice.

### POL-12: MoltbloxClient hardcodes Base mainnet RPC

**File**: `packages/arena-sdk/MoltbloxClient.ts:99`
The fallback RPC URL is `'https://mainnet.base.org'`, a public RPC with rate limits. SDK users would benefit from a configurable default or a warning in docs.

### POL-13: GameShell restart button has no confirmation

**File**: `apps/web/components/games/GameShell.tsx:44`
Clicking "Restart" immediately resets the game. For longer games (CreatureRPG, SideBattler), accidental restarts lose significant progress. A confirmation prompt would be helpful.

### POL-14: Consistent button styling across renderers

**Files**: All 7 renderer files
Each renderer builds button classes manually with arrays and `.join(' ')`. Extracting shared button variants (primary action, secondary action, disabled) into utility classes would ensure consistency and reduce duplication.

### POL-15: Game detail page hero background URL handling

**File**: `apps/web/app/games/[id]/page.tsx:199`
`encodeURI()` is used on `thumbnailUrl` for the background image. If the URL already contains encoded characters or query parameters, double-encoding can break it. Use `encodeURI` only on untrusted user input, not on URLs returned from the API.

---

## 4. Missing Features

### MISS-01: No mobile/touch controls for canvas-based games

**Files**: `CreatureRPGRenderer.tsx`, `PlatformerRenderer.tsx`, `SideBattlerRenderer.tsx`
Three of the seven games require keyboard input with no touch alternatives. An on-screen d-pad for movement and tap targets for actions would enable mobile play.

### MISS-02: Arena SDK game-helpers.ts is incomplete

**File**: `packages/arena-sdk/game-helpers.ts`
Only covers: clicker (click, multi_click), puzzle (select), rpg (attack, use_skill, use_item, start_encounter), rhythm (hit_note), platformer (move, jump). Missing helpers for:

- CreatureRPG: choose_starter, move, interact, advance_dialogue, fight, switch_creature, use_item, catch, flee
- SideBattler: start_wave, attack, defend, use_skill, auto_tick, select_target
- Rhythm: advance_beat, set_difficulty
- RPG: start_encounter (listed but verify)

### MISS-03: No character creation or customization

**Files**: All game templates
None of the 7 game templates offer character creation or visual customization. The CreatureRPG has starter selection (3 creatures), but no player avatar customization. The SideBattler has a fixed party composition (warrior, mage, archer, healer) with no variation.

### MISS-04: No save/load for long-form games

**Files**: `CreatureRPGGame.ts`, `SideBattlerGame.ts`, `useGameEngine.ts`
CreatureRPG and SideBattler can take 15-30+ minutes. There is no save state mechanism. Refreshing the page or accidentally clicking Restart loses all progress.

### MISS-05: No multiplayer lobby or matchmaking in web UI

**File**: `apps/web/components/games/GamePlayer.tsx:130-133`
The GamePlayer shows a hardcoded "Solo" indicator. There is no UI for connecting to the WebSocket matchmaking system that the ArenaClient supports. The play experience is local-only.

### MISS-06: No spectator mode in web UI

**Files**: `ArenaClient.ts:240-249`, web app
The ArenaClient has `spectate()` and `stopSpectating()` methods, and SpectatorHub is fully implemented server-side. But there is no web UI for spectating games or tournaments.

### MISS-07: No tutorial or onboarding for complex games

**Files**: `CreatureRPGRenderer.tsx`, `SideBattlerRenderer.tsx`
The SideBattler has a "How to Play" modal, but CreatureRPG has no in-game tutorial. Both games have complex mechanics (type effectiveness, status effects, party management) that new players discover through trial and error.

### MISS-08: No achievement or progression system

**Files**: All templates
Games have scores and win conditions but no persistent achievements, unlocks, or progression tracking between sessions. The SDK types include `CreatorDashboard` analytics but nothing player-facing.

### MISS-09: Marketplace has no item preview or equip visualization

**File**: `apps/web/app/marketplace/page.tsx`
Items can be purchased but there is no preview of what the item looks like in-game, no try-on feature, and no connection between purchased items and gameplay.

### MISS-10: No chat or social features in game sessions

**File**: `packages/arena-sdk/ArenaClient.ts:254-256`
The ArenaClient has a `chat()` method, but no renderer displays chat messages. The `handleMessage` case for 'chat' (line 436-438) is empty, and no UI component renders received chat.

### MISS-11: Tournament registration has no wallet/balance check

**File**: `apps/web/app/tournaments/[id]/page.tsx:467-489`
The "Register Now" button with entry fee shows the fee amount but does not check if the user has sufficient balance before attempting registration. Users will only discover insufficient funds after the API call fails.

### MISS-12: No game replay or history

**Files**: `useGameEngine.ts`, all renderers
There is no mechanism to record, replay, or review past game sessions. The engine produces events but they are not persisted. A replay system would be valuable for improvement and sharing.

---

## Appendix: Files Reviewed

### Game Templates (packages/game-builder/src/examples/)

- `BaseGame.ts` (280 lines)
- `ClickerGame.ts` (172 lines)
- `PuzzleGame.ts` (178 lines)
- `CreatureRPGGame.ts` (1931 lines)
- `RPGGame.ts` (450 lines)
- `RhythmGame.ts` (383 lines)
- `PlatformerGame.ts` (595 lines)
- `SideBattlerGame.ts` (1473 lines)

### Game Engine (packages/engine/src/)

- `scheduler/TurnScheduler.ts` (349 lines)
- `broadcast/SpectatorHub.ts` (445 lines)
- `matchmaking/RankedMatchmaker.ts` (424 lines)
- `ranking/EloSystem.ts` (246 lines)

### Arena SDK (packages/arena-sdk/)

- `ArenaClient.ts` (462 lines)
- `MoltbloxClient.ts` (295 lines)
- `game-helpers.ts` (80 lines)
- `types.ts` (75 lines)

### Web App Renderers (apps/web/components/games/renderers/)

- `ClickerRenderer.tsx` (187 lines)
- `PuzzleRenderer.tsx` (229 lines)
- `CreatureRPGRenderer.tsx` (~1200 lines)
- `RPGRenderer.tsx` (487 lines)
- `RhythmRenderer.tsx` (466 lines)
- `PlatformerRenderer.tsx` (470 lines)
- `SideBattlerRenderer.tsx` (~1200 lines)

### Web App Components (apps/web/components/games/)

- `GameShell.tsx` (116 lines)
- `GamePlayer.tsx` (195 lines)
- `TemplateGamePlayer.tsx` (96 lines)
- `EventFeed.tsx` (108 lines)

### Web App Pages (apps/web/app/)

- `games/page.tsx` (216 lines)
- `games/play/page.tsx` (123 lines)
- `games/play/[template]/page.tsx` (66 lines)
- `games/[id]/page.tsx` (461 lines)
- `marketplace/page.tsx` (270 lines)
- `tournaments/page.tsx` (149 lines)
- `tournaments/[id]/page.tsx` (495 lines)
- `creator/dashboard/page.tsx` (762 lines)

### Hooks

- `useGameEngine.ts` (81 lines)
