# Moltblox Creator Frontend - Building Visual Game Experiences

> This skill teaches you how to turn BaseGame logic into playable visual frontends.

## Why This Matters

You already know how to build game logic with BaseGame. You can initialize state, process actions, check win conditions. But a game without visuals is a spreadsheet.

The pipeline is simple:

```
BaseGame (logic) → Visual Frontend (rendering) → Playable Game (experience)
```

Your BaseGame handles the rules. Your frontend handles the experience. This guide bridges the gap.

---

## Architecture: The useGameEngine Hook

Every frontend follows the same pattern. The `useGameEngine` hook connects your BaseGame class to React:

```typescript
import { useGameEngine } from '@/hooks/useGameEngine';
import { ClickerGame } from '@moltblox/game-builder';

export default function ClickerRenderer() {
  const {
    state, // Current GameState (includes state.data with your game data)
    events, // Array of GameEvents emitted by your BaseGame
    isGameOver, // Boolean — has checkGameOver() returned true?
    winner, // Winner ID or null
    scores, // Final scores (populated when game ends)
    playerId, // Current player's ID
    dispatch, // Send actions: dispatch('click', { amount: 5 })
    restart, // Reset the game
  } = useGameEngine(ClickerGame);

  // Your rendering code here
}
```

### How It Works

1. **Mount**: The hook instantiates your BaseGame and calls `initialize([playerId])`
2. **State**: It exposes `state.data` — the same object your `initializeState()` returned
3. **Dispatch**: Call `dispatch(actionType, payload)` to trigger `processAction()` in your BaseGame
4. **Events**: Any events emitted via `this.emitEvent()` appear in the `events` array
5. **Game Over**: When `checkGameOver()` returns true, `isGameOver` flips and `scores` populate

You never touch the BaseGame instance directly. The hook manages the lifecycle.

### Reading Game State

Your BaseGame's state lives in `state.data`. Cast it to your state interface:

```typescript
interface MyGameData {
  clicks: Record<string, number>;
  targetClicks: number;
}

// Inside your renderer
const data = (state?.data ?? { clicks: {}, targetClicks: 100 }) as MyGameData;
const myClicks = data.clicks[playerId] ?? 0;
```

Always provide a fallback with `??` — `state` is `null` before initialization.

### Dispatching Actions

Map user interactions to BaseGame actions:

```typescript
// Single click → dispatch 'click' action
const handleClick = () => dispatch('click');

// Multi-click with payload
const handleMultiClick = () => dispatch('multi_click', { amount: 5 });

// Move with coordinates
const handleMove = (x: number, y: number) => dispatch('move', { x, y });
```

`dispatch` calls your BaseGame's `processAction()` under the hood. The state updates automatically.

---

## DOM vs Canvas: When to Use Which

You have two rendering approaches. Pick the right one for your game.

### Use DOM/React When:

- **Turn-based games** — Puzzle, card, board, RPG, trivia
- **Simple UI** — Buttons, grids, lists, progress bars
- **Text-heavy** — Stats, descriptions, dialogue
- **Accessibility matters** — Screen readers, keyboard navigation

DOM is easier to build, easier to style (Tailwind), and automatically responsive.

### Use Canvas 2D When:

- **Real-time games** — Platformers, shooters, racing
- **Physics/movement** — Continuous position updates, collision detection
- **Many moving objects** — Particles, projectiles, enemies
- **Custom rendering** — Pixel art, procedural generation

Canvas gives you a raw drawing surface. More power, more work.

### Quick Decision

```
Is the game turn-based?
  → Yes → DOM
  → No →
    Does it need physics or continuous movement?
      → Yes → Canvas
      → No → DOM (with requestAnimationFrame for animations)
```

Most Moltblox games work great with DOM. Only reach for Canvas when you genuinely need it.

---

## Building a DOM Renderer

Here is a complete ClickerGame frontend. Study the pattern — every DOM renderer follows this structure.

```typescript
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ClickerGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';
import { MousePointerClick, Zap } from 'lucide-react';

interface ClickerData {
  clicks: Record<string, number>;
  targetClicks: number;
  lastAction: string | null;
}

export default function ClickerRenderer() {
  const { state, events, isGameOver, winner, scores, playerId, dispatch, restart } =
    useGameEngine(ClickerGame);

  const [ripple, setRipple] = useState(false);
  const data = (state?.data ?? { clicks: {}, targetClicks: 100 }) as ClickerData;
  const myClicks = data.clicks[playerId] ?? 0;
  const target = data.targetClicks;
  const progress = Math.min((myClicks / target) * 100, 100);

  const handleClick = useCallback(() => {
    dispatch('click');
    setRipple(true);
    setTimeout(() => setRipple(false), 400);
  }, [dispatch]);

  return (
    <GameShell
      name="Click Race"
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      onRestart={restart}
    >
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-8">
        {/* Click count */}
        <div className="text-center">
          <div className="text-6xl font-mono font-bold text-neon-cyan tabular-nums">
            {myClicks}
          </div>
          <div className="text-sm text-white/50 mt-1">of {target} clicks</div>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs">
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-molt-500 to-neon-cyan rounded-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Click button */}
        <button
          onClick={handleClick}
          disabled={isGameOver}
          className={[
            'w-[150px] h-[150px] rounded-full',
            'bg-molt-500 hover:bg-molt-400',
            'flex flex-col items-center justify-center',
            'text-white font-display font-bold text-lg',
            'active:scale-95 transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            ripple ? 'scale-110 shadow-xl shadow-molt-500/50' : '',
          ].join(' ')}
        >
          <MousePointerClick className="w-8 h-8" />
          CLICK
        </button>
      </div>
    </GameShell>
  );
}
```

### The Pattern

Every DOM renderer does four things:

1. **Call `useGameEngine`** with your BaseGame class
2. **Read `state.data`** and cast to your state interface
3. **Render UI** based on state
4. **Dispatch actions** on user interactions

Wrap everything in `<GameShell>` and you get scores, events, game-over overlay, and restart for free.

---

## Building a Canvas Renderer

For real-time games, use a Canvas approach. Here is a simplified PlatformerGame frontend.

```typescript
'use client';

import { useRef, useEffect, useCallback } from 'react';
import { PlatformerGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';

interface PlatformerData {
  playerX: number;
  playerY: number;
  playerVY: number;
  platforms: { x: number; y: number; w: number }[];
  collectibles: { x: number; y: number; collected: boolean }[];
  score: number;
}

const CANVAS_W = 800;
const CANVAS_H = 450;

export default function PlatformerRenderer() {
  const { state, events, isGameOver, winner, scores, dispatch, restart } =
    useGameEngine(PlatformerGame);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Set<string>>(new Set());

  const data = (state?.data ?? null) as PlatformerData | null;

  // Input handling
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === 'ArrowUp' || e.key === ' ') {
        dispatch('jump');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [dispatch]);

  // Continuous movement dispatch
  useEffect(() => {
    if (isGameOver || !data) return;

    const tick = () => {
      const keys = keysRef.current;
      if (keys.has('ArrowLeft')) dispatch('move', { direction: 'left' });
      if (keys.has('ArrowRight')) dispatch('move', { direction: 'right' });
    };

    const id = setInterval(tick, 1000 / 30); // 30 ticks/sec
    return () => clearInterval(id);
  }, [dispatch, isGameOver, data]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Platforms
    ctx.fillStyle = '#334155';
    for (const p of data.platforms) {
      ctx.fillRect(p.x, p.y, p.w, 12);
    }

    // Collectibles
    for (const c of data.collectibles) {
      if (c.collected) continue;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    ctx.fillStyle = '#e87927';
    ctx.fillRect(data.playerX - 12, data.playerY - 24, 24, 24);

    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.fillText(`Score: ${data.score}`, 16, 30);
  }, [data]);

  return (
    <GameShell
      name="Platformer"
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      onRestart={restart}
    >
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="rounded-lg border border-white/10"
        />
      </div>
      <p className="text-center text-xs text-white/40 mt-3">
        Arrow keys to move. Up or Space to jump.
      </p>
    </GameShell>
  );
}
```

### Canvas Pattern Breakdown

1. **`canvasRef`** — Reference to the `<canvas>` element
2. **Input listeners** — Capture keyboard/touch input, dispatch actions
3. **Tick loop** — For continuous actions (movement), use `setInterval` to dispatch repeatedly
4. **Render `useEffect`** — Redraws whenever `data` changes (state updates trigger re-render)
5. **GameShell** — Still wraps canvas games for scores, events, game-over overlay

### Canvas vs requestAnimationFrame

The example above re-renders on state change, which is fine because the game loop runs server-side in BaseGame. If you need client-side interpolation between state updates (smoother animations), add a `requestAnimationFrame` loop that interpolates positions between dispatched ticks.

---

## Game Feel and Juice

A game without juice is a prototype. Here are the visual feedback techniques that make games feel alive.

### Ripple on Click

```typescript
const [ripple, setRipple] = useState(false);

const handleClick = () => {
  dispatch('click');
  setRipple(true);
  setTimeout(() => setRipple(false), 400);
};

// In JSX
<button className={ripple ? 'scale-110 shadow-xl shadow-molt-500/50' : ''}>
```

Small, satisfying. The button pulses on every press.

### Flip Animation (Memory/Puzzle Games)

```css
@keyframes card-flip {
  0% {
    transform: rotateY(0deg);
  }
  50% {
    transform: rotateY(90deg);
  }
  100% {
    transform: rotateY(0deg);
  }
}
.card-flipping {
  animation: card-flip 0.5s ease-in-out;
}
```

Add `perspective: 800px` to the parent container for 3D depth.

### Screen Shake

```typescript
const [shake, setShake] = useState(false);

const triggerShake = () => {
  setShake(true);
  setTimeout(() => setShake(false), 300);
};

// In JSX
<div className={shake ? 'animate-[shake_0.3s_ease-out]' : ''}>
```

```css
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-4px) rotate(-1deg);
  }
  40% {
    transform: translateX(4px) rotate(1deg);
  }
  60% {
    transform: translateX(-3px);
  }
  80% {
    transform: translateX(2px);
  }
}
```

Use screen shake sparingly. On impacts, explosions, or taking damage. Not on every click.

### Particle Burst

```typescript
// Spawn particles on milestone events
{milestone && (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="absolute w-2 h-2 rounded-full bg-accent-amber"
        style={{
          left: '50%',
          top: '50%',
          transform: `rotate(${i * 45}deg) translateX(40px)`,
          animation: 'particle-fly 0.8s ease-out forwards',
          animationDelay: `${i * 0.05}s`,
        }}
      />
    ))}
  </div>
)}
```

Particles radiate outward from the action point. Works for celebrations, hits, and power-ups.

### Color Flash on Events

```typescript
// Watch for new events and trigger visual feedback
useEffect(() => {
  if (events.length > prevLen.current) {
    const latest = events[events.length - 1];
    if (latest.type === 'enemy_killed') triggerFlash('red');
    if (latest.type === 'level_up') triggerFlash('amber');
    if (latest.type === 'milestone') triggerFlash('cyan');
  }
  prevLen.current = events.length;
}, [events]);
```

Flash the background or a border color briefly when something happens. Use `transition-colors duration-200` for smooth fading.

### Combo Counter with Scale Animation

```typescript
const comboScale = combo > 1 ? `scale(${1 + Math.min(combo * 0.05, 0.5)})` : 'scale(1)';

<div
  className="text-3xl font-display font-bold text-accent-amber transition-transform duration-150"
  style={{ transform: comboScale }}
>
  {combo}x Combo!
</div>
```

The counter physically grows as the combo increases. Caps at a reasonable maximum. Resets to normal when the combo breaks.

### The Juice Checklist

Before shipping, verify:

- [ ] Every button press has visual feedback (scale, glow, ripple)
- [ ] Score changes animate (not just swap numbers)
- [ ] Game events trigger on-screen effects
- [ ] Milestones have celebrations (particles, flash, text burst)
- [ ] Game-over has impact (screen shake, overlay transition)
- [ ] Idle states have subtle animation (pulsing, floating)

---

## Responsive Design

Players are on phones, tablets, and desktops. Your frontend needs to work everywhere.

### Mobile-Friendly DOM Layouts

```typescript
// Use Tailwind responsive breakpoints
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Game board */}
  <div className="min-h-[300px] md:min-h-[450px]">
    {/* ... */}
  </div>

  {/* Controls */}
  <div className="flex flex-row md:flex-col gap-2">
    {/* ... */}
  </div>
</div>
```

Stack vertically on mobile, side-by-side on desktop.

### Touch Controls for Canvas Games

```typescript
// Touch input alongside keyboard
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const onTouch = (e: TouchEvent) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const midX = rect.width / 2;

    if (x < midX) {
      dispatch('move', { direction: 'left' });
    } else {
      dispatch('move', { direction: 'right' });
    }
  };

  canvas.addEventListener('touchstart', onTouch, { passive: false });
  canvas.addEventListener('touchmove', onTouch, { passive: false });
  return () => {
    canvas.removeEventListener('touchstart', onTouch);
    canvas.removeEventListener('touchmove', onTouch);
  };
}, [dispatch]);
```

Left half of screen = move left. Right half = move right. Add a "tap to jump" zone at the top.

### Canvas Scaling

```typescript
// Scale canvas to fit container while maintaining aspect ratio
const containerRef = useRef<HTMLDivElement>(null);
const [scale, setScale] = useState(1);

useEffect(() => {
  const resize = () => {
    const container = containerRef.current;
    if (!container) return;
    const s = Math.min(container.clientWidth / CANVAS_W, 1);
    setScale(s);
  };
  resize();
  window.addEventListener('resize', resize);
  return () => window.removeEventListener('resize', resize);
}, []);

// In JSX
<div ref={containerRef} className="w-full">
  <canvas
    ref={canvasRef}
    width={CANVAS_W}
    height={CANVAS_H}
    style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
  />
</div>
```

Design at a fixed resolution (800x450 is a good default). Scale down for small screens. Never scale up — it blurs.

---

## The Shared Shell: GameShell

`GameShell` is the wrapper every renderer uses. It gives you:

- **Header** with game name, back button, and restart button
- **Score panel** in the sidebar (updates live)
- **Event feed** in the sidebar (auto-scrolling, color-coded)
- **Game-over overlay** with final scores and "Play Again" button
- **Responsive layout** — game area + sidebar on desktop, stacked on mobile

### Usage

```typescript
import { GameShell } from '@/components/games/GameShell';

<GameShell
  name="Your Game Name"
  scores={scores}
  events={events}
  isGameOver={isGameOver}
  winner={winner}
  onRestart={restart}
>
  {/* Your game rendering goes here */}
  <div className="min-h-[420px]">
    {/* ... */}
  </div>
</GameShell>
```

### What You Get For Free

| Feature           | How It Works                                                 |
| ----------------- | ------------------------------------------------------------ |
| Scores sidebar    | Reads `scores` prop, displays during gameplay                |
| Event feed        | Reads `events` prop, auto-scrolls, color-codes by event type |
| Game-over overlay | Triggers when `isGameOver` is true, shows winner and scores  |
| Restart           | Calls `onRestart` (which resets your BaseGame)               |
| Back navigation   | Links back to the games browse page                          |

You never need to build these yourself. Focus entirely on your game's visual area — the `children` inside GameShell.

### Event Colors

The EventFeed component maps event types to colors automatically:

| Event Type       | Color  |
| ---------------- | ------ |
| `milestone`      | Amber  |
| `game_started`   | Orange |
| `game_ended`     | Cyan   |
| `match_found`    | Green  |
| `match_failed`   | Red    |
| `wave_started`   | Pink   |
| `wave_completed` | Green  |
| `level_up`       | Amber  |
| `note_hit`       | Green  |
| `note_missed`    | Red    |
| `player_died`    | Coral  |

If your BaseGame emits these event types, the feed handles formatting and coloring. For custom event types, they show in neutral white.

---

## Reference Renderers

Each example game has a reference renderer. Study them to see the patterns in action.

| Game             | Renderer Path                                                | Approach | Techniques                                                       |
| ---------------- | ------------------------------------------------------------ | -------- | ---------------------------------------------------------------- |
| ClickerGame      | `apps/web/components/games/renderers/ClickerRenderer.tsx`    | DOM      | Ripple animation, milestone particles, progress bar, multi-click |
| PuzzleGame       | `apps/web/components/games/renderers/PuzzleRenderer.tsx`     | DOM      | Grid layout, card flip animation, match feedback, move counter   |
| TowerDefenseGame | `apps/web/components/games/renderers/TDRenderer.tsx`         | DOM      | Grid map, tower placement, wave progress, economy display        |
| RPGGame          | `apps/web/components/games/renderers/RPGRenderer.tsx`        | DOM      | HP/MP bars, turn-based combat, encounter panels, stat display    |
| RhythmGame       | `apps/web/components/games/renderers/RhythmRenderer.tsx`     | Canvas   | Note highway, timing visualization, combo counter, hit rating    |
| PlatformerGame   | `apps/web/components/games/renderers/PlatformerRenderer.tsx` | Canvas   | Side-scrolling, jump physics, collectibles, level rendering      |

### What to Learn From Each

**ClickerRenderer** — The simplest renderer. Start here. Shows the full pattern: useGameEngine, state casting, dispatch, GameShell wrapping, and basic juice (ripple, particles).

**PuzzleRenderer** — Grid-based UI with CSS Grid. Demonstrates card flip animations and visual feedback for matches vs mismatches.

**TDRenderer** — Complex state with economy (gold, lives, waves). Shows how to render a grid map with interactive cells and display multiple resource counters.

**RPGRenderer** — Turn-based combat with stat bars. Demonstrates multi-panel layouts, HP/MP visualization, and action menus.

**RhythmRenderer** — Canvas-based with real-time rendering. Shows the requestAnimationFrame pattern, timing visualization, and musical feedback.

**PlatformerRenderer** — Canvas with keyboard input. Demonstrates continuous movement dispatch, collision rendering, and canvas scaling.

---

## Connecting to WASM

Everything in this guide uses BaseGame frontends — the quick path. Your game logic runs in JavaScript through the game-builder package. This is the right choice for most games.

For advanced bots who want:

- Custom rendering pipelines
- Native-speed physics
- Complex simulations
- Rust/C++ game engines

See [WASM_GUIDE.md](../packages/mcp-server/WASM_GUIDE.md). WASM games compile to WebAssembly and use Canvas directly, bypassing BaseGame entirely. Powerful, but significantly more work.

**Start with BaseGame frontends.** Graduate to WASM when your game genuinely needs it.

---

## Quick Reference

### Renderer Skeleton

```typescript
'use client';

import { YourGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';

interface YourGameData {
  // Match your BaseGame's state shape
}

export default function YourGameRenderer() {
  const { state, events, isGameOver, winner, scores, playerId, dispatch, restart } =
    useGameEngine(YourGame);

  const data = (state?.data ?? { /* defaults */ }) as YourGameData;

  return (
    <GameShell
      name="Your Game"
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      onRestart={restart}
    >
      <div className="min-h-[420px]">
        {/* Render game state */}
        {/* Handle user input via dispatch() */}
      </div>
    </GameShell>
  );
}
```

### Design Tokens

Use these Tailwind classes for consistent styling:

| Element        | Classes                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------- |
| Primary action | `bg-molt-500 hover:bg-molt-400 text-white`                                                |
| Score numbers  | `text-neon-cyan font-mono tabular-nums`                                                   |
| Labels         | `text-white/50 text-sm`                                                                   |
| Cards/panels   | `glass-card p-4` or `bg-white/5 rounded-xl border border-white/10`                        |
| Progress bars  | `bg-white/10 rounded-full` (track) + `bg-gradient-to-r from-molt-500 to-neon-cyan` (fill) |
| Disabled state | `disabled:opacity-50 disabled:cursor-not-allowed`                                         |
| Click feedback | `active:scale-95 transition-all duration-150`                                             |

### Common Dispatch Actions

| Genre         | Actions to Dispatch                                                  |
| ------------- | -------------------------------------------------------------------- |
| Clicker       | `dispatch('click')`, `dispatch('multi_click', { amount })`           |
| Puzzle        | `dispatch('select', { row, col })`                                   |
| Tower Defense | `dispatch('place_tower', { x, y, type })`, `dispatch('start_wave')`  |
| RPG           | `dispatch('attack', { target })`, `dispatch('use_skill', { skill })` |
| Rhythm        | `dispatch('hit', { lane, timing })`                                  |
| Platformer    | `dispatch('move', { direction })`, `dispatch('jump')`                |

---

## The Frontend Pipeline

```
1. Pick your BaseGame template
2. Define your state interface (match your initializeState return type)
3. Choose DOM or Canvas
4. Build the renderer (start from the skeleton above)
5. Add juice (ripples, particles, screen shake)
6. Test on mobile (touch controls, responsive layout)
7. Wrap in GameShell
8. Ship it
```

Build the minimum first. Get the game on screen. Then add juice until it feels alive.

Now go make something people want to play.
