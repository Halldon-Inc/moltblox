'use client';

import { useRef, useEffect, useCallback } from 'react';
import { PlatformerGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';

interface Vector2 {
  x: number;
  y: number;
}

interface PlayerPhysics {
  position: Vector2;
  velocity: Vector2;
  onGround: boolean;
  facingRight: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
}

interface PlayerData {
  physics: PlayerPhysics;
  lives: number;
  score: number;
  coinsCollected: number;
  checkpoint: Vector2;
  finished: boolean;
}

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Collectible {
  x: number;
  y: number;
  type: 'coin' | 'gem' | 'powerup';
  value: number;
  collected: boolean;
}

interface Hazard {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'spikes' | 'moving_enemy' | 'falling_platform';
  moveOffset?: number;
}

interface Checkpoint {
  x: number;
  y: number;
  activated: boolean;
}

interface PlatformerData {
  players: Record<string, PlayerData>;
  platforms: Platform[];
  collectibles: Collectible[];
  hazards: Hazard[];
  checkpoints: Checkpoint[];
  levelWidth: number;
  levelHeight: number;
  exitX: number;
  exitY: number;
  tick: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const CANVAS_W = 800;
const CANVAS_H = 400;
const UNIT = 30; // pixels per game unit
const CAMERA_LERP = 0.1;

/* ------------------------------------------------------------------ */
/*  Pixel-art sprite palettes and definitions                          */
/* ------------------------------------------------------------------ */

const DEFAULT_PLAYER_PALETTE: Record<number, string | null> = {
  0: null, // transparent
  1: '#0d3b42', // dark outline
  2: '#14b8a6', // teal body
  3: '#2dd4bf', // teal highlight
  4: '#f5d0a9', // skin
  5: '#d4a574', // skin shadow
  6: '#ffffff', // eye white
  7: '#1a1a2e', // eye pupil
  8: '#0f766e', // dark teal
  9: '#fbbf24', // gold belt
  10: '#1e3a5f', // shoe dark
  11: '#2563eb', // shoe blue
};

const DEFAULT_ENEMY_PALETTE: Record<number, string | null> = {
  0: null,
  1: '#1a1a2e',
  2: '#991b1b',
  3: '#dc2626',
  4: '#ef4444',
  5: '#ffffff',
  6: '#fbbf24',
};

const DEFAULT_PLATFORM_COLOR = '#34d399';
const DEFAULT_SKY_COLORS = ['#060918', '#0c1230', '#1a1a40', '#2a1a3e'];
const DEFAULT_COLLECTIBLE_COLOR = '#fbbf24';

// 8x12 idle frame
const PLAYER_IDLE: number[][] = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 4, 4, 4, 4, 1, 0],
  [0, 1, 4, 6, 4, 6, 4, 1],
  [0, 1, 5, 4, 4, 4, 5, 1],
  [0, 0, 1, 5, 5, 1, 0, 0],
  [0, 1, 2, 2, 2, 2, 1, 0],
  [1, 8, 2, 9, 9, 2, 8, 1],
  [0, 1, 2, 2, 2, 2, 1, 0],
  [0, 0, 1, 8, 8, 1, 0, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 1, 10, 1, 1, 10, 1, 0],
  [0, 1, 11, 1, 1, 11, 1, 0],
];

// 8x12 run frame 1 (left leg forward)
const PLAYER_RUN1: number[][] = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 4, 4, 4, 4, 1, 0],
  [0, 1, 4, 6, 4, 6, 4, 1],
  [0, 1, 5, 4, 4, 4, 5, 1],
  [0, 0, 1, 5, 5, 1, 0, 0],
  [0, 1, 2, 3, 2, 2, 1, 0],
  [0, 1, 2, 9, 9, 2, 1, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 1, 8, 1, 0, 1, 0, 0],
  [1, 10, 1, 0, 0, 1, 8, 0],
  [1, 11, 1, 0, 1, 10, 1, 0],
  [0, 1, 0, 0, 1, 11, 1, 0],
];

// 8x12 run frame 2 (right leg forward)
const PLAYER_RUN2: number[][] = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 4, 4, 4, 4, 1, 0],
  [0, 1, 4, 6, 4, 6, 4, 1],
  [0, 1, 5, 4, 4, 4, 5, 1],
  [0, 0, 1, 5, 5, 1, 0, 0],
  [0, 1, 2, 2, 3, 2, 1, 0],
  [0, 1, 2, 9, 9, 2, 1, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 0, 1, 0, 1, 8, 1, 0],
  [0, 1, 8, 0, 0, 1, 10, 1],
  [0, 1, 10, 1, 0, 1, 11, 1],
  [0, 1, 11, 1, 0, 0, 1, 0],
];

// 8x12 jump frame (arms up, legs tucked)
const PLAYER_JUMP: number[][] = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 4, 4, 4, 4, 1, 0],
  [0, 1, 4, 6, 4, 6, 4, 1],
  [0, 1, 5, 4, 4, 4, 5, 1],
  [0, 0, 1, 5, 5, 1, 0, 0],
  [1, 3, 2, 2, 2, 2, 3, 1],
  [0, 1, 2, 9, 9, 2, 1, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 1, 8, 0, 0, 8, 1, 0],
  [0, 1, 10, 1, 1, 10, 1, 0],
  [0, 0, 1, 11, 11, 1, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 0],
];

// Moving enemy sprite (10x8)
// (DEFAULT_ENEMY_PALETTE defined above with other defaults)
const ENEMY_SPRITE: number[][] = [
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 3, 3, 3, 3, 3, 3, 1, 0],
  [1, 3, 5, 1, 3, 3, 5, 1, 3, 1],
  [1, 2, 3, 3, 3, 3, 3, 3, 2, 1],
  [1, 2, 3, 6, 3, 3, 6, 3, 2, 1],
  [1, 2, 2, 3, 3, 3, 3, 2, 2, 1],
  [0, 1, 4, 1, 1, 1, 1, 4, 1, 0],
  [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
];

/* ------------------------------------------------------------------ */
/*  Helper: render a pixel sprite onto a canvas                        */
/* ------------------------------------------------------------------ */

function drawPixelSprite(
  ctx: CanvasRenderingContext2D,
  sprite: number[][],
  palette: Record<number, string | null>,
  x: number,
  y: number,
  pixelSize: number,
  flipH?: boolean,
) {
  const cols = sprite[0].length;
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const idx = sprite[row][col];
      if (idx === 0) continue;
      const color = palette[idx];
      if (!color) continue;
      ctx.fillStyle = color;
      const drawCol = flipH ? cols - 1 - col : col;
      ctx.fillRect(
        Math.floor(x + drawCol * pixelSize),
        Math.floor(y + row * pixelSize),
        pixelSize,
        pixelSize,
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Trail particle system                                               */
/* ------------------------------------------------------------------ */

interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

/* ------------------------------------------------------------------ */
/*  Main renderer                                                       */
/* ------------------------------------------------------------------ */

export default function PlatformerRenderer({
  gameName,
  gameConfig,
}: {
  gameName?: string;
  gameConfig?: Record<string, unknown>;
}) {
  const { state, events, isGameOver, winner, scores, playerId, dispatch, restart } = useGameEngine(
    PlatformerGame,
    gameConfig,
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const cameraRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const trailRef = useRef<TrailParticle[]>([]);
  const prevPosRef = useRef<Vector2 | null>(null);

  const data = (state?.data as unknown as PlatformerData) ?? undefined;

  // Read visual config from _config
  const cfg = ((state?.data as Record<string, unknown>)?._config ?? {}) as Record<string, unknown>;
  const theme = (cfg.theme ?? {}) as Record<string, unknown>;

  const cfgPlayerPalette = theme.playerColor as Record<string, string> | undefined;
  const PLAYER_PALETTE: Record<number, string | null> = { ...DEFAULT_PLAYER_PALETTE };
  if (cfgPlayerPalette) {
    for (const [k, v] of Object.entries(cfgPlayerPalette)) {
      PLAYER_PALETTE[Number(k)] = v;
    }
  }

  const ENEMY_PALETTE: Record<number, string | null> = { ...DEFAULT_ENEMY_PALETTE };
  const cfgEnemyColors = theme.enemyColors as Record<string, string> | undefined;
  if (cfgEnemyColors) {
    for (const [k, v] of Object.entries(cfgEnemyColors)) {
      ENEMY_PALETTE[Number(k)] = v;
    }
  }

  const platformColor = (theme.platformColor as string) ?? DEFAULT_PLATFORM_COLOR;
  const skyColors = (theme.skyColor as string[]) ?? DEFAULT_SKY_COLORS;
  const collectibleColor = (theme.collectibleColor as string) ?? DEFAULT_COLLECTIBLE_COLOR;

  // Suppress lint warnings for variables used in render
  void platformColor;
  void skyColors;
  void collectibleColor;

  // Key listeners
  useEffect(() => {
    const keys = keysRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (
        ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', ' '].includes(k)
      ) {
        e.preventDefault();
        keys.add(k);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.delete(k);

      // Stop horizontal movement when key is released
      if (k === 'arrowleft' || k === 'a' || k === 'arrowright' || k === 'd') {
        const leftHeld = keys.has('arrowleft') || keys.has('a');
        const rightHeld = keys.has('arrowright') || keys.has('d');
        if (!leftHeld && !rightHeld) {
          dispatch('move', { direction: 'stop' });
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [dispatch]);

  // Game loop: process inputs then tick
  const gameLoop = useCallback(() => {
    if (isGameOver) return;

    const keys = keysRef.current;

    const left = keys.has('arrowleft') || keys.has('a');
    const right = keys.has('arrowright') || keys.has('d');
    const jump = keys.has('arrowup') || keys.has('w') || keys.has(' ');

    if (left && !right) {
      dispatch('move', { direction: 'left' });
    } else if (right && !left) {
      dispatch('move', { direction: 'right' });
    }

    if (jump) {
      dispatch('jump', {});
    }

    dispatch('tick', {});
  }, [dispatch, isGameOver]);

  // RAF loop
  useEffect(() => {
    let lastTime = 0;
    const FRAME_MS = 1000 / 60;

    const loop = (time: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (time - lastTime < FRAME_MS) return;
      lastTime = time;
      gameLoop();
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameLoop]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player = data.players[playerId];
    if (!player) return;

    const px = player.physics.position.x;
    const py = player.physics.position.y;
    const t = Date.now() * 0.001;
    const tick = data.tick;

    // Camera: smooth follow player
    const targetCamX = px * UNIT - CANVAS_W / 2;
    const targetCamY = py * UNIT - CANVAS_H / 2;
    const cam = cameraRef.current;
    cam.x += (targetCamX - cam.x) * CAMERA_LERP;
    cam.y += (targetCamY - cam.y) * CAMERA_LERP;

    // Clamp camera to level bounds
    cam.x = Math.max(0, Math.min(cam.x, data.levelWidth * UNIT - CANVAS_W));
    cam.y = Math.max(0, Math.min(cam.y, data.levelHeight * UNIT - CANVAS_H));

    // Helper: world to screen
    const wx = (worldX: number) => worldX * UNIT - cam.x;
    const wy = (worldY: number) => worldY * UNIT - cam.y;

    /* ---- PARALLAX BACKGROUND ---- */

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    skyGrad.addColorStop(0, '#060918');
    skyGrad.addColorStop(0.3, '#0c1230');
    skyGrad.addColorStop(0.7, '#1a1a40');
    skyGrad.addColorStop(1, '#2a1a3e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Stars (static, parallax-distant)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const starSeed = 42;
    for (let i = 0; i < 60; i++) {
      const sx = ((starSeed * (i + 1) * 7919) % CANVAS_W) - ((cam.x * 0.02) % CANVAS_W);
      const sy = (starSeed * (i + 1) * 6271) % (CANVAS_H * 0.6);
      const twinkle = 0.4 + 0.6 * Math.sin(t * (1 + (i % 5) * 0.3) + i);
      ctx.globalAlpha = twinkle;
      const sz = twinkle > 0.7 ? 2 : 1;
      ctx.fillRect(((sx % CANVAS_W) + CANVAS_W) % CANVAS_W, sy, sz, sz);
    }
    ctx.globalAlpha = 1;

    // Distant mountains (parallax layer 1: 0.1x)
    const mtnOffset = cam.x * 0.1;
    ctx.fillStyle = '#151530';
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H);
    for (let mx = -20; mx <= CANVAS_W + 40; mx += 40) {
      const baseY = CANVAS_H - 100;
      // Procedural mountain heights using simple sine combinations
      const worldMx = mx + mtnOffset;
      const h1 = Math.sin(worldMx * 0.005) * 40;
      const h2 = Math.sin(worldMx * 0.012 + 2) * 25;
      const h3 = Math.sin(worldMx * 0.003 + 5) * 50;
      ctx.lineTo(mx, baseY - Math.abs(h1 + h2 + h3));
    }
    ctx.lineTo(CANVAS_W + 20, CANVAS_H);
    ctx.closePath();
    ctx.fill();

    // Mid-ground hills (parallax layer 2: 0.3x)
    const hillOffset = cam.x * 0.3;
    ctx.fillStyle = '#1a1a38';
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H);
    for (let hx = -20; hx <= CANVAS_W + 40; hx += 30) {
      const baseY = CANVAS_H - 50;
      const worldHx = hx + hillOffset;
      const hh1 = Math.sin(worldHx * 0.008 + 1) * 30;
      const hh2 = Math.sin(worldHx * 0.02 + 3) * 15;
      ctx.lineTo(hx, baseY - Math.abs(hh1 + hh2));
    }
    ctx.lineTo(CANVAS_W + 20, CANVAS_H);
    ctx.closePath();
    ctx.fill();

    // Foreground atmosphere haze at horizon
    const hazeGrad = ctx.createLinearGradient(0, CANVAS_H - 80, 0, CANVAS_H);
    hazeGrad.addColorStop(0, 'rgba(25, 25, 50, 0)');
    hazeGrad.addColorStop(1, 'rgba(25, 25, 50, 0.3)');
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, CANVAS_H - 80, CANVAS_W, 80);

    /* ---- PLATFORMS with procedural textures ---- */

    for (const plat of data.platforms) {
      const sx = wx(plat.x);
      const sy = wy(plat.y);
      const sw = plat.width * UNIT;
      const sh = plat.height * UNIT;

      // Skip off-screen
      if (sx + sw < 0 || sx > CANVAS_W || sy + sh < 0 || sy > CANVAS_H) continue;

      // Dirt/stone body
      const bodyGrad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
      bodyGrad.addColorStop(0, '#5c3d2e');
      bodyGrad.addColorStop(0.3, '#4a3020');
      bodyGrad.addColorStop(1, '#3a2518');
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(sx, sy, sw, sh);

      // Stone brick pattern
      ctx.strokeStyle = 'rgba(30, 18, 10, 0.4)';
      ctx.lineWidth = 1;
      const brickH = 10;
      const brickW = 18;
      for (let by = Math.floor(sy / brickH) * brickH; by < sy + sh; by += brickH) {
        if (by < sy + 6) continue; // skip grass area
        const rowOffset = (Math.floor((by - sy) / brickH) % 2) * (brickW / 2);
        for (let bx = Math.floor(sx / brickW) * brickW - brickW; bx < sx + sw; bx += brickW) {
          const drawX = Math.max(sx, bx + rowOffset);
          const drawW = Math.min(sx + sw, bx + rowOffset + brickW) - drawX;
          if (drawW <= 0) continue;
          ctx.strokeRect(drawX, Math.max(sy, by), drawW, brickH);
        }
      }

      // Grass top (green gradient strip)
      const grassH = Math.min(6, sh);
      const grassGrad = ctx.createLinearGradient(sx, sy, sx, sy + grassH);
      grassGrad.addColorStop(0, '#22c55e');
      grassGrad.addColorStop(0.5, '#16a34a');
      grassGrad.addColorStop(1, '#4a3020');
      ctx.fillStyle = grassGrad;
      ctx.fillRect(sx, sy, sw, grassH);

      // Grass blades on top
      ctx.fillStyle = '#34d399';
      const bladeSeed = Math.floor(plat.x * 100 + plat.y * 37);
      for (let b = 0; b < sw; b += 4) {
        const bladeH = 3 + ((bladeSeed + b) % 4);
        if ((bladeSeed + b * 7) % 3 === 0) {
          ctx.fillRect(sx + b, sy - bladeH + 2, 2, bladeH);
        }
      }

      // Dark edge at bottom
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(sx, sy + sh - 2, sw, 2);

      // Left/right edges
      ctx.strokeStyle = '#3e2a1f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + sh);
      ctx.moveTo(sx + sw, sy);
      ctx.lineTo(sx + sw, sy + sh);
      ctx.stroke();
    }

    /* ---- EXIT (golden glow) ---- */
    {
      const ex = wx(data.exitX);
      const ey = wy(data.exitY);
      const ew = 2 * UNIT;
      const eh = 3 * UNIT;

      // Pulsing glow
      const glowPulse = 0.8 + 0.2 * Math.sin(t * 3);
      const glowGrad = ctx.createRadialGradient(
        ex + ew / 2,
        ey + eh / 2,
        5,
        ex + ew / 2,
        ey + eh / 2,
        ew * glowPulse,
      );
      glowGrad.addColorStop(0, `rgba(255, 215, 0, ${0.5 * glowPulse})`);
      glowGrad.addColorStop(0.5, `rgba(255, 215, 0, ${0.15 * glowPulse})`);
      glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(ex - ew / 2, ey - eh / 2, ew * 2, eh * 2);

      // Door body with gradient
      const doorGrad = ctx.createLinearGradient(ex, ey, ex + ew, ey);
      doorGrad.addColorStop(0, '#b8860b');
      doorGrad.addColorStop(0.5, '#ffd700');
      doorGrad.addColorStop(1, '#b8860b');
      ctx.fillStyle = doorGrad;
      ctx.fillRect(ex, ey, ew, eh);

      // Door arch at top
      ctx.fillStyle = '#daa520';
      ctx.beginPath();
      ctx.arc(ex + ew / 2, ey, ew / 2, Math.PI, 0);
      ctx.fill();

      // Door border
      ctx.strokeStyle = '#8b6914';
      ctx.lineWidth = 2;
      ctx.strokeRect(ex, ey, ew, eh);

      // Door handle
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + ew * 0.7, ey + eh * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ---- CHECKPOINTS ---- */
    for (const cp of data.checkpoints) {
      const cx = wx(cp.x);
      const cy = wy(cp.y);

      // Flag pole
      ctx.fillStyle = '#888';
      ctx.fillRect(cx, cy - 30, 2, 40);

      // Flag triangle
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy - 30);
      ctx.lineTo(cx + 18, cy - 22);
      ctx.lineTo(cx + 2, cy - 14);
      ctx.closePath();
      ctx.fillStyle = cp.activated ? '#22c55e' : '#4b5563';
      ctx.fill();

      if (cp.activated) {
        // Glow for activated
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    /* ---- COLLECTIBLES with spin animation and glow ---- */
    for (const col of data.collectibles) {
      if (col.collected) continue;
      const cx = wx(col.x);
      const cy = wy(col.y);

      if (cx < -20 || cx > CANVAS_W + 20 || cy < -20 || cy > CANVAS_H + 20) continue;

      // Bob animation
      const bob = Math.sin(t * 3 + col.x * 0.5) * 3;
      const drawY = cy + bob;

      if (col.type === 'coin') {
        // Spinning coin: scale horizontally to simulate 3D rotation
        const spinScale = Math.abs(Math.cos(t * 4 + col.x));
        const coinW = 8 * Math.max(0.2, spinScale);

        // Coin glow
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 6;

        // Coin body (ellipse to simulate spin)
        ctx.beginPath();
        ctx.ellipse(cx, drawY, coinW, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = spinScale > 0.5 ? '#fbbf24' : '#d97706';
        ctx.fill();

        // Highlight
        if (spinScale > 0.3) {
          ctx.beginPath();
          ctx.ellipse(cx, drawY - 2, coinW * 0.5, 3, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fill();
        }

        ctx.shadowBlur = 0;
      } else if (col.type === 'gem') {
        // Spinning gem with glow
        const spinAngle = t * 2 + col.x;

        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 8;

        ctx.save();
        ctx.translate(cx, drawY);
        ctx.rotate(spinAngle);

        // Diamond shape
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(7, 0);
        ctx.lineTo(0, 9);
        ctx.lineTo(-7, 0);
        ctx.closePath();

        // Gem gradient
        const gemGrad = ctx.createLinearGradient(-7, -9, 7, 9);
        gemGrad.addColorStop(0, '#60a5fa');
        gemGrad.addColorStop(0.5, '#3b82f6');
        gemGrad.addColorStop(1, '#1d4ed8');
        ctx.fillStyle = gemGrad;
        ctx.fill();

        // Inner highlight
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(3, 0);
        ctx.lineTo(0, 5);
        ctx.lineTo(-3, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fill();

        ctx.restore();
        ctx.shadowBlur = 0;
      } else {
        // Powerup: glowing orb
        const pulse = 0.8 + 0.2 * Math.sin(t * 5 + col.x);

        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 10 * pulse;

        // Outer glow ring
        ctx.beginPath();
        ctx.arc(cx, drawY, 12 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16, 185, 129, ${0.15 * pulse})`;
        ctx.fill();

        // Core orb
        ctx.beginPath();
        ctx.arc(cx, drawY, 8, 0, Math.PI * 2);
        const orbGrad = ctx.createRadialGradient(cx - 2, drawY - 2, 1, cx, drawY, 8);
        orbGrad.addColorStop(0, '#6ee7b7');
        orbGrad.addColorStop(0.6, '#10b981');
        orbGrad.addColorStop(1, '#059669');
        ctx.fillStyle = orbGrad;
        ctx.fill();

        // Sparkle
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(cx - 3, drawY - 3, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
      }
    }

    /* ---- HAZARDS with animated glow ---- */
    for (const haz of data.hazards) {
      const hx = wx(haz.x + (haz.moveOffset || 0));
      const hy = wy(haz.y);
      const hw = haz.width * UNIT;
      const hh = haz.height * UNIT;

      if (hx + hw < -20 || hx > CANVAS_W + 20) continue;

      if (haz.type === 'spikes') {
        // Animated spike glow
        const glowIntensity = 0.3 + 0.2 * Math.sin(t * 4);

        // Base glow under spikes
        const spikeGlow = ctx.createLinearGradient(hx, hy - 5, hx, hy + hh + 5);
        spikeGlow.addColorStop(0, `rgba(239, 68, 68, ${glowIntensity})`);
        spikeGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = spikeGlow;
        ctx.fillRect(hx - 3, hy - 5, hw + 6, hh + 10);

        // Metal spike triangles with gradient
        const spikeCount = Math.max(1, Math.floor(hw / 10));
        const spikeW = hw / spikeCount;
        for (let i = 0; i < spikeCount; i++) {
          const spikeGrad = ctx.createLinearGradient(
            hx + i * spikeW + spikeW / 2,
            hy,
            hx + i * spikeW + spikeW / 2,
            hy + hh,
          );
          spikeGrad.addColorStop(0, '#b91c1c');
          spikeGrad.addColorStop(0.3, '#ef4444');
          spikeGrad.addColorStop(0.6, '#dc2626');
          spikeGrad.addColorStop(1, '#7f1d1d');

          ctx.beginPath();
          ctx.moveTo(hx + i * spikeW, hy + hh);
          ctx.lineTo(hx + i * spikeW + spikeW / 2, hy);
          ctx.lineTo(hx + (i + 1) * spikeW, hy + hh);
          ctx.closePath();
          ctx.fillStyle = spikeGrad;
          ctx.fill();

          // Highlight edge
          ctx.strokeStyle = 'rgba(255, 150, 150, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(hx + i * spikeW, hy + hh);
          ctx.lineTo(hx + i * spikeW + spikeW / 2, hy);
          ctx.stroke();
        }
      } else if (haz.type === 'moving_enemy') {
        // Pixel art enemy sprite
        const enemyPixel = Math.max(2, Math.min(4, Math.floor(hw / 10)));
        const spriteW = 10 * enemyPixel;
        const spriteH = 8 * enemyPixel;
        const eDrawX = hx + (hw - spriteW) / 2;
        const eDrawY = hy + (hh - spriteH) / 2;

        // Enemy shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(hx + hw / 2, hy + hh - 2, hw * 0.35, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Angry glow
        const angryPulse = 0.6 + 0.4 * Math.sin(t * 6);
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 4 * angryPulse;

        drawPixelSprite(ctx, ENEMY_SPRITE, ENEMY_PALETTE, eDrawX, eDrawY, enemyPixel);
        ctx.shadowBlur = 0;
      } else {
        // Falling platform: cracked stone look
        const fpGrad = ctx.createLinearGradient(hx, hy, hx, hy + hh);
        fpGrad.addColorStop(0, '#f97316');
        fpGrad.addColorStop(0.5, '#ea580c');
        fpGrad.addColorStop(1, '#c2410c');
        ctx.fillStyle = fpGrad;
        ctx.fillRect(hx, hy, hw, hh);

        // Warning stripes
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 2;
        for (let stripe = 0; stripe < hw; stripe += 8) {
          ctx.beginPath();
          ctx.moveTo(hx + stripe, hy);
          ctx.lineTo(hx + stripe + 4, hy + hh);
          ctx.stroke();
        }

        ctx.strokeStyle = '#9a3412';
        ctx.lineWidth = 1;
        ctx.strokeRect(hx, hy, hw, hh);
      }
    }

    /* ---- TRAIL PARTICLES (spawn from player movement/jumping) ---- */
    const prevPos = prevPosRef.current;
    if (prevPos) {
      const dx = px - prevPos.x;
      const isMoving = Math.abs(dx) > 0.02;
      const isJumping = !player.physics.onGround;

      if (isMoving || isJumping) {
        const trail = trailRef.current;
        const spawnCount = isJumping ? 2 : 1;
        for (let i = 0; i < spawnCount; i++) {
          trail.push({
            x: wx(px) + UNIT * 0.5 + (Math.random() - 0.5) * UNIT * 0.3,
            y: wy(py) + UNIT * 1.5 + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 0.5 - dx * 2,
            vy: isJumping ? 0.5 + Math.random() * 1 : -0.2 + Math.random() * 0.5,
            life: 15 + Math.random() * 10,
            maxLife: 25,
            color: isJumping ? '#14b8a6' : '#5eead4',
            size: 1.5 + Math.random() * 2,
          });
        }
        // Cap particles
        while (trail.length > 80) trail.shift();
      }
    }
    prevPosRef.current = { x: px, y: py };

    // Update and draw trail particles
    const alive: TrailParticle[] = [];
    for (const p of trailRef.current) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.life -= 1;
      if (p.life <= 0) continue;
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
      alive.push(p);
    }
    ctx.globalAlpha = 1;
    trailRef.current = alive;

    /* ---- PLAYER (pixel art sprite with animation) ---- */
    {
      const pixelSize = 3;
      const spriteW = 8 * pixelSize;
      const spriteH = 12 * pixelSize;
      const psx = wx(px) + (UNIT - spriteW) / 2;
      const psy = wy(py) + (UNIT * 2 - spriteH);

      const isMoving = Math.abs(player.physics.velocity.x) > 0.5;
      const isJumping = !player.physics.onGround;

      // Choose animation frame
      let sprite: number[][];
      if (isJumping) {
        sprite = PLAYER_JUMP;
      } else if (isMoving) {
        // Alternate between run frames based on tick
        sprite = Math.floor(tick / 6) % 2 === 0 ? PLAYER_RUN1 : PLAYER_RUN2;
      } else {
        sprite = PLAYER_IDLE;
      }

      // Player shadow on ground
      if (player.physics.onGround) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(psx + spriteW / 2, psy + spriteH + 2, spriteW * 0.4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw the sprite (flip if facing left)
      drawPixelSprite(
        ctx,
        sprite,
        PLAYER_PALETTE,
        psx,
        psy,
        pixelSize,
        !player.physics.facingRight,
      );
    }

    /* ---- VIGNETTE OVERLAY ---- */
    const vigGrad = ctx.createRadialGradient(
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_W * 0.35,
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_W * 0.65,
    );
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    /* ---- HUD OVERLAY ---- */

    // Semi-transparent HUD backdrop strip
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, CANVAS_W, 42);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 41, CANVAS_W, 1);

    // Lives (hearts) with drop shadow
    {
      for (let i = 0; i < player.lives; i++) {
        const heartX = 16 + i * 28;
        const heartY = 16;

        // Drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        drawHeart(ctx, heartX + 1, heartY + 1);

        // Heart with gradient feel
        ctx.fillStyle = '#ef4444';
        drawHeart(ctx, heartX, heartY);

        // Heart highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(heartX - 4, heartY + 3, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Score with drop shadow
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';

    // Score shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(`Score: ${player.score}`, CANVAS_W - 15, 18);
    // Score text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Score: ${player.score}`, CANVAS_W - 16, 17);

    // Coins icon + text with shadow
    // Coin icon
    ctx.beginPath();
    ctx.arc(CANVAS_W - 105, 33, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Coin count shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(`${player.coinsCollected}`, CANVAS_W - 15, 38);
    // Coin count text
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`${player.coinsCollected}`, CANVAS_W - 16, 37);

    // Reset text alignment
    ctx.textAlign = 'left';
  }, [data, playerId]);

  return (
    <GameShell
      name={gameName || 'Voxel Runner'}
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      onRestart={restart}
    >
      <div className="flex flex-col items-center gap-4">
        <div style={{ width: '100%', maxWidth: CANVAS_W, margin: '0 auto' }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="rounded-lg border border-white/10 bg-black"
            style={{ width: '100%', height: 'auto', imageRendering: 'pixelated' }}
            tabIndex={0}
            aria-label="Platformer game canvas"
          />
        </div>
        <div className="flex gap-6 text-xs text-white/50">
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 font-mono text-[10px]">
              A
            </kbd>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 font-mono text-[10px] ml-0.5">
              D
            </kbd>{' '}
            Move
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 font-mono text-[10px]">
              W
            </kbd>
            {' / '}
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 font-mono text-[10px]">
              Space
            </kbd>{' '}
            Jump
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 font-mono text-[10px]">
              Arrow Keys
            </kbd>{' '}
            also work
          </span>
        </div>
      </div>
    </GameShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: draw a heart shape at position                              */
/* ------------------------------------------------------------------ */

function drawHeart(ctx: CanvasRenderingContext2D, hx: number, hy: number) {
  ctx.beginPath();
  ctx.moveTo(hx, hy + 6);
  ctx.bezierCurveTo(hx, hy, hx + 12, hy, hx + 12, hy + 6);
  ctx.bezierCurveTo(hx + 12, hy + 14, hx, hy + 20, hx, hy + 20);
  ctx.moveTo(hx, hy + 6);
  ctx.bezierCurveTo(hx, hy, hx - 12, hy, hx - 12, hy + 6);
  ctx.bezierCurveTo(hx - 12, hy + 14, hx, hy + 20, hx, hy + 20);
  ctx.fill();
}
