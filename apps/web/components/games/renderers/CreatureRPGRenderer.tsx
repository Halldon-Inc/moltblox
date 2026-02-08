'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { CreatureRPGGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';
import { MAPS } from './creature-rpg-maps';

// ---------------------------------------------------------------------------
// Types mirroring CreatureRPGGame state
// ---------------------------------------------------------------------------

interface CreatureStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spatk: number;
  spdef: number;
  spd: number;
}

interface StatusEffect {
  type: 'burn' | 'poison' | 'paralysis';
  turnsActive: number;
}

interface Move {
  name: string;
  type: string;
  power: number;
  accuracy: number;
  pp: number;
  maxPp: number;
  category: 'physical' | 'special' | 'status';
  description: string;
}

interface Creature {
  id: string;
  species: string;
  type: string;
  level: number;
  xp: number;
  xpToLevel: number;
  stats: CreatureStats;
  moves: Move[];
  statusEffect: StatusEffect | null;
  statStages: Record<string, number>;
}

interface Inventory {
  potions: number;
  captureOrbs: number;
}

interface BattleState {
  type: 'wild' | 'trainer' | 'gym';
  activeIndex: number;
  enemyCreature: Creature;
  enemyParty: Creature[];
  enemyPartyIndex: number;
  canCatch: boolean;
  canFlee: boolean;
  trainerId: string | null;
  trainerName: string | null;
  turnCount: number;
  leechSeedActive: boolean;
  message: string | null;
  awaitingAction: boolean;
}

interface CreatureRPGState {
  gamePhase: 'starter_select' | 'overworld' | 'battle' | 'dialogue' | 'victory' | 'defeat';
  party: Creature[];
  activeCreatureIndex: number;
  inventory: Inventory;
  playerPos: { x: number; y: number };
  playerDirection: 'up' | 'down' | 'left' | 'right';
  mapId: string;
  defeatedTrainers: string[];
  caughtSpecies: string[];
  starterChosen: boolean;
  dialogueLines: string[];
  dialogueIndex: number;
  dialogueSpeaker: string;
  postDialogueAction: string | null;
  battleState: BattleState | null;
  gymDefeated: boolean;
  totalBattlesWon: number;
  totalCreaturesCaught: number;
  totalSteps: number;
  combatLog: string[];
}

// ---------------------------------------------------------------------------
// Canvas constants
// ---------------------------------------------------------------------------

const CANVAS_W = 960;
const CANVAS_H = 540;
const TILE_SIZE = 32;
const MAP_COLS = 30;
const MAP_ROWS = 20;

// ---------------------------------------------------------------------------
// Tile types (must match game logic T constant)
// ---------------------------------------------------------------------------

const T = {
  GRASS: 0,
  TALL_GRASS: 1,
  TREE: 2,
  WATER: 3,
  PATH: 4,
  BUILDING: 5,
  DOOR: 6,
  FENCE: 7,
  FLOWER: 8,
  SIGN: 9,
  HEAL: 10,
  GYM_DOOR: 11,
  SAND: 12,
} as const;

// ---------------------------------------------------------------------------

// NPC positions (must match game logic NPC_DEFS)
interface NPCInfo {
  id: string;
  name: string;
  type: 'trainer' | 'healer' | 'guide' | 'professor';
  mapId: string;
  x: number;
  y: number;
}

const NPC_LIST: NPCInfo[] = [
  { id: 'professor', name: 'Prof. Elm', type: 'professor', mapId: 'starter_town', x: 10, y: 11 },
  { id: 'mom', name: 'Mom', type: 'guide', mapId: 'starter_town', x: 19, y: 5 },
  { id: 'trainer_1', name: 'Bug Catcher Tim', type: 'trainer', mapId: 'route_1', x: 7, y: 7 },
  { id: 'trainer_2', name: 'Lass Jenny', type: 'trainer', mapId: 'route_1', x: 22, y: 14 },
  { id: 'healer_town', name: 'Nurse Joy', type: 'healer', mapId: 'starter_town', x: 19, y: 5 },
  { id: 'healer_city', name: 'Nurse Joy', type: 'healer', mapId: 'verdant_city', x: 3, y: 5 },
  { id: 'guide_city', name: 'Ranger Blake', type: 'guide', mapId: 'verdant_city', x: 13, y: 9 },
  { id: 'gym_leader', name: 'Verdana', type: 'trainer', mapId: 'verdant_city', x: 22, y: 5 },
];

// ---------------------------------------------------------------------------
// Color palettes for procedural sprites
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, { primary: string; secondary: string; glow: string }> = {
  fire: { primary: '#ff6b35', secondary: '#ff4500', glow: '#ff8c00' },
  water: { primary: '#4fc3f7', secondary: '#0288d1', glow: '#29b6f6' },
  grass: { primary: '#66bb6a', secondary: '#388e3c', glow: '#81c784' },
  electric: { primary: '#ffee58', secondary: '#fbc02d', glow: '#fff176' },
  ghost: { primary: '#ab47bc', secondary: '#7b1fa2', glow: '#ce93d8' },
  normal: { primary: '#a1887f', secondary: '#6d4c41', glow: '#bcaaa4' },
};

const TILE_COLORS: Record<number, string> = {
  [T.GRASS]: '#4a7c3f',
  [T.TALL_GRASS]: '#3a6b30',
  [T.TREE]: '#2d5a27',
  [T.WATER]: '#2196f3',
  [T.PATH]: '#c4a45a',
  [T.BUILDING]: '#5a4a3a',
  [T.DOOR]: '#8b6914',
  [T.FENCE]: '#7a6a5a',
  [T.FLOWER]: '#4a7c3f',
  [T.SIGN]: '#4a7c3f',
  [T.HEAL]: '#e91e63',
  [T.GYM_DOOR]: '#9c27b0',
  [T.SAND]: '#d4b896',
};

// ---------------------------------------------------------------------------
// Animation types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Procedural creature sprite generator
// ---------------------------------------------------------------------------

function generateCreatureSprite(
  species: string,
  size: number,
  facing: 'left' | 'right' = 'right',
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const s = size / 32; // scale factor

  const colors = TYPE_COLORS[getSpeciesType(species)] || TYPE_COLORS.normal;

  switch (species) {
    case 'emberfox': {
      // Body
      ctx.fillStyle = '#ff6b35';
      ctx.fillRect(8 * s, 14 * s, 16 * s, 10 * s);
      // Head
      ctx.fillStyle = '#ff8c42';
      ctx.fillRect(10 * s, 6 * s, 12 * s, 10 * s);
      // Ears (pointed)
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath();
      ctx.moveTo(10 * s, 8 * s);
      ctx.lineTo(8 * s, 2 * s);
      ctx.lineTo(13 * s, 6 * s);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(22 * s, 8 * s);
      ctx.lineTo(24 * s, 2 * s);
      ctx.lineTo(19 * s, 6 * s);
      ctx.fill();
      // Ear insides
      ctx.fillStyle = '#ffab76';
      ctx.beginPath();
      ctx.moveTo(10 * s, 7 * s);
      ctx.lineTo(9 * s, 3 * s);
      ctx.lineTo(12 * s, 6 * s);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(22 * s, 7 * s);
      ctx.lineTo(23 * s, 3 * s);
      ctx.lineTo(20 * s, 6 * s);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(12 * s, 9 * s, 3 * s, 3 * s);
      ctx.fillRect(18 * s, 9 * s, 3 * s, 3 * s);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(13 * s, 10 * s, 2 * s, 2 * s);
      ctx.fillRect(19 * s, 10 * s, 2 * s, 2 * s);
      // Nose
      ctx.fillStyle = '#222';
      ctx.fillRect(15 * s, 12 * s, 2 * s, 1 * s);
      // Tail (fiery)
      ctx.fillStyle = '#ff4500';
      ctx.beginPath();
      ctx.moveTo(8 * s, 18 * s);
      ctx.lineTo(2 * s, 12 * s);
      ctx.lineTo(4 * s, 16 * s);
      ctx.lineTo(1 * s, 10 * s);
      ctx.lineTo(6 * s, 15 * s);
      ctx.fill();
      // Legs
      ctx.fillStyle = '#cc5500';
      ctx.fillRect(10 * s, 24 * s, 3 * s, 4 * s);
      ctx.fillRect(19 * s, 24 * s, 3 * s, 4 * s);
      // Belly
      ctx.fillStyle = '#ffcc80';
      ctx.fillRect(12 * s, 17 * s, 8 * s, 5 * s);
      break;
    }
    case 'aquaphin': {
      // Body (oval)
      ctx.fillStyle = '#4fc3f7';
      ctx.beginPath();
      ctx.ellipse(16 * s, 16 * s, 10 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Belly
      ctx.fillStyle = '#b3e5fc';
      ctx.beginPath();
      ctx.ellipse(16 * s, 18 * s, 7 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = '#4fc3f7';
      ctx.beginPath();
      ctx.ellipse(16 * s, 10 * s, 7 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Beak/nose
      ctx.fillStyle = '#0288d1';
      ctx.beginPath();
      ctx.moveTo(22 * s, 10 * s);
      ctx.lineTo(28 * s, 11 * s);
      ctx.lineTo(22 * s, 12 * s);
      ctx.fill();
      // Eye
      ctx.fillStyle = '#fff';
      ctx.fillRect(17 * s, 8 * s, 4 * s, 3 * s);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(19 * s, 9 * s, 2 * s, 2 * s);
      // Dorsal fin
      ctx.fillStyle = '#0288d1';
      ctx.beginPath();
      ctx.moveTo(14 * s, 10 * s);
      ctx.lineTo(16 * s, 3 * s);
      ctx.lineTo(18 * s, 10 * s);
      ctx.fill();
      // Tail fin
      ctx.fillStyle = '#29b6f6';
      ctx.beginPath();
      ctx.moveTo(6 * s, 16 * s);
      ctx.lineTo(1 * s, 12 * s);
      ctx.lineTo(1 * s, 20 * s);
      ctx.fill();
      // Flippers
      ctx.fillStyle = '#0288d1';
      ctx.fillRect(10 * s, 22 * s, 4 * s, 3 * s);
      ctx.fillRect(18 * s, 22 * s, 4 * s, 3 * s);
      break;
    }
    case 'thornvine': {
      // Body (bulky)
      ctx.fillStyle = '#66bb6a';
      ctx.fillRect(8 * s, 10 * s, 16 * s, 14 * s);
      // Head
      ctx.fillStyle = '#81c784';
      ctx.fillRect(10 * s, 4 * s, 12 * s, 8 * s);
      // Thorns
      ctx.fillStyle = '#388e3c';
      ctx.beginPath();
      ctx.moveTo(8 * s, 2 * s);
      ctx.lineTo(10 * s, 6 * s);
      ctx.lineTo(6 * s, 6 * s);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(16 * s, 0 * s);
      ctx.lineTo(18 * s, 4 * s);
      ctx.lineTo(14 * s, 4 * s);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(24 * s, 2 * s);
      ctx.lineTo(22 * s, 6 * s);
      ctx.lineTo(26 * s, 6 * s);
      ctx.fill();
      // Eyes (angry)
      ctx.fillStyle = '#fff';
      ctx.fillRect(12 * s, 7 * s, 3 * s, 2 * s);
      ctx.fillRect(18 * s, 7 * s, 3 * s, 2 * s);
      ctx.fillStyle = '#c62828';
      ctx.fillRect(13 * s, 7 * s, 2 * s, 2 * s);
      ctx.fillRect(19 * s, 7 * s, 2 * s, 2 * s);
      // Vine arms
      ctx.strokeStyle = '#388e3c';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(8 * s, 14 * s);
      ctx.quadraticCurveTo(2 * s, 10 * s, 3 * s, 18 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(24 * s, 14 * s);
      ctx.quadraticCurveTo(30 * s, 10 * s, 29 * s, 18 * s);
      ctx.stroke();
      // Legs
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(10 * s, 24 * s, 4 * s, 4 * s);
      ctx.fillRect(18 * s, 24 * s, 4 * s, 4 * s);
      // Belly marking
      ctx.fillStyle = '#a5d6a7';
      ctx.fillRect(12 * s, 14 * s, 8 * s, 6 * s);
      break;
    }
    case 'zappup': {
      // Body
      ctx.fillStyle = '#ffee58';
      ctx.fillRect(10 * s, 12 * s, 12 * s, 10 * s);
      // Head
      ctx.fillStyle = '#fff176';
      ctx.fillRect(11 * s, 5 * s, 10 * s, 9 * s);
      // Ears (zigzag/lightning shaped)
      ctx.fillStyle = '#fbc02d';
      ctx.beginPath();
      ctx.moveTo(11 * s, 6 * s);
      ctx.lineTo(7 * s, 0 * s);
      ctx.lineTo(10 * s, 4 * s);
      ctx.lineTo(6 * s, 2 * s);
      ctx.lineTo(12 * s, 5 * s);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(21 * s, 6 * s);
      ctx.lineTo(25 * s, 0 * s);
      ctx.lineTo(22 * s, 4 * s);
      ctx.lineTo(26 * s, 2 * s);
      ctx.lineTo(20 * s, 5 * s);
      ctx.fill();
      // Eyes (big, sparkly)
      ctx.fillStyle = '#fff';
      ctx.fillRect(13 * s, 8 * s, 3 * s, 3 * s);
      ctx.fillRect(18 * s, 8 * s, 3 * s, 3 * s);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(14 * s, 9 * s, 2 * s, 2 * s);
      ctx.fillRect(19 * s, 9 * s, 2 * s, 2 * s);
      // Nose
      ctx.fillStyle = '#222';
      ctx.fillRect(16 * s, 11 * s, 1 * s, 1 * s);
      // Lightning bolt tail
      ctx.fillStyle = '#fbc02d';
      ctx.beginPath();
      ctx.moveTo(10 * s, 16 * s);
      ctx.lineTo(5 * s, 14 * s);
      ctx.lineTo(7 * s, 17 * s);
      ctx.lineTo(2 * s, 16 * s);
      ctx.lineTo(8 * s, 18 * s);
      ctx.fill();
      // Legs
      ctx.fillStyle = '#f9a825';
      ctx.fillRect(12 * s, 22 * s, 3 * s, 5 * s);
      ctx.fillRect(18 * s, 22 * s, 3 * s, 5 * s);
      // Belly spot
      ctx.fillStyle = '#fff9c4';
      ctx.fillRect(13 * s, 15 * s, 6 * s, 4 * s);
      break;
    }
    case 'shadewisp': {
      // Ghostly body (wispy, semi-transparent look)
      ctx.fillStyle = '#ab47bc';
      ctx.beginPath();
      ctx.moveTo(16 * s, 4 * s);
      ctx.quadraticCurveTo(26 * s, 4 * s, 26 * s, 16 * s);
      ctx.quadraticCurveTo(26 * s, 26 * s, 22 * s, 28 * s);
      ctx.lineTo(20 * s, 24 * s);
      ctx.lineTo(18 * s, 28 * s);
      ctx.lineTo(16 * s, 24 * s);
      ctx.lineTo(14 * s, 28 * s);
      ctx.lineTo(12 * s, 24 * s);
      ctx.lineTo(10 * s, 28 * s);
      ctx.quadraticCurveTo(6 * s, 26 * s, 6 * s, 16 * s);
      ctx.quadraticCurveTo(6 * s, 4 * s, 16 * s, 4 * s);
      ctx.fill();
      // Inner glow
      ctx.fillStyle = '#ce93d8';
      ctx.beginPath();
      ctx.ellipse(16 * s, 14 * s, 6 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes (glowing)
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(11 * s, 11 * s, 4 * s, 3 * s);
      ctx.fillRect(18 * s, 11 * s, 4 * s, 3 * s);
      ctx.fillStyle = '#fff';
      ctx.fillRect(12 * s, 12 * s, 2 * s, 1 * s);
      ctx.fillRect(19 * s, 12 * s, 2 * s, 1 * s);
      // Mouth
      ctx.fillStyle = '#4a148c';
      ctx.beginPath();
      ctx.arc(16 * s, 18 * s, 2 * s, 0, Math.PI);
      ctx.fill();
      break;
    }
    case 'pebblecrab': {
      // Body (wide, sturdy)
      ctx.fillStyle = '#a1887f';
      ctx.fillRect(6 * s, 12 * s, 20 * s, 10 * s);
      // Shell top
      ctx.fillStyle = '#8d6e63';
      ctx.beginPath();
      ctx.arc(16 * s, 12 * s, 10 * s, Math.PI, 0);
      ctx.fill();
      // Shell pattern
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.arc(16 * s, 12 * s, 7 * s, Math.PI, 0);
      ctx.stroke();
      // Eyes (on stalks)
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(10 * s, 6 * s, 2 * s, 6 * s);
      ctx.fillRect(20 * s, 6 * s, 2 * s, 6 * s);
      ctx.fillStyle = '#fff';
      ctx.fillRect(9 * s, 4 * s, 4 * s, 3 * s);
      ctx.fillRect(19 * s, 4 * s, 4 * s, 3 * s);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(10 * s, 5 * s, 2 * s, 2 * s);
      ctx.fillRect(20 * s, 5 * s, 2 * s, 2 * s);
      // Claws
      ctx.fillStyle = '#8d6e63';
      ctx.beginPath();
      ctx.ellipse(3 * s, 16 * s, 4 * s, 3 * s, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(29 * s, 16 * s, 4 * s, 3 * s, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Legs
      ctx.fillStyle = '#795548';
      ctx.fillRect(9 * s, 22 * s, 3 * s, 4 * s);
      ctx.fillRect(14 * s, 22 * s, 3 * s, 4 * s);
      ctx.fillRect(20 * s, 22 * s, 3 * s, 4 * s);
      break;
    }
    default: {
      // Fallback: simple blob
      ctx.fillStyle = colors.primary;
      ctx.beginPath();
      ctx.ellipse(16 * s, 16 * s, 10 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(12 * s, 12 * s, 3 * s, 3 * s);
      ctx.fillRect(18 * s, 12 * s, 3 * s, 3 * s);
      ctx.fillStyle = '#000';
      ctx.fillRect(13 * s, 13 * s, 2 * s, 2 * s);
      ctx.fillRect(19 * s, 13 * s, 2 * s, 2 * s);
    }
  }

  // Mirror for left-facing
  if (facing === 'left') {
    const flipped = document.createElement('canvas');
    flipped.width = size;
    flipped.height = size;
    const fCtx = flipped.getContext('2d')!;
    fCtx.translate(size, 0);
    fCtx.scale(-1, 1);
    fCtx.drawImage(canvas, 0, 0);
    return flipped;
  }

  return canvas;
}

function getSpeciesType(species: string): string {
  const map: Record<string, string> = {
    emberfox: 'fire',
    aquaphin: 'water',
    thornvine: 'grass',
    zappup: 'electric',
    shadewisp: 'ghost',
    pebblecrab: 'normal',
  };
  return map[species] || 'normal';
}

// ---------------------------------------------------------------------------
// Procedural player & NPC sprites
// ---------------------------------------------------------------------------

function generatePlayerSprite(direction: string, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const s = size / 32;

  // Hat
  ctx.fillStyle = '#e53935';
  ctx.fillRect(10 * s, 2 * s, 12 * s, 4 * s);
  ctx.fillRect(8 * s, 4 * s, 16 * s, 2 * s);

  // Head
  ctx.fillStyle = '#ffcc80';
  ctx.fillRect(11 * s, 6 * s, 10 * s, 8 * s);

  // Hair
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(10 * s, 6 * s, 2 * s, 4 * s);
  ctx.fillRect(20 * s, 6 * s, 2 * s, 4 * s);

  // Eyes based on direction
  ctx.fillStyle = '#1a1a1a';
  if (direction === 'up') {
    // No eyes visible from behind
  } else if (direction === 'left') {
    ctx.fillRect(12 * s, 9 * s, 2 * s, 2 * s);
  } else if (direction === 'right') {
    ctx.fillRect(18 * s, 9 * s, 2 * s, 2 * s);
  } else {
    ctx.fillRect(13 * s, 9 * s, 2 * s, 2 * s);
    ctx.fillRect(17 * s, 9 * s, 2 * s, 2 * s);
  }

  // Body (jacket)
  ctx.fillStyle = '#1565c0';
  ctx.fillRect(10 * s, 14 * s, 12 * s, 8 * s);

  // Backpack (if facing away)
  if (direction === 'up') {
    ctx.fillStyle = '#e53935';
    ctx.fillRect(12 * s, 15 * s, 8 * s, 6 * s);
  }

  // Legs
  ctx.fillStyle = '#37474f';
  ctx.fillRect(11 * s, 22 * s, 4 * s, 6 * s);
  ctx.fillRect(17 * s, 22 * s, 4 * s, 6 * s);

  // Shoes
  ctx.fillStyle = '#f44336';
  ctx.fillRect(11 * s, 27 * s, 4 * s, 2 * s);
  ctx.fillRect(17 * s, 27 * s, 4 * s, 2 * s);

  return canvas;
}

function generateNPCSprite(type: string, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const s = size / 32;

  switch (type) {
    case 'professor': {
      // Lab coat
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(10 * s, 14 * s, 12 * s, 10 * s);
      // Head
      ctx.fillStyle = '#ffcc80';
      ctx.fillRect(11 * s, 5 * s, 10 * s, 9 * s);
      // Hair
      ctx.fillStyle = '#9e9e9e';
      ctx.fillRect(10 * s, 4 * s, 12 * s, 3 * s);
      // Glasses
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1 * s;
      ctx.strokeRect(12 * s, 8 * s, 3 * s, 3 * s);
      ctx.strokeRect(17 * s, 8 * s, 3 * s, 3 * s);
      ctx.beginPath();
      ctx.moveTo(15 * s, 9 * s);
      ctx.lineTo(17 * s, 9 * s);
      ctx.stroke();
      // Eyes
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(13 * s, 9 * s, 1 * s, 1 * s);
      ctx.fillRect(18 * s, 9 * s, 1 * s, 1 * s);
      // Legs
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(12 * s, 24 * s, 3 * s, 5 * s);
      ctx.fillRect(17 * s, 24 * s, 3 * s, 5 * s);
      break;
    }
    case 'trainer': {
      // Cap
      ctx.fillStyle = '#43a047';
      ctx.fillRect(10 * s, 3 * s, 12 * s, 3 * s);
      // Head
      ctx.fillStyle = '#ffcc80';
      ctx.fillRect(11 * s, 6 * s, 10 * s, 8 * s);
      // Eyes
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(13 * s, 9 * s, 2 * s, 2 * s);
      ctx.fillRect(17 * s, 9 * s, 2 * s, 2 * s);
      // Shirt
      ctx.fillStyle = '#43a047';
      ctx.fillRect(10 * s, 14 * s, 12 * s, 8 * s);
      // Legs
      ctx.fillStyle = '#795548';
      ctx.fillRect(11 * s, 22 * s, 4 * s, 6 * s);
      ctx.fillRect(17 * s, 22 * s, 4 * s, 6 * s);
      break;
    }
    case 'healer': {
      // Nurse cap
      ctx.fillStyle = '#fff';
      ctx.fillRect(11 * s, 2 * s, 10 * s, 3 * s);
      ctx.fillStyle = '#e91e63';
      ctx.fillRect(14 * s, 2 * s, 4 * s, 2 * s);
      // Head
      ctx.fillStyle = '#ffcc80';
      ctx.fillRect(11 * s, 5 * s, 10 * s, 9 * s);
      // Hair
      ctx.fillStyle = '#e91e63';
      ctx.fillRect(10 * s, 6 * s, 2 * s, 6 * s);
      ctx.fillRect(20 * s, 6 * s, 2 * s, 6 * s);
      // Eyes
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(13 * s, 8 * s, 2 * s, 2 * s);
      ctx.fillRect(17 * s, 8 * s, 2 * s, 2 * s);
      // Dress
      ctx.fillStyle = '#fff';
      ctx.fillRect(10 * s, 14 * s, 12 * s, 10 * s);
      // Cross
      ctx.fillStyle = '#e91e63';
      ctx.fillRect(15 * s, 16 * s, 2 * s, 6 * s);
      ctx.fillRect(13 * s, 18 * s, 6 * s, 2 * s);
      // Legs
      ctx.fillStyle = '#fff';
      ctx.fillRect(12 * s, 24 * s, 3 * s, 5 * s);
      ctx.fillRect(17 * s, 24 * s, 3 * s, 5 * s);
      break;
    }
    default: {
      // Generic guide NPC
      ctx.fillStyle = '#ffcc80';
      ctx.fillRect(11 * s, 5 * s, 10 * s, 9 * s);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(13 * s, 8 * s, 2 * s, 2 * s);
      ctx.fillRect(17 * s, 8 * s, 2 * s, 2 * s);
      ctx.fillStyle = '#7b1fa2';
      ctx.fillRect(10 * s, 14 * s, 12 * s, 8 * s);
      ctx.fillStyle = '#37474f';
      ctx.fillRect(11 * s, 22 * s, 4 * s, 6 * s);
      ctx.fillRect(17 * s, 22 * s, 4 * s, 6 * s);
    }
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Helper: capitalize
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Move type to button color
function moveTypeColor(type: string): string {
  const map: Record<string, string> = {
    fire: 'bg-orange-600/40 border-orange-500/40 text-orange-200',
    water: 'bg-blue-600/40 border-blue-500/40 text-blue-200',
    grass: 'bg-green-600/40 border-green-500/40 text-green-200',
    electric: 'bg-yellow-600/40 border-yellow-500/40 text-yellow-200',
    ghost: 'bg-purple-600/40 border-purple-500/40 text-purple-200',
    normal: 'bg-gray-600/40 border-gray-500/40 text-gray-200',
  };
  return map[type] || map.normal;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CreatureRPGRenderer() {
  const { state, events, isGameOver, winner, scores, dispatch, restart } =
    useGameEngine(CreatureRPGGame);

  const data = state?.data as CreatureRPGState | undefined;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameCountRef = useRef(0);
  const spriteCacheRef = useRef<Record<string, HTMLCanvasElement>>({});
  const damageNumbersRef = useRef<DamageNumber[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const prevCombatLogLenRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef({ x: 0, y: 0 });
  const minimapCacheRef = useRef<{ mapId: string; canvas: HTMLCanvasElement } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // --- Generate/cache sprites ---
  useEffect(() => {
    const cache = spriteCacheRef.current;
    // Player sprites (4 directions)
    for (const dir of ['up', 'down', 'left', 'right']) {
      const key = `player_${dir}`;
      if (!cache[key]) {
        cache[key] = generatePlayerSprite(dir, 32);
      }
    }
    // NPC sprites
    for (const npc of NPC_LIST) {
      const key = `npc_${npc.type}`;
      if (!cache[key]) {
        cache[key] = generateNPCSprite(npc.type, 32);
      }
    }
  }, []);

  // Generate creature sprites based on party + battle enemy
  useEffect(() => {
    if (!data) return;
    const cache = spriteCacheRef.current;

    // Party creatures (right-facing for battle)
    for (const c of data.party) {
      const key = `creature_${c.species}_right`;
      if (!cache[key]) {
        cache[key] = generateCreatureSprite(c.species, 64, 'right');
      }
    }

    // Enemy creature (left-facing for battle)
    if (data.battleState?.enemyCreature) {
      const species = data.battleState.enemyCreature.species;
      const key = `creature_${species}_left`;
      if (!cache[key]) {
        cache[key] = generateCreatureSprite(species, 64, 'left');
      }
    }
  }, [data?.party?.length, data?.battleState?.enemyCreature?.species]);

  // --- Keyboard controls ---
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!data) return;

      if (data.gamePhase === 'overworld') {
        const dirMap: Record<string, string> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
          w: 'up',
          s: 'down',
          a: 'left',
          d: 'right',
        };
        const dir = dirMap[e.key];
        if (dir) {
          e.preventDefault();
          dispatch('move', { direction: dir });
        }
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          dispatch('interact', {});
        }
      }

      if (data.gamePhase === 'dialogue') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          dispatch('advance_dialogue', {});
        }
      }

      if (data.gamePhase === 'battle' && data.battleState) {
        if (e.key >= '1' && e.key <= '4') {
          e.preventDefault();
          dispatch('fight', { moveIndex: parseInt(e.key) - 1 });
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [data?.gamePhase, data?.battleState, dispatch]);

  // --- Parse combat log for damage numbers ---
  useEffect(() => {
    if (!data?.combatLog) return;
    const newLen = data.combatLog.length;
    if (newLen <= prevCombatLogLenRef.current) {
      prevCombatLogLenRef.current = newLen;
      return;
    }

    for (let i = prevCombatLogLenRef.current; i < newLen; i++) {
      const line = data.combatLog[i];
      const dmgMatch = line.match(/\(-(\d+) HP\)/);
      if (dmgMatch) {
        const isSuperEffective = line.includes('super effective');
        const isNotVery = line.includes('not very effective');
        damageNumbersRef.current.push({
          x:
            data.gamePhase === 'battle'
              ? line.includes('used') && !line.startsWith('Wild')
                ? 700
                : 260
              : 480,
          y: 180 + Math.random() * 40,
          value: `-${dmgMatch[1]}`,
          color: isSuperEffective ? '#ff5252' : isNotVery ? '#bdbdbd' : '#ffab40',
          life: 45,
        });
      }
      if (line.includes('Critical hit')) {
        damageNumbersRef.current.push({
          x: 480,
          y: 160 + Math.random() * 20,
          value: 'CRIT!',
          color: '#ffeb3b',
          life: 50,
        });
      }
      if (line.includes('super effective')) {
        damageNumbersRef.current.push({
          x: 480,
          y: 220,
          value: 'Super Effective!',
          color: '#ff5252',
          life: 55,
        });
      }
    }
    prevCombatLogLenRef.current = newLen;
  }, [data?.combatLog?.length, data?.gamePhase]);

  // Auto-scroll combat log
  useEffect(() => {
    const container = logContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [data?.combatLog?.length]);

  // ---------------------------------------------------------------------------
  // Canvas render loop
  // ---------------------------------------------------------------------------

  // Keep a mutable ref to data so the RAF loop never tears down on state changes
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const d = dataRef.current;
    if (!canvas || !d) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame = frameCountRef.current++;

    if (d.gamePhase === 'overworld' || d.gamePhase === 'dialogue') {
      renderOverworld(ctx, d, frame);
    } else if (d.gamePhase === 'battle') {
      renderBattle(ctx, d, frame);
    } else if (d.gamePhase === 'starter_select') {
      renderStarterSelect(ctx, frame);
    } else if (d.gamePhase === 'victory') {
      renderVictory(ctx, d, frame);
    } else if (d.gamePhase === 'defeat') {
      renderDefeat(ctx, frame);
    }

    // Render floating damage numbers
    ctx.save();
    const dnArr = damageNumbersRef.current;
    let dnWrite = 0;
    for (let i = 0; i < dnArr.length; i++) {
      const dn = dnArr[i];
      dn.y -= 1.2;
      dn.life--;
      if (dn.life <= 0) continue;
      dnArr[dnWrite++] = dn;
      ctx.globalAlpha = Math.min(1, dn.life / 15);
      ctx.fillStyle = dn.color;
      ctx.font = `bold ${dn.value.length > 5 ? 16 : 22}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(dn.value, dn.x, dn.y);
    }
    dnArr.length = dnWrite;
    ctx.restore();

    // Render particles
    ctx.save();
    const pArr = particlesRef.current;
    let pWrite = 0;
    for (let i = 0; i < pArr.length; i++) {
      const p = pArr[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
      if (p.life <= 0) continue;
      pArr[pWrite++] = p;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    pArr.length = pWrite;
    ctx.restore();
  }, []);

  // --- Overworld render ---
  function renderOverworld(ctx: CanvasRenderingContext2D, d: CreatureRPGState, frame: number) {
    const map = MAPS[d.mapId];
    if (!map) return;

    // Camera: lerp to player position
    const targetCamX = d.playerPos.x * TILE_SIZE - CANVAS_W / 2 + TILE_SIZE / 2;
    const targetCamY = d.playerPos.y * TILE_SIZE - CANVAS_H / 2 + TILE_SIZE / 2;
    const maxCamX = MAP_COLS * TILE_SIZE - CANVAS_W;
    const maxCamY = MAP_ROWS * TILE_SIZE - CANVAS_H;
    const clampedX = Math.max(0, Math.min(maxCamX, targetCamX));
    const clampedY = Math.max(0, Math.min(maxCamY, targetCamY));
    cameraRef.current.x += (clampedX - cameraRef.current.x) * 0.15;
    cameraRef.current.y += (clampedY - cameraRef.current.y) * 0.15;

    const camX = cameraRef.current.x;
    const camY = cameraRef.current.y;

    // Draw tiles
    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE));
    const endCol = Math.min(MAP_COLS, startCol + Math.ceil(CANVAS_W / TILE_SIZE) + 2);
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE));
    const endRow = Math.min(MAP_ROWS, startRow + Math.ceil(CANVAS_H / TILE_SIZE) + 2);

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const tile = map[row]?.[col] ?? 0;
        const drawX = col * TILE_SIZE - camX;
        const drawY = row * TILE_SIZE - camY;

        // Base tile color
        ctx.fillStyle = TILE_COLORS[tile] || TILE_COLORS[T.GRASS];
        ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);

        // Tile details
        switch (tile) {
          case T.TALL_GRASS: {
            // Animated grass blades
            ctx.fillStyle = '#2d8a2d';
            const sway = Math.sin(frame * 0.05 + col * 0.7 + row * 0.5) * 2;
            for (let i = 0; i < 5; i++) {
              const bx = drawX + 3 + i * 6;
              const by = drawY + TILE_SIZE - 4;
              ctx.fillRect(bx + sway, by - 12, 2, 12);
              ctx.fillRect(bx + sway - 1, by - 14, 4, 3);
            }
            break;
          }
          case T.TREE: {
            // Trunk
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(drawX + 12, drawY + 16, 8, 16);
            // Canopy
            ctx.fillStyle = '#1b5e20';
            ctx.beginPath();
            ctx.arc(drawX + 16, drawY + 12, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2e7d32';
            ctx.beginPath();
            ctx.arc(drawX + 16, drawY + 10, 9, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case T.WATER: {
            // Animated water
            ctx.fillStyle = '#1976d2';
            const waveOff = Math.sin(frame * 0.08 + col + row) * 2;
            ctx.fillRect(drawX, drawY + waveOff, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(drawX + 4, drawY + 8 + waveOff, 12, 2);
            ctx.fillRect(drawX + 16, drawY + 18 + waveOff, 10, 2);
            break;
          }
          case T.BUILDING: {
            // Building wall with window
            ctx.fillStyle = '#4e342e';
            ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#795548';
            ctx.fillRect(drawX + 2, drawY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            // Window
            ctx.fillStyle = '#ffeb3b';
            ctx.globalAlpha = 0.5 + Math.sin(frame * 0.02 + col) * 0.2;
            ctx.fillRect(drawX + 10, drawY + 10, 12, 12);
            ctx.globalAlpha = 1;
            break;
          }
          case T.DOOR: {
            // Door
            ctx.fillStyle = '#8b6914';
            ctx.fillRect(drawX + 4, drawY + 4, TILE_SIZE - 8, TILE_SIZE - 4);
            ctx.fillStyle = '#ffc107';
            ctx.fillRect(drawX + TILE_SIZE - 12, drawY + 16, 3, 3);
            break;
          }
          case T.FENCE: {
            // Fence posts
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(drawX + 2, drawY + 4, 4, 24);
            ctx.fillRect(drawX + TILE_SIZE - 6, drawY + 4, 4, 24);
            ctx.fillRect(drawX, drawY + 8, TILE_SIZE, 3);
            ctx.fillRect(drawX, drawY + 20, TILE_SIZE, 3);
            break;
          }
          case T.FLOWER: {
            // Grass base + flower
            ctx.fillStyle = '#e91e63';
            ctx.fillRect(drawX + 8, drawY + 10, 4, 4);
            ctx.fillStyle = '#ffc107';
            ctx.fillRect(drawX + 20, drawY + 18, 4, 4);
            ctx.fillStyle = '#9c27b0';
            ctx.fillRect(drawX + 14, drawY + 6, 4, 4);
            break;
          }
          case T.SIGN: {
            // Sign post
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(drawX + 14, drawY + 14, 4, 18);
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(drawX + 6, drawY + 6, 20, 12);
            ctx.fillStyle = '#4e342e';
            ctx.fillRect(drawX + 8, drawY + 9, 16, 2);
            ctx.fillRect(drawX + 8, drawY + 13, 12, 2);
            break;
          }
          case T.HEAL: {
            // Heal pad (pulsing cross)
            const pulse = 0.7 + Math.sin(frame * 0.08) * 0.3;
            ctx.fillStyle = `rgba(233,30,99,${pulse})`;
            ctx.fillRect(drawX + 12, drawY + 4, 8, 24);
            ctx.fillRect(drawX + 4, drawY + 12, 24, 8);
            break;
          }
          case T.GYM_DOOR: {
            // Gym door (special glowing)
            ctx.fillStyle = '#7b1fa2';
            ctx.fillRect(drawX + 2, drawY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            const glow = 0.6 + Math.sin(frame * 0.06) * 0.4;
            ctx.fillStyle = `rgba(206,147,216,${glow})`;
            ctx.fillRect(drawX + 8, drawY + 4, TILE_SIZE - 16, TILE_SIZE - 8);
            // Star emblem
            ctx.fillStyle = '#ffd54f';
            ctx.beginPath();
            ctx.moveTo(drawX + 16, drawY + 8);
            ctx.lineTo(drawX + 18, drawY + 14);
            ctx.lineTo(drawX + 24, drawY + 14);
            ctx.lineTo(drawX + 19, drawY + 18);
            ctx.lineTo(drawX + 21, drawY + 24);
            ctx.lineTo(drawX + 16, drawY + 20);
            ctx.lineTo(drawX + 11, drawY + 24);
            ctx.lineTo(drawX + 13, drawY + 18);
            ctx.lineTo(drawX + 8, drawY + 14);
            ctx.lineTo(drawX + 14, drawY + 14);
            ctx.closePath();
            ctx.fill();
            break;
          }
          case T.PATH: {
            // Dirt path with subtle texture
            ctx.fillStyle = '#b89a5a';
            ctx.fillRect(drawX + 4, drawY + 12, 3, 3);
            ctx.fillRect(drawX + 20, drawY + 6, 2, 2);
            ctx.fillRect(drawX + 14, drawY + 22, 3, 2);
            break;
          }
        }
      }
    }

    // Draw NPCs on current map
    const npcsOnMap = NPC_LIST.filter((n) => n.mapId === d.mapId);
    for (const npc of npcsOnMap) {
      const nx = npc.x * TILE_SIZE - camX;
      const ny = npc.y * TILE_SIZE - camY;
      if (
        nx < -TILE_SIZE ||
        nx > CANVAS_W + TILE_SIZE ||
        ny < -TILE_SIZE ||
        ny > CANVAS_H + TILE_SIZE
      )
        continue;

      const spriteKey = `npc_${npc.type}`;
      const sprite = spriteCacheRef.current[spriteKey];
      if (sprite) {
        ctx.drawImage(sprite, nx, ny, TILE_SIZE, TILE_SIZE);
      } else {
        // Fallback colored rectangle
        ctx.fillStyle =
          npc.type === 'healer' ? '#e91e63' : npc.type === 'trainer' ? '#43a047' : '#9c27b0';
        ctx.fillRect(nx + 4, ny + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      }

      // NPC name label
      ctx.fillStyle = '#fff';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(npc.name, nx + TILE_SIZE / 2, ny - 2);
    }

    // Draw player
    const px = d.playerPos.x * TILE_SIZE - camX;
    const py = d.playerPos.y * TILE_SIZE - camY;
    const playerSprite = spriteCacheRef.current[`player_${d.playerDirection}`];
    if (playerSprite) {
      ctx.drawImage(playerSprite, px, py, TILE_SIZE, TILE_SIZE);
    } else {
      ctx.fillStyle = '#e53935';
      ctx.fillRect(px + 6, py + 6, 20, 20);
    }

    // Mini-map overlay (top-right) — pre-rendered to offscreen canvas, only redrawn on map change
    const mmSize = 90;
    const mmTile = mmSize / MAP_COLS;
    const mmX = CANVAS_W - mmSize - 8;
    const mmY = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(mmX - 2, mmY - 2, mmSize + 4, mmTile * MAP_ROWS + 4);

    // Cache minimap tiles to offscreen canvas
    if (!minimapCacheRef.current || minimapCacheRef.current.mapId !== d.mapId) {
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.ceil(mmSize);
      offscreen.height = Math.ceil(mmTile * MAP_ROWS);
      const offCtx = offscreen.getContext('2d')!;
      for (let row = 0; row < MAP_ROWS; row++) {
        for (let col = 0; col < MAP_COLS; col++) {
          const tile = map[row]?.[col] ?? 0;
          if (tile === T.TREE || tile === T.BUILDING || tile === T.FENCE) {
            offCtx.fillStyle = '#555';
          } else if (tile === T.WATER) {
            offCtx.fillStyle = '#2196f3';
          } else if (tile === T.PATH) {
            offCtx.fillStyle = '#c4a45a';
          } else if (tile === T.TALL_GRASS) {
            offCtx.fillStyle = '#2d8a2d';
          } else {
            offCtx.fillStyle = '#4a7c3f';
          }
          offCtx.fillRect(col * mmTile, row * mmTile, mmTile, mmTile);
        }
      }
      minimapCacheRef.current = { mapId: d.mapId, canvas: offscreen };
    }
    ctx.drawImage(minimapCacheRef.current.canvas, mmX, mmY);

    // Player dot
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(mmX + d.playerPos.x * mmTile - 1, mmY + d.playerPos.y * mmTile - 1, 3, 3);

    // Zone name
    const zoneNames: Record<string, string> = {
      starter_town: 'Starter Town',
      route_1: 'Route 1',
      verdant_city: 'Verdant City',
    };
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(8, 8, 160, 24);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(zoneNames[d.mapId] || d.mapId, 14, 24);

    // Party HP bar display (top-left, below zone name)
    for (let i = 0; i < d.party.length; i++) {
      const c = d.party[i];
      const barY = 40 + i * 22;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(8, barY, 160, 18);
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${capitalize(c.species)} Lv${c.level}`, 12, barY + 12);
      // HP bar
      const hpRatio = c.stats.hp / c.stats.maxHp;
      const barColor = hpRatio > 0.5 ? '#4caf50' : hpRatio > 0.25 ? '#ffc107' : '#f44336';
      ctx.fillStyle = '#333';
      ctx.fillRect(110, barY + 4, 52, 8);
      ctx.fillStyle = barColor;
      ctx.fillRect(110, barY + 4, Math.max(0, 52 * hpRatio), 8);
    }

    // Dialogue box overlay
    if (d.gamePhase === 'dialogue') {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(20, CANVAS_H - 130, CANVAS_W - 40, 110);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, CANVAS_H - 130, CANVAS_W - 40, 110);

      // Speaker name
      if (d.dialogueSpeaker) {
        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(d.dialogueSpeaker, 36, CANVAS_H - 108);
      }

      // Dialogue text (typewriter effect based on frame)
      const line = d.dialogueLines[d.dialogueIndex] || '';
      const charCount = Math.min(line.length, Math.floor(frame * 0.5) % (line.length + 30));
      const displayText = line.substring(0, charCount);
      ctx.fillStyle = '#fff';
      ctx.font = '13px monospace';
      // Word wrap
      const maxWidth = CANVAS_W - 80;
      const words = displayText.split(' ');
      let currentLine = '';
      let lineY = CANVAS_H - 86;
      for (const word of words) {
        const test = currentLine + (currentLine ? ' ' : '') + word;
        if (ctx.measureText(test).width > maxWidth) {
          ctx.fillText(currentLine, 36, lineY);
          currentLine = word;
          lineY += 18;
        } else {
          currentLine = test;
        }
      }
      ctx.fillText(currentLine, 36, lineY);

      // "Press Space" prompt
      if (charCount >= line.length) {
        const blink = Math.sin(frame * 0.1) > 0;
        if (blink) {
          ctx.fillStyle = '#888';
          ctx.font = '11px monospace';
          ctx.textAlign = 'right';
          ctx.fillText('[Space / Click to continue]', CANVAS_W - 36, CANVAS_H - 30);
        }
      }
    }
  }

  // --- Battle render ---
  function renderBattle(ctx: CanvasRenderingContext2D, d: CreatureRPGState, frame: number) {
    if (!d.battleState) return;
    const bs = d.battleState;

    // Background: battle arena
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    skyGrad.addColorStop(0, '#0d1b2a');
    skyGrad.addColorStop(0.5, '#1b2838');
    skyGrad.addColorStop(1, '#2a1a2e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Mountains silhouette
    ctx.fillStyle = '#1a1a3e';
    ctx.beginPath();
    ctx.moveTo(0, 300);
    for (let x = 0; x <= CANVAS_W; x += 50) {
      const h = Math.sin(x * 0.01 + 1) * 50 + Math.sin(x * 0.018) * 25;
      ctx.lineTo(x, 280 - h);
    }
    ctx.lineTo(CANVAS_W, CANVAS_H);
    ctx.lineTo(0, CANVAS_H);
    ctx.closePath();
    ctx.fill();

    // Ground
    const groundY = 340;
    ctx.fillStyle = '#3a3a5a';
    ctx.fillRect(0, groundY, CANVAS_W, CANVAS_H - groundY);
    ctx.fillStyle = '#4a4a6a';
    ctx.fillRect(0, groundY, CANVAS_W, 3);

    // Stone pattern
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < CANVAS_W; x += 48) {
      for (let y = groundY + 3; y < CANVAS_H; y += 24) {
        const xOff = (Math.floor((y - groundY) / 24) % 2) * 24;
        ctx.strokeRect(x + xOff, y, 48, 24);
      }
    }

    // Player creature (left side)
    const playerCreature = d.party[bs.activeIndex];
    if (playerCreature) {
      const pcX = 180;
      const pcY = groundY - 96;
      const bob = Math.sin(frame * 0.06) * 3;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(pcX + 32, groundY - 2, 40, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Creature sprite
      const spriteKey = `creature_${playerCreature.species}_right`;
      const sprite = spriteCacheRef.current[spriteKey];
      if (sprite) {
        // Hit flash
        if (playerCreature.stats.hp <= 0) {
          ctx.globalAlpha = 0.3;
        }
        ctx.drawImage(sprite, pcX, pcY + bob, 96, 96);
        ctx.globalAlpha = 1;
      }

      // HP bar
      drawBattleHPBar(ctx, pcX - 20, pcY - 40, playerCreature, true);

      // Status effect indicator
      if (playerCreature.statusEffect) {
        const statusColors: Record<string, string> = {
          burn: '#ff5722',
          poison: '#9c27b0',
          paralysis: '#ffeb3b',
        };
        ctx.fillStyle = statusColors[playerCreature.statusEffect.type] || '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(playerCreature.statusEffect.type.toUpperCase(), pcX, pcY - 46);
      }
    }

    // Enemy creature (right side)
    const enemyCreature = bs.enemyCreature;
    if (enemyCreature) {
      const ecX = 660;
      const ecY = groundY - 96;
      const bob = Math.sin(frame * 0.06 + 2) * 3;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(ecX + 32, groundY - 2, 40, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Creature sprite
      const spriteKey = `creature_${enemyCreature.species}_left`;
      const sprite = spriteCacheRef.current[spriteKey];
      if (sprite) {
        if (enemyCreature.stats.hp <= 0) {
          ctx.globalAlpha = 0.3;
        }
        ctx.drawImage(sprite, ecX, ecY + bob, 96, 96);
        ctx.globalAlpha = 1;
      }

      // HP bar
      drawBattleHPBar(ctx, ecX - 20, ecY - 40, enemyCreature, false);

      // Trainer name
      if (bs.trainerName) {
        ctx.fillStyle = '#ff8a80';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${bs.trainerName}'s`, ecX + 48, ecY - 48);
      }

      // Status effect
      if (enemyCreature.statusEffect) {
        const statusColors: Record<string, string> = {
          burn: '#ff5722',
          poison: '#9c27b0',
          paralysis: '#ffeb3b',
        };
        ctx.fillStyle = statusColors[enemyCreature.statusEffect.type] || '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(enemyCreature.statusEffect.type.toUpperCase(), ecX + 116, ecY - 46);
      }
    }

    // VS indicator
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.15;
    ctx.font = 'bold 80px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VS', CANVAS_W / 2, groundY - 40);
    ctx.globalAlpha = 1;

    // Battle type indicator
    if (bs.type === 'gym') {
      ctx.fillStyle = '#ffd54f';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GYM BATTLE', CANVAS_W / 2, 30);
    } else if (bs.type === 'trainer') {
      ctx.fillStyle = '#ff8a80';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TRAINER BATTLE', CANVAS_W / 2, 30);
    } else {
      ctx.fillStyle = '#81c784';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WILD ENCOUNTER', CANVAS_W / 2, 30);
    }

    // Leech seed vines
    if (bs.leechSeedActive) {
      ctx.strokeStyle = '#66bb6a';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(frame * 0.1) * 0.2;
      ctx.beginPath();
      ctx.moveTo(680, groundY - 50);
      ctx.quadraticCurveTo(680 + Math.sin(frame * 0.05) * 10, groundY - 80, 700, groundY - 96);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawBattleHPBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    creature: Creature,
    isPlayer: boolean,
  ) {
    const barW = 140;
    const barH = 8;

    // Name + level
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${capitalize(creature.species)} Lv${creature.level}`, x, y);

    // HP bar background
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y + 4, barW, barH);

    // HP bar fill
    const hpRatio = Math.max(0, creature.stats.hp / creature.stats.maxHp);
    const barColor = hpRatio > 0.5 ? '#4caf50' : hpRatio > 0.25 ? '#ffc107' : '#f44336';
    ctx.fillStyle = barColor;
    ctx.fillRect(x, y + 4, barW * hpRatio, barH);

    // HP text
    ctx.fillStyle = '#ccc';
    ctx.font = '10px monospace';
    if (isPlayer) {
      ctx.fillText(`${creature.stats.hp}/${creature.stats.maxHp}`, x, y + 22);
    } else {
      // Don't show exact HP for enemy
      const pct = Math.round(hpRatio * 100);
      ctx.fillText(`${pct}%`, x, y + 22);
    }

    // XP bar (player only)
    if (isPlayer) {
      const xpRatio = creature.xpToLevel > 0 ? creature.xp / creature.xpToLevel : 0;
      ctx.fillStyle = '#222';
      ctx.fillRect(x, y + 26, barW, 3);
      ctx.fillStyle = '#29b6f6';
      ctx.fillRect(x, y + 26, barW * xpRatio, 3);
    }

    // Type badge
    const typeColors = TYPE_COLORS[creature.type] || TYPE_COLORS.normal;
    ctx.fillStyle = typeColors.primary;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(creature.type.toUpperCase(), x + barW, y);
    ctx.textAlign = 'left';
  }

  // --- Starter select render ---
  function renderStarterSelect(ctx: CanvasRenderingContext2D, frame: number) {
    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#1a237e');
    grad.addColorStop(1, '#0d47a1');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Choose Your Starter!', CANVAS_W / 2, 60);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#90caf9';
    ctx.fillText('Pick your first creature partner', CANVAS_W / 2, 85);

    // Three starter cards
    const starters = ['emberfox', 'aquaphin', 'thornvine'];
    const descriptions = [
      'Fast & fiery. Special attacker.',
      'Tanky & balanced. Good all-around.',
      'Bulky with status effects.',
    ];
    const cardW = 200;
    const cardH = 280;
    const gap = 40;
    const totalW = starters.length * cardW + (starters.length - 1) * gap;
    const startX = (CANVAS_W - totalW) / 2;

    for (let i = 0; i < starters.length; i++) {
      const species = starters[i];
      const cx = startX + i * (cardW + gap);
      const cy = 120;
      const hover = Math.sin(frame * 0.04 + i * 2) * 5;

      // Card background
      const typeColor = TYPE_COLORS[getSpeciesType(species)];
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(cx, cy + hover, cardW, cardH);
      ctx.strokeStyle = typeColor.primary;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy + hover, cardW, cardH);

      // Creature sprite
      const spriteKey = `creature_${species}_right`;
      let sprite = spriteCacheRef.current[spriteKey];
      if (!sprite) {
        sprite = generateCreatureSprite(species, 64, 'right');
        spriteCacheRef.current[spriteKey] = sprite;
      }
      ctx.drawImage(sprite, cx + (cardW - 96) / 2, cy + hover + 20, 96, 96);

      // Name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(capitalize(species), cx + cardW / 2, cy + hover + 140);

      // Type
      ctx.fillStyle = typeColor.primary;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(getSpeciesType(species).toUpperCase(), cx + cardW / 2, cy + hover + 158);

      // Description
      ctx.fillStyle = '#b0bec5';
      ctx.font = '11px monospace';
      ctx.fillText(descriptions[i], cx + cardW / 2, cy + hover + 180);

      // "Click below to choose"
      ctx.fillStyle = '#90caf9';
      ctx.font = '10px monospace';
      ctx.fillText('Use buttons below', cx + cardW / 2, cy + hover + cardH - 20);
    }
  }

  // --- Victory render ---
  function renderVictory(ctx: CanvasRenderingContext2D, d: CreatureRPGState, frame: number) {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#1b5e20');
    grad.addColorStop(1, '#004d40');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Confetti particles
    for (let i = 0; i < 30; i++) {
      const px = ((frame * 2 + i * 37) % (CANVAS_W + 40)) - 20;
      const py = ((frame * 1.5 + i * 23) % (CANVAS_H + 40)) - 20;
      const colors = ['#ffd54f', '#ff5252', '#69f0ae', '#448aff', '#e040fb'];
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(px, py, 6, 6);
    }

    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', CANVAS_W / 2, 100);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('You defeated Gym Leader Verdana!', CANVAS_W / 2, 150);
    ctx.fillText('You earned the Verdant Badge!', CANVAS_W / 2, 180);

    // Stats
    ctx.font = '14px monospace';
    ctx.fillStyle = '#b2dfdb';
    const stats = [
      `Battles Won: ${d.totalBattlesWon}`,
      `Creatures Caught: ${d.totalCreaturesCaught}`,
      `Species Discovered: ${d.caughtSpecies.length}`,
      `Total Steps: ${d.totalSteps}`,
    ];
    for (let i = 0; i < stats.length; i++) {
      ctx.fillText(stats[i], CANVAS_W / 2, 230 + i * 24);
    }

    // Party display
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Your Party:', CANVAS_W / 2, 340);
    for (let i = 0; i < d.party.length; i++) {
      const c = d.party[i];
      const spriteKey = `creature_${c.species}_right`;
      const sprite = spriteCacheRef.current[spriteKey];
      const sx = CANVAS_W / 2 - (d.party.length * 80) / 2 + i * 80;
      if (sprite) {
        ctx.drawImage(sprite, sx, 355, 64, 64);
      }
      ctx.fillStyle = '#b2dfdb';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Lv${c.level}`, sx + 32, 430);
    }
  }

  // --- Defeat render ---
  function renderDefeat(ctx: CanvasRenderingContext2D, frame: number) {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#1a1a1a');
    grad.addColorStop(1, '#37474f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#f44336';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DEFEAT', CANVAS_W / 2, CANVAS_H / 2 - 30);

    ctx.fillStyle = '#bdbdbd';
    ctx.font = '16px monospace';
    ctx.fillText('All your creatures have fainted...', CANVAS_W / 2, CANVAS_H / 2 + 10);

    const blink = Math.sin(frame * 0.08) > 0;
    if (blink) {
      ctx.fillStyle = '#757575';
      ctx.font = '13px monospace';
      ctx.fillText('Click Restart to try again', CANVAS_W / 2, CANVAS_H / 2 + 50);
    }
  }

  // RAF loop â€” runs once on mount; renderFrame reads dataRef.current
  useEffect(() => {
    let animId: number;
    function loop() {
      renderFrame();
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [renderFrame]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  const handleChooseStarter = useCallback(
    (species: string) => {
      dispatch('choose_starter', { species });
    },
    [dispatch],
  );

  const handleMove = useCallback(
    (dir: string) => {
      dispatch('move', { direction: dir });
    },
    [dispatch],
  );

  const handleInteract = useCallback(() => {
    dispatch('interact', {});
  }, [dispatch]);

  const handleAdvanceDialogue = useCallback(() => {
    dispatch('advance_dialogue', {});
  }, [dispatch]);

  const handleFight = useCallback(
    (moveIndex: number) => {
      dispatch('fight', { moveIndex });
    },
    [dispatch],
  );

  const handleCatch = useCallback(() => {
    dispatch('catch', {});
  }, [dispatch]);

  const handleFlee = useCallback(() => {
    dispatch('flee', {});
  }, [dispatch]);

  const handleUseItem = useCallback(() => {
    dispatch('use_item', { item: 'potion' });
  }, [dispatch]);

  const handleSwitchCreature = useCallback(
    (index: number) => {
      dispatch('switch_creature', { partyIndex: index });
    },
    [dispatch],
  );

  // ---------------------------------------------------------------------------
  // Help button
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!data) {
    return (
      <GameShell
        name="Creature Quest"
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
      name="Creature Quest"
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
                <p>
                  Travel from Starter Town through Route 1 to Verdant City and defeat Gym Leader
                  Verdana to earn the Verdant Badge.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Controls</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <span className="text-white font-semibold">Arrow Keys / WASD</span> â€” Move in
                    the overworld
                  </li>
                  <li>
                    <span className="text-white font-semibold">Space / Enter</span> â€” Interact
                    with NPCs, advance dialogue
                  </li>
                  <li>
                    <span className="text-white font-semibold">1-4</span> â€” Use moves in battle
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Overworld</h3>
                <p>
                  Walk through <span className="text-green-300">tall grass</span> to encounter wild
                  creatures (15% per step). Talk to NPCs, heal at{' '}
                  <span className="text-pink-300">healing pads</span>, and challenge trainers who
                  block your path.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Battle</h3>
                <p>
                  Turn-based combat. Faster creature goes first. Choose from 4 moves, each with a
                  type, power, accuracy, and PP cost. Type matchups matter!
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Type Chart</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <span className="text-orange-300">Fire</span> beats{' '}
                    <span className="text-green-300">Grass</span>
                  </li>
                  <li>
                    <span className="text-green-300">Grass</span> beats{' '}
                    <span className="text-blue-300">Water</span>
                  </li>
                  <li>
                    <span className="text-blue-300">Water</span> beats{' '}
                    <span className="text-orange-300">Fire</span>
                  </li>
                  <li>
                    <span className="text-yellow-300">Electric</span> beats{' '}
                    <span className="text-blue-300">Water</span>
                  </li>
                  <li>
                    <span className="text-purple-300">Ghost</span> and{' '}
                    <span className="text-gray-300">Normal</span> are immune to each other
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Starters</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <span className="text-orange-300 font-semibold">Emberfox</span> (Fire) â€” Fast,
                    high special attack
                  </li>
                  <li>
                    <span className="text-blue-300 font-semibold">Aquaphin</span> (Water) â€” Tanky,
                    balanced stats
                  </li>
                  <li>
                    <span className="text-green-300 font-semibold">Thornvine</span> (Grass) â€”
                    Bulky, inflicts status effects
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Tips</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Catch creatures to build a party of up to 3.</li>
                  <li>Use type advantages â€” 2x damage makes a huge difference.</li>
                  <li>Heal at healing centers before the gym battle.</li>
                  <li>
                    Weaken wild creatures before catching (low HP + status = higher catch rate).
                  </li>
                  <li>Gym Leader Verdana uses Ghost and Grass types â€” plan accordingly!</li>
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
          onClick={() => {
            if (data.gamePhase === 'dialogue') handleAdvanceDialogue();
          }}
        />

        {/* Action panels based on game phase */}
        <div className="w-full max-w-[960px]">
          {/* Starter Selection */}
          {data.gamePhase === 'starter_select' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <p className="text-white/50 text-sm">Choose your first creature partner:</p>
              <div className="grid grid-cols-3 gap-4">
                {['emberfox', 'aquaphin', 'thornvine'].map((species) => {
                  const typeColor = TYPE_COLORS[getSpeciesType(species)];
                  return (
                    <button
                      key={species}
                      onClick={() => handleChooseStarter(species)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all active:scale-95 cursor-pointer select-none"
                    >
                      <span
                        className="text-lg font-display font-bold"
                        style={{ color: typeColor.primary }}
                      >
                        {capitalize(species)}
                      </span>
                      <span className="text-xs text-white/50">
                        {getSpeciesType(species).toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overworld Controls */}
          {data.gamePhase === 'overworld' && (
            <div className="flex flex-col sm:flex-row items-center gap-4 py-3">
              {/* D-pad */}
              <div className="grid grid-cols-3 gap-1 w-[140px]">
                <div />
                <button
                  onClick={() => handleMove('up')}
                  className="py-2 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-lg transition-all active:scale-90 cursor-pointer select-none"
                >
                  ^
                </button>
                <div />
                <button
                  onClick={() => handleMove('left')}
                  className="py-2 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-lg transition-all active:scale-90 cursor-pointer select-none"
                >
                  &lt;
                </button>
                <button
                  onClick={() => handleInteract()}
                  className="py-2 rounded bg-molt-500/30 border border-molt-500/30 hover:bg-molt-500/50 text-white text-xs font-bold transition-all active:scale-90 cursor-pointer select-none"
                >
                  ACT
                </button>
                <button
                  onClick={() => handleMove('right')}
                  className="py-2 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-lg transition-all active:scale-90 cursor-pointer select-none"
                >
                  &gt;
                </button>
                <div />
                <button
                  onClick={() => handleMove('down')}
                  className="py-2 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-lg transition-all active:scale-90 cursor-pointer select-none"
                >
                  v
                </button>
                <div />
              </div>

              {/* Inventory display */}
              <div className="flex gap-4 text-sm text-white/60">
                <span>
                  Potions: <span className="text-white font-bold">{data.inventory.potions}</span>
                </span>
                <span>
                  Orbs: <span className="text-white font-bold">{data.inventory.captureOrbs}</span>
                </span>
                <span>
                  Caught: <span className="text-white font-bold">{data.caughtSpecies.length}</span>
                </span>
                <span>
                  Badges: <span className="text-white font-bold">{data.gymDefeated ? 1 : 0}</span>
                </span>
              </div>

              {/* Party summary */}
              <div className="flex gap-2">
                {data.party.map((c) => {
                  const typeColor = TYPE_COLORS[c.type] || TYPE_COLORS.normal;
                  const hpPct = Math.round((c.stats.hp / c.stats.maxHp) * 100);
                  return (
                    <div
                      key={c.id}
                      className="text-xs border border-white/10 rounded px-2 py-1 bg-white/5"
                    >
                      <span style={{ color: typeColor.primary }} className="font-bold">
                        {capitalize(c.species)}
                      </span>
                      <span className="text-white/40 ml-1">Lv{c.level}</span>
                      <span
                        className={`ml-1 ${hpPct > 50 ? 'text-green-400' : hpPct > 25 ? 'text-yellow-400' : 'text-red-400'}`}
                      >
                        {hpPct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dialogue Controls */}
          {data.gamePhase === 'dialogue' && (
            <div className="flex justify-center py-3">
              <button
                onClick={handleAdvanceDialogue}
                className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-display font-bold transition-all active:scale-95 cursor-pointer select-none"
              >
                Continue (Space)
              </button>
            </div>
          )}

          {/* Battle Controls */}
          {data.gamePhase === 'battle' && data.battleState && (
            <div className="flex flex-col gap-3 py-3">
              {/* Moves grid (2x2) */}
              <div className="grid grid-cols-2 gap-2">
                {data.party[data.battleState.activeIndex]?.moves.map((move, i) => (
                  <button
                    key={move.name}
                    onClick={() => handleFight(i)}
                    disabled={move.pp <= 0 || isGameOver}
                    className={[
                      'py-2.5 px-3 rounded-lg font-display font-bold text-sm border',
                      moveTypeColor(move.type),
                      'hover:brightness-125 transition-all active:scale-[0.98]',
                      'disabled:opacity-30 disabled:cursor-not-allowed',
                      'cursor-pointer select-none',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <span>{move.name}</span>
                      <span className="text-[10px] opacity-60">
                        {move.pp}/{move.maxPp} PP
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] opacity-50 mt-0.5">
                      <span>{move.type.toUpperCase()}</span>
                      {move.power > 0 && <span>PWR: {move.power}</span>}
                      <span>ACC: {move.accuracy}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Action row */}
              <div className="grid grid-cols-4 gap-2">
                {/* Catch (wild only) */}
                <button
                  onClick={handleCatch}
                  disabled={
                    !data.battleState.canCatch || data.inventory.captureOrbs <= 0 || isGameOver
                  }
                  className={[
                    'py-2 rounded-lg font-display font-bold text-sm',
                    'bg-green-600/30 border border-green-500/30 text-green-300',
                    'hover:bg-green-600/50 transition-all active:scale-[0.98]',
                    'disabled:opacity-30 disabled:cursor-not-allowed',
                    'cursor-pointer select-none',
                  ].join(' ')}
                >
                  Catch ({data.inventory.captureOrbs})
                </button>

                {/* Potion */}
                <button
                  onClick={handleUseItem}
                  disabled={data.inventory.potions <= 0 || isGameOver}
                  className={[
                    'py-2 rounded-lg font-display font-bold text-sm',
                    'bg-pink-600/30 border border-pink-500/30 text-pink-300',
                    'hover:bg-pink-600/50 transition-all active:scale-[0.98]',
                    'disabled:opacity-30 disabled:cursor-not-allowed',
                    'cursor-pointer select-none',
                  ].join(' ')}
                >
                  Potion ({data.inventory.potions})
                </button>

                {/* Switch */}
                {data.party.length > 1 ? (
                  <div className="relative group">
                    <button
                      disabled={isGameOver}
                      className={[
                        'w-full py-2 rounded-lg font-display font-bold text-sm',
                        'bg-blue-600/30 border border-blue-500/30 text-blue-300',
                        'hover:bg-blue-600/50 transition-all',
                        'disabled:opacity-30 disabled:cursor-not-allowed',
                        'cursor-pointer select-none',
                      ].join(' ')}
                    >
                      Switch
                    </button>
                    <div className="absolute bottom-full left-0 mb-1 hidden group-hover:flex flex-col gap-1 bg-surface-dark border border-white/10 rounded-lg p-2 min-w-[160px] z-10">
                      {data.party.map((c, i) => {
                        if (i === data.battleState!.activeIndex) return null;
                        return (
                          <button
                            key={c.id}
                            onClick={() => handleSwitchCreature(i)}
                            disabled={c.stats.hp <= 0 || isGameOver}
                            className="text-left text-xs px-2 py-1.5 rounded hover:bg-white/10 disabled:opacity-30 cursor-pointer select-none"
                          >
                            <span
                              className="font-bold"
                              style={{ color: (TYPE_COLORS[c.type] || TYPE_COLORS.normal).primary }}
                            >
                              {capitalize(c.species)}
                            </span>
                            <span className="text-white/40 ml-1">Lv{c.level}</span>
                            <span className="text-white/40 ml-1">
                              {c.stats.hp}/{c.stats.maxHp} HP
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <button
                    disabled
                    className="py-2 rounded-lg font-display font-bold text-sm bg-blue-600/30 border border-blue-500/30 text-blue-300 opacity-30 cursor-not-allowed select-none"
                  >
                    Switch
                  </button>
                )}

                {/* Flee */}
                <button
                  onClick={handleFlee}
                  disabled={!data.battleState.canFlee || isGameOver}
                  className={[
                    'py-2 rounded-lg font-display font-bold text-sm',
                    'bg-gray-600/30 border border-gray-500/30 text-gray-300',
                    'hover:bg-gray-600/50 transition-all active:scale-[0.98]',
                    'disabled:opacity-30 disabled:cursor-not-allowed',
                    'cursor-pointer select-none',
                  ].join(' ')}
                >
                  Flee
                </button>
              </div>
            </div>
          )}

          {/* Victory / Defeat */}
          {(data.gamePhase === 'victory' || data.gamePhase === 'defeat') && (
            <div className="flex justify-center py-4">
              <button
                onClick={restart}
                className="px-8 py-3 rounded-lg font-display font-bold text-lg bg-molt-500 hover:bg-molt-400 text-white shadow-lg shadow-molt-500/30 hover:shadow-xl transition-all active:scale-95 cursor-pointer select-none"
              >
                Play Again
              </button>
            </div>
          )}
        </div>

        {/* Combat Log */}
        {data.combatLog.length > 0 && (
          <div className="w-full max-w-[960px]">
            <div
              ref={logContainerRef}
              className="bg-black/40 border border-white/10 rounded-lg p-3 max-h-[150px] overflow-y-auto"
            >
              {data.combatLog.slice(-20).map((line, i) => (
                <div
                  key={`log-${data.combatLog.length - 20 + i}`}
                  className={[
                    'text-xs font-mono py-0.5',
                    line.includes('super effective')
                      ? 'text-red-300 font-bold'
                      : line.includes('not very effective')
                        ? 'text-gray-400'
                        : line.includes('fainted')
                          ? 'text-red-400'
                          : line.includes('caught') || line.includes('healed')
                            ? 'text-green-300'
                            : line.includes('level')
                              ? 'text-yellow-300 font-bold'
                              : 'text-white/60',
                  ].join(' ')}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
