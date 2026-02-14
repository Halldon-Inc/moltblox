/**
 * TentsGame: Place tents adjacent to trees, match row/col counts, no adjacent tents
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface TentsConfig {
  size?: number;
}

interface TentsState {
  [key: string]: unknown;
  size: number;
  trees: boolean[];
  tents: boolean[];
  rowCounts: number[];
  colCounts: number[];
  moves: number;
  solved: boolean;
}

export class TentsGame extends BaseGame {
  readonly name = 'Tents';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): TentsState {
    const cfg = this.config as TentsConfig;
    const size = Math.max(5, Math.min(cfg.size ?? 8, 12));
    const total = size * size;

    const trees = new Array(total).fill(false);
    const solutionTents = new Array(total).fill(false);
    const numTrees = Math.floor(total * 0.2);

    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    let placed = 0;
    for (const treeIdx of indices) {
      if (placed >= numTrees) break;
      const row = Math.floor(treeIdx / size);
      const col = treeIdx % size;
      if (trees[treeIdx]) continue;

      const adj: number[] = [];
      if (row > 0) adj.push((row - 1) * size + col);
      if (row < size - 1) adj.push((row + 1) * size + col);
      if (col > 0) adj.push(row * size + col - 1);
      if (col < size - 1) adj.push(row * size + col + 1);

      for (const tentIdx of adj) {
        if (trees[tentIdx] || solutionTents[tentIdx]) continue;
        const tr = Math.floor(tentIdx / size);
        const tc = tentIdx % size;

        let tooClose = false;
        for (let dr = -1; dr <= 1 && !tooClose; dr++) {
          for (let dc = -1; dc <= 1 && !tooClose; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = tr + dr;
            const nc = tc + dc;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
              if (solutionTents[nr * size + nc]) tooClose = true;
            }
          }
        }

        if (!tooClose) {
          trees[treeIdx] = true;
          solutionTents[tentIdx] = true;
          placed++;
          break;
        }
      }
    }

    const rowCounts: number[] = [];
    for (let r = 0; r < size; r++) {
      let count = 0;
      for (let c = 0; c < size; c++) {
        if (solutionTents[r * size + c]) count++;
      }
      rowCounts.push(count);
    }

    const colCounts: number[] = [];
    for (let c = 0; c < size; c++) {
      let count = 0;
      for (let r = 0; r < size; r++) {
        if (solutionTents[r * size + c]) count++;
      }
      colCounts.push(count);
    }

    return {
      size,
      trees,
      tents: new Array(total).fill(false),
      rowCounts,
      colCounts,
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: TentsState): boolean {
    const { size, trees, tents, rowCounts, colCounts } = data;

    for (let r = 0; r < size; r++) {
      let count = 0;
      for (let c = 0; c < size; c++) {
        if (tents[r * size + c]) count++;
      }
      if (count !== rowCounts[r]) return false;
    }
    for (let c = 0; c < size; c++) {
      let count = 0;
      for (let r = 0; r < size; r++) {
        if (tents[r * size + c]) count++;
      }
      if (count !== colCounts[c]) return false;
    }

    for (let i = 0; i < size * size; i++) {
      if (!tents[i]) continue;
      if (trees[i]) return false;

      const row = Math.floor(i / size);
      const col = i % size;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
            if (tents[nr * size + nc]) return false;
          }
        }
      }

      let adjTree = false;
      if (row > 0 && trees[(row - 1) * size + col]) adjTree = true;
      if (row < size - 1 && trees[(row + 1) * size + col]) adjTree = true;
      if (col > 0 && trees[row * size + col - 1]) adjTree = true;
      if (col < size - 1 && trees[row * size + col + 1]) adjTree = true;
      if (!adjTree) return false;
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TentsState>();

    switch (action.type) {
      case 'toggle': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= data.size * data.size) {
          return { success: false, error: 'Invalid cell index' };
        }
        if (data.trees[index]) {
          return { success: false, error: 'Cannot place tent on tree' };
        }

        data.tents[index] = !data.tents[index];
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
    return this.getData<TentsState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<TentsState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}
