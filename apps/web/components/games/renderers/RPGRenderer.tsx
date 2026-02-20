'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { RPGGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';

interface CharacterStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  mp: number;
  maxMp: number;
}

interface Skill {
  name: string;
  mpCost: number;
  damage: number;
  effect?: 'heal' | 'buff_atk' | 'buff_def';
  effectValue?: number;
}

interface PlayerData {
  stats: CharacterStats;
  level: number;
  xp: number;
  xpToLevel: number;
  skills: Skill[];
  items: Record<string, number>;
  buffs: Record<string, number>;
}

interface Enemy {
  name: string;
  stats: CharacterStats;
  reward: number;
}

interface RPGData {
  players: Record<string, PlayerData>;
  currentEnemy: Enemy | null;
  encounter: number;
  maxEncounters: number;
  turnOrder: string[];
  currentTurnIndex: number;
  combatLog: string[];
}

/* ------------------------------------------------------------------ */
/*  Pixel-art sprite palettes and definitions                          */
/* ------------------------------------------------------------------ */

const HERO_PALETTE: Record<number, string | null> = {
  0: null, // transparent
  1: '#1a1a2e', // dark outline
  2: '#3a3a5e', // mid shadow
  3: '#6366f1', // indigo armor
  4: '#818cf8', // armor highlight
  5: '#fbbf24', // gold accent
  6: '#f5d0a9', // skin
  7: '#d4a574', // skin shadow
  8: '#7c3aed', // cape
  9: '#a78bfa', // cape highlight
  10: '#ffffff', // eye white
  11: '#1e3a5f', // eye pupil
  12: '#e5e7eb', // steel weapon
  13: '#9ca3af', // weapon shadow
};

// 12x16 hero sprite (idle pose with sword)
const HERO_SPRITE: number[][] = [
  [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 5, 5, 5, 5, 1, 0, 0, 0],
  [0, 0, 1, 6, 6, 6, 6, 6, 6, 1, 0, 0],
  [0, 0, 1, 6, 10, 11, 6, 10, 11, 1, 0, 0],
  [0, 0, 1, 7, 6, 6, 6, 6, 6, 1, 0, 0],
  [0, 0, 0, 1, 7, 6, 6, 7, 1, 0, 0, 0],
  [0, 8, 1, 3, 3, 3, 3, 3, 3, 1, 0, 0],
  [0, 8, 1, 3, 4, 3, 3, 4, 3, 1, 12, 0],
  [0, 9, 1, 3, 3, 5, 5, 3, 3, 1, 12, 0],
  [0, 9, 0, 1, 3, 3, 3, 3, 1, 0, 13, 0],
  [0, 8, 0, 1, 6, 1, 1, 6, 1, 0, 12, 0],
  [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 12, 0],
  [0, 0, 0, 1, 2, 1, 1, 2, 1, 0, 0, 0],
  [0, 0, 0, 1, 2, 2, 2, 2, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0],
];

// Enemy sprites: Slime (8x6)
const SLIME_PALETTE: Record<number, string | null> = {
  0: null,
  1: '#166534',
  2: '#22c55e',
  3: '#4ade80',
  4: '#ffffff',
  5: '#1a1a2e',
};
const SLIME_SPRITE: number[][] = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 2, 2, 2, 2, 1, 0],
  [1, 2, 4, 5, 2, 4, 5, 1],
  [1, 2, 3, 2, 2, 3, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 1],
  [0, 1, 1, 1, 1, 1, 1, 0],
];

// Goblin (10x12)
const GOBLIN_PALETTE: Record<number, string | null> = {
  0: null,
  1: '#1a1a2e',
  2: '#4d7c0f',
  3: '#65a30d',
  4: '#84cc16',
  5: '#fbbf24',
  6: '#ffffff',
  7: '#ef4444',
  8: '#713f12',
};
const GOBLIN_SPRITE: number[][] = [
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 2, 2, 2, 2, 1, 0, 0],
  [0, 1, 2, 6, 7, 2, 6, 7, 1, 0],
  [0, 1, 3, 2, 2, 2, 2, 3, 1, 0],
  [0, 0, 1, 2, 7, 7, 2, 1, 0, 0],
  [0, 1, 8, 8, 8, 8, 8, 8, 1, 0],
  [0, 1, 8, 5, 8, 8, 5, 8, 1, 0],
  [0, 0, 1, 8, 8, 8, 8, 1, 0, 0],
  [0, 0, 0, 1, 3, 3, 1, 0, 0, 0],
  [0, 0, 1, 3, 1, 1, 3, 1, 0, 0],
  [0, 0, 1, 2, 0, 0, 2, 1, 0, 0],
  [0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
];

// Skeleton (10x14)
const SKELETON_PALETTE: Record<number, string | null> = {
  0: null,
  1: '#1a1a2e',
  2: '#d4d4d8',
  3: '#f4f4f5',
  4: '#a1a1aa',
  5: '#ef4444',
  6: '#71717a',
};
const SKELETON_SPRITE: number[][] = [
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 3, 3, 3, 3, 1, 0, 0],
  [0, 0, 1, 5, 1, 1, 5, 1, 0, 0],
  [0, 0, 1, 3, 3, 3, 3, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 6, 1, 2, 2, 2, 2, 1, 6, 0],
  [0, 0, 1, 4, 2, 2, 4, 1, 0, 0],
  [0, 0, 0, 1, 2, 2, 1, 0, 0, 0],
  [0, 0, 0, 1, 2, 2, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 4, 4, 1, 0, 0, 0],
  [0, 0, 1, 2, 0, 0, 2, 1, 0, 0],
  [0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
];

// Dark Knight (10x14)
const DARK_KNIGHT_PALETTE: Record<number, string | null> = {
  0: null,
  1: '#0f0f1a',
  2: '#27272a',
  3: '#3f3f46',
  4: '#52525b',
  5: '#ef4444',
  6: '#dc2626',
  7: '#9ca3af',
  8: '#6b7280',
};
const DARK_KNIGHT_SPRITE: number[][] = [
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 2, 3, 3, 2, 1, 0, 0],
  [0, 0, 1, 5, 1, 1, 5, 1, 0, 0],
  [0, 0, 1, 2, 2, 2, 2, 1, 0, 0],
  [0, 0, 0, 1, 6, 6, 1, 0, 0, 0],
  [0, 7, 1, 2, 2, 2, 2, 1, 7, 0],
  [0, 7, 1, 3, 5, 5, 3, 1, 8, 0],
  [0, 8, 1, 2, 2, 2, 2, 1, 7, 0],
  [0, 0, 0, 1, 2, 2, 1, 0, 7, 0],
  [0, 0, 0, 1, 2, 2, 1, 0, 8, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 3, 3, 1, 0, 0, 0],
  [0, 0, 1, 2, 0, 0, 2, 1, 0, 0],
  [0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
];

// Dragon (14x12)
const DRAGON_PALETTE: Record<number, string | null> = {
  0: null,
  1: '#1a1a2e',
  2: '#7f1d1d',
  3: '#b91c1c',
  4: '#ef4444',
  5: '#fbbf24',
  6: '#f97316',
  7: '#ffffff',
};
const DRAGON_SPRITE: number[][] = [
  [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
  [0, 1, 3, 3, 1, 0, 0, 0, 0, 0, 1, 3, 3, 1],
  [1, 3, 4, 4, 3, 1, 1, 1, 1, 1, 3, 4, 4, 3],
  [0, 1, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 1, 0],
  [0, 0, 0, 1, 3, 7, 5, 3, 7, 5, 1, 0, 0, 0],
  [0, 0, 0, 1, 2, 3, 3, 3, 3, 2, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 3, 6, 6, 3, 1, 0, 0, 0, 0],
  [0, 0, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0],
  [0, 1, 4, 1, 2, 5, 2, 2, 5, 2, 1, 4, 1, 0],
  [0, 0, 1, 0, 1, 2, 2, 2, 2, 1, 0, 1, 0, 0],
  [0, 0, 0, 0, 1, 3, 0, 0, 3, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0],
];

const ENEMY_SPRITES: Record<
  string,
  { sprite: number[][]; palette: Record<number, string | null> }
> = {
  Slime: { sprite: SLIME_SPRITE, palette: SLIME_PALETTE },
  Goblin: { sprite: GOBLIN_SPRITE, palette: GOBLIN_PALETTE },
  Skeleton: { sprite: SKELETON_SPRITE, palette: SKELETON_PALETTE },
  'Dark Knight': { sprite: DARK_KNIGHT_SPRITE, palette: DARK_KNIGHT_PALETTE },
  Dragon: { sprite: DRAGON_SPRITE, palette: DRAGON_PALETTE },
};

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
) {
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const idx = sprite[row][col];
      if (idx === 0) continue;
      const color = palette[idx];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.floor(x + col * pixelSize),
        Math.floor(y + row * pixelSize),
        pixelSize,
        pixelSize,
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Battle scene canvas (stars, sprites, particles, effects)           */
/* ------------------------------------------------------------------ */

interface BattleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const BATTLE_W = 500;
const BATTLE_H = 200;

function BattleCanvas({
  enemy,
  enemyHp,
  enemyMaxHp,
  playerHp,
  playerMaxHp,
  combatLogLen,
}: {
  enemy: Enemy;
  enemyHp: number;
  enemyMaxHp: number;
  playerHp: number;
  playerMaxHp: number;
  combatLogLen: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<BattleParticle[]>([]);
  const starsRef = useRef<{ x: number; y: number; brightness: number; speed: number }[]>([]);
  const flashRef = useRef(0);
  const shakeRef = useRef(0);
  const prevLogLenRef = useRef(combatLogLen);
  const prevEnemyHpRef = useRef(enemyHp);
  const prevPlayerHpRef = useRef(playerHp);
  const rafRef = useRef(0);

  // Initialize stars once
  useEffect(() => {
    const stars: typeof starsRef.current = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * BATTLE_W,
        y: Math.random() * BATTLE_H,
        brightness: 0.3 + Math.random() * 0.7,
        speed: 0.1 + Math.random() * 0.3,
      });
    }
    starsRef.current = stars;
  }, []);

  // Detect combat events and spawn particles/flash
  useEffect(() => {
    if (combatLogLen > prevLogLenRef.current) {
      const enemyTookDamage = enemyHp < prevEnemyHpRef.current;
      const playerTookDamage = playerHp < prevPlayerHpRef.current;

      if (enemyTookDamage) {
        // Spawn burst on enemy position
        const cx = BATTLE_W * 0.72;
        const cy = BATTLE_H * 0.45;
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1 + Math.random() * 3;
          particlesRef.current.push({
            x: cx + (Math.random() - 0.5) * 20,
            y: cy + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30 + Math.random() * 20,
            maxLife: 50,
            color: enemyHp <= 0 ? '#fbbf24' : '#ef4444',
            size: 2 + Math.random() * 3,
          });
        }
        if (enemyHp <= 0) {
          flashRef.current = 15;
        }
      }
      if (playerTookDamage) {
        shakeRef.current = 8;
        flashRef.current = 6;
        // Spawn sparks on hero position
        const cx = BATTLE_W * 0.22;
        const cy = BATTLE_H * 0.5;
        for (let i = 0; i < 10; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1 + Math.random() * 2;
          particlesRef.current.push({
            x: cx + (Math.random() - 0.5) * 16,
            y: cy + (Math.random() - 0.5) * 16,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 20 + Math.random() * 15,
            maxLife: 35,
            color: '#ff6b6b',
            size: 2 + Math.random() * 2,
          });
        }
      }
    }
    prevLogLenRef.current = combatLogLen;
    prevEnemyHpRef.current = enemyHp;
    prevPlayerHpRef.current = playerHp;
  }, [combatLogLen, enemyHp, playerHp]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      rafRef.current = requestAnimationFrame(render);

      // Shake offset
      let shakeX = 0;
      let shakeY = 0;
      if (shakeRef.current > 0) {
        shakeX = (Math.random() - 0.5) * shakeRef.current;
        shakeY = (Math.random() - 0.5) * shakeRef.current;
        shakeRef.current -= 0.5;
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Background: dark gradient with atmospheric depth
      const bgGrad = ctx.createLinearGradient(0, 0, 0, BATTLE_H);
      bgGrad.addColorStop(0, '#050510');
      bgGrad.addColorStop(0.4, '#0a0a20');
      bgGrad.addColorStop(0.8, '#121228');
      bgGrad.addColorStop(1, '#1a1a35');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(-10, -10, BATTLE_W + 20, BATTLE_H + 20);

      // Stars: twinkling
      const t = Date.now() * 0.001;
      for (const star of starsRef.current) {
        const twinkle = 0.5 + 0.5 * Math.sin(t * star.speed * 5 + star.x);
        const alpha = star.brightness * twinkle;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        const sz = alpha > 0.6 ? 2 : 1;
        ctx.fillRect(Math.floor(star.x), Math.floor(star.y), sz, sz);
      }

      // Ground: subtle gradient at bottom
      const groundGrad = ctx.createLinearGradient(0, BATTLE_H - 40, 0, BATTLE_H);
      groundGrad.addColorStop(0, 'rgba(30, 30, 60, 0)');
      groundGrad.addColorStop(1, 'rgba(30, 30, 60, 0.8)');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, BATTLE_H - 40, BATTLE_W, 40);

      // Floor line
      ctx.strokeStyle = 'rgba(100, 100, 180, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, BATTLE_H - 20);
      ctx.lineTo(BATTLE_W, BATTLE_H - 20);
      ctx.stroke();

      // Draw hero sprite (left side)
      const heroPixel = 4;
      const heroW = 12 * heroPixel;
      const heroH = 16 * heroPixel;
      const heroX = BATTLE_W * 0.15;
      const heroY = BATTLE_H - 20 - heroH;
      drawPixelSprite(ctx, HERO_SPRITE, HERO_PALETTE, heroX, heroY, heroPixel);

      // Hero shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(heroX + heroW / 2, BATTLE_H - 18, heroW * 0.4, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw enemy sprite (right side)
      const enemyDef = ENEMY_SPRITES[enemy.name];
      if (enemyDef) {
        const eCols = enemyDef.sprite[0].length;
        const eRows = enemyDef.sprite.length;
        // Scale enemy to fill roughly similar visual weight
        const enemyPixel = Math.max(3, Math.min(6, Math.floor(80 / Math.max(eCols, eRows))));
        const eW = eCols * enemyPixel;
        const eH = eRows * enemyPixel;
        const eX = BATTLE_W * 0.65;
        const eY = BATTLE_H - 20 - eH;

        // Enemy shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(eX + eW / 2, BATTLE_H - 18, eW * 0.4, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Enemy glow based on HP
        const hpRatio = enemyHp / enemyMaxHp;
        if (hpRatio < 0.3) {
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 8 + Math.sin(t * 6) * 4;
        }

        drawPixelSprite(ctx, enemyDef.sprite, enemyDef.palette, eX, eY, enemyPixel);
        ctx.shadowBlur = 0;
      } else {
        // Fallback: generic enemy shape
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(BATTLE_W * 0.65, BATTLE_H - 80, 50, 60);
      }

      // Health bars in battle scene
      drawBattleHPBar(ctx, 20, 12, 140, 10, playerHp, playerMaxHp, '#22c55e', '#15803d');
      drawBattleHPBar(ctx, BATTLE_W - 160, 12, 140, 10, enemyHp, enemyMaxHp, '#ef4444', '#991b1b');

      // Name labels above HP bars with drop shadow
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.textAlign = 'left';
      ctx.fillText('HERO', 21, 10);
      ctx.fillStyle = '#a5b4fc';
      ctx.fillText('HERO', 20, 9);

      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(enemy.name.toUpperCase(), BATTLE_W - 19, 10);
      ctx.fillStyle = '#fca5a5';
      ctx.fillText(enemy.name.toUpperCase(), BATTLE_W - 20, 9);
      ctx.textAlign = 'left';

      // Update and draw particles
      const alive: BattleParticle[] = [];
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.life -= 1;
        if (p.life <= 0) continue;
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
        alive.push(p);
      }
      ctx.globalAlpha = 1;
      particlesRef.current = alive;

      // Screen flash (white overlay for critical/kill)
      if (flashRef.current > 0) {
        const flashAlpha = flashRef.current / 15;
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.3})`;
        ctx.fillRect(-10, -10, BATTLE_W + 20, BATTLE_H + 20);
        flashRef.current -= 1;
      }

      // Vignette overlay
      const vigGrad = ctx.createRadialGradient(
        BATTLE_W / 2,
        BATTLE_H / 2,
        BATTLE_W * 0.3,
        BATTLE_W / 2,
        BATTLE_H / 2,
        BATTLE_W * 0.7,
      );
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vigGrad;
      ctx.fillRect(-10, -10, BATTLE_W + 20, BATTLE_H + 20);

      ctx.restore();
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [enemy, enemyHp, enemyMaxHp, playerHp, playerMaxHp]);

  return (
    <canvas
      ref={canvasRef}
      width={BATTLE_W}
      height={BATTLE_H}
      className="rounded-lg border border-white/10 w-full"
      style={{ imageRendering: 'pixelated', maxWidth: BATTLE_W }}
    />
  );
}

function drawBattleHPBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  current: number,
  max: number,
  fillColor: string,
  darkColor: string,
) {
  const ratio = Math.max(0, Math.min(1, current / max));

  // Background with subtle border
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(x, y, w, h);

  // Fill with gradient
  if (ratio > 0) {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(1, darkColor);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w * ratio, h);

    // Highlight shine on top
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x, y, w * ratio, 2);
  }

  // Glow when low
  if (ratio < 0.3 && ratio > 0) {
    ctx.shadowColor = fillColor;
    ctx.shadowBlur = 6;
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w * ratio, h);
    ctx.shadowBlur = 0;
  }

  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

/* ------------------------------------------------------------------ */
/*  Idle scene canvas (dungeon atmosphere when out of combat)           */
/* ------------------------------------------------------------------ */

function IdleCanvas({ encounter, maxEncounters }: { encounter: number; maxEncounters: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const torchParticles: { x: number; y: number; vy: number; life: number; maxLife: number }[] =
      [];

    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      const t = Date.now() * 0.001;

      // Dark dungeon background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, BATTLE_H);
      bgGrad.addColorStop(0, '#030308');
      bgGrad.addColorStop(0.5, '#0a0a18');
      bgGrad.addColorStop(1, '#101025');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, BATTLE_W, BATTLE_H);

      // Stone wall texture (back wall)
      ctx.fillStyle = 'rgba(40, 40, 60, 0.3)';
      for (let bx = 0; bx < BATTLE_W; bx += 30) {
        for (let by = 0; by < BATTLE_H - 40; by += 20) {
          const offset = (Math.floor(by / 20) % 2) * 15;
          ctx.fillRect(bx + offset, by, 28, 18);
          ctx.strokeStyle = 'rgba(20, 20, 40, 0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx + offset, by, 28, 18);
        }
      }

      // Torch glow (two torches on walls)
      const torches = [
        { x: BATTLE_W * 0.2, y: BATTLE_H * 0.35 },
        { x: BATTLE_W * 0.8, y: BATTLE_H * 0.35 },
      ];

      for (const torch of torches) {
        const flicker = 0.7 + 0.3 * Math.sin(t * 8 + torch.x);
        const glowGrad = ctx.createRadialGradient(
          torch.x,
          torch.y,
          2,
          torch.x,
          torch.y,
          60 * flicker,
        );
        glowGrad.addColorStop(0, `rgba(255, 150, 50, ${0.3 * flicker})`);
        glowGrad.addColorStop(0.5, `rgba(255, 100, 30, ${0.1 * flicker})`);
        glowGrad.addColorStop(1, 'rgba(255, 80, 20, 0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(torch.x - 80, torch.y - 80, 160, 160);

        // Torch body
        ctx.fillStyle = '#5c3d2e';
        ctx.fillRect(torch.x - 3, torch.y, 6, 20);
        // Flame
        ctx.fillStyle = `rgba(255, 150, 50, ${flicker})`;
        ctx.beginPath();
        ctx.arc(torch.x, torch.y - 2, 5 * flicker, 0, Math.PI * 2);
        ctx.fill();
      }

      // Spawn torch particles
      if (Math.random() < 0.3) {
        const torch = torches[Math.floor(Math.random() * 2)];
        torchParticles.push({
          x: torch.x + (Math.random() - 0.5) * 6,
          y: torch.y - 4,
          vy: -0.5 - Math.random() * 1,
          life: 20 + Math.random() * 20,
          maxLife: 40,
        });
      }

      // Update and draw torch particles
      for (let i = torchParticles.length - 1; i >= 0; i--) {
        const p = torchParticles[i];
        p.y += p.vy;
        p.x += (Math.random() - 0.5) * 0.5;
        p.life -= 1;
        if (p.life <= 0) {
          torchParticles.splice(i, 1);
          continue;
        }
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = `rgba(255, 180, 80, ${alpha * 0.6})`;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2);
      }

      // Floor
      ctx.fillStyle = 'rgba(30, 30, 50, 0.8)';
      ctx.fillRect(0, BATTLE_H - 30, BATTLE_W, 30);
      ctx.strokeStyle = 'rgba(60, 60, 90, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, BATTLE_H - 30);
      ctx.lineTo(BATTLE_W, BATTLE_H - 30);
      ctx.stroke();

      // Hero standing in the dungeon (centered)
      const heroPixel = 4;
      const heroW = 12 * heroPixel;
      const heroH = 16 * heroPixel;
      const heroX = (BATTLE_W - heroW) / 2;
      const heroY = BATTLE_H - 30 - heroH;

      // Idle breathing animation: slight vertical bob
      const bob = Math.sin(t * 2) * 2;
      drawPixelSprite(ctx, HERO_SPRITE, HERO_PALETTE, heroX, heroY + bob, heroPixel);

      // Hero shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(heroX + heroW / 2, BATTLE_H - 28, heroW * 0.35, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Encounter progress text with drop shadow
      const progressText = `Dungeon Depth: ${encounter} / ${maxEncounters}`;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(progressText, BATTLE_W / 2 + 1, 19);
      ctx.fillStyle = 'rgba(160, 160, 220, 0.7)';
      ctx.fillText(progressText, BATTLE_W / 2, 18);
      ctx.textAlign = 'left';

      // Vignette
      const vigGrad = ctx.createRadialGradient(
        BATTLE_W / 2,
        BATTLE_H / 2,
        BATTLE_W * 0.25,
        BATTLE_W / 2,
        BATTLE_H / 2,
        BATTLE_W * 0.6,
      );
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, BATTLE_W, BATTLE_H);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [encounter, maxEncounters]);

  return (
    <canvas
      ref={canvasRef}
      width={BATTLE_W}
      height={BATTLE_H}
      className="rounded-lg border border-white/10 w-full"
      style={{ imageRendering: 'pixelated', maxWidth: BATTLE_W }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components: HP bar, XP bar (with gradient glow)                */
/* ------------------------------------------------------------------ */

const EMPTY_DATA: RPGData = {
  players: {},
  currentEnemy: null,
  encounter: 0,
  maxEncounters: 10,
  turnOrder: [],
  currentTurnIndex: 0,
  combatLog: [],
};

function HPBar({
  current,
  max,
  color,
  label,
}: {
  current: number;
  max: number;
  color: 'hp' | 'mp' | 'enemy';
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const gradients = {
    hp: 'from-green-500 to-emerald-400',
    mp: 'from-blue-500 to-cyan-400',
    enemy: 'from-red-600 to-rose-400',
  };
  const glowColors = {
    hp: 'shadow-green-500/40',
    mp: 'shadow-blue-500/40',
    enemy: 'shadow-red-500/40',
  };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/60 drop-shadow-sm">{label}</span>
        <span className="font-mono text-white/80 drop-shadow-sm">
          {Math.max(0, current)}/{max}
        </span>
      </div>
      <div className="h-3 bg-white/10 rounded-full overflow-hidden border border-white/5">
        <div
          className={`h-full bg-gradient-to-r ${gradients[color]} rounded-full transition-all duration-300 ease-out shadow-lg ${glowColors[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function XPBar({ xp, xpToLevel }: { xp: number; xpToLevel: number }) {
  const pct = Math.min(100, (xp / xpToLevel) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/60 drop-shadow-sm">XP</span>
        <span className="font-mono text-accent-amber drop-shadow-sm">
          {xp}/{xpToLevel}
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden border border-white/5">
        <div
          className="h-full bg-gradient-to-r from-accent-amber to-yellow-400 rounded-full transition-all duration-300 ease-out shadow-lg shadow-amber-500/30"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main renderer                                                       */
/* ------------------------------------------------------------------ */

export default function RPGRenderer({
  gameName,
  gameConfig,
}: {
  gameName?: string;
  gameConfig?: Record<string, unknown>;
}) {
  const { state, events, isGameOver, winner, scores, dispatch, playerId, restart } = useGameEngine(
    RPGGame,
    gameConfig,
  );

  const logEndRef = useRef<HTMLDivElement>(null);
  const [lastReward, setLastReward] = useState<{ enemy: string; xp: number } | null>(null);

  const data = (state?.data as unknown as RPGData) ?? EMPTY_DATA;
  const player = data.players[playerId] as unknown as PlayerData | undefined;
  const enemy = data.currentEnemy;
  const inCombat = enemy !== null;
  const isPlayerTurn =
    inCombat && data.turnOrder.length > 0 && data.turnOrder[data.currentTurnIndex] === playerId;

  // Auto-scroll combat log (scroll within container, not the page)
  useEffect(() => {
    const container = logEndRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [data.combatLog.length]);

  // Detect enemy defeated for loot summary
  const prevEnemyRef = useRef<Enemy | null>(null);
  useEffect(() => {
    if (prevEnemyRef.current && !enemy) {
      setLastReward({ enemy: prevEnemyRef.current.name, xp: prevEnemyRef.current.reward });
      const timer = setTimeout(() => setLastReward(null), 3000);
      prevEnemyRef.current = enemy;
      return () => clearTimeout(timer);
    }
    prevEnemyRef.current = enemy;
  }, [enemy]);

  const handleStartEncounter = useCallback(() => {
    setLastReward(null);
    dispatch('start_encounter');
  }, [dispatch]);

  const handleAttack = useCallback(() => {
    dispatch('attack');
  }, [dispatch]);

  const handleSkill = useCallback(
    (skillIndex: number) => {
      dispatch('use_skill', { skillIndex });
    },
    [dispatch],
  );

  const handleItem = useCallback(
    (item: string) => {
      dispatch('use_item', { item });
    },
    [dispatch],
  );

  if (!player) {
    return (
      <GameShell
        name={gameName || 'Dungeon Crawl'}
        scores={scores}
        events={events}
        isGameOver={isGameOver}
        winner={winner}
        onRestart={restart}
      >
        <div className="flex items-center justify-center min-h-[400px] text-white/50">
          Loading...
        </div>
      </GameShell>
    );
  }

  const allEncountersDone = data.encounter >= data.maxEncounters && !inCombat;
  const buffKeys = Object.keys(player.buffs);

  return (
    <GameShell
      name={gameName || 'Dungeon Crawl'}
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      onRestart={restart}
    >
      <style jsx>{`
        @keyframes rpg-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-4px);
          }
          75% {
            transform: translateX(4px);
          }
        }
        @keyframes rpg-flash {
          0% {
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes rpg-reward-slide {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          20% {
            opacity: 1;
            transform: translateY(0);
          }
          80% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-10px);
          }
        }
        .rpg-reward {
          animation: rpg-reward-slide 3s ease-out forwards;
        }
        .glass-panel {
          background: rgba(15, 15, 35, 0.6);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            0 0 15px rgba(99, 102, 241, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }
      `}</style>

      <div className="flex flex-col gap-4 min-h-[480px]">
        {/* Encounter counter */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider drop-shadow-sm">
            Encounter {data.encounter}/{data.maxEncounters}
          </span>
          <span className="text-xs font-mono text-accent-amber drop-shadow-sm">
            Lv.{player.level}
          </span>
        </div>

        {/* Battle scene canvas / Idle dungeon scene */}
        {inCombat && enemy ? (
          <div className="flex flex-col gap-3">
            <BattleCanvas
              enemy={enemy}
              enemyHp={enemy.stats.hp}
              enemyMaxHp={enemy.stats.maxHp}
              playerHp={player.stats.hp}
              playerMaxHp={player.stats.maxHp}
              combatLogLen={data.combatLog.length}
            />
            {/* Enemy info bar below canvas */}
            <div className="glass-panel rounded-lg p-3 border border-accent-coral/20">
              <div className="flex items-center justify-between mb-1">
                <span className="font-display font-bold text-lg text-white drop-shadow-sm">
                  {enemy.name}
                </span>
                <span className="text-xs text-white/40 font-mono drop-shadow-sm">
                  ATK {enemy.stats.atk} / DEF {enemy.stats.def}
                </span>
              </div>
              <HPBar current={enemy.stats.hp} max={enemy.stats.maxHp} color="enemy" label="HP" />
            </div>
          </div>
        ) : lastReward ? (
          <div className="flex flex-col gap-3">
            <IdleCanvas encounter={data.encounter} maxEncounters={data.maxEncounters} />
            <div className="rpg-reward glass-panel rounded-lg p-4 border border-accent-amber/30 text-center">
              <span className="text-accent-amber font-display font-bold drop-shadow-sm">
                {lastReward.enemy} defeated!
              </span>
              <span className="text-white/60 ml-2 font-mono text-sm drop-shadow-sm">
                +{lastReward.xp} XP
              </span>
            </div>
          </div>
        ) : !allEncountersDone ? (
          <div className="flex flex-col gap-3">
            <IdleCanvas encounter={data.encounter} maxEncounters={data.maxEncounters} />
            <div className="glass-panel rounded-lg p-6 flex flex-col items-center justify-center">
              <p className="text-white/50 text-sm mb-4 drop-shadow-sm">
                {data.encounter === 0
                  ? 'A dungeon lies ahead...'
                  : 'Prepare for the next encounter'}
              </p>
              <button
                onClick={handleStartEncounter}
                disabled={isGameOver}
                className={[
                  'px-6 py-3 rounded-lg font-display font-bold text-lg',
                  'bg-molt-500 hover:bg-molt-400 text-white',
                  'shadow-lg shadow-molt-500/30 hover:shadow-xl hover:shadow-molt-500/50',
                  'transition-all duration-150 active:scale-95',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'select-none cursor-pointer',
                ].join(' ')}
              >
                Begin Encounter
              </button>
            </div>
          </div>
        ) : (
          <IdleCanvas encounter={data.encounter} maxEncounters={data.maxEncounters} />
        )}

        {/* Player stats panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* HP / MP / XP */}
          <div className="glass-panel rounded-lg p-3 space-y-2">
            <HPBar current={player.stats.hp} max={player.stats.maxHp} color="hp" label="HP" />
            <HPBar current={player.stats.mp} max={player.stats.maxMp} color="mp" label="MP" />
            <XPBar xp={player.xp} xpToLevel={player.xpToLevel} />
          </div>

          {/* Stats + buffs */}
          <div className="glass-panel rounded-lg p-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50 drop-shadow-sm">ATK</span>
                <span className="font-mono text-white drop-shadow-sm">
                  {player.stats.atk}
                  {player.buffs['buff_atk'] ? (
                    <span className="text-accent-amber ml-1">+5</span>
                  ) : null}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50 drop-shadow-sm">DEF</span>
                <span className="font-mono text-white drop-shadow-sm">
                  {player.stats.def}
                  {player.buffs['buff_def'] ? (
                    <span className="text-neon-cyan ml-1">+5</span>
                  ) : null}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50 drop-shadow-sm">SPD</span>
                <span className="font-mono text-white drop-shadow-sm">{player.stats.spd}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50 drop-shadow-sm">Level</span>
                <span className="font-mono text-accent-amber drop-shadow-sm">{player.level}</span>
              </div>
            </div>
            {buffKeys.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {buffKeys.map((b) => (
                  <span
                    key={b}
                    className={[
                      'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase',
                      b === 'buff_atk'
                        ? 'bg-accent-amber/20 text-accent-amber'
                        : 'bg-neon-cyan/20 text-neon-cyan',
                    ].join(' ')}
                  >
                    {b === 'buff_atk' ? 'ATK UP' : 'DEF UP'} ({player.buffs[b]}t)
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action bar: only shown during combat, dimmed on enemy turn */}
        {inCombat && (
          <div
            className={`glass-panel rounded-lg p-3 space-y-2.5 transition-opacity duration-200 ${isPlayerTurn ? '' : 'opacity-30 pointer-events-none'}`}
          >
            {/* Turn indicator */}
            <div className="text-xs font-semibold text-center drop-shadow-sm">
              {isPlayerTurn ? (
                <span className="text-molt-400">Your turn: choose an action</span>
              ) : (
                <span className="text-white/40">Waiting...</span>
              )}
            </div>

            {/* Attack */}
            <button
              onClick={handleAttack}
              disabled={!isPlayerTurn || isGameOver}
              className={[
                'w-full py-2.5 rounded-lg font-display font-bold',
                'bg-red-600/80 hover:bg-red-500 text-white',
                'shadow-lg shadow-red-600/20 hover:shadow-red-500/30',
                'transition-all duration-150 active:scale-[0.98]',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'select-none cursor-pointer',
              ].join(' ')}
            >
              Attack
            </button>

            {/* Skills row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {player.skills.map((skill, i) => {
                const canUse = isPlayerTurn && player.stats.mp >= skill.mpCost && !isGameOver;
                return (
                  <button
                    key={skill.name}
                    onClick={() => handleSkill(i)}
                    disabled={!canUse}
                    className={[
                      'py-2 px-2 rounded-lg text-xs font-semibold',
                      'bg-blue-600/20 border border-blue-500/30 text-blue-300',
                      'hover:bg-blue-600/40 hover:border-blue-400/50',
                      'transition-all duration-150 active:scale-95',
                      'disabled:opacity-30 disabled:cursor-not-allowed',
                      'select-none cursor-pointer',
                    ].join(' ')}
                  >
                    <div>{skill.name}</div>
                    <div className="text-[10px] text-blue-400/70 font-mono mt-0.5">
                      {skill.mpCost} MP
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Items row */}
            <div className="flex gap-2">
              <button
                onClick={() => handleItem('Potion')}
                disabled={!isPlayerTurn || (player.items['Potion'] ?? 0) <= 0 || isGameOver}
                className={[
                  'flex-1 py-2 rounded-lg text-xs font-semibold',
                  'bg-green-600/20 border border-green-500/30 text-green-300',
                  'hover:bg-green-600/40 hover:border-green-400/50',
                  'transition-all duration-150 active:scale-95',
                  'disabled:opacity-30 disabled:cursor-not-allowed',
                  'select-none cursor-pointer',
                ].join(' ')}
              >
                Potion ({player.items['Potion'] ?? 0})
                <span className="block text-[10px] text-green-400/70 font-mono">+50 HP</span>
              </button>
              <button
                onClick={() => handleItem('Ether')}
                disabled={!isPlayerTurn || (player.items['Ether'] ?? 0) <= 0 || isGameOver}
                className={[
                  'flex-1 py-2 rounded-lg text-xs font-semibold',
                  'bg-cyan-600/20 border border-cyan-500/30 text-cyan-300',
                  'hover:bg-cyan-600/40 hover:border-cyan-400/50',
                  'transition-all duration-150 active:scale-95',
                  'disabled:opacity-30 disabled:cursor-not-allowed',
                  'select-none cursor-pointer',
                ].join(' ')}
              >
                Ether ({player.items['Ether'] ?? 0})
                <span className="block text-[10px] text-cyan-400/70 font-mono">+20 MP</span>
              </button>
            </div>
          </div>
        )}

        {/* Combat log */}
        {data.combatLog.length > 0 && (
          <div className="glass-panel rounded-lg p-3">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 drop-shadow-sm">
              Combat Log
            </h3>
            <div className="max-h-32 overflow-y-auto space-y-0.5 scrollbar-thin">
              {data.combatLog.slice(-8).map((msg, i) => (
                <p
                  key={`${data.combatLog.length - 8 + i}-${msg.slice(0, 20)}`}
                  className="text-xs font-mono text-white/60 leading-relaxed drop-shadow-sm"
                >
                  {msg}
                </p>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
