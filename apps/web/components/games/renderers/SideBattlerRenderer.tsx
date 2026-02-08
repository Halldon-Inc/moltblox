'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { SideBattlerGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';
import {
  WARRIOR_PIXELS,
  WARRIOR_PALETTE,
  MAGE_PIXELS,
  MAGE_PALETTE,
  ARCHER_PIXELS,
  ARCHER_PALETTE,
  HEALER_PIXELS,
  HEALER_PALETTE,
} from './side-battler-sprites';

// --- Type definitions matching game logic ---

interface BattlerCharacter {
  classType: 'warrior' | 'mage' | 'archer' | 'healer';
  name: string;
  stats: {
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    atk: number;
    def: number;
    spd: number;
    matk: number;
    mdef: number;
  };
  skills: { name: string; mpCost: number }[];
  statusEffects: { type: string; turnsRemaining: number }[];
  row: 'front' | 'back';
  isDefending: boolean;
}

interface BattlerEnemy {
  name: string;
  stats: {
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    spd: number;
    matk?: number;
    mdef?: number;
  };
  statusEffects: { type: string; turnsRemaining: number }[];
  isBoss?: boolean;
}

interface SideBattlerData {
  party: BattlerCharacter[];
  enemies: BattlerEnemy[];
  currentWave: number;
  maxWaves: number;
  turnOrder: { id: string; type: 'party' | 'enemy'; index: number }[];
  currentTurnIndex: number;
  selectedTarget: number;
  battlePhase: 'prep' | 'combat' | 'wave_clear' | 'victory' | 'defeat';
  combatLog: string[];
  totalKills: number;
  totalTurns: number;
}

// --- Canvas constants ---

const CANVAS_W = 960;
const CANVAS_H = 540;
const SPRITE_SIZE = 32;
const BOSS_SIZE = 64;

// --- Animation types ---

type AnimState = 'idle' | 'attack' | 'hit' | 'death' | 'cast';

interface AnimInfo {
  state: AnimState;
  frame: number;
  timer: number;
}

interface DamageNumber {
  x: number;
  y: number;
  value: string;
  color: string;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// Sprite pixel data imported from ./side-battler-sprites.ts

// --- Sprite generation helpers ---

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function createSprite(pixelData: number[][], palette: string[]): HTMLCanvasElement {
  const h = pixelData.length;
  const w = pixelData[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = pixelData[y][x];
      const off = (y * w + x) * 4;
      if (idx === 0) {
        imageData.data[off + 3] = 0;
      } else {
        const [r, g, b] = hexToRgb(palette[idx]);
        imageData.data[off] = r;
        imageData.data[off + 1] = g;
        imageData.data[off + 2] = b;
        imageData.data[off + 3] = 255;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Generate a simple enemy sprite procedurally using canvas drawing
function createEnemySprite(name: string, isBoss: boolean): HTMLCanvasElement {
  const size = isBoss ? BOSS_SIZE : SPRITE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const n = name.toLowerCase();

  if (n.includes('slime')) {
    // Green blob
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(size / 2, size * 0.65, size * 0.4, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.ellipse(size / 2, size * 0.7, size * 0.35, size * 0.15, 0, 0, Math.PI);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(size * 0.35, size * 0.5, 4, 4);
    ctx.fillRect(size * 0.55, size * 0.5, 4, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(size * 0.37, size * 0.52, 2, 2);
    ctx.fillRect(size * 0.57, size * 0.52, 2, 2);
  } else if (n.includes('goblin')) {
    // Short hunched figure
    ctx.fillStyle = '#6B8E23';
    // Body
    ctx.fillRect(size * 0.3, size * 0.35, size * 0.4, size * 0.35);
    // Head
    ctx.fillStyle = '#9ACD32';
    ctx.fillRect(size * 0.35, size * 0.15, size * 0.3, size * 0.25);
    // Eyes
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(size * 0.4, size * 0.22, 3, 3);
    ctx.fillRect(size * 0.55, size * 0.22, 3, 3);
    // Club
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(size * 0.65, size * 0.3, 4, size * 0.35);
    ctx.fillRect(size * 0.62, size * 0.25, 10, 6);
    // Legs
    ctx.fillStyle = '#6B8E23';
    ctx.fillRect(size * 0.35, size * 0.7, 5, size * 0.15);
    ctx.fillRect(size * 0.55, size * 0.7, 5, size * 0.15);
  } else if (n.includes('skeleton')) {
    // Bone-white skeletal figure
    ctx.fillStyle = '#E8E8E8';
    // Skull (larger, rounder)
    ctx.fillRect(size * 0.33, size * 0.08, size * 0.34, size * 0.22);
    ctx.fillStyle = '#D0D0D0';
    ctx.fillRect(size * 0.35, size * 0.1, size * 0.3, size * 0.18);
    // Eye sockets
    ctx.fillStyle = '#000';
    ctx.fillRect(size * 0.38, size * 0.14, 4, 5);
    ctx.fillRect(size * 0.56, size * 0.14, 4, 5);
    // Eye glow
    ctx.fillStyle = '#66ffff';
    ctx.fillRect(size * 0.39, size * 0.15, 2, 3);
    ctx.fillRect(size * 0.57, size * 0.15, 2, 3);
    // Jaw
    ctx.fillStyle = '#D0D0D0';
    ctx.fillRect(size * 0.4, size * 0.24, size * 0.2, 3);
    // Spine
    ctx.fillStyle = '#E8E8E8';
    ctx.fillRect(size * 0.45, size * 0.3, size * 0.1, size * 0.25);
    // Ribcage (thicker ribs)
    ctx.fillRect(size * 0.32, size * 0.32, size * 0.36, 3);
    ctx.fillRect(size * 0.34, size * 0.37, size * 0.32, 3);
    ctx.fillRect(size * 0.36, size * 0.42, size * 0.28, 3);
    // Arms (thicker bones)
    ctx.fillRect(size * 0.2, size * 0.32, size * 0.12, 4);
    ctx.fillRect(size * 0.68, size * 0.32, size * 0.12, 4);
    // Forearms angled down
    ctx.fillRect(size * 0.18, size * 0.36, 4, size * 0.12);
    ctx.fillRect(size * 0.78, size * 0.36, 4, size * 0.12);
    // Pelvis
    ctx.fillRect(size * 0.38, size * 0.55, size * 0.24, 4);
    // Legs (thicker)
    ctx.fillRect(size * 0.38, size * 0.59, 5, size * 0.22);
    ctx.fillRect(size * 0.57, size * 0.59, 5, size * 0.22);
    // Feet
    ctx.fillRect(size * 0.35, size * 0.79, 8, 3);
    ctx.fillRect(size * 0.57, size * 0.79, 8, 3);
    // Sword (if warrior type)
    if (n.includes('warrior')) {
      ctx.fillStyle = '#A0AEC0';
      ctx.fillRect(size * 0.82, size * 0.15, 3, size * 0.35);
      ctx.fillStyle = '#C0C0C0';
      ctx.fillRect(size * 0.8, size * 0.12, 7, 4);
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(size * 0.79, size * 0.49, 9, 4);
    }
    // Staff (if mage type)
    if (n.includes('mage')) {
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(size * 0.15, size * 0.1, 3, size * 0.7);
      ctx.fillStyle = '#9333EA';
      ctx.beginPath();
      ctx.arc(size * 0.165, size * 0.1, 4, 0, Math.PI * 2);
      ctx.fill();
      // Magical glow
      ctx.fillStyle = 'rgba(147, 51, 234, 0.25)';
      ctx.beginPath();
      ctx.arc(size * 0.165, size * 0.1, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (n.includes('shadow') || n.includes('assassin')) {
    // Stealthy dark figure with daggers
    ctx.fillStyle = '#1a1a1a';
    // Hood
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.18, size * 0.14, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(size * 0.36, size * 0.18, size * 0.28, size * 0.08);
    // Face (barely visible)
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(size * 0.4, size * 0.2, size * 0.2, size * 0.06);
    // Eyes (red slits)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(size * 0.42, size * 0.21, 3, 2);
    ctx.fillRect(size * 0.55, size * 0.21, 3, 2);
    // Body (slim)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(size * 0.38, size * 0.26, size * 0.24, size * 0.3);
    // Cape (flowing)
    ctx.fillStyle = '#2a0a2a';
    ctx.beginPath();
    ctx.moveTo(size * 0.35, size * 0.28);
    ctx.lineTo(size * 0.25, size * 0.6);
    ctx.lineTo(size * 0.38, size * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.65, size * 0.28);
    ctx.lineTo(size * 0.75, size * 0.6);
    ctx.lineTo(size * 0.62, size * 0.56);
    ctx.closePath();
    ctx.fill();
    // Legs
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(size * 0.4, size * 0.56, 4, size * 0.22);
    ctx.fillRect(size * 0.56, size * 0.56, 4, size * 0.22);
    // Daggers
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(size * 0.22, size * 0.35, 2, size * 0.2);
    ctx.fillRect(size * 0.76, size * 0.35, 2, size * 0.2);
    ctx.fillStyle = '#A0AEC0';
    ctx.fillRect(size * 0.2, size * 0.33, 6, 2);
    ctx.fillRect(size * 0.74, size * 0.33, 6, 2);
    // Shadow aura
    ctx.fillStyle = 'rgba(100, 0, 100, 0.2)';
    ctx.beginPath();
    ctx.arc(size / 2, size * 0.45, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (n.includes('dark') || n.includes('knight')) {
    // Armored dark figure
    ctx.fillStyle = '#1a1a2e';
    // Body
    ctx.fillRect(size * 0.3, size * 0.25, size * 0.4, size * 0.4);
    // Helmet
    ctx.fillStyle = '#2D2D44';
    ctx.fillRect(size * 0.32, size * 0.08, size * 0.36, size * 0.22);
    ctx.fillStyle = '#9333EA';
    ctx.fillRect(size * 0.4, size * 0.16, size * 0.2, 3); // visor glow
    // Shoulders
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(size * 0.2, size * 0.25, size * 0.15, size * 0.1);
    ctx.fillRect(size * 0.65, size * 0.25, size * 0.15, size * 0.1);
    // Legs
    ctx.fillRect(size * 0.35, size * 0.65, size * 0.12, size * 0.2);
    ctx.fillRect(size * 0.53, size * 0.65, size * 0.12, size * 0.2);
    // Dark glow
    ctx.fillStyle = 'rgba(147, 51, 234, 0.3)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (n.includes('dragon') || isBoss) {
    // Large dragon boss
    ctx.fillStyle = '#8B0000';
    // Body
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size * 0.55, size * 0.3, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = '#A52A2A';
    ctx.beginPath();
    ctx.ellipse(size * 0.25, size * 0.35, size * 0.12, size * 0.1, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Eye
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(size * 0.2, size * 0.32, 4, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(size * 0.21, size * 0.33, 2, 2);
    // Wings
    ctx.fillStyle = '#660000';
    ctx.beginPath();
    ctx.moveTo(size * 0.4, size * 0.4);
    ctx.lineTo(size * 0.7, size * 0.1);
    ctx.lineTo(size * 0.85, size * 0.25);
    ctx.lineTo(size * 0.65, size * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.35);
    ctx.lineTo(size * 0.8, size * 0.05);
    ctx.lineTo(size * 0.95, size * 0.2);
    ctx.lineTo(size * 0.7, size * 0.4);
    ctx.closePath();
    ctx.fill();
    // Tail
    ctx.fillStyle = '#8B0000';
    ctx.beginPath();
    ctx.moveTo(size * 0.75, size * 0.55);
    ctx.quadraticCurveTo(size * 0.9, size * 0.7, size * 0.95, size * 0.5);
    ctx.lineTo(size * 0.85, size * 0.55);
    ctx.quadraticCurveTo(size * 0.8, size * 0.65, size * 0.7, size * 0.58);
    ctx.fill();
    // Fire breath
    ctx.fillStyle = 'rgba(255, 165, 0, 0.6)';
    ctx.beginPath();
    ctx.moveTo(size * 0.15, size * 0.35);
    ctx.lineTo(size * 0.02, size * 0.25);
    ctx.lineTo(size * 0.02, size * 0.45);
    ctx.closePath();
    ctx.fill();
    // Legs
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(size * 0.35, size * 0.72, 6, size * 0.15);
    ctx.fillRect(size * 0.55, size * 0.72, 6, size * 0.15);
  } else {
    // Generic enemy: purple blob
    ctx.fillStyle = '#7C3AED';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(size * 0.38, size * 0.4, 4, 4);
    ctx.fillRect(size * 0.58, size * 0.4, 4, 4);
  }

  return canvas;
}

// --- Positions for party and enemies ---

// Ground line Y â€” must match the background render
const GROUND_Y = CANVAS_H * 0.72;

const partyPosCache = new Map<number, { x: number; y: number }[]>();
function getPartyPositions(count: number): { x: number; y: number }[] {
  const cached = partyPosCache.get(count);
  if (cached) return cached;
  // Party sprites are 32px drawn at 2x (64px). They render from drawY-16 to drawY+48.
  // Align feet (drawY+48) with the ground line. Stagger upward for depth.
  const feetOffset = 48;
  const bottomDrawY = GROUND_Y - feetOffset;
  const spacing = 28;
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    positions.push({
      x: 100 + (i % 2) * 40,
      y: bottomDrawY - (count - 1 - i) * spacing,
    });
  }
  partyPosCache.set(count, positions);
  return positions;
}

const enemyPosCache = new Map<number, { x: number; y: number }[]>();
function getEnemyPositions(count: number): { x: number; y: number }[] {
  const cached = enemyPosCache.get(count);
  if (cached) return cached;
  // Regular enemy sprites are 32px at 2x (64px), drawn from drawY to drawY+64.
  // Boss sprites are 64px at 2x (128px) â€” handled by an offset in the render loop.
  const feetOffset = 64;
  const bottomDrawY = GROUND_Y - feetOffset;
  const spacing = 28;
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    positions.push({
      x: 750 - (i % 2) * 40,
      y: bottomDrawY - (count - 1 - i) * spacing,
    });
  }
  enemyPosCache.set(count, positions);
  return positions;
}

// --- Main Component ---

export default function SideBattlerRenderer() {
  const { state, events, isGameOver, winner, scores, playerId, dispatch, restart } =
    useGameEngine(SideBattlerGame);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const skyGradRef = useRef<CanvasGradient | null>(null);
  const frameCountRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Sprite cache
  const spriteCacheRef = useRef<Record<string, HTMLCanvasElement>>({});
  // Animation state per character/enemy
  const animRef = useRef<Record<string, AnimInfo>>({});
  // Floating damage numbers
  const damageNumsRef = useRef<DamageNumber[]>([]);
  // Particles
  const particlesRef = useRef<Particle[]>([]);
  // Background star positions (generated once)
  const starsRef = useRef<{ x: number; y: number; size: number; brightness: number }[]>([]);
  // Track previous enemy HP to detect hits
  const prevEnemyHpRef = useRef<number[]>([]);
  const prevPartyHpRef = useRef<number[]>([]);
  // Track if we already auto-ticked
  const autoTickingRef = useRef(false);

  const [selectedTarget, setSelectedTarget] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const data = (state?.data as unknown as SideBattlerData) ?? undefined;

  // Generate stars once
  useEffect(() => {
    if (starsRef.current.length === 0) {
      const stars: typeof starsRef.current = [];
      for (let i = 0; i < 80; i++) {
        stars.push({
          x: Math.random() * CANVAS_W,
          y: Math.random() * CANVAS_H * 0.5,
          size: Math.random() * 2 + 0.5,
          brightness: Math.random() * 0.5 + 0.5,
        });
      }
      starsRef.current = stars;
    }
  }, []);

  // Generate sprites on mount
  useEffect(() => {
    const cache = spriteCacheRef.current;
    if (!cache['warrior']) {
      cache['warrior'] = createSprite(WARRIOR_PIXELS, WARRIOR_PALETTE);
      cache['mage'] = createSprite(MAGE_PIXELS, MAGE_PALETTE);
      cache['archer'] = createSprite(ARCHER_PIXELS, ARCHER_PALETTE);
      cache['healer'] = createSprite(HEALER_PIXELS, HEALER_PALETTE);
    }
  }, []);

  // Generate enemy sprites when enemies change
  useEffect(() => {
    if (!data) return;
    const cache = spriteCacheRef.current;
    for (const enemy of data.enemies) {
      const key = `enemy_${enemy.name}_${enemy.isBoss ? 'boss' : 'normal'}`;
      if (!cache[key]) {
        cache[key] = createEnemySprite(enemy.name, !!enemy.isBoss);
      }
    }
  }, [data?.currentWave, data?.enemies?.length]);

  // Detect HP changes and trigger animations + damage numbers
  useEffect(() => {
    if (!data) return;

    // Check enemy HP changes
    for (let i = 0; i < data.enemies.length; i++) {
      const prevHp = prevEnemyHpRef.current[i];
      const curHp = data.enemies[i].stats.hp;
      if (prevHp !== undefined && curHp < prevHp) {
        const dmg = prevHp - curHp;
        const pos = getEnemyPositions(data.enemies.length)[i];
        if (pos) {
          damageNumsRef.current.push({
            x: pos.x,
            y: pos.y - 20,
            value: `-${dmg}`,
            color: '#ef4444',
            life: 60,
          });
          animRef.current[`enemy_${i}`] = { state: 'hit', frame: 0, timer: 0 };
        }
      }
    }
    prevEnemyHpRef.current = data.enemies.map((e) => e.stats.hp);

    // Check party HP changes
    for (let i = 0; i < data.party.length; i++) {
      const prevHp = prevPartyHpRef.current[i];
      const curHp = data.party[i].stats.hp;
      if (prevHp !== undefined && curHp !== prevHp) {
        const pos = getPartyPositions(data.party.length)[i];
        if (pos) {
          const diff = curHp - prevHp;
          damageNumsRef.current.push({
            x: pos.x,
            y: pos.y - 20,
            value: diff > 0 ? `+${diff}` : `${diff}`,
            color: diff > 0 ? '#22c55e' : '#ef4444',
            life: 60,
          });
          if (diff < 0) {
            animRef.current[`party_${i}`] = { state: 'hit', frame: 0, timer: 0 };
          }
        }
      }
    }
    prevPartyHpRef.current = data.party.map((p) => p.stats.hp);
  }, [data?.enemies, data?.party]);

  // Auto-scroll combat log (scroll within the container, not the page)
  useEffect(() => {
    const container = logEndRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [data?.combatLog?.length]);

  // Auto-tick for enemy turns
  useEffect(() => {
    if (!data || data.battlePhase !== 'combat' || isGameOver) return;
    if (data.turnOrder.length === 0) return;

    const current = data.turnOrder[data.currentTurnIndex];
    if (!current || current.type !== 'enemy') {
      autoTickingRef.current = false;
      return;
    }

    // It's an enemy's turn, auto-tick after a short delay
    if (autoTickingRef.current) return;
    autoTickingRef.current = true;

    const timer = setTimeout(() => {
      dispatch('auto_tick', {});
      autoTickingRef.current = false;
    }, 600);

    return () => {
      clearTimeout(timer);
      autoTickingRef.current = false;
    };
  }, [data?.currentTurnIndex, data?.battlePhase, data?.totalTurns, dispatch, isGameOver]);

  // Keep mutable refs so the RAF loop never tears down on state changes
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const selectedTargetRef = useRef(selectedTarget);
  useEffect(() => {
    selectedTargetRef.current = selectedTarget;
  }, [selectedTarget]);

  // --- Canvas render loop ---
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const data = dataRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame = frameCountRef.current++;

    // --- Background: parallax sky --- cached gradient
    if (!skyGradRef.current) {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      skyGrad.addColorStop(0, '#0a0a1a');
      skyGrad.addColorStop(0.4, '#1a1a3e');
      skyGrad.addColorStop(1, '#2a1a2e');
      skyGradRef.current = skyGrad;
    }
    ctx.fillStyle = skyGradRef.current;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Stars (twinkling)
    for (const star of starsRef.current) {
      const twinkle = star.brightness + Math.sin(frame * 0.05 + star.x) * 0.2;
      ctx.globalAlpha = Math.max(0.2, Math.min(1, twinkle));
      ctx.fillStyle = '#fff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;

    // Layer 2: Mountain silhouettes
    ctx.fillStyle = '#1a1a3e';
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H * 0.55);
    const mountainOffset = Math.sin(frame * 0.002) * 2;
    for (let x = 0; x <= CANVAS_W; x += 60) {
      const h = Math.sin(x * 0.008 + 1) * 60 + Math.sin(x * 0.015) * 30 + mountainOffset;
      ctx.lineTo(x, CANVAS_H * 0.5 - h);
    }
    ctx.lineTo(CANVAS_W, CANVAS_H);
    ctx.lineTo(0, CANVAS_H);
    ctx.closePath();
    ctx.fill();

    // Layer 2b: Nearer mountains
    ctx.fillStyle = '#252545';
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H * 0.65);
    for (let x = 0; x <= CANVAS_W; x += 40) {
      const h = Math.sin(x * 0.012 + 3) * 40 + Math.sin(x * 0.02 + 1) * 20;
      ctx.lineTo(x, CANVAS_H * 0.6 - h);
    }
    ctx.lineTo(CANVAS_W, CANVAS_H);
    ctx.lineTo(0, CANVAS_H);
    ctx.closePath();
    ctx.fill();

    // Layer 3: Ground / arena floor
    ctx.fillStyle = '#3a3a5a';
    ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);
    // Stone tile pattern
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 48) {
      for (let y = GROUND_Y; y < CANVAS_H; y += 24) {
        const xOff = (Math.floor((y - GROUND_Y) / 24) % 2) * 24;
        ctx.strokeRect(x + xOff, y, 48, 24);
      }
    }

    // Ground edge highlight
    ctx.fillStyle = '#5a5a7a';
    ctx.fillRect(0, GROUND_Y, CANVAS_W, 3);

    // --- Draw party characters ---
    const partyPositions = getPartyPositions(data.party.length);
    for (let i = 0; i < data.party.length; i++) {
      const char = data.party[i];
      const pos = partyPositions[i];
      if (!pos) continue;

      const animKey = `party_${i}`;
      const anim = animRef.current[animKey] || { state: 'idle' as AnimState, frame: 0, timer: 0 };

      // Update animation timer
      anim.timer++;
      if (anim.state === 'idle') {
        anim.frame = Math.floor(anim.timer / 15) % 4;
      } else if (anim.state === 'hit') {
        if (anim.timer > 16) {
          anim.state = 'idle';
          anim.timer = 0;
        }
      } else if (anim.state === 'attack') {
        if (anim.timer > 24) {
          anim.state = 'idle';
          anim.timer = 0;
        }
      } else if (anim.state === 'cast') {
        if (anim.timer > 30) {
          anim.state = 'idle';
          anim.timer = 0;
        }
      }
      animRef.current[animKey] = anim;

      // Calculate draw position with animation offsets
      let drawX = pos.x;
      let drawY = pos.y;
      let opacity = 1;

      // Idle bob
      if (anim.state === 'idle') {
        drawY += Math.sin(frame * 0.08 + i) * 2;
      }
      // Hit knockback + flash
      if (anim.state === 'hit') {
        drawX -= 5;
        if (anim.timer % 4 < 2) opacity = 0.5;
      }
      // Attack lunge
      if (anim.state === 'attack') {
        const t = anim.timer / 24;
        if (t < 0.25) drawX += 0;
        else if (t < 0.5) drawX += 30 * ((t - 0.25) / 0.25);
        else if (t < 0.75) drawX += 30;
        else drawX += 30 * (1 - (t - 0.75) / 0.25);
      }
      // Death
      if (char.stats.hp <= 0) {
        opacity = 0.4;
        drawY += 10;
      }

      // Turn indicator: pulsing glow
      const currentTurn = data.turnOrder[data.currentTurnIndex];
      if (
        currentTurn &&
        currentTurn.type === 'party' &&
        currentTurn.index === i &&
        data.battlePhase === 'combat'
      ) {
        const pulse = Math.sin(frame * 0.1) * 0.3 + 0.5;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 3;
        ctx.strokeRect(drawX - 6, drawY - 6, SPRITE_SIZE + 12, SPRITE_SIZE + 12);
        ctx.globalAlpha = 1;
        ctx.restore();

        // Arrow above
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(drawX + SPRITE_SIZE / 2, drawY - 18);
        ctx.lineTo(drawX + SPRITE_SIZE / 2 - 6, drawY - 10);
        ctx.lineTo(drawX + SPRITE_SIZE / 2 + 6, drawY - 10);
        ctx.closePath();
        ctx.fill();
      }

      // Draw sprite
      const spriteKey = char.classType;
      const sprite = spriteCacheRef.current[spriteKey];
      if (sprite) {
        ctx.save();
        ctx.globalAlpha = opacity;
        // Draw scaled up 2x
        ctx.drawImage(
          sprite,
          drawX - SPRITE_SIZE / 2,
          drawY - SPRITE_SIZE / 2,
          SPRITE_SIZE * 2,
          SPRITE_SIZE * 2,
        );
        ctx.restore();
      }

      // Defending shield overlay
      if (char.isDefending) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(
          drawX + SPRITE_SIZE / 2,
          drawY + SPRITE_SIZE / 2,
          SPRITE_SIZE * 0.8,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // HP bar
      const barY = drawY - 24;
      const barW = 48;
      const barH = 5;
      const hpPct = Math.max(0, char.stats.hp / char.stats.maxHp);
      ctx.fillStyle = '#333';
      ctx.fillRect(drawX - 4, barY, barW, barH);
      ctx.fillStyle = hpPct < 0.3 ? '#eab308' : '#22c55e';
      ctx.fillRect(drawX - 4, barY, barW * hpPct, barH);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.strokeRect(drawX - 4, barY, barW, barH);

      // MP bar
      const mpBarY = barY + barH + 1;
      const mpPct = Math.max(0, char.stats.mp / char.stats.maxMp);
      ctx.fillStyle = '#1a1a4e';
      ctx.fillRect(drawX - 4, mpBarY, barW, 3);
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(drawX - 4, mpBarY, barW * mpPct, 3);

      // Status effect dots
      const dotY = drawY + SPRITE_SIZE * 2 + 4;
      for (let s = 0; s < char.statusEffects.length; s++) {
        const eff = char.statusEffects[s];
        let dotColor = '#888';
        if (eff.type === 'poison') dotColor = '#22c55e';
        else if (eff.type === 'def_up') dotColor = '#3b82f6';
        else if (eff.type === 'taunt') dotColor = '#ef4444';
        else if (eff.type === 'mana_shield') dotColor = '#a855f7';
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(drawX + s * 8, dotY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Name label
      ctx.fillStyle = '#ccc';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(char.name, drawX + SPRITE_SIZE / 2, drawY + SPRITE_SIZE * 2 + 16);
      ctx.textAlign = 'left';
    }

    // --- Draw enemies ---
    const enemyPositions = getEnemyPositions(data.enemies.length);
    for (let i = 0; i < data.enemies.length; i++) {
      const enemy = data.enemies[i];
      const pos = enemyPositions[i];
      if (!pos) continue;

      const animKey = `enemy_${i}`;
      const anim = animRef.current[animKey] || { state: 'idle' as AnimState, frame: 0, timer: 0 };

      anim.timer++;
      if (anim.state === 'hit') {
        if (anim.timer > 16) {
          anim.state = 'idle';
          anim.timer = 0;
        }
      }
      animRef.current[animKey] = anim;

      let drawX = pos.x;
      // Boss sprites are 128px tall vs 64px regular â€” shift up so feet stay on ground
      let drawY = enemy.isBoss ? pos.y - (BOSS_SIZE * 2 - SPRITE_SIZE * 2) : pos.y;
      let opacity = 1;

      // Idle bob
      if (anim.state === 'idle') {
        drawY += Math.sin(frame * 0.08 + i + 3) * 2;
      }
      // Hit flash
      if (anim.state === 'hit') {
        drawX += 5;
        if (anim.timer % 4 < 2) opacity = 0.5;
      }
      // Death
      if (enemy.stats.hp <= 0) {
        opacity = 0.3;
        drawY += 15;
      }

      // Selected target indicator
      if (selectedTargetRef.current === i && data.battlePhase === 'combat') {
        const pulse = Math.sin(frame * 0.12) * 0.3 + 0.7;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        const sz = enemy.isBoss ? BOSS_SIZE : SPRITE_SIZE;
        ctx.strokeRect(drawX - 4, drawY - 4, sz + 8, sz + 8);
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Turn indicator for enemies
      const currentTurn = data.turnOrder[data.currentTurnIndex];
      if (
        currentTurn &&
        currentTurn.type === 'enemy' &&
        currentTurn.index === i &&
        data.battlePhase === 'combat'
      ) {
        const pulse = Math.sin(frame * 0.1) * 0.3 + 0.5;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 3;
        const sz = enemy.isBoss ? BOSS_SIZE : SPRITE_SIZE;
        ctx.strokeRect(drawX - 6, drawY - 6, sz + 12, sz + 12);
        ctx.restore();
      }

      // Draw enemy sprite (mirrored horizontally to face left)
      const spriteKey = `enemy_${enemy.name}_${enemy.isBoss ? 'boss' : 'normal'}`;
      const sprite = spriteCacheRef.current[spriteKey];
      const sz = enemy.isBoss ? BOSS_SIZE * 2 : SPRITE_SIZE * 2;
      if (sprite) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(drawX + sz / 2, drawY);
        ctx.scale(-1, 1); // Mirror
        ctx.drawImage(sprite, -sz / 2, 0, sz, sz);
        ctx.restore();
      }

      // HP bar for enemy
      const barY = drawY - 12;
      const barW = enemy.isBoss ? 80 : 48;
      const hpPct = Math.max(0, enemy.stats.hp / enemy.stats.maxHp);
      ctx.fillStyle = '#333';
      ctx.fillRect(drawX - 4, barY, barW, 5);
      ctx.fillStyle = hpPct < 0.3 ? '#eab308' : '#ef4444';
      ctx.fillRect(drawX - 4, barY, barW * hpPct, 5);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.strokeRect(drawX - 4, barY, barW, 5);

      // Status dots
      const dotY = drawY + sz + 4;
      for (let s = 0; s < enemy.statusEffects.length; s++) {
        const eff = enemy.statusEffects[s];
        let dotColor = '#888';
        if (eff.type === 'poison') dotColor = '#22c55e';
        else if (eff.type === 'def_up') dotColor = '#3b82f6';
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(drawX + s * 8, dotY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Name + boss label
      ctx.fillStyle = enemy.isBoss ? '#fbbf24' : '#ccc';
      ctx.font = enemy.isBoss ? 'bold 12px monospace' : '10px monospace';
      ctx.textAlign = 'center';
      const label = enemy.isBoss ? `[BOSS] ${enemy.name}` : enemy.name;
      ctx.fillText(label, drawX + sz / 2, drawY + sz + 18);
      ctx.textAlign = 'left';
    }

    // --- Floating damage numbers ---
    const nums = damageNumsRef.current;
    let nWrite = 0;
    for (let i = 0; i < nums.length; i++) {
      const dn = nums[i];
      dn.life--;
      dn.y -= 0.8;
      if (dn.life <= 0) continue;
      nums[nWrite++] = dn;
      ctx.save();
      ctx.globalAlpha = Math.min(1, dn.life / 20);
      ctx.fillStyle = dn.color;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(dn.value, dn.x + 16, dn.y);
      ctx.textAlign = 'left';
      ctx.restore();
    }
    nums.length = nWrite;

    // --- Particles ---
    const parts = particlesRef.current;
    let pWrite = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) continue;
      parts[pWrite++] = p;
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.restore();
    }
    parts.length = pWrite;

    // --- HUD overlay ---
    // Wave info
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Wave ${data.currentWave}/${data.maxWaves}`, 16, 24);

    // Phase indicator
    ctx.font = '12px monospace';
    ctx.fillStyle = '#aaa';
    const phaseText: Record<string, string> = {
      prep: 'PREPARE',
      combat: 'COMBAT',
      wave_clear: 'WAVE CLEAR!',
      victory: 'VICTORY!',
      defeat: 'DEFEAT',
    };
    ctx.fillText(phaseText[data.battlePhase] || data.battlePhase, 16, 42);

    // Kill count
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'right';
    ctx.fillText(`Kills: ${data.totalKills}`, CANVAS_W - 16, 24);

    ctx.textAlign = 'left';

    // VS text in center
    if (data.battlePhase === 'combat') {
      ctx.save();
      ctx.font = 'bold 28px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.textAlign = 'center';
      ctx.fillText('VS', CANVAS_W / 2, CANVAS_H / 2);
      ctx.restore();
    }

    // Victory / Defeat banners
    if (data.battlePhase === 'victory' || data.battlePhase === 'defeat') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, CANVAS_H / 2 - 30, CANVAS_W, 60);
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = data.battlePhase === 'victory' ? '#fbbf24' : '#ef4444';
      ctx.fillText(
        data.battlePhase === 'victory' ? 'VICTORY!' : 'DEFEAT',
        CANVAS_W / 2,
        CANVAS_H / 2 + 12,
      );
      ctx.restore();
    }
  }, []);

  // RAF loop
  useEffect(() => {
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      renderFrame();
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderFrame]);

  // --- Action handlers ---

  const handleAttack = useCallback(() => {
    if (!data) return;
    // Trigger attack animation on current character
    const current = data.turnOrder[data.currentTurnIndex];
    if (current && current.type === 'party') {
      animRef.current[`party_${current.index}`] = { state: 'attack', frame: 0, timer: 0 };
      // Spawn particles at target
      const ePos = getEnemyPositions(data.enemies.length)[selectedTarget];
      if (ePos) {
        for (let i = 0; i < 8; i++) {
          particlesRef.current.push({
            x: ePos.x + 16,
            y: ePos.y + 16,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 20,
            maxLife: 20,
            color: '#fbbf24',
            size: 3,
          });
        }
      }
    }
    dispatch('select_target', { targetIndex: selectedTarget });
    dispatch('attack', {});
  }, [data, selectedTarget, dispatch]);

  const handleDefend = useCallback(() => {
    dispatch('defend', {});
  }, [dispatch]);

  const handleSkill = useCallback(
    (skillIndex: number) => {
      if (!data) return;
      const current = data.turnOrder[data.currentTurnIndex];
      if (current && current.type === 'party') {
        animRef.current[`party_${current.index}`] = { state: 'cast', frame: 0, timer: 0 };
        // Spell particles
        const pPos = getPartyPositions(data.party.length)[current.index];
        if (pPos) {
          const colors = ['#a855f7', '#6366f1', '#3b82f6', '#FFD700'];
          for (let i = 0; i < 12; i++) {
            particlesRef.current.push({
              x: pPos.x + 16,
              y: pPos.y + 16,
              vx: (Math.random() - 0.3) * 6,
              vy: (Math.random() - 0.5) * 4,
              life: 30,
              maxLife: 30,
              color: colors[i % colors.length],
              size: 2 + Math.random() * 2,
            });
          }
        }
      }
      dispatch('select_target', { targetIndex: selectedTarget });
      dispatch('use_skill', { skillIndex, targetIndex: selectedTarget });
    },
    [data, selectedTarget, dispatch],
  );

  const handleStartWave = useCallback(() => {
    dispatch('start_wave', {});
  }, [dispatch]);

  // Determine whose turn it is
  const isPlayerTurn =
    data &&
    data.battlePhase === 'combat' &&
    data.turnOrder.length > 0 &&
    data.turnOrder[data.currentTurnIndex]?.type === 'party';

  const currentChar =
    isPlayerTurn && data ? data.party[data.turnOrder[data.currentTurnIndex].index] : null;

  const helpButton = useMemo(
    () => (
      <button
        type="button"
        onClick={() => setShowHelp(true)}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        ? How to Play
      </button>
    ),
    [],
  );

  if (!data) {
    return (
      <GameShell
        name="Molt Arena"
        scores={scores}
        events={events}
        isGameOver={isGameOver}
        winner={winner}
        onRestart={restart}
        headerExtra={helpButton}
      >
        <div className="flex items-center justify-center min-h-[400px] text-white/50">
          Loading...
        </div>
      </GameShell>
    );
  }

  return (
    <GameShell
      name="Molt Arena"
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      onRestart={restart}
      headerExtra={helpButton}
    >
      {/* How to Play modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-surface-dark border border-white/10 rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-display font-bold">How to Play</h2>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="text-white/50 hover:text-white text-2xl leading-none"
              >
                x
              </button>
            </div>
            <div className="space-y-4 text-sm text-white/70">
              <div>
                <h3 className="text-white font-semibold mb-1">Goal</h3>
                <p>Defeat all 5 waves of enemies to win. The final wave features a boss.</p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Turns</h3>
                <p>
                  Combat is turn-based. Turn order is determined by each character&apos;s Speed stat
                  (fastest goes first). A cyan arrow marks your active character; orange marks the
                  enemy&apos;s turn (auto-played).
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Actions</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <span className="text-red-300 font-semibold">Attack</span> â€” Deal physical
                    damage to the selected target.
                  </li>
                  <li>
                    <span className="text-blue-300 font-semibold">Defend</span> â€” Take 50% less
                    damage until your next turn and restore 3 MP.
                  </li>
                  <li>
                    <span className="text-purple-300 font-semibold">Skills</span> â€” Spend MP to
                    use powerful abilities (damage, heal, buff, AoE).
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Targeting</h3>
                <p>
                  Click an enemy in the Target panel (right side) to select who you want to hit
                  before using Attack or a single-target skill.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Your Party</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <span className="text-white font-semibold">Warrior</span> (front row) â€” Tank.
                    High HP/DEF. Skills: Cleave, Shield Wall, Taunt.
                  </li>
                  <li>
                    <span className="text-white font-semibold">Mage</span> (back row) â€” Magic DPS.
                    Skills: Fireball, Blizzard (AoE), Mana Shield.
                  </li>
                  <li>
                    <span className="text-white font-semibold">Archer</span> (back row) â€” Sniper.
                    Skills: Snipe (ignores DEF), Rain of Arrows (AoE), Poison Shot.
                  </li>
                  <li>
                    <span className="text-white font-semibold">Healer</span> (back row) â€” Support.
                    Skills: Heal, Purify (removes debuffs), Holy Light (damage + self-heal).
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Formation</h3>
                <p>
                  Front row characters deal full melee damage but take full hits. Back row takes 30%
                  less damage but deals 15% less with melee attacks. Magic ignores formation.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Tips</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Use Defend when low on MP â€” it restores 3 MP per use.</li>
                  <li>Focus down one enemy at a time to reduce incoming damage.</li>
                  <li>Taunt with Warrior to protect wounded allies.</li>
                  <li>Save Healer MP for emergencies â€” basic attacks are free.</li>
                  <li>Blizzard and Rain of Arrows hit ALL enemies â€” great for clearing waves.</li>
                </ul>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full py-2.5 rounded-lg font-display font-bold bg-molt-500 hover:bg-molt-400 text-white transition-all"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="rounded-lg border border-white/10 bg-black w-full max-w-[960px]"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Action panel */}
        <div className="w-full max-w-[960px]">
          {/* Prep phase: start wave */}
          {(data.battlePhase === 'prep' || data.battlePhase === 'wave_clear') && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-white/50 text-sm">
                {data.battlePhase === 'prep'
                  ? 'Your party is ready. Begin the battle!'
                  : `Wave ${data.currentWave} cleared! Prepare for wave ${data.currentWave + 1}.`}
              </p>
              <button
                onClick={handleStartWave}
                disabled={isGameOver}
                className={[
                  'px-8 py-3 rounded-lg font-display font-bold text-lg',
                  'bg-molt-500 hover:bg-molt-400 text-white',
                  'shadow-lg shadow-molt-500/30 hover:shadow-xl',
                  'transition-all duration-150 active:scale-95',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'select-none cursor-pointer',
                ].join(' ')}
              >
                {data.battlePhase === 'prep' ? 'Start Battle' : 'Next Wave'}
              </button>
            </div>
          )}

          {/* Combat phase: action buttons */}
          {data.battlePhase === 'combat' && (
            <div className="flex flex-col gap-3">
              {/* Turn info */}
              <div className="text-center text-xs font-semibold">
                {isPlayerTurn && currentChar ? (
                  <span className="text-neon-cyan">
                    {currentChar.name}&apos;s turn â€” choose an action
                  </span>
                ) : (
                  <span className="text-white/40">Enemy turn...</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                {/* Left: action buttons */}
                <div className="flex flex-col gap-2">
                  {/* Attack + Defend */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleAttack}
                      disabled={!isPlayerTurn || isGameOver}
                      className={[
                        'py-2.5 rounded-lg font-display font-bold',
                        'bg-red-600/30 border border-red-500/30 text-red-300',
                        'hover:bg-red-600/50 hover:border-red-400/50',
                        'transition-all duration-150 active:scale-[0.98]',
                        'disabled:opacity-30 disabled:cursor-not-allowed',
                        'select-none cursor-pointer',
                      ].join(' ')}
                    >
                      Attack
                    </button>
                    <button
                      onClick={handleDefend}
                      disabled={!isPlayerTurn || isGameOver}
                      className={[
                        'py-2.5 rounded-lg font-display font-bold',
                        'bg-blue-600/30 border border-blue-500/30 text-blue-300',
                        'hover:bg-blue-600/50 hover:border-blue-400/50',
                        'transition-all duration-150 active:scale-[0.98]',
                        'disabled:opacity-30 disabled:cursor-not-allowed',
                        'select-none cursor-pointer',
                      ].join(' ')}
                    >
                      Defend
                    </button>
                  </div>

                  {/* Skills */}
                  {currentChar && currentChar.skills.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {currentChar.skills.map((skill, i) => {
                        const canUse =
                          isPlayerTurn && currentChar.stats.mp >= skill.mpCost && !isGameOver;
                        return (
                          <button
                            key={skill.name}
                            onClick={() => handleSkill(i)}
                            disabled={!canUse}
                            className={[
                              'py-2 px-2 rounded-lg text-xs font-semibold',
                              'bg-purple-600/20 border border-purple-500/30 text-purple-300',
                              'hover:bg-purple-600/40 hover:border-purple-400/50',
                              'transition-all duration-150 active:scale-95',
                              'disabled:opacity-30 disabled:cursor-not-allowed',
                              'select-none cursor-pointer',
                            ].join(' ')}
                          >
                            <div>{skill.name}</div>
                            <div className="text-[10px] text-accent-amber font-mono mt-0.5">
                              {skill.mpCost} MP
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right: target selector */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-2 min-w-[160px]">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1.5">
                    Target
                  </div>
                  <div className="flex flex-col gap-1">
                    {data.enemies.map((enemy, i) => (
                      <button
                        key={`target-${i}`}
                        onClick={() => {
                          setSelectedTarget(i);
                          dispatch('select_target', { targetIndex: i });
                        }}
                        disabled={enemy.stats.hp <= 0}
                        className={[
                          'flex items-center justify-between px-2 py-1.5 rounded text-xs',
                          'transition-all duration-100',
                          selectedTarget === i
                            ? 'bg-red-600/30 border border-red-500/40 text-white'
                            : 'bg-white/5 border border-transparent text-white/60 hover:bg-white/10',
                          enemy.stats.hp <= 0
                            ? 'opacity-30 line-through cursor-not-allowed'
                            : 'cursor-pointer',
                          'select-none',
                        ].join(' ')}
                      >
                        <span className="truncate">
                          {enemy.isBoss ? '[B] ' : ''}
                          {enemy.name}
                        </span>
                        <span className="font-mono text-[10px] text-white/40 ml-2">
                          {Math.max(0, enemy.stats.hp)}/{enemy.stats.maxHp}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Party overview bar */}
              <div className="grid grid-cols-4 gap-1.5">
                {data.party.map((char, i) => {
                  const isCurrent =
                    isPlayerTurn && data.turnOrder[data.currentTurnIndex]?.index === i;
                  return (
                    <div
                      key={`party-${i}`}
                      className={[
                        'bg-white/5 rounded-lg p-2 text-center text-xs',
                        'border',
                        isCurrent ? 'border-neon-cyan/50' : 'border-white/5',
                        char.stats.hp <= 0 ? 'opacity-40' : '',
                      ].join(' ')}
                    >
                      <div className="font-semibold text-white/80 truncate">{char.name}</div>
                      <div className="text-[10px] text-white/40 uppercase">{char.classType}</div>
                      <div className="mt-1">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{
                              width: `${Math.max(0, (char.stats.hp / char.stats.maxHp) * 100)}%`,
                            }}
                          />
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-cyan-500 rounded-full transition-all"
                            style={{
                              width: `${Math.max(0, (char.stats.mp / char.stats.maxMp) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Combat log */}
        {data.combatLog.length > 0 && (
          <div className="w-full max-w-[960px] bg-white/5 border border-white/10 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
              Combat Log
            </h3>
            <div className="max-h-28 overflow-y-auto space-y-0.5 scrollbar-thin">
              {data.combatLog.slice(-10).map((msg, i) => (
                <p
                  key={`${data.combatLog.length - 10 + i}-${msg.slice(0, 20)}`}
                  className="text-xs font-mono text-white/60 leading-relaxed"
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
