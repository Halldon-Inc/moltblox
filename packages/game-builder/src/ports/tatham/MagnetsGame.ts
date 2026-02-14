/**
 * MagnetsGame: Place +/- magnets in domino pairs, match row/col counts
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface MagnetsConfig {
  rows?: number;
  cols?: number;
}

type CellValue = '+' | '-' | 'empty' | null;

interface MagnetsState {
  [key: string]: unknown;
  rows: number;
  cols: number;
  dominoes: number[];
  dominoCount: number;
  cells: CellValue[];
  rowPlusCounts: (number | null)[];
  rowMinusCounts: (number | null)[];
  colPlusCounts: (number | null)[];
  colMinusCounts: (number | null)[];
  moves: number;
  solved: boolean;
}

export class MagnetsGame extends BaseGame {
  readonly name = 'Magnets';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): MagnetsState {
    const cfg = this.config as MagnetsConfig;
    const rows = Math.max(3, Math.min(cfg.rows ?? 5, 8));
    const cols = Math.max(3, Math.min(cfg.cols ?? 5, 8));
    const total = rows * cols;

    const dominoes = new Array(total).fill(-1);
    let dominoId = 0;

    const unassigned: number[] = [];
    for (let i = 0; i < total; i++) unassigned.push(i);

    for (let i = unassigned.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unassigned[i], unassigned[j]] = [unassigned[j], unassigned[i]];
    }

    for (const idx of unassigned) {
      if (dominoes[idx] !== -1) continue;
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const neighbors: number[] = [];
      if (col < cols - 1 && dominoes[idx + 1] === -1) neighbors.push(idx + 1);
      if (row < rows - 1 && dominoes[idx + cols] === -1) neighbors.push(idx + cols);
      if (col > 0 && dominoes[idx - 1] === -1) neighbors.push(idx - 1);
      if (row > 0 && dominoes[idx - cols] === -1) neighbors.push(idx - cols);

      if (neighbors.length > 0) {
        const partner = neighbors[Math.floor(Math.random() * neighbors.length)];
        dominoes[idx] = dominoId;
        dominoes[partner] = dominoId;
        dominoId++;
      }
    }

    for (let i = 0; i < total; i++) {
      if (dominoes[i] === -1) dominoes[i] = dominoId++;
    }

    const solution: CellValue[] = new Array(total).fill(null);
    const dominoSeen = new Set<number>();
    for (let i = 0; i < total; i++) {
      if (dominoSeen.has(dominoes[i])) continue;
      const pair: number[] = [];
      for (let j = i; j < total; j++) {
        if (dominoes[j] === dominoes[i]) pair.push(j);
      }
      dominoSeen.add(dominoes[i]);

      if (pair.length === 2) {
        const r = Math.random();
        if (r < 0.4) {
          solution[pair[0]] = '+';
          solution[pair[1]] = '-';
        } else if (r < 0.8) {
          solution[pair[0]] = '-';
          solution[pair[1]] = '+';
        } else {
          solution[pair[0]] = 'empty';
          solution[pair[1]] = 'empty';
        }
      } else {
        solution[pair[0]] = 'empty';
      }
    }

    const rowPlusCounts: (number | null)[] = [];
    const rowMinusCounts: (number | null)[] = [];
    for (let r = 0; r < rows; r++) {
      let plus = 0;
      let minus = 0;
      for (let c = 0; c < cols; c++) {
        if (solution[r * cols + c] === '+') plus++;
        if (solution[r * cols + c] === '-') minus++;
      }
      rowPlusCounts.push(Math.random() < 0.7 ? plus : null);
      rowMinusCounts.push(Math.random() < 0.7 ? minus : null);
    }

    const colPlusCounts: (number | null)[] = [];
    const colMinusCounts: (number | null)[] = [];
    for (let c = 0; c < cols; c++) {
      let plus = 0;
      let minus = 0;
      for (let r = 0; r < rows; r++) {
        if (solution[r * cols + c] === '+') plus++;
        if (solution[r * cols + c] === '-') minus++;
      }
      colPlusCounts.push(Math.random() < 0.7 ? plus : null);
      colMinusCounts.push(Math.random() < 0.7 ? minus : null);
    }

    return {
      rows,
      cols,
      dominoes,
      dominoCount: dominoId,
      cells: new Array(total).fill(null),
      rowPlusCounts,
      rowMinusCounts,
      colPlusCounts,
      colMinusCounts,
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: MagnetsState): boolean {
    const {
      rows,
      cols,
      cells,
      dominoes,
      rowPlusCounts,
      rowMinusCounts,
      colPlusCounts,
      colMinusCounts,
    } = data;

    for (let i = 0; i < rows * cols; i++) {
      if (cells[i] === null) return false;
    }

    for (let i = 0; i < rows * cols; i++) {
      if (cells[i] === '+' || cells[i] === '-') {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const neighbors = [
          row > 0 ? (row - 1) * cols + col : -1,
          row < rows - 1 ? (row + 1) * cols + col : -1,
          col > 0 ? row * cols + col - 1 : -1,
          col < cols - 1 ? row * cols + col + 1 : -1,
        ];
        for (const n of neighbors) {
          if (n >= 0 && n < rows * cols && dominoes[n] !== dominoes[i] && cells[n] === cells[i]) {
            return false;
          }
        }
      }
    }

    const dominoSeen = new Set<number>();
    for (let i = 0; i < rows * cols; i++) {
      if (dominoSeen.has(dominoes[i])) continue;
      dominoSeen.add(dominoes[i]);
      const pair: number[] = [];
      for (let j = i; j < rows * cols; j++) {
        if (dominoes[j] === dominoes[i]) pair.push(j);
      }
      if (pair.length === 2) {
        const a = cells[pair[0]];
        const b = cells[pair[1]];
        if ((a === '+' && b !== '-') || (a === '-' && b !== '+')) return false;
        if (a === 'empty' && b !== 'empty') return false;
      }
    }

    for (let r = 0; r < rows; r++) {
      if (rowPlusCounts[r] !== null) {
        let count = 0;
        for (let c = 0; c < cols; c++) {
          if (cells[r * cols + c] === '+') count++;
        }
        if (count !== rowPlusCounts[r]) return false;
      }
      if (rowMinusCounts[r] !== null) {
        let count = 0;
        for (let c = 0; c < cols; c++) {
          if (cells[r * cols + c] === '-') count++;
        }
        if (count !== rowMinusCounts[r]) return false;
      }
    }

    for (let c = 0; c < cols; c++) {
      if (colPlusCounts[c] !== null) {
        let count = 0;
        for (let r = 0; r < rows; r++) {
          if (cells[r * cols + c] === '+') count++;
        }
        if (count !== colPlusCounts[c]) return false;
      }
      if (colMinusCounts[c] !== null) {
        let count = 0;
        for (let r = 0; r < rows; r++) {
          if (cells[r * cols + c] === '-') count++;
        }
        if (count !== colMinusCounts[c]) return false;
      }
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MagnetsState>();

    switch (action.type) {
      case 'place': {
        const index = Number(action.payload.index);
        const value = action.payload.value as CellValue;
        if (index < 0 || index >= data.rows * data.cols) {
          return { success: false, error: 'Invalid cell index' };
        }
        if (value !== '+' && value !== '-' && value !== 'empty' && value !== null) {
          return { success: false, error: 'Value must be +, -, empty, or null' };
        }

        data.cells[index] = value;
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
    return this.getData<MagnetsState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MagnetsState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}
