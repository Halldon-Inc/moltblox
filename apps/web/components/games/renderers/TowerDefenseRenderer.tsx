'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { TowerDefenseGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';

// ── Types ────────────────────────────────────────────────────────────────────

interface Tower {
  type: 'basic' | 'sniper' | 'splash' | 'slow';
  level: number;
  position: number;
  damage: number;
  range: number;
}

interface Enemy {
  id: number;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  position: number;
}

interface TDState {
  grid: (Tower | null)[];
  gridWidth: number;
  gridHeight: number;
  pathCells: number[];
  towers: Tower[];
  enemies: Enemy[];
  wave: number;
  waveActive: boolean;
  gold: Record<string, number>;
  lives: number;
  maxLives: number;
  score: Record<string, number>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TOWER_TYPES = [
  { type: 'basic', label: 'Basic', cost: 50, color: '#22c55e', desc: 'Balanced' },
  { type: 'slow', label: 'Slow', cost: 75, color: '#06b6d4', desc: 'Slows enemies' },
  { type: 'sniper', label: 'Sniper', cost: 100, color: '#3b82f6', desc: 'Long range' },
  { type: 'splash', label: 'Splash', cost: 150, color: '#f97316', desc: 'Area damage' },
] as const;

const TOWER_COLOR_MAP: Record<string, string> = {
  basic: '#22c55e',
  sniper: '#3b82f6',
  splash: '#f97316',
  slow: '#06b6d4',
};

const TOWER_RANGE_MAP: Record<string, number> = {
  basic: 2,
  sniper: 5,
  splash: 2,
  slow: 3,
};

const CELL_BG = '#1a1a2e';
const CELL_BORDER = '#2a2a4a';
const PATH_COLOR = '#2d2d50';
const ENEMY_COLOR = '#ef4444';
const ENEMY_HP_BG = '#991b1b';
const ENEMY_HP_FG = '#22c55e';

// ── Component ────────────────────────────────────────────────────────────────

export default function TowerDefenseRenderer() {
  const { state, events, isGameOver, winner, scores, playerId, dispatch, restart } =
    useGameEngine(TowerDefenseGame);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTower, setSelectedTower] = useState<string>('basic');
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 480 });

  const data = (state?.data as unknown as TDState) ?? undefined;
  const gridW = data?.gridWidth ?? 8;
  const gridH = data?.gridHeight ?? 6;

  // Derived cell size from canvas
  const cellW = canvasSize.width / gridW;
  const cellH = canvasSize.height / gridH;

  // ── Auto-tick during active wave ─────────────────────────────────────────

  useEffect(() => {
    if (!data?.waveActive) return;
    const interval = setInterval(() => {
      dispatch('tick');
    }, 500);
    return () => clearInterval(interval);
  }, [data?.waveActive, dispatch]);

  // ── Responsive canvas sizing ─────────────────────────────────────────────

  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        // Maintain aspect ratio of gridW:gridH
        const h = (w / gridW) * gridH;
        setCanvasSize({ width: Math.floor(w), height: Math.floor(h) });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [gridW, gridH]);

  // ── Canvas rendering ─────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = cellW;
    const ch = cellH;

    // Clear
    ctx.fillStyle = CELL_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pathSet = new Set(data.pathCells);

    // Draw grid cells
    for (let row = 0; row < gridH; row++) {
      for (let col = 0; col < gridW; col++) {
        const idx = row * gridW + col;
        const x = col * cw;
        const y = row * ch;

        // Path cells are lighter
        if (pathSet.has(idx)) {
          ctx.fillStyle = PATH_COLOR;
          ctx.fillRect(x, y, cw, ch);
        }

        // Cell border
        ctx.strokeStyle = CELL_BORDER;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);

        // Hover highlight (only non-path, non-tower cells)
        if (idx === hoveredCell && !pathSet.has(idx) && !data.grid[idx]) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.fillRect(x, y, cw, ch);
        }
      }
    }

    // Draw tower range ring on hover
    if (hoveredCell !== null) {
      const tower = data.grid[hoveredCell];
      if (tower) {
        const tCol = hoveredCell % gridW;
        const tRow = Math.floor(hoveredCell / gridW);
        const cx = tCol * cw + cw / 2;
        const cy = tRow * ch + ch / 2;
        const rangeRadius = tower.range * Math.min(cw, ch);

        ctx.beginPath();
        ctx.arc(cx, cy, rangeRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fill();
      } else if (!pathSet.has(hoveredCell)) {
        // Show range preview for selected tower type
        const tCol = hoveredCell % gridW;
        const tRow = Math.floor(hoveredCell / gridW);
        const cx = tCol * cw + cw / 2;
        const cy = tRow * ch + ch / 2;
        const baseRange = TOWER_RANGE_MAP[selectedTower] ?? 2;
        const rangeRadius = baseRange * Math.min(cw, ch);

        ctx.beginPath();
        ctx.arc(cx, cy, rangeRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw towers
    for (const tower of data.towers) {
      const tCol = tower.position % gridW;
      const tRow = Math.floor(tower.position / gridW);
      const cx = tCol * cw + cw / 2;
      const cy = tRow * ch + ch / 2;
      const radius = Math.min(cw, ch) * 0.32;

      const color = TOWER_COLOR_MAP[tower.type] ?? '#ffffff';

      // Tower base
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Level indicator (small dots)
      if (tower.level > 1) {
        const dotRadius = 3;
        for (let i = 0; i < tower.level; i++) {
          const angle = ((i - (tower.level - 1) / 2) * Math.PI) / 4 - Math.PI / 2;
          const dx = cx + Math.cos(angle) * (radius + 6);
          const dy = cy + Math.sin(angle) * (radius + 6);
          ctx.beginPath();
          ctx.arc(dx, dy, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#fbbf24';
          ctx.fill();
        }
      }
    }

    // Draw enemies along the path
    for (const enemy of data.enemies) {
      if (enemy.hp <= 0) continue;

      // Interpolate position along path
      const pathIdx = Math.max(0, Math.min(enemy.position, data.pathCells.length - 1));
      if (pathIdx < 0) continue; // Haven't entered the map yet

      const cell = data.pathCells[Math.floor(pathIdx)];
      if (cell === undefined) continue;

      const eCol = cell % gridW;
      const eRow = Math.floor(cell / gridW);

      // Smooth interpolation between path cells
      let ex = eCol * cw + cw / 2;
      let ey = eRow * ch + ch / 2;

      const frac = pathIdx - Math.floor(pathIdx);
      const nextIdx = Math.floor(pathIdx) + 1;
      if (nextIdx < data.pathCells.length && frac > 0) {
        const nextCell = data.pathCells[nextIdx];
        const nCol = nextCell % gridW;
        const nRow = Math.floor(nextCell / gridW);
        ex = ex * (1 - frac) + (nCol * cw + cw / 2) * frac;
        ey = ey * (1 - frac) + (nRow * ch + ch / 2) * frac;
      }

      const enemyRadius = Math.min(cw, ch) * 0.2;

      // Enemy body
      ctx.beginPath();
      ctx.arc(ex, ey, enemyRadius, 0, Math.PI * 2);
      ctx.fillStyle = ENEMY_COLOR;
      ctx.fill();

      // HP bar above enemy
      const barW = cw * 0.6;
      const barH = 4;
      const barX = ex - barW / 2;
      const barY = ey - enemyRadius - 8;
      const hpPct = enemy.hp / enemy.maxHp;

      ctx.fillStyle = ENEMY_HP_BG;
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = ENEMY_HP_FG;
      ctx.fillRect(barX, barY, barW * hpPct, barH);
    }
  }, [data, canvasSize, hoveredCell, selectedTower, cellW, cellH, gridW, gridH]);

  // ── Mouse handlers ───────────────────────────────────────────────────────

  const getCellFromEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return -1;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      const col = Math.floor(mx / cellW);
      const row = Math.floor(my / cellH);
      if (col < 0 || col >= gridW || row < 0 || row >= gridH) return -1;
      return row * gridW + col;
    },
    [cellW, cellH, gridW, gridH],
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!data || isGameOver) return;
      const cell = getCellFromEvent(e);
      if (cell < 0) return;

      const pathSet = new Set(data.pathCells);

      if (data.grid[cell]) {
        // Click on existing tower -> upgrade
        dispatch('upgrade_tower', { position: cell });
      } else if (!pathSet.has(cell)) {
        // Click on empty non-path cell -> place tower
        dispatch('place_tower', { position: cell, towerType: selectedTower });
      }
    },
    [data, isGameOver, getCellFromEvent, dispatch, selectedTower],
  );

  const handleCanvasMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = getCellFromEvent(e);
      setHoveredCell(cell >= 0 ? cell : null);
    },
    [getCellFromEvent],
  );

  const handleCanvasLeave = useCallback(() => {
    setHoveredCell(null);
  }, []);

  // ── Derived values ───────────────────────────────────────────────────────

  const playerGold = data?.gold[playerId] ?? 0;
  const lives = data?.lives ?? 0;
  const maxLives = data?.maxLives ?? 20;
  const wave = data?.wave ?? 0;
  const waveActive = data?.waveActive ?? false;

  // Hovered tower info for tooltip
  const hoveredTower = hoveredCell !== null ? (data?.grid[hoveredCell] ?? null) : null;

  return (
    <GameShell
      name="Tower Defense"
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      onRestart={restart}
    >
      <div className="flex flex-col gap-4">
        {/* Stats bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400 text-lg">&#x2B50;</span>
              <span className="font-mono font-bold text-amber-400 text-lg">{playerGold}</span>
              <span className="text-xs text-white/40">gold</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-red-400 text-lg">&#x2764;</span>
              <span className="font-mono font-bold text-red-400 text-lg">
                {lives}/{maxLives}
              </span>
              <span className="text-xs text-white/40">lives</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-cyan-400 text-lg">&#x1F30A;</span>
              <span className="font-mono font-bold text-cyan-400 text-lg">{wave}/10</span>
              <span className="text-xs text-white/40">wave</span>
            </div>
          </div>

          {!isGameOver && !waveActive && (
            <button
              onClick={() => dispatch('start_wave')}
              className="px-5 py-2 rounded-xl bg-molt-500 hover:bg-molt-400 text-white font-semibold text-sm transition-colors"
            >
              {wave === 0 ? 'Start Game' : 'Next Wave'}
            </button>
          )}
          {waveActive && (
            <span className="text-xs font-mono text-white/40 animate-pulse">
              Wave in progress...
            </span>
          )}
        </div>

        {/* Canvas */}
        <div className="w-full">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="w-full rounded-xl cursor-crosshair border border-white/5"
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMove}
            onMouseLeave={handleCanvasLeave}
          />
        </div>

        {/* Tower info tooltip */}
        {hoveredTower && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 text-xs text-white/60">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: TOWER_COLOR_MAP[hoveredTower.type] }}
            />
            <span className="font-semibold text-white/80 capitalize">{hoveredTower.type}</span>
            <span>Lv.{hoveredTower.level}</span>
            <span>DMG: {hoveredTower.damage}</span>
            <span>Range: {hoveredTower.range}</span>
            {hoveredTower.level < 3 && <span className="text-amber-400">Click to upgrade</span>}
          </div>
        )}

        {/* Tower selector */}
        <div className="grid grid-cols-4 gap-2">
          {TOWER_TYPES.map((t) => {
            const canAfford = playerGold >= t.cost;
            const isSelected = selectedTower === t.type;
            return (
              <button
                key={t.type}
                onClick={() => setSelectedTower(t.type)}
                disabled={!canAfford}
                className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border transition-all text-sm ${
                  isSelected
                    ? 'border-white/30 bg-white/10 shadow-lg'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/5'
                } ${!canAfford ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className="inline-block w-5 h-5 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                <span className={`font-semibold ${isSelected ? 'text-white' : 'text-white/70'}`}>
                  {t.label}
                </span>
                <span className="text-xs text-amber-400 font-mono">{t.cost}g</span>
                <span className="text-[10px] text-white/30">{t.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    </GameShell>
  );
}
