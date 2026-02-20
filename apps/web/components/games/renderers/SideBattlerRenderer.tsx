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

export default function SideBattlerRenderer({
  gameName,
  gameConfig,
}: {
  gameName?: string;
  gameConfig?: Record<string, unknown>;
}) {
  const { state, events, isGameOver, winner, scores, playerId, dispatch, restart } = useGameEngine(
    SideBattlerGame,
    gameConfig,
  );

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
      skyGrad.addColorStop(0, '#050510');
      skyGrad.addColorStop(0.25, '#0a0a1a');
      skyGrad.addColorStop(0.5, '#1a1a3e');
      skyGrad.addColorStop(0.75, '#2a1a3e');
      skyGrad.addColorStop(1, '#1a0a1e');
      skyGradRef.current = skyGrad;
    }
    ctx.fillStyle = skyGradRef.current;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle aurora / nebula glow
    ctx.save();
    ctx.globalAlpha = 0.06 + Math.sin(frame * 0.008) * 0.02;
    const auroraGrad = ctx.createRadialGradient(
      CANVAS_W * 0.3,
      CANVAS_H * 0.2,
      20,
      CANVAS_W * 0.3,
      CANVAS_H * 0.2,
      250,
    );
    auroraGrad.addColorStop(0, '#6366f1');
    auroraGrad.addColorStop(0.5, '#a855f7');
    auroraGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = auroraGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H * 0.6);
    const aurora2 = ctx.createRadialGradient(
      CANVAS_W * 0.7,
      CANVAS_H * 0.15,
      10,
      CANVAS_W * 0.7,
      CANVAS_H * 0.15,
      200,
    );
    aurora2.addColorStop(0, '#22d3ee');
    aurora2.addColorStop(0.5, '#3b82f6');
    aurora2.addColorStop(1, 'transparent');
    ctx.fillStyle = aurora2;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H * 0.5);
    ctx.restore();

    // Stars (twinkling with color variation)
    for (const star of starsRef.current) {
      const twinkle = star.brightness + Math.sin(frame * 0.05 + star.x) * 0.25;
      ctx.globalAlpha = Math.max(0.15, Math.min(1, twinkle));
      // Slight color variation based on position
      const hue = (star.x * 0.3 + star.y * 0.2) % 60;
      ctx.fillStyle = hue < 20 ? '#cce5ff' : hue < 40 ? '#ffe5cc' : '#ffffff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
      // Star glow for brighter ones
      if (star.brightness > 0.75) {
        ctx.globalAlpha = twinkle * 0.15;
        ctx.fillRect(star.x - 1, star.y - 1, star.size + 2, star.size + 2);
      }
    }
    ctx.globalAlpha = 1;

    // Layer 2: Mountain silhouettes (far)
    ctx.fillStyle = '#12122e';
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

    // Layer 2b: Nearer mountains with top highlight
    ctx.fillStyle = '#1e1e40';
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H * 0.65);
    const nearMtnPoints: { x: number; y: number }[] = [];
    for (let x = 0; x <= CANVAS_W; x += 40) {
      const h = Math.sin(x * 0.012 + 3) * 40 + Math.sin(x * 0.02 + 1) * 20;
      const py = CANVAS_H * 0.6 - h;
      ctx.lineTo(x, py);
      nearMtnPoints.push({ x, y: py });
    }
    ctx.lineTo(CANVAS_W, CANVAS_H);
    ctx.lineTo(0, CANVAS_H);
    ctx.closePath();
    ctx.fill();
    // Mountain top edge glow
    ctx.save();
    ctx.strokeStyle = '#3a3a6a';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    if (nearMtnPoints.length > 0) {
      ctx.moveTo(nearMtnPoints[0].x, nearMtnPoints[0].y);
      for (let i = 1; i < nearMtnPoints.length; i++) {
        ctx.lineTo(nearMtnPoints[i].x, nearMtnPoints[i].y);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Stone wall / dungeon pillars behind the arena
    ctx.fillStyle = '#1a1a30';
    ctx.fillRect(0, CANVAS_H * 0.55, CANVAS_W, GROUND_Y - CANVAS_H * 0.55);
    // Pillar details
    for (let px = 80; px < CANVAS_W; px += 180) {
      ctx.fillStyle = '#252540';
      ctx.fillRect(px, CANVAS_H * 0.48, 24, GROUND_Y - CANVAS_H * 0.48);
      ctx.fillStyle = '#2a2a50';
      ctx.fillRect(px + 2, CANVAS_H * 0.48, 20, GROUND_Y - CANVAS_H * 0.48);
      // Pillar cap
      ctx.fillStyle = '#353560';
      ctx.fillRect(px - 4, CANVAS_H * 0.47, 32, 8);
      ctx.fillRect(px - 2, CANVAS_H * 0.46, 28, 4);
    }

    // Torch flames on pillars (animated)
    for (let px = 80; px < CANVAS_W; px += 180) {
      const torchX = px + 12;
      const torchY = CANVAS_H * 0.48 + 20;
      const flicker = Math.sin(frame * 0.15 + px) * 2;
      const flicker2 = Math.cos(frame * 0.2 + px * 0.5) * 1.5;
      // Torch bracket
      ctx.fillStyle = '#5a5a7a';
      ctx.fillRect(torchX - 2, torchY, 4, 10);
      // Outer glow
      ctx.save();
      ctx.globalAlpha = 0.08 + Math.sin(frame * 0.1 + px) * 0.03;
      const torchGlow = ctx.createRadialGradient(torchX, torchY - 4, 2, torchX, torchY - 4, 60);
      torchGlow.addColorStop(0, '#ff8c00');
      torchGlow.addColorStop(0.4, '#ff4500');
      torchGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = torchGlow;
      ctx.fillRect(torchX - 60, torchY - 64, 120, 120);
      ctx.restore();
      // Flame
      ctx.fillStyle = '#ff6a00';
      ctx.beginPath();
      ctx.ellipse(torchX + flicker2, torchY - 6 + flicker, 4, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.ellipse(torchX + flicker2 * 0.5, torchY - 8 + flicker * 0.7, 2.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.ellipse(torchX, torchY - 8 + flicker * 0.3, 1.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Layer 3: Ground / arena floor with depth gradient
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_H);
    groundGrad.addColorStop(0, '#3a3a5a');
    groundGrad.addColorStop(0.3, '#333350');
    groundGrad.addColorStop(1, '#2a2a42');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);
    // Stone tile pattern with subtle shading
    for (let x = 0; x < CANVAS_W; x += 48) {
      for (let y = GROUND_Y; y < CANVAS_H; y += 24) {
        const xOff = (Math.floor((y - GROUND_Y) / 24) % 2) * 24;
        const tileX = x + xOff;
        // Slight per-tile brightness variation
        const shade = ((tileX * 7 + y * 13) % 20) - 10;
        ctx.fillStyle = `rgba(${80 + shade}, ${80 + shade}, ${110 + shade}, 0.15)`;
        ctx.fillRect(tileX + 1, y + 1, 46, 22);
        ctx.strokeStyle = '#4a4a6a';
        ctx.lineWidth = 1;
        ctx.strokeRect(tileX, y, 48, 24);
      }
    }

    // Ground edge highlight with glow
    const edgeGlow = ctx.createLinearGradient(0, GROUND_Y - 6, 0, GROUND_Y + 4);
    edgeGlow.addColorStop(0, 'transparent');
    edgeGlow.addColorStop(0.5, 'rgba(100, 100, 140, 0.3)');
    edgeGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = edgeGlow;
    ctx.fillRect(0, GROUND_Y - 6, CANVAS_W, 10);
    ctx.fillStyle = '#6a6a8a';
    ctx.fillRect(0, GROUND_Y, CANVAS_W, 2);
    ctx.fillStyle = '#5a5a7a';
    ctx.fillRect(0, GROUND_Y + 2, CANVAS_W, 1);

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

      // Turn indicator: glowing pulse with radial highlight
      const currentTurn = data.turnOrder[data.currentTurnIndex];
      if (
        currentTurn &&
        currentTurn.type === 'party' &&
        currentTurn.index === i &&
        data.battlePhase === 'combat'
      ) {
        const pulse = Math.sin(frame * 0.1) * 0.3 + 0.5;
        const pulseSize = Math.sin(frame * 0.08) * 2;
        ctx.save();
        // Outer glow aura
        ctx.globalAlpha = pulse * 0.15;
        const turnGlow = ctx.createRadialGradient(
          drawX + SPRITE_SIZE / 2,
          drawY + SPRITE_SIZE / 2,
          SPRITE_SIZE * 0.3,
          drawX + SPRITE_SIZE / 2,
          drawY + SPRITE_SIZE / 2,
          SPRITE_SIZE * 1.5,
        );
        turnGlow.addColorStop(0, '#22d3ee');
        turnGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = turnGlow;
        ctx.fillRect(drawX - 20, drawY - 20, SPRITE_SIZE + 40, SPRITE_SIZE + 40);
        // Border
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          drawX - 6 - pulseSize,
          drawY - 6 - pulseSize,
          SPRITE_SIZE + 12 + pulseSize * 2,
          SPRITE_SIZE + 12 + pulseSize * 2,
        );
        // Corner accents
        const cLen = 6;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#67e8f9';
        // Top-left
        ctx.beginPath();
        ctx.moveTo(drawX - 6, drawY - 6 + cLen);
        ctx.lineTo(drawX - 6, drawY - 6);
        ctx.lineTo(drawX - 6 + cLen, drawY - 6);
        ctx.stroke();
        // Top-right
        ctx.beginPath();
        ctx.moveTo(drawX + SPRITE_SIZE + 6 - cLen, drawY - 6);
        ctx.lineTo(drawX + SPRITE_SIZE + 6, drawY - 6);
        ctx.lineTo(drawX + SPRITE_SIZE + 6, drawY - 6 + cLen);
        ctx.stroke();
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(drawX - 6, drawY + SPRITE_SIZE + 6 - cLen);
        ctx.lineTo(drawX - 6, drawY + SPRITE_SIZE + 6);
        ctx.lineTo(drawX - 6 + cLen, drawY + SPRITE_SIZE + 6);
        ctx.stroke();
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(drawX + SPRITE_SIZE + 6 - cLen, drawY + SPRITE_SIZE + 6);
        ctx.lineTo(drawX + SPRITE_SIZE + 6, drawY + SPRITE_SIZE + 6);
        ctx.lineTo(drawX + SPRITE_SIZE + 6, drawY + SPRITE_SIZE + 6 - cLen);
        ctx.stroke();
        ctx.restore();

        // Bouncing arrow above
        const arrowBob = Math.sin(frame * 0.12) * 3;
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(drawX + SPRITE_SIZE / 2, drawY - 20 + arrowBob);
        ctx.lineTo(drawX + SPRITE_SIZE / 2 - 7, drawY - 10 + arrowBob);
        ctx.lineTo(drawX + SPRITE_SIZE / 2 + 7, drawY - 10 + arrowBob);
        ctx.closePath();
        ctx.fill();
        // Arrow glow
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(drawX + SPRITE_SIZE / 2, drawY - 22 + arrowBob);
        ctx.lineTo(drawX + SPRITE_SIZE / 2 - 9, drawY - 9 + arrowBob);
        ctx.lineTo(drawX + SPRITE_SIZE / 2 + 9, drawY - 9 + arrowBob);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Drop shadow
      ctx.save();
      ctx.globalAlpha = opacity * 0.25;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(
        drawX + SPRITE_SIZE / 2,
        drawY + SPRITE_SIZE * 2 + 2,
        SPRITE_SIZE * 0.5,
        4,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();

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

      // Defending shield overlay with animated ring
      if (char.isDefending) {
        ctx.save();
        const shieldPulse = 0.25 + Math.sin(frame * 0.08) * 0.1;
        ctx.globalAlpha = shieldPulse;
        const shieldGrad = ctx.createRadialGradient(
          drawX + SPRITE_SIZE / 2,
          drawY + SPRITE_SIZE / 2,
          SPRITE_SIZE * 0.2,
          drawX + SPRITE_SIZE / 2,
          drawY + SPRITE_SIZE / 2,
          SPRITE_SIZE * 0.9,
        );
        shieldGrad.addColorStop(0, 'rgba(59, 130, 246, 0.05)');
        shieldGrad.addColorStop(0.6, 'rgba(59, 130, 246, 0.15)');
        shieldGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = shieldGrad;
        ctx.beginPath();
        ctx.arc(
          drawX + SPRITE_SIZE / 2,
          drawY + SPRITE_SIZE / 2,
          SPRITE_SIZE * 0.9,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        // Shield ring
        ctx.globalAlpha = shieldPulse + 0.2;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          drawX + SPRITE_SIZE / 2,
          drawY + SPRITE_SIZE / 2,
          SPRITE_SIZE * 0.8,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.restore();
      }

      // HP bar with gradient fill
      const barY = drawY - 24;
      const barW = 48;
      const barH = 6;
      const hpPct = Math.max(0, char.stats.hp / char.stats.maxHp);
      // Background with inner shadow
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(drawX - 4, barY, barW, barH);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(drawX - 4, barY, barW, 1);
      // Gradient HP fill
      if (hpPct > 0) {
        const hpGrad = ctx.createLinearGradient(drawX - 4, barY, drawX - 4, barY + barH);
        if (hpPct < 0.3) {
          hpGrad.addColorStop(0, '#fbbf24');
          hpGrad.addColorStop(0.5, '#eab308');
          hpGrad.addColorStop(1, '#ca8a04');
        } else {
          hpGrad.addColorStop(0, '#4ade80');
          hpGrad.addColorStop(0.5, '#22c55e');
          hpGrad.addColorStop(1, '#16a34a');
        }
        ctx.fillStyle = hpGrad;
        ctx.fillRect(drawX - 4, barY, barW * hpPct, barH);
        // Specular highlight on bar
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(drawX - 4, barY, barW * hpPct, 1);
      }
      // Damage flash shimmer
      if (anim.state === 'hit') {
        ctx.fillStyle = 'rgba(255,80,80,0.4)';
        ctx.fillRect(drawX - 4, barY, barW, barH);
      }
      ctx.strokeStyle = '#6a6a8a';
      ctx.lineWidth = 1;
      ctx.strokeRect(drawX - 4, barY, barW, barH);

      // MP bar with gradient
      const mpBarY = barY + barH + 2;
      const mpPct = Math.max(0, char.stats.mp / char.stats.maxMp);
      ctx.fillStyle = '#0a0a2e';
      ctx.fillRect(drawX - 4, mpBarY, barW, 4);
      if (mpPct > 0) {
        const mpGrad = ctx.createLinearGradient(drawX - 4, mpBarY, drawX - 4, mpBarY + 4);
        mpGrad.addColorStop(0, '#22d3ee');
        mpGrad.addColorStop(0.5, '#06b6d4');
        mpGrad.addColorStop(1, '#0891b2');
        ctx.fillStyle = mpGrad;
        ctx.fillRect(drawX - 4, mpBarY, barW * mpPct, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(drawX - 4, mpBarY, barW * mpPct, 1);
      }

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

      // HP bar for enemy with gradient
      const barY = drawY - 12;
      const barW = enemy.isBoss ? 80 : 48;
      const barH = 6;
      const hpPct = Math.max(0, enemy.stats.hp / enemy.stats.maxHp);
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(drawX - 4, barY, barW, barH);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(drawX - 4, barY, barW, 1);
      if (hpPct > 0) {
        const eHpGrad = ctx.createLinearGradient(drawX - 4, barY, drawX - 4, barY + barH);
        if (hpPct < 0.3) {
          eHpGrad.addColorStop(0, '#fbbf24');
          eHpGrad.addColorStop(0.5, '#eab308');
          eHpGrad.addColorStop(1, '#ca8a04');
        } else {
          eHpGrad.addColorStop(0, '#f87171');
          eHpGrad.addColorStop(0.5, '#ef4444');
          eHpGrad.addColorStop(1, '#dc2626');
        }
        ctx.fillStyle = eHpGrad;
        ctx.fillRect(drawX - 4, barY, barW * hpPct, barH);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(drawX - 4, barY, barW * hpPct, 1);
      }
      // Hit flash on bar
      if (anim.state === 'hit') {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(drawX - 4, barY, barW, barH);
      }
      ctx.strokeStyle = '#6a6a8a';
      ctx.lineWidth = 1;
      ctx.strokeRect(drawX - 4, barY, barW, barH);

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

    // --- Floating damage numbers with outline ---
    const nums = damageNumsRef.current;
    let nWrite = 0;
    for (let i = 0; i < nums.length; i++) {
      const dn = nums[i];
      dn.life--;
      dn.y -= 0.9;
      if (dn.life <= 0) continue;
      nums[nWrite++] = dn;
      ctx.save();
      const alpha = Math.min(1, dn.life / 20);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      // Text outline for readability
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(dn.value, dn.x + 16, dn.y);
      ctx.fillStyle = dn.color;
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

    // --- Vignette overlay ---
    ctx.save();
    const vignetteOuter = ctx.createRadialGradient(
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_W * 0.25,
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_W * 0.7,
    );
    vignetteOuter.addColorStop(0, 'transparent');
    vignetteOuter.addColorStop(0.7, 'rgba(0,0,0,0.15)');
    vignetteOuter.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vignetteOuter;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();

    // --- HUD overlay with glass panels ---
    // Wave info panel (top-left)
    ctx.save();
    ctx.fillStyle = 'rgba(10, 10, 30, 0.6)';
    ctx.fillRect(8, 8, 140, 44);
    ctx.strokeStyle = 'rgba(100, 100, 160, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 8, 140, 44);
    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(9, 9, 138, 22);
    ctx.restore();
    ctx.fillStyle = '#e0e0ff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Wave ${data.currentWave}/${data.maxWaves}`, 16, 28);
    // Phase indicator
    ctx.font = '11px monospace';
    const phaseText: Record<string, string> = {
      prep: 'PREPARE',
      combat: 'COMBAT',
      wave_clear: 'WAVE CLEAR!',
      victory: 'VICTORY!',
      defeat: 'DEFEAT',
    };
    const phaseColors: Record<string, string> = {
      prep: '#60a5fa',
      combat: '#f87171',
      wave_clear: '#4ade80',
      victory: '#fbbf24',
      defeat: '#ef4444',
    };
    ctx.fillStyle = phaseColors[data.battlePhase] || '#aaa';
    ctx.fillText(phaseText[data.battlePhase] || data.battlePhase, 16, 44);

    // Kill count panel (top-right)
    ctx.save();
    ctx.fillStyle = 'rgba(10, 10, 30, 0.6)';
    ctx.fillRect(CANVAS_W - 128, 8, 120, 32);
    ctx.strokeStyle = 'rgba(100, 100, 160, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(CANVAS_W - 128, 8, 120, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(CANVAS_W - 127, 9, 118, 15);
    ctx.restore();
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Kills: ${data.totalKills}`, CANVAS_W - 16, 28);
    ctx.textAlign = 'left';

    // VS text in center with glow
    if (data.battlePhase === 'combat') {
      ctx.save();
      const vsPulse = 0.05 + Math.sin(frame * 0.03) * 0.03;
      ctx.globalAlpha = vsPulse;
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6366f1';
      ctx.fillText('VS', CANVAS_W / 2, CANVAS_H / 2 - 20);
      ctx.globalAlpha = vsPulse * 2;
      ctx.font = 'bold 44px monospace';
      ctx.fillStyle = '#818cf8';
      ctx.fillText('VS', CANVAS_W / 2, CANVAS_H / 2 - 20);
      ctx.restore();
    }

    // Victory / Defeat banners with gradient and glow
    if (data.battlePhase === 'victory' || data.battlePhase === 'defeat') {
      ctx.save();
      const bannerGrad = ctx.createLinearGradient(0, CANVAS_H / 2 - 40, 0, CANVAS_H / 2 + 40);
      bannerGrad.addColorStop(0, 'rgba(0,0,0,0)');
      bannerGrad.addColorStop(0.3, 'rgba(0,0,0,0.7)');
      bannerGrad.addColorStop(0.7, 'rgba(0,0,0,0.7)');
      bannerGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bannerGrad;
      ctx.fillRect(0, CANVAS_H / 2 - 40, CANVAS_W, 80);
      // Glowing line accent
      const accentColor = data.battlePhase === 'victory' ? '#fbbf24' : '#ef4444';
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(CANVAS_W * 0.2, CANVAS_H / 2 - 22, CANVAS_W * 0.6, 1);
      ctx.fillRect(CANVAS_W * 0.2, CANVAS_H / 2 + 20, CANVAS_W * 0.6, 1);
      ctx.globalAlpha = 1;
      // Text with shadow
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(
        data.battlePhase === 'victory' ? 'VICTORY!' : 'DEFEAT',
        CANVAS_W / 2 + 2,
        CANVAS_H / 2 + 14,
      );
      ctx.fillStyle = accentColor;
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
      // Spawn slash particles at target (sword trail effect)
      const ePos = getEnemyPositions(data.enemies.length)[selectedTarget];
      if (ePos) {
        // Slash arc particles
        for (let i = 0; i < 14; i++) {
          const angle = (i / 14) * Math.PI * 0.8 - Math.PI * 0.4;
          const speed = 2 + Math.random() * 3;
          particlesRef.current.push({
            x: ePos.x + 16 + Math.cos(angle) * 8,
            y: ePos.y + 16 + Math.sin(angle) * 8,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 18 + Math.random() * 10,
            maxLife: 28,
            color: i % 3 === 0 ? '#fff' : i % 3 === 1 ? '#fbbf24' : '#f97316',
            size: 2 + Math.random() * 2,
          });
        }
        // Impact sparks
        for (let i = 0; i < 6; i++) {
          particlesRef.current.push({
            x: ePos.x + 16,
            y: ePos.y + 16,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 12,
            maxLife: 12,
            color: '#fff',
            size: 1.5,
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
        // Magic projectile particles (spiral outward from caster)
        const pPos = getPartyPositions(data.party.length)[current.index];
        if (pPos) {
          const colors = ['#a855f7', '#6366f1', '#818cf8', '#c084fc', '#FFD700'];
          // Spiral ring of magic
          for (let i = 0; i < 18; i++) {
            const angle = (i / 18) * Math.PI * 2;
            const speed = 1.5 + Math.random() * 2;
            particlesRef.current.push({
              x: pPos.x + 16,
              y: pPos.y + 16,
              vx: Math.cos(angle) * speed + 2,
              vy: Math.sin(angle) * speed,
              life: 25 + Math.random() * 15,
              maxLife: 40,
              color: colors[i % colors.length],
              size: 2 + Math.random() * 2.5,
            });
          }
          // Central burst
          for (let i = 0; i < 8; i++) {
            particlesRef.current.push({
              x: pPos.x + 16,
              y: pPos.y + 16,
              vx: (Math.random() - 0.3) * 8,
              vy: (Math.random() - 0.5) * 5,
              life: 20,
              maxLife: 20,
              color: '#fff',
              size: 1.5 + Math.random(),
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
        name={gameName || 'Molt Arena'}
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
      name={gameName || 'Molt Arena'}
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
        <div style={{ width: '100%', maxWidth: CANVAS_W, margin: '0 auto' }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="rounded-lg border border-white/10 bg-black"
            style={{ width: '100%', height: 'auto', imageRendering: 'pixelated' }}
          />
        </div>

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
