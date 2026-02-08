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

const CANVAS_W = 800;
const CANVAS_H = 400;
const UNIT = 30; // pixels per game unit
const CAMERA_LERP = 0.1;

export default function PlatformerRenderer() {
  const { state, events, isGameOver, winner, scores, playerId, dispatch, restart } =
    useGameEngine(PlatformerGame);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const cameraRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const bgGradRef = useRef<CanvasGradient | null>(null);

  const data = (state?.data as unknown as PlatformerData) ?? undefined;

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

    // Camera: smooth follow player
    const targetCamX = px * UNIT - CANVAS_W / 2;
    const targetCamY = py * UNIT - CANVAS_H / 2;
    const cam = cameraRef.current;
    cam.x += (targetCamX - cam.x) * CAMERA_LERP;
    cam.y += (targetCamY - cam.y) * CAMERA_LERP;

    // Clamp camera to level bounds
    cam.x = Math.max(0, Math.min(cam.x, data.levelWidth * UNIT - CANVAS_W));
    cam.y = Math.max(0, Math.min(cam.y, data.levelHeight * UNIT - CANVAS_H));

    // Background gradient (dark sky) — cached
    if (!bgGradRef.current) {
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, '#0b1120');
      grad.addColorStop(1, '#1a1a2e');
      bgGradRef.current = grad;
    }
    ctx.fillStyle = bgGradRef.current;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Helper: world to screen
    const wx = (worldX: number) => worldX * UNIT - cam.x;
    const wy = (worldY: number) => worldY * UNIT - cam.y;

    // Platforms
    for (const plat of data.platforms) {
      const sx = wx(plat.x);
      const sy = wy(plat.y);
      const sw = plat.width * UNIT;
      const sh = plat.height * UNIT;

      // Skip off-screen
      if (sx + sw < 0 || sx > CANVAS_W || sy + sh < 0 || sy > CANVAS_H) continue;

      ctx.fillStyle = '#5c3d2e';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = '#3e2a1f';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, sw, sh);

      // Top edge highlight
      ctx.fillStyle = '#7a5a3e';
      ctx.fillRect(sx, sy, sw, 3);
    }

    // Exit (golden glow)
    {
      const ex = wx(data.exitX);
      const ey = wy(data.exitY);
      const ew = 2 * UNIT;
      const eh = 3 * UNIT;

      // Glow
      const glowGrad = ctx.createRadialGradient(
        ex + ew / 2,
        ey + eh / 2,
        5,
        ex + ew / 2,
        ey + eh / 2,
        ew,
      );
      glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.4)');
      glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(ex - ew / 2, ey - eh / 2, ew * 2, eh * 2);

      // Door
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(ex, ey, ew, eh);
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2;
      ctx.strokeRect(ex, ey, ew, eh);
    }

    // Checkpoints
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

    // Collectibles
    for (const col of data.collectibles) {
      if (col.collected) continue;
      const cx = wx(col.x);
      const cy = wy(col.y);

      if (cx < -20 || cx > CANVAS_W + 20 || cy < -20 || cy > CANVAS_H + 20) continue;

      if (col.type === 'coin') {
        // Yellow circle
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (col.type === 'gem') {
        // Blue diamond (rotated square)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(-7, -7, 14, 14);
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-7, -7, 14, 14);
        ctx.restore();
      } else {
        // Powerup: green circle with star
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Hazards
    for (const haz of data.hazards) {
      const hx = wx(haz.x + (haz.moveOffset || 0));
      const hy = wy(haz.y);
      const hw = haz.width * UNIT;
      const hh = haz.height * UNIT;

      if (hx + hw < -20 || hx > CANVAS_W + 20) continue;

      if (haz.type === 'spikes') {
        // Red triangles along the bottom of the hitbox
        ctx.fillStyle = '#ef4444';
        const spikeCount = Math.max(1, Math.floor(hw / 10));
        const spikeW = hw / spikeCount;
        for (let i = 0; i < spikeCount; i++) {
          ctx.beginPath();
          ctx.moveTo(hx + i * spikeW, hy + hh);
          ctx.lineTo(hx + i * spikeW + spikeW / 2, hy);
          ctx.lineTo(hx + (i + 1) * spikeW, hy + hh);
          ctx.closePath();
          ctx.fill();
        }
      } else if (haz.type === 'moving_enemy') {
        // Red rectangle with eyes
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(hx, hy, hw, hh);
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(hx, hy, hw, hh);

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(hx + hw * 0.2, hy + hh * 0.2, hw * 0.2, hh * 0.25);
        ctx.fillRect(hx + hw * 0.6, hy + hh * 0.2, hw * 0.2, hh * 0.25);
      } else {
        // Falling platform: orange rectangle
        ctx.fillStyle = '#f97316';
        ctx.fillRect(hx, hy, hw, hh);
        ctx.strokeStyle = '#c2410c';
        ctx.lineWidth = 1;
        ctx.strokeRect(hx, hy, hw, hh);
      }
    }

    // Player
    {
      const pw = 1 * UNIT;
      const ph = (player.physics.onGround ? 2 : 1.8) * UNIT;
      const psx = wx(px);
      const psy = wy(py) + (player.physics.onGround ? 0 : 0.2 * UNIT);

      // Body
      ctx.fillStyle = '#14b8a6'; // teal/molt-500
      ctx.fillRect(psx, psy, pw, ph);
      ctx.strokeStyle = '#0d9488';
      ctx.lineWidth = 2;
      ctx.strokeRect(psx, psy, pw, ph);

      // Eyes (show facing direction)
      const eyeX = player.physics.facingRight ? psx + pw * 0.6 : psx + pw * 0.15;
      ctx.fillStyle = '#fff';
      ctx.fillRect(eyeX, psy + 5, 8, 8);
      ctx.fillStyle = '#000';
      ctx.fillRect(player.physics.facingRight ? eyeX + 4 : eyeX, psy + 7, 4, 4);
    }

    // HUD overlay
    // Lives (hearts)
    {
      ctx.fillStyle = '#ef4444';
      for (let i = 0; i < player.lives; i++) {
        const hx = 16 + i * 28;
        const hy = 16;
        // Simple heart shape
        ctx.beginPath();
        ctx.moveTo(hx, hy + 6);
        ctx.bezierCurveTo(hx, hy, hx + 12, hy, hx + 12, hy + 6);
        ctx.bezierCurveTo(hx + 12, hy + 14, hx, hy + 20, hx, hy + 20);
        ctx.moveTo(hx, hy + 6);
        ctx.bezierCurveTo(hx, hy, hx - 12, hy, hx - 12, hy + 6);
        ctx.bezierCurveTo(hx - 12, hy + 14, hx, hy + 20, hx, hy + 20);
        ctx.fill();
      }
    }

    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Score: ${player.score}`, CANVAS_W - 16, 30);

    // Coins
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'right';
    ctx.fillText(`Coins: ${player.coinsCollected}`, CANVAS_W - 16, 52);

    // Reset text alignment
    ctx.textAlign = 'left';
  }, [data, playerId]);

  return (
    <GameShell
      name="Voxel Runner"
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      onRestart={restart}
    >
      <div className="flex flex-col items-center gap-4">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="rounded-lg border border-white/10 bg-black"
          tabIndex={0}
        />
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
