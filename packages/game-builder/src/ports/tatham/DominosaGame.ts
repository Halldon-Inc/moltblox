/**
 * DominosaGame: Place all dominoes on grid matching the numbers shown
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface DominosaConfig {
  maxNum?: number;
}

interface DominosaState {
  [key: string]: unknown;
  rows: number;
  cols: number;
  maxNum: number;
  grid: number[];
  placements: (number | null)[];
  dominoCount: number;
  moves: number;
  solved: boolean;
}

export class DominosaGame extends BaseGame {
  readonly name = 'Dominosa';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): DominosaState {
    const cfg = this.config as DominosaConfig;
    const maxNum = Math.max(2, Math.min(cfg.maxNum ?? 6, 9));
    const rows = maxNum + 1;
    const cols = maxNum + 2;
    const total = rows * cols;

    const dominoes: [number, number][] = [];
    for (let a = 0; a <= maxNum; a++) {
      for (let b = a; b <= maxNum; b++) {
        dominoes.push([a, b]);
      }
    }

    for (let i = dominoes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dominoes[i], dominoes[j]] = [dominoes[j], dominoes[i]];
    }

    const grid = new Array(total).fill(0);
    const placement = new Array(total).fill(-1);
    let dominoIdx = 0;

    const cells = Array.from({ length: total }, (_, i) => i);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    for (const cell of cells) {
      if (placement[cell] !== -1 || dominoIdx >= dominoes.length) continue;
      const row = Math.floor(cell / cols);
      const col = cell % cols;
      const neighbors: number[] = [];
      if (col < cols - 1 && placement[cell + 1] === -1) neighbors.push(cell + 1);
      if (row < rows - 1 && placement[cell + cols] === -1) neighbors.push(cell + cols);
      if (col > 0 && placement[cell - 1] === -1) neighbors.push(cell - 1);
      if (row > 0 && placement[cell - cols] === -1) neighbors.push(cell - cols);

      if (neighbors.length > 0 && dominoIdx < dominoes.length) {
        const partner = neighbors[Math.floor(Math.random() * neighbors.length)];
        const [a, b] = dominoes[dominoIdx];
        if (Math.random() < 0.5) {
          grid[cell] = a;
          grid[partner] = b;
        } else {
          grid[cell] = b;
          grid[partner] = a;
        }
        placement[cell] = dominoIdx;
        placement[partner] = dominoIdx;
        dominoIdx++;
      }
    }

    for (let i = 0; i < total; i++) {
      if (placement[i] === -1) {
        grid[i] = Math.floor(Math.random() * (maxNum + 1));
      }
    }

    return {
      rows,
      cols,
      maxNum,
      grid,
      placements: new Array(total).fill(null),
      dominoCount: dominoes.length,
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: DominosaState): boolean {
    const { rows, cols, grid, placements, maxNum } = data;
    const total = rows * cols;

    for (let i = 0; i < total; i++) {
      if (placements[i] === null) return false;
    }

    const usedDominoes = new Set<string>();
    const processed = new Set<number>();

    for (let i = 0; i < total; i++) {
      const did = placements[i];
      if (did === null || processed.has(did)) continue;
      processed.add(did);

      const cells: number[] = [];
      for (let j = i; j < total; j++) {
        if (placements[j] === did) cells.push(j);
      }

      if (cells.length !== 2) return false;

      const a = Math.min(grid[cells[0]], grid[cells[1]]);
      const b = Math.max(grid[cells[0]], grid[cells[1]]);
      const key = `${a}-${b}`;
      if (usedDominoes.has(key)) return false;
      usedDominoes.add(key);
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<DominosaState>();

    switch (action.type) {
      case 'place_domino': {
        const cell1 = Number(action.payload.cell1);
        const cell2 = Number(action.payload.cell2);
        const dominoId = Number(action.payload.dominoId);
        const total = data.rows * data.cols;

        if (cell1 < 0 || cell1 >= total || cell2 < 0 || cell2 >= total) {
          return { success: false, error: 'Invalid cell index' };
        }

        const r1 = Math.floor(cell1 / data.cols);
        const c1 = cell1 % data.cols;
        const r2 = Math.floor(cell2 / data.cols);
        const c2 = cell2 % data.cols;
        const dist = Math.abs(r1 - r2) + Math.abs(c1 - c2);
        if (dist !== 1) return { success: false, error: 'Cells must be adjacent' };

        data.placements[cell1] = dominoId;
        data.placements[cell2] = dominoId;
        data.moves++;

        if (this.checkSolved(data)) {
          data.solved = true;
          this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      case 'clear': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= data.rows * data.cols) {
          return { success: false, error: 'Invalid cell index' };
        }
        const did = data.placements[index];
        if (did !== null) {
          for (let i = 0; i < data.placements.length; i++) {
            if (data.placements[i] === did) data.placements[i] = null;
          }
        }
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<DominosaState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<DominosaState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 8);
    return { [playerId]: score };
  }
}
