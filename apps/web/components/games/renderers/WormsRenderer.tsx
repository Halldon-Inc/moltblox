'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { WormsGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';

// ==========================================================================
// Constants
// ==========================================================================

const CANVAS_W = 960;
const CANVAS_H = 540;
const CAMERA_LERP = 0.08;
const TICK_INTERVAL = 33; // ~30fps
const GRAVITY_VIS = 0.15;

// Default team colors
const DEFAULT_TEAM_COLORS = [
  { body: '#ec4899', highlight: '#f472b6', name: 'Pink' },
  { body: '#3b82f6', highlight: '#60a5fa', name: 'Blue' },
  { body: '#22c55e', highlight: '#4ade80', name: 'Green' },
  { body: '#f59e0b', highlight: '#fbbf24', name: 'Yellow' },
];

const DEFAULT_SKY_GRADIENT = ['#87ceeb', '#e0f2fe', '#bae6fd'];
const DEFAULT_TERRAIN_COLORS = { grass: '#4ade80', dirt: '#92400e', rock: '#57534e' };
const DEFAULT_WATER_COLOR = 'rgba(30, 64, 175, 0.5)';

// Weapon display categories for the selector
const WEAPON_CATEGORIES = [
  { keys: ['bazooka', 'homing-missile', 'grenade', 'cluster-bomb'], label: 'Projectiles' },
  { keys: ['banana-bomb', 'holy-hand-grenade', 'dynamite', 'mine'], label: 'Explosives' },
  { keys: ['shotgun', 'fire-punch', 'baseball-bat', 'prod'], label: 'Close Range' },
  { keys: ['airstrike', 'napalm-strike'], label: 'Air' },
  { keys: ['blowtorch', 'drill', 'teleport', 'ninja-rope', 'girder'], label: 'Utilities' },
  { keys: ['skip'], label: 'Skip' },
];

const WEAPON_NAMES: Record<string, string> = {
  bazooka: 'Bazooka',
  'homing-missile': 'Homing',
  grenade: 'Grenade',
  'cluster-bomb': 'Cluster',
  'banana-bomb': 'Banana',
  'holy-hand-grenade': 'Holy HG',
  shotgun: 'Shotgun',
  'fire-punch': 'Fire Punch',
  dynamite: 'Dynamite',
  mine: 'Mine',
  airstrike: 'Airstrike',
  'napalm-strike': 'Napalm',
  blowtorch: 'Blowtorch',
  drill: 'Drill',
  teleport: 'Teleport',
  'ninja-rope': 'Ninja Rope',
  girder: 'Girder',
  'baseball-bat': 'Bat',
  prod: 'Prod',
  skip: 'Skip',
};

// ==========================================================================
// Types
// ==========================================================================

interface Vec2 {
  x: number;
  y: number;
}

interface WormData {
  id: string;
  playerId: string;
  teamId: number;
  name: string;
  position: Vec2;
  hp: number;
  maxHp: number;
  alive: boolean;
  facingRight: boolean;
  velocity: Vec2;
}

interface ProjectileData {
  id: string;
  weaponSlug: string;
  position: Vec2;
  velocity: Vec2;
  trail: Vec2[];
  active: boolean;
}

interface CrateData {
  id: string;
  position: Vec2;
  type: string;
  content: string;
  falling: boolean;
}

interface PlayerInfo {
  id: string;
  teamId: number;
  isNPC: boolean;
  wormIds: string[];
  alive: boolean;
  weapons: Record<string, number>;
}

interface WormsStateData {
  terrain: number[];
  terrainWidth: number;
  terrainHeight: number;
  players: Record<string, PlayerInfo>;
  worms: Record<string, WormData>;
  turnOrder: string[];
  currentTurnIndex: number;
  activeWormId: string | null;
  turnPhase: string;
  turnStartedAt: number;
  hasFiredThisTurn: boolean;
  wind: number;
  waterLevel: number;
  suddenDeath: boolean;
  roundTimeRemaining: number;
  projectiles: ProjectileData[];
  crates: CrateData[];
  gameOver: boolean;
  turnCount: number;
  mode: string;
  selectedWeapon: string;
  aimAngle: number;
  power: number;
  fuseTimer: number;
  config: Record<string, unknown>;
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

interface ScreenShake {
  intensity: number;
  duration: number;
  elapsed: number;
}

interface Tombstone {
  x: number;
  y: number;
  name: string;
  alpha: number;
}

// ==========================================================================
// Sprite definitions (pixel art)
// ==========================================================================

const WORM_IDLE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 5, 5, 5, 5, 0, 0, 0],
  [0, 0, 5, 6, 5, 5, 6, 5, 0, 0],
  [0, 0, 0, 5, 5, 5, 5, 0, 0, 0],
  [0, 0, 1, 2, 2, 2, 2, 1, 0, 0],
  [0, 1, 2, 3, 2, 2, 3, 2, 1, 0],
  [0, 1, 2, 2, 2, 2, 2, 2, 1, 0],
  [0, 1, 2, 2, 4, 4, 2, 2, 1, 0],
  [0, 0, 1, 2, 2, 2, 2, 1, 0, 0],
  [0, 0, 0, 1, 2, 2, 1, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
];

const WORM_WALK1: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 5, 5, 5, 5, 0, 0, 0],
  [0, 0, 5, 6, 5, 5, 6, 5, 0, 0],
  [0, 0, 0, 5, 5, 5, 5, 0, 0, 0],
  [0, 0, 1, 2, 2, 2, 2, 1, 0, 0],
  [0, 1, 2, 3, 2, 2, 3, 2, 1, 0],
  [0, 1, 2, 2, 2, 2, 2, 2, 1, 0],
  [0, 0, 1, 2, 4, 4, 2, 1, 0, 0],
  [0, 0, 0, 1, 2, 2, 1, 0, 0, 0],
  [0, 0, 0, 1, 2, 2, 1, 0, 0, 0],
  [0, 0, 1, 1, 0, 1, 1, 0, 0, 0],
  [0, 1, 1, 0, 0, 0, 1, 1, 0, 0],
];

const WORM_WALK2: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 5, 5, 5, 5, 0, 0, 0],
  [0, 0, 5, 6, 5, 5, 6, 5, 0, 0],
  [0, 0, 0, 5, 5, 5, 5, 0, 0, 0],
  [0, 1, 2, 2, 2, 2, 2, 2, 1, 0],
  [1, 2, 3, 2, 2, 2, 2, 3, 2, 1],
  [0, 1, 2, 2, 2, 2, 2, 2, 1, 0],
  [0, 0, 1, 2, 4, 4, 2, 1, 0, 0],
  [0, 0, 0, 1, 2, 2, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
];

const WORM_JUMP: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 5, 5, 5, 5, 0, 0, 0],
  [0, 0, 5, 6, 5, 5, 6, 5, 0, 0],
  [0, 0, 0, 5, 5, 5, 5, 0, 0, 0],
  [0, 0, 0, 1, 2, 2, 1, 0, 0, 0],
  [0, 0, 1, 2, 2, 2, 2, 1, 0, 0],
  [0, 1, 2, 3, 2, 2, 3, 2, 1, 0],
  [0, 1, 2, 2, 4, 4, 2, 2, 1, 0],
  [0, 0, 1, 2, 2, 2, 2, 1, 0, 0],
  [0, 0, 1, 2, 2, 2, 2, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const WORM_DEATH: number[][] = [
  [0, 0, 0, 7, 7, 7, 7, 0, 0, 0],
  [0, 0, 7, 0, 7, 7, 0, 7, 0, 0],
  [0, 0, 0, 5, 5, 5, 5, 0, 0, 0],
  [0, 0, 5, 8, 5, 5, 8, 5, 0, 0],
  [0, 0, 0, 5, 5, 5, 5, 0, 0, 0],
  [0, 0, 1, 2, 2, 2, 2, 1, 0, 0],
  [0, 1, 2, 2, 2, 2, 2, 2, 1, 0],
  [0, 0, 1, 2, 2, 2, 2, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

function getWormPalette(
  teamId: number,
  teamColors: { body: string; highlight: string; name: string }[] = DEFAULT_TEAM_COLORS,
): Record<number, string | null> {
  const tc = teamColors[teamId % teamColors.length];
  return {
    0: null,
    1: '#1a1a2e',
    2: tc.body,
    3: tc.highlight,
    4: '#f5d0a9',
    5: '#ffffff',
    6: '#1a1a2e',
    7: '#ffd700',
    8: '#ef4444',
  };
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: number[][],
  palette: Record<number, string | null>,
  x: number,
  y: number,
  scale: number,
  flipX: boolean,
) {
  const h = sprite.length;
  const w = sprite[0].length;
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const pIdx = sprite[row][flipX ? w - 1 - col : col];
      const color = palette[pIdx];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.floor(x + col * scale),
        Math.floor(y + row * scale),
        Math.ceil(scale),
        Math.ceil(scale),
      );
    }
  }
}

// ==========================================================================
// Component
// ==========================================================================

interface WormsRendererProps {
  gameName?: string;
  gameConfig?: Record<string, unknown>;
}

export default function WormsRenderer({ gameName, gameConfig }: WormsRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const terrainDirty = useRef(true);

  const cameraRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef<ScreenShake>({ intensity: 0, duration: 0, elapsed: 0 });
  const tombstonesRef = useRef<Tombstone[]>([]);
  const timeRef = useRef(0);
  const blinkRef = useRef(0);
  const rafRef = useRef(0);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
  const chargingRef = useRef(false);
  const chargeStartRef = useRef(0);
  const [weaponPanelOpen, setWeaponPanelOpen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const lastTerrainRef = useRef<number[] | null>(null);

  const { state, events, isGameOver, winner, scores, dispatch, restart } = useGameEngine(
    WormsGame,
    gameConfig,
  );

  const data = state?.data as WormsStateData | undefined;

  // Read visual config from state.data.config (Worms uses config, not _config)
  const wormsCfg = (data?.config ?? {}) as Record<string, unknown>;
  const theme = (wormsCfg.theme ?? {}) as Record<string, unknown>;

  const cfgTeamColors = theme.teamColors as
    | { body: string; highlight: string; name: string }[]
    | undefined;
  const TEAM_COLORS = cfgTeamColors ?? DEFAULT_TEAM_COLORS;

  const skyGradientColors = (theme.skyGradient as string[]) ?? DEFAULT_SKY_GRADIENT;
  const terrainColors =
    (theme.terrainColors as { grass?: string; dirt?: string; rock?: string }) ??
    DEFAULT_TERRAIN_COLORS;
  const waterColor = (theme.waterColor as string) ?? DEFAULT_WATER_COLOR;

  const cfgWeaponNames = theme.weaponNames as Record<string, string> | undefined;
  const weaponDisplayNames = cfgWeaponNames ? { ...WEAPON_NAMES, ...cfgWeaponNames } : WEAPON_NAMES;

  // Suppress lint warnings for variables used in render
  void skyGradientColors;
  void terrainColors;
  void waterColor;
  void weaponDisplayNames;

  // =========================================================================
  // Tick loop (physics resolution)
  // =========================================================================

  useEffect(() => {
    if (!data) return;
    const hasProjectiles = data.projectiles?.some((p) => p.active);
    const hasMovingWorms = Object.values(data.worms ?? {}).some(
      (w) => w.alive && (w.velocity.x !== 0 || w.velocity.y !== 0),
    );
    const isResolving = data.turnPhase === 'resolving';
    const isRetreating = data.turnPhase === 'retreat';

    if (
      (hasProjectiles || hasMovingWorms || isResolving || isRetreating) &&
      !tickIntervalRef.current
    ) {
      tickIntervalRef.current = setInterval(() => {
        dispatch('tick', {});
      }, TICK_INTERVAL);
    }

    if (
      !hasProjectiles &&
      !hasMovingWorms &&
      !isResolving &&
      !isRetreating &&
      tickIntervalRef.current
    ) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [data?.turnPhase, data?.projectiles?.length, dispatch]);

  // =========================================================================
  // Process events (particles, tombstones, screen shake)
  // =========================================================================

  useEffect(() => {
    if (!events || events.length === 0) return;
    const latest = events[events.length - 1];
    if (!latest) return;

    if (latest.type === 'explosion') {
      const ex = Number(latest.data.x);
      const ey = Number(latest.data.y);
      const radius = Number(latest.data.radius ?? 25);

      // Spawn particles
      const count = Math.min(50, Math.floor(radius * 1.5));
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        const colors = ['#92400e', '#65a30d', '#78716c', '#f97316', '#fbbf24', '#ef4444'];
        particlesRef.current.push({
          x: ex,
          y: ey,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 0,
          maxLife: 20 + Math.random() * 20,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 2 + Math.random() * 3,
        });
      }

      // Screen shake
      shakeRef.current = {
        intensity: Math.min(8, radius * 0.15),
        duration: 15,
        elapsed: 0,
      };

      // Mark terrain dirty
      terrainDirty.current = true;
    }

    if (latest.type === 'worm_died' || latest.type === 'worm_drowned') {
      const wormId = String(latest.data.wormId ?? '');
      const wormName = String(latest.data.wormName ?? 'Worm');
      if (data?.worms[wormId]) {
        tombstonesRef.current.push({
          x: data.worms[wormId].position.x,
          y: data.worms[wormId].position.y,
          name: wormName,
          alpha: 1,
        });
      }
    }

    if (latest.type === 'splash') {
      const sx = Number(latest.data.x);
      const sy = Number(latest.data.y);
      for (let i = 0; i < 15; i++) {
        particlesRef.current.push({
          x: sx,
          y: sy,
          vx: (Math.random() - 0.5) * 3,
          vy: -2 - Math.random() * 3,
          life: 0,
          maxLife: 15 + Math.random() * 10,
          color: '#60a5fa',
          size: 2 + Math.random() * 2,
        });
      }
    }
  }, [events, data?.worms]);

  // =========================================================================
  // Input handlers
  // =========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);

      if (!data || isGameOver) return;
      const isMyTurn = data.turnOrder[data.currentTurnIndex] === 'player-1';
      if (!isMyTurn) return;

      if (data.turnPhase === 'moving' || data.turnPhase === 'retreat') {
        if (e.key === 'ArrowLeft' || e.key === 'a') {
          dispatch('move', { direction: 'left' });
        }
        if (e.key === 'ArrowRight' || e.key === 'd') {
          dispatch('move', { direction: 'right' });
        }
        if (e.key === 'Enter') {
          if (data.hasFiredThisTurn) {
            dispatch('end_turn', {});
          } else {
            dispatch('jump', { type: 'forward' });
          }
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          dispatch('jump', { type: 'backflip' });
        }
      }

      // Weapon selection (number keys)
      if (e.key >= '1' && e.key <= '5' && !data.hasFiredThisTurn) {
        const fuse = parseInt(e.key);
        dispatch('set_fuse', { fuse });
      }

      // F-keys for weapon categories
      if (e.key.startsWith('F') && e.key.length <= 3) {
        e.preventDefault();
        const fIdx = parseInt(e.key.slice(1)) - 1;
        if (fIdx >= 0 && fIdx < WEAPON_CATEGORIES.length) {
          const cat = WEAPON_CATEGORIES[fIdx];
          const firstAvailable = cat.keys.find((k) => {
            const player = data.players['player-1'];
            return player && player.weapons[k] !== 0;
          });
          if (firstAvailable) {
            dispatch('select_weapon', { weapon: firstAvailable });
          }
        }
      }

      // Space: start charging
      if (e.key === ' ' && !data.hasFiredThisTurn && data.turnPhase === 'moving') {
        e.preventDefault();
        if (!chargingRef.current) {
          chargingRef.current = true;
          chargeStartRef.current = Date.now();
        }
      }

      // Tab: cycle camera
      if (e.key === 'Tab') {
        e.preventDefault();
      }

      // Home: center camera
      if (e.key === 'Home') {
        if (data.activeWormId && data.worms[data.activeWormId]) {
          const w = data.worms[data.activeWormId];
          cameraRef.current.targetX = w.position.x - CANVAS_W / 2;
          cameraRef.current.targetY = w.position.y - CANVAS_H / 2;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);

      // Space release: fire weapon
      if (e.key === ' ' && chargingRef.current && data && !isGameOver) {
        chargingRef.current = false;
        const chargeTime = Date.now() - chargeStartRef.current;
        const power = Math.min(100, Math.max(10, chargeTime / 20));

        const worm = data.activeWormId ? data.worms[data.activeWormId] : null;
        if (worm) {
          const cam = cameraRef.current;
          const wormScreenX = worm.position.x - cam.x;
          const wormScreenY = worm.position.y - cam.y;
          const dx = mouseRef.current.x - wormScreenX;
          const dy = mouseRef.current.y - wormScreenY;
          const angle = Math.atan2(dy, dx);

          dispatch('fire', {
            weapon: data.selectedWeapon,
            angle,
            power,
          });
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      mouseRef.current.x = (e.clientX - rect.left) * scaleX;
      mouseRef.current.y = (e.clientY - rect.top) * scaleY;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setWeaponPanelOpen((v) => !v);
    };

    const handleClick = (e: MouseEvent) => {
      if (!data || isGameOver) return;

      // If weapon panel is open, check for weapon selection
      if (weaponPanelOpen) {
        setWeaponPanelOpen(false);
        return;
      }

      // Teleport / airstrike targeting
      if (
        data.selectedWeapon === 'teleport' ||
        data.selectedWeapon === 'airstrike' ||
        data.selectedWeapon === 'napalm-strike' ||
        data.selectedWeapon === 'homing-missile'
      ) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX + cameraRef.current.x;
        const clickY = (e.clientY - rect.top) * scaleY + cameraRef.current.y;

        if (data.selectedWeapon === 'teleport') {
          dispatch('fire', { weapon: 'teleport', targetX: clickX, targetY: clickY });
        } else {
          dispatch('fire', { weapon: data.selectedWeapon, targetX: clickX, angle: 0, power: 100 });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('contextmenu', handleContextMenu);
      canvas.addEventListener('click', handleClick);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      if (canvas) {
        canvas.removeEventListener('contextmenu', handleContextMenu);
        canvas.removeEventListener('click', handleClick);
      }
    };
  }, [data, dispatch, isGameOver, weaponPanelOpen]);

  // =========================================================================
  // Render loop
  // =========================================================================

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    timeRef.current++;
    blinkRef.current++;

    const cam = cameraRef.current;

    // ---- Camera tracking ----
    // Follow active worm or projectile
    let trackTarget: Vec2 | null = null;
    const activeProj = data.projectiles?.find((p) => p.active);
    if (activeProj) {
      trackTarget = activeProj.position;
    } else if (data.activeWormId && data.worms[data.activeWormId]?.alive) {
      trackTarget = data.worms[data.activeWormId].position;
    }

    if (trackTarget) {
      cam.targetX = trackTarget.x - CANVAS_W / 2;
      cam.targetY = trackTarget.y - CANVAS_H / 2;
    }

    cam.x += (cam.targetX - cam.x) * CAMERA_LERP;
    cam.y += (cam.targetY - cam.y) * CAMERA_LERP;

    // Clamp camera
    cam.x = Math.max(0, Math.min(data.terrainWidth - CANVAS_W, cam.x));
    cam.y = Math.max(0, Math.min(data.terrainHeight - CANVAS_H, cam.y));

    // Screen shake
    let shakeX = 0,
      shakeY = 0;
    const shake = shakeRef.current;
    if (shake.elapsed < shake.duration) {
      shake.elapsed++;
      const factor = 1 - shake.elapsed / shake.duration;
      shakeX = (Math.random() - 0.5) * shake.intensity * factor * 2;
      shakeY = (Math.random() - 0.5) * shake.intensity * factor * 2;
    }

    const cx = cam.x + shakeX;
    const cy = cam.y + shakeY;

    // ---- Clear ----
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // ---- Sky gradient ----
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    if (data.suddenDeath) {
      skyGrad.addColorStop(0, '#4a0000');
      skyGrad.addColorStop(1, '#1a0000');
    } else {
      skyGrad.addColorStop(0, skyGradientColors[0] ?? '#87ceeb');
      skyGrad.addColorStop(0.6, skyGradientColors[1] ?? '#e0f2fe');
      skyGrad.addColorStop(1, skyGradientColors[2] ?? '#bae6fd');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ---- Terrain ----
    // Use offscreen canvas for terrain, re-render only when dirty
    if (!terrainCanvasRef.current) {
      const tc = document.createElement('canvas');
      tc.width = data.terrainWidth;
      tc.height = data.terrainHeight;
      terrainCanvasRef.current = tc;
      terrainDirty.current = true;
    }

    // Check if terrain changed
    if (lastTerrainRef.current !== data.terrain) {
      terrainDirty.current = true;
      lastTerrainRef.current = data.terrain;
    }

    if (terrainDirty.current && terrainCanvasRef.current) {
      const tctx = terrainCanvasRef.current.getContext('2d');
      if (tctx) {
        tctx.clearRect(0, 0, data.terrainWidth, data.terrainHeight);
        for (let x = 0; x < data.terrainWidth; x++) {
          const groundY = data.terrain[x];
          if (groundY == null || groundY >= data.terrainHeight) continue;

          // Grass (green, 3px)
          tctx.fillStyle = terrainColors.grass ?? '#4ade80';
          tctx.fillRect(x, groundY, 1, Math.min(3, data.terrainHeight - groundY));

          // Dirt (brown, 30px)
          tctx.fillStyle = terrainColors.dirt ?? '#92400e';
          tctx.fillRect(x, groundY + 3, 1, Math.min(30, data.terrainHeight - groundY - 3));

          // Rock (gray, rest)
          tctx.fillStyle = terrainColors.rock ?? '#57534e';
          const rockStart = groundY + 33;
          if (rockStart < data.terrainHeight) {
            tctx.fillRect(x, rockStart, 1, data.terrainHeight - rockStart);
          }
        }
      }
      terrainDirty.current = false;
    }

    // Draw terrain from offscreen canvas
    if (terrainCanvasRef.current) {
      ctx.drawImage(
        terrainCanvasRef.current,
        Math.floor(cx),
        Math.floor(cy),
        CANVAS_W,
        CANVAS_H,
        0,
        0,
        CANVAS_W,
        CANVAS_H,
      );
    }

    // ---- Water ----
    const waterScreenY = data.waterLevel - cy;
    if (waterScreenY < CANVAS_H) {
      ctx.fillStyle = waterColor;
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H);
      for (let x = 0; x <= CANVAS_W; x += 2) {
        const waveY = waterScreenY + Math.sin(timeRef.current * 0.05 + x * 0.03) * 3;
        ctx.lineTo(x, waveY);
      }
      ctx.lineTo(CANVAS_W, CANVAS_H);
      ctx.closePath();
      ctx.fill();

      // Deeper water
      ctx.fillStyle = 'rgba(30, 64, 175, 0.3)';
      ctx.fillRect(0, waterScreenY + 5, CANVAS_W, CANVAS_H - waterScreenY);
    }

    // ---- Tombstones ----
    for (const tomb of tombstonesRef.current) {
      const tx = tomb.x - cx;
      const ty = tomb.y - cy;
      if (tx < -30 || tx > CANVAS_W + 30 || ty < -30 || ty > CANVAS_H + 30) continue;
      ctx.globalAlpha = Math.max(0, tomb.alpha);
      ctx.fillStyle = '#6b7280';
      // Simple cross tombstone
      ctx.fillRect(tx - 4, ty - 18, 8, 22);
      ctx.fillRect(tx - 8, ty - 14, 16, 5);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tomb.name, tx, ty + 12);
      ctx.globalAlpha = 1;
      tomb.alpha -= 0.002;
    }
    tombstonesRef.current = tombstonesRef.current.filter((t) => t.alpha > 0);

    // ---- Crates ----
    for (const crate of data.crates ?? []) {
      const crateX = crate.position.x - cx;
      const crateY = crate.position.y - cy;
      if (crateX < -20 || crateX > CANVAS_W + 20 || crateY < -20 || crateY > CANVAS_H + 20)
        continue;

      // Parachute if falling
      if (crate.falling) {
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(crateX, crateY - 18);
        ctx.quadraticCurveTo(crateX - 12, crateY - 32, crateX, crateY - 40);
        ctx.quadraticCurveTo(crateX + 12, crateY - 32, crateX, crateY - 18);
        ctx.stroke();
      }

      // Crate box
      const crateColor =
        crate.type === 'health' ? '#ef4444' : crate.type === 'weapon' ? '#f59e0b' : '#3b82f6';
      ctx.fillStyle = crateColor;
      ctx.fillRect(crateX - 9, crateY - 9, 18, 18);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(crateX - 9, crateY - 9, 18, 18);

      // Cross on crate
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(crateX - 5, crateY);
      ctx.lineTo(crateX + 5, crateY);
      ctx.moveTo(crateX, crateY - 5);
      ctx.lineTo(crateX, crateY + 5);
      ctx.stroke();
    }

    // ---- Worms ----
    const activeWorm = data.activeWormId ? data.worms[data.activeWormId] : null;

    for (const worm of Object.values(data.worms ?? {})) {
      const wx = worm.position.x - cx;
      const wy = worm.position.y - cy;
      if (wx < -30 || wx > CANVAS_W + 30 || wy < -40 || wy > CANVAS_H + 20) continue;

      const palette = getWormPalette(worm.teamId, TEAM_COLORS);
      const scale = 4;
      const spriteW = 10 * scale;
      const spriteH = 12 * scale;

      if (!worm.alive) {
        // Death sprite (briefly)
        drawSprite(
          ctx,
          WORM_DEATH,
          palette,
          wx - spriteW / 2,
          wy - spriteH,
          scale,
          !worm.facingRight,
        );
        continue;
      }

      // Choose animation frame
      let sprite = WORM_IDLE;
      if (worm.velocity.x !== 0 || worm.velocity.y !== 0) {
        sprite = WORM_JUMP;
      } else if (
        worm.id === data.activeWormId &&
        (keysRef.current.has('ArrowLeft') ||
          keysRef.current.has('ArrowRight') ||
          keysRef.current.has('a') ||
          keysRef.current.has('d'))
      ) {
        sprite = timeRef.current % 20 < 10 ? WORM_WALK1 : WORM_WALK2;
      } else {
        // Blink every 90 frames
        if (blinkRef.current % 90 < 5) {
          // Close eyes (use jump sprite briefly)
          sprite = WORM_IDLE;
        }
      }

      drawSprite(ctx, sprite, palette, wx - spriteW / 2, wy - spriteH, scale, !worm.facingRight);

      // Health bar
      const hpPct = worm.hp / worm.maxHp;
      const barW = 44;
      const barX = wx - barW / 2;
      const barY = wy - spriteH - 16;

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, 8);

      const hpColor = hpPct > 0.5 ? '#22c55e' : hpPct > 0.2 ? '#fbbf24' : '#ef4444';
      ctx.fillStyle = hpColor;
      ctx.fillRect(barX, barY, barW * hpPct, 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, 6);

      // Worm name
      const tc = TEAM_COLORS[worm.teamId % 4];
      ctx.fillStyle = tc.highlight;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(worm.name, wx, barY - 4);

      // HP number below worm
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`${worm.hp}`, wx, wy + 12);

      // Active indicator
      if (worm.id === data.activeWormId) {
        ctx.fillStyle = tc.body;
        ctx.beginPath();
        ctx.moveTo(wx, barY - 18);
        ctx.lineTo(wx - 6, barY - 12);
        ctx.lineTo(wx + 6, barY - 12);
        ctx.closePath();
        ctx.fill();
        // Pulsing glow ring
        const pulse = 0.4 + Math.sin(timeRef.current * 0.1) * 0.3;
        ctx.strokeStyle = tc.body;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wx, wy - spriteH / 2, spriteW / 2 + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // ---- Aiming UI ----
    if (activeWorm?.alive && !data.hasFiredThisTurn && data.turnPhase === 'moving') {
      const awx = activeWorm.position.x - cx;
      const awy = activeWorm.position.y - cy - 5;

      // Calculate aim angle from mouse
      const dx = mouseRef.current.x - awx;
      const dy = mouseRef.current.y - awy;
      const aimAngle = Math.atan2(dy, dx);

      // Crosshair line
      const lineLen = 40;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(awx, awy);
      ctx.lineTo(awx + Math.cos(aimAngle) * lineLen, awy + Math.sin(aimAngle) * lineLen);
      ctx.stroke();

      // Crosshair circle
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(
        awx + Math.cos(aimAngle) * lineLen,
        awy + Math.sin(aimAngle) * lineLen,
        7,
        0,
        Math.PI * 2,
      );
      ctx.stroke();

      // Trajectory preview (dotted arc)
      if (chargingRef.current) {
        const chargeTime = Date.now() - chargeStartRef.current;
        const power = Math.min(100, Math.max(10, chargeTime / 20));
        const speed = 8 * (power / 100);
        let px = activeWorm.position.x;
        let py = activeWorm.position.y - 5;
        let pvx = Math.cos(aimAngle) * speed;
        let pvy = Math.sin(aimAngle) * speed;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (let i = 0; i < 25; i++) {
          pvx += data.config.windEnabled !== false ? data.wind * 0.001 : 0;
          pvy += GRAVITY_VIS;
          px += pvx;
          py += pvy;
          const dotX = px - cx;
          const dotY = py - cy;
          if (dotX >= 0 && dotX <= CANVAS_W && dotY >= 0 && dotY <= CANVAS_H) {
            ctx.fillRect(dotX - 1, dotY - 1, 3, 3);
          }
        }

        // Power bar
        const barX2 = awx + 30;
        const barY2 = awy - 40;
        const barHeight = 55;
        const barWidth = 10;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(barX2, barY2, barWidth, barHeight);
        const pFill = power / 100;
        const pColor = pFill > 0.7 ? '#ef4444' : pFill > 0.4 ? '#fbbf24' : '#22c55e';
        ctx.fillStyle = pColor;
        ctx.fillRect(barX2, barY2 + barHeight * (1 - pFill), barWidth, barHeight * pFill);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(barX2, barY2, barWidth, barHeight);
      }
    }

    // ---- Teleport/Airstrike targeting cursor ----
    if (
      activeWorm?.alive &&
      !data.hasFiredThisTurn &&
      (data.selectedWeapon === 'teleport' ||
        data.selectedWeapon === 'airstrike' ||
        data.selectedWeapon === 'napalm-strike' ||
        data.selectedWeapon === 'homing-missile')
    ) {
      ctx.strokeStyle = data.selectedWeapon === 'teleport' ? '#a855f7' : '#ef4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(mouseRef.current.x, mouseRef.current.y, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mouseRef.current.x - 20, mouseRef.current.y);
      ctx.lineTo(mouseRef.current.x + 20, mouseRef.current.y);
      ctx.moveTo(mouseRef.current.x, mouseRef.current.y - 20);
      ctx.lineTo(mouseRef.current.x, mouseRef.current.y + 20);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---- Projectiles ----
    for (const proj of data.projectiles ?? []) {
      if (!proj.active) continue;
      const px = proj.position.x - cx;
      const py = proj.position.y - cy;

      // Trail
      if (proj.trail.length > 1) {
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const t0 = proj.trail[0];
        ctx.moveTo(t0.x - cx, t0.y - cy);
        for (let i = 1; i < proj.trail.length; i++) {
          ctx.lineTo(proj.trail[i].x - cx, proj.trail[i].y - cy);
        }
        ctx.stroke();
      }

      // Projectile dot
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Particles ----
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life++;

      const alpha = 1 - p.life / p.maxLife;
      if (alpha <= 0) {
        particlesRef.current.splice(i, 1);
        continue;
      }

      const psx = p.x - cx;
      const psy = p.y - cy;
      if (psx < -10 || psx > CANVAS_W + 10 || psy < -10 || psy > CANVAS_H + 10) continue;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(psx - p.size / 2, psy - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // ---- HUD: Turn Timer ----
    if (data.turnStartedAt && !isGameOver) {
      const turnTimeMs = ((data.config?.turnTimeSeconds as number) ?? 45) * 1000;
      const elapsed = Date.now() - data.turnStartedAt;
      const remaining = Math.max(0, Math.ceil((turnTimeMs - elapsed) / 1000));

      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';

      let timerColor = '#ffffff';
      if (remaining <= 5) {
        timerColor = '#ef4444';
        const pulse = 1 + Math.sin(timeRef.current * 0.3) * 0.15;
        ctx.save();
        ctx.translate(CANVAS_W / 2, 45);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = timerColor;
        ctx.fillText(String(remaining), 0, 0);
        ctx.restore();
      } else {
        if (remaining <= 15) timerColor = '#fbbf24';
        ctx.fillStyle = timerColor;
        ctx.fillText(String(remaining), CANVAS_W / 2, 45);
      }
    }

    // ---- HUD: Wind Indicator ----
    if (data.config?.windEnabled !== false) {
      const windCx = CANVAS_W / 2;
      const windY = 65;
      const arrowLen = Math.abs(data.wind) * 0.4;
      const dir = data.wind > 0 ? 1 : data.wind < 0 ? -1 : 0;

      if (dir !== 0) {
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(windCx, windY);
        ctx.lineTo(windCx + arrowLen * dir, windY);
        // Arrowhead
        ctx.lineTo(windCx + (arrowLen - 6) * dir, windY - 4);
        ctx.moveTo(windCx + arrowLen * dir, windY);
        ctx.lineTo(windCx + (arrowLen - 6) * dir, windY + 4);
        ctx.stroke();
      }

      ctx.fillStyle = '#60a5fa';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Wind: ${Math.abs(data.wind)}`, windCx, windY + 18);
    }

    // ---- HUD: Current Player & Weapon ----
    const currentPlayerId = data.turnOrder[data.currentTurnIndex];
    const currentPlayer = data.players[currentPlayerId];
    if (currentPlayer) {
      const tc = TEAM_COLORS[currentPlayer.teamId % 4];
      ctx.fillStyle = tc.body;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      const playerLabel = currentPlayer.isNPC ? `NPC ${currentPlayerId}` : 'Your Turn';
      ctx.fillText(playerLabel, 10, 22);

      // Active weapon
      const weaponName = weaponDisplayNames[data.selectedWeapon] ?? data.selectedWeapon;
      const ammo = currentPlayer.weapons[data.selectedWeapon];
      const ammoStr = ammo === -1 ? 'inf' : String(ammo);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`[${weaponName}] x${ammoStr}`, 10, 40);

      // Turn phase
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px monospace';
      const phaseLabel =
        data.turnPhase === 'moving'
          ? 'Move / Aim / Fire'
          : data.turnPhase === 'retreat'
            ? 'RETREAT!'
            : data.turnPhase === 'resolving'
              ? 'Resolving...'
              : data.turnPhase === 'between_turns'
                ? 'Next turn...'
                : data.turnPhase;
      ctx.fillText(phaseLabel, 10, 56);
    }

    // ---- HUD: Round Timer ----
    if (data.roundTimeRemaining > 0 && !data.suddenDeath) {
      const mins = Math.floor(data.roundTimeRemaining / 60);
      const secs = Math.floor(data.roundTimeRemaining % 60);
      ctx.fillStyle = '#9ca3af';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Round: ${mins}:${String(secs).padStart(2, '0')}`, CANVAS_W - 10, 22);
    } else if (data.suddenDeath) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('SUDDEN DEATH', CANVAS_W - 10, 22);
    }

    // ---- HUD: Fuse timer (for grenades) ----
    if (['grenade', 'cluster-bomb', 'banana-bomb'].includes(data.selectedWeapon)) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Fuse: ${data.fuseTimer}s (1-5 to change)`, 10, CANVAS_H - 12);
    }

    // ---- HUD: Kill Feed (last 5 events) ----
    const killEvents = (events ?? [])
      .filter((e) => e.type === 'worm_died' || e.type === 'worm_drowned')
      .slice(-5);

    ctx.textAlign = 'right';
    ctx.font = '11px monospace';
    for (let i = 0; i < killEvents.length; i++) {
      const ev = killEvents[i];
      const name = String(ev.data.wormName ?? 'Worm');
      const cause = ev.type === 'worm_drowned' ? 'drowned' : 'eliminated';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(`${name} ${cause}`, CANVAS_W - 10, CANVAS_H - 18 - i * 16);
    }

    // ---- Game Over Overlay ----
    if (isGameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 40);

      if (winner) {
        const winnerPlayer = data.players[winner];
        const isHuman = winner === 'player-1';
        const label = isHuman ? 'YOU WIN!' : `${winner} WINS`;
        const tc = winnerPlayer ? TEAM_COLORS[winnerPlayer.teamId % 4] : TEAM_COLORS[0];
        ctx.fillStyle = tc.body;
        ctx.font = 'bold 28px monospace';
        ctx.fillText(label, CANVAS_W / 2, CANVAS_H / 2 + 10);
      }

      // Scores
      ctx.font = '14px monospace';
      let yOff = 0;
      for (const [pid, score] of Object.entries(scores)) {
        const p = data.players[pid];
        const tc = p ? TEAM_COLORS[p.teamId % 4] : TEAM_COLORS[0];
        ctx.fillStyle = tc.body;
        const label = pid === 'player-1' ? 'You' : pid;
        ctx.fillText(`${label}: ${score}`, CANVAS_W / 2, CANVAS_H / 2 + 45 + yOff);
        yOff += 20;
      }

      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px monospace';
      ctx.fillText('Press R to restart', CANVAS_W / 2, CANVAS_H / 2 + 55 + yOff);
    }

    rafRef.current = requestAnimationFrame(render);
  }, [data, events, isGameOver, winner, scores]);

  // Start render loop
  useEffect(() => {
    if (data) {
      rafRef.current = requestAnimationFrame(render);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [render, data]);

  // Restart on R key
  useEffect(() => {
    const handleRestart = (e: KeyboardEvent) => {
      if (e.key === 'r' && isGameOver) {
        restart();
        particlesRef.current = [];
        tombstonesRef.current = [];
        terrainDirty.current = true;
        lastTerrainRef.current = null;
        if (terrainCanvasRef.current) {
          terrainCanvasRef.current = null;
        }
      }
    };
    window.addEventListener('keydown', handleRestart);
    return () => window.removeEventListener('keydown', handleRestart);
  }, [isGameOver, restart]);

  // =========================================================================
  // Weapon Panel (overlay)
  // =========================================================================

  const weaponPanel =
    weaponPanelOpen && data ? (
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '2px solid #4b5563',
          borderRadius: '8px',
          padding: '12px',
          zIndex: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '6px',
          maxWidth: '400px',
        }}
      >
        {Object.entries(weaponDisplayNames).map(([slug, name]) => {
          const player = data.players['player-1'];
          const ammo = player?.weapons[slug] ?? 0;
          const isSelected = data.selectedWeapon === slug;
          const available = ammo !== 0;

          return (
            <button
              key={slug}
              onClick={() => {
                if (available) {
                  dispatch('select_weapon', { weapon: slug });
                  setWeaponPanelOpen(false);
                }
              }}
              style={{
                background: isSelected ? '#3b82f6' : available ? '#374151' : '#1f2937',
                color: available ? '#ffffff' : '#6b7280',
                border: isSelected ? '2px solid #60a5fa' : '1px solid #4b5563',
                borderRadius: '4px',
                padding: '4px 2px',
                fontSize: '9px',
                fontFamily: 'monospace',
                cursor: available ? 'pointer' : 'default',
                textAlign: 'center' as const,
                lineHeight: '1.2',
              }}
            >
              <div>{name}</div>
              <div style={{ color: '#9ca3af', fontSize: '8px' }}>{ammo === -1 ? 'inf' : ammo}</div>
            </button>
          );
        })}
      </div>
    ) : null;

  // =========================================================================
  // Controls overlay
  // =========================================================================

  const controlsOverlay = showControls ? (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        color: '#ffffff',
        fontFamily: 'monospace',
        cursor: 'pointer',
      }}
      onClick={() => setShowControls(false)}
    >
      <h2 style={{ fontSize: '28px', marginBottom: '20px', color: '#ec4899' }}>WORMS ARENA</h2>
      <div style={{ fontSize: '12px', lineHeight: '2', textAlign: 'left' as const }}>
        <div>
          <span style={{ color: '#60a5fa' }}>A/D or Arrows</span> : Walk
        </div>
        <div>
          <span style={{ color: '#60a5fa' }}>Enter</span> : Forward Jump / End Turn
        </div>
        <div>
          <span style={{ color: '#60a5fa' }}>Backspace</span> : Backflip
        </div>
        <div>
          <span style={{ color: '#60a5fa' }}>Mouse</span> : Aim
        </div>
        <div>
          <span style={{ color: '#60a5fa' }}>Hold Space</span> : Charge Power, Release to Fire
        </div>
        <div>
          <span style={{ color: '#60a5fa' }}>Right-Click</span> : Weapon Panel
        </div>
        <div>
          <span style={{ color: '#60a5fa' }}>1-5</span> : Set Grenade Fuse Timer
        </div>
        <div>
          <span style={{ color: '#60a5fa' }}>F1-F6</span> : Weapon Categories
        </div>
        <div>
          <span style={{ color: '#60a5fa' }}>Click</span> : Teleport/Airstrike Target
        </div>
        <div>
          <span style={{ color: '#60a5fa' }}>Home</span> : Center Camera
        </div>
        <div>
          <span style={{ color: '#60a5fa' }}>R</span> : Restart (when game over)
        </div>
      </div>
      <p style={{ marginTop: '20px', color: '#9ca3af', fontSize: '11px' }}>
        Click anywhere to start
      </p>
    </div>
  ) : null;

  // =========================================================================
  // Team scoreboard
  // =========================================================================

  const scoreboard = data ? (
    <div style={{ marginTop: '8px' }}>
      {Object.entries(data.players).map(([pid, player]) => {
        const tc = TEAM_COLORS[player.teamId % 4];
        const aliveCount = player.wormIds.filter((wid) => data.worms[wid]?.alive).length;
        const totalWorms = player.wormIds.length;
        const isActive = data.turnOrder[data.currentTurnIndex] === pid;
        return (
          <div
            key={pid}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 6px',
              borderLeft: `3px solid ${tc.body}`,
              background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
              marginBottom: '2px',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: player.alive ? '#ffffff' : '#6b7280',
            }}
          >
            <span style={{ color: tc.body, fontWeight: 'bold' }}>
              {player.isNPC ? pid.replace('npc_', 'CPU ') : 'YOU'}
            </span>
            <span>
              {aliveCount}/{totalWorms}
            </span>
            {isActive && <span style={{ color: '#fbbf24' }}>{'<'}</span>}
          </div>
        );
      })}
    </div>
  ) : null;

  // =========================================================================
  // JSX
  // =========================================================================

  return (
    <GameShell
      name={gameName ?? 'Worms Arena'}
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      headerExtra={scoreboard}
      onRestart={() => {
        restart();
        particlesRef.current = [];
        tombstonesRef.current = [];
        terrainDirty.current = true;
        lastTerrainRef.current = null;
        terrainCanvasRef.current = null;
      }}
    >
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            width: '100%',
            background: '#000',
            imageRendering: 'pixelated',
            cursor:
              data?.selectedWeapon === 'teleport' ||
              data?.selectedWeapon === 'airstrike' ||
              data?.selectedWeapon === 'napalm-strike'
                ? 'crosshair'
                : 'default',
          }}
        />
        {weaponPanel}
        {controlsOverlay}
      </div>
    </GameShell>
  );
}
