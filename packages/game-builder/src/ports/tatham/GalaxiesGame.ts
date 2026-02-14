/**
 * GalaxiesGame: Divide grid into rotationally symmetric regions around dots
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface GalaxiesConfig {
  width?: number;
  height?: number;
}

interface Dot {
  row: number;
  col: number;
}

interface GalaxiesState {
  [key: string]: unknown;
  width: number;
  height: number;
  dots: Dot[];
  cellOwner: (number | null)[];
  moves: number;
  solved: boolean;
}

export class GalaxiesGame extends BaseGame {
  readonly name = 'Galaxies';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): GalaxiesState {
    const cfg = this.config as GalaxiesConfig;
    const width = Math.max(4, Math.min(cfg.width ?? 7, 12));
    const height = Math.max(4, Math.min(cfg.height ?? 7, 12));
    const total = width * height;

    const dots: Dot[] = [];
    const cellOwner = new Array(total).fill(null) as (number | null)[];
    const numDots = Math.floor(total / 4) + 1;

    let placed = 0;
    let attempts = 0;
    while (placed < numDots && attempts < 300) {
      const row = Math.floor(Math.random() * height);
      const col = Math.floor(Math.random() * width);
      const idx = row * width + col;

      if (cellOwner[idx] !== null) {
        attempts++;
        continue;
      }

      dots.push({ row: row * 2 + 1, col: col * 2 + 1 });
      cellOwner[idx] = placed;
      placed++;
      attempts++;
    }

    for (let i = 0; i < total; i++) {
      if (cellOwner[i] !== null) continue;
      const row = Math.floor(i / width);
      const col = i % width;
      let bestDot = 0;
      let bestDist = Infinity;
      for (let d = 0; d < dots.length; d++) {
        const dist = Math.abs(row * 2 + 1 - dots[d].row) + Math.abs(col * 2 + 1 - dots[d].col);
        if (dist < bestDist) {
          bestDist = dist;
          bestDot = d;
        }
      }
      cellOwner[i] = bestDot;
    }

    return {
      width,
      height,
      dots,
      cellOwner: new Array(total).fill(null),
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: GalaxiesState): boolean {
    const { width, height, dots, cellOwner } = data;
    const total = width * height;

    for (let i = 0; i < total; i++) {
      if (cellOwner[i] === null) return false;
    }

    for (let d = 0; d < dots.length; d++) {
      const cells: number[] = [];
      for (let i = 0; i < total; i++) {
        if (cellOwner[i] === d) cells.push(i);
      }
      if (cells.length === 0) continue;

      const centerR = dots[d].row;
      const centerC = dots[d].col;

      for (const cell of cells) {
        const row = Math.floor(cell / width);
        const col = cell % width;
        const mirrorR = centerR - (row * 2 + 1 - centerR);
        const mirrorC = centerC - (col * 2 + 1 - centerC);
        const mr = (mirrorR - 1) / 2;
        const mc = (mirrorC - 1) / 2;

        if (mr < 0 || mr >= height || mc < 0 || mc >= width) return false;
        if (!Number.isInteger(mr) || !Number.isInteger(mc)) return false;
        if (cellOwner[mr * width + mc] !== d) return false;
      }

      const visited = new Set<number>();
      const stack = [cells[0]];
      while (stack.length > 0) {
        const idx = stack.pop()!;
        if (visited.has(idx)) continue;
        if (cellOwner[idx] !== d) continue;
        visited.add(idx);
        const row = Math.floor(idx / width);
        const col = idx % width;
        if (row > 0) stack.push((row - 1) * width + col);
        if (row < height - 1) stack.push((row + 1) * width + col);
        if (col > 0) stack.push(row * width + col - 1);
        if (col < width - 1) stack.push(row * width + col + 1);
      }
      if (visited.size !== cells.length) return false;
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<GalaxiesState>();

    switch (action.type) {
      case 'assign': {
        const cell = Number(action.payload.cell);
        const dot = action.payload.dot as number | null;
        if (cell < 0 || cell >= data.width * data.height) {
          return { success: false, error: 'Invalid cell index' };
        }
        if (dot !== null && (dot < 0 || dot >= data.dots.length)) {
          return { success: false, error: 'Invalid dot index' };
        }

        data.cellOwner[cell] = dot;
        data.moves++;

        if (this.checkSolved(data)) {
          data.solved = true;
          this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<GalaxiesState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<GalaxiesState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 5);
    return { [playerId]: score };
  }
}
