/**
 * TrainTracksGame: Draw track from A to B, match row/col piece counts
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface TrainTracksConfig {
  size?: number;
}

interface TrainTracksState {
  [key: string]: unknown;
  size: number;
  startCell: number;
  endCell: number;
  track: boolean[];
  fixed: boolean[];
  rowCounts: number[];
  colCounts: number[];
  moves: number;
  solved: boolean;
}

export class TrainTracksGame extends BaseGame {
  readonly name = 'Train Tracks';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): TrainTracksState {
    const cfg = this.config as TrainTracksConfig;
    const size = Math.max(4, Math.min(cfg.size ?? 6, 10));
    const total = size * size;

    const edgeCells: number[] = [];
    for (let i = 0; i < size; i++) {
      edgeCells.push(i);
      edgeCells.push((size - 1) * size + i);
      if (i > 0 && i < size - 1) {
        edgeCells.push(i * size);
        edgeCells.push(i * size + size - 1);
      }
    }

    const startCell = edgeCells[Math.floor(Math.random() * edgeCells.length)];
    let endCell: number;
    do {
      endCell = edgeCells[Math.floor(Math.random() * edgeCells.length)];
    } while (endCell === startCell);

    const solutionTrack = new Array(total).fill(false);
    const visited = new Set<number>();
    const path = [startCell];
    visited.add(startCell);
    solutionTrack[startCell] = true;

    let current = startCell;
    let found = false;
    let attempts = 0;

    while (!found && attempts < 1000) {
      const row = Math.floor(current / size);
      const col = current % size;
      const dirs: number[] = [];
      if (row > 0 && !visited.has((row - 1) * size + col)) dirs.push((row - 1) * size + col);
      if (row < size - 1 && !visited.has((row + 1) * size + col)) dirs.push((row + 1) * size + col);
      if (col > 0 && !visited.has(row * size + col - 1)) dirs.push(row * size + col - 1);
      if (col < size - 1 && !visited.has(row * size + col + 1)) dirs.push(row * size + col + 1);

      if (dirs.includes(endCell)) {
        solutionTrack[endCell] = true;
        found = true;
        break;
      }

      if (dirs.length === 0) {
        if (path.length > 1) {
          path.pop();
          current = path[path.length - 1];
        }
        attempts++;
        continue;
      }

      const next = dirs[Math.floor(Math.random() * dirs.length)];
      path.push(next);
      visited.add(next);
      solutionTrack[next] = true;
      current = next;
      attempts++;
    }

    const rowCounts: number[] = [];
    for (let r = 0; r < size; r++) {
      let count = 0;
      for (let c = 0; c < size; c++) {
        if (solutionTrack[r * size + c]) count++;
      }
      rowCounts.push(count);
    }

    const colCounts: number[] = [];
    for (let c = 0; c < size; c++) {
      let count = 0;
      for (let r = 0; r < size; r++) {
        if (solutionTrack[r * size + c]) count++;
      }
      colCounts.push(count);
    }

    const track = new Array(total).fill(false);
    const fixed = new Array(total).fill(false);
    track[startCell] = true;
    fixed[startCell] = true;
    track[endCell] = true;
    fixed[endCell] = true;

    const fixedCount = Math.floor(total * 0.1);
    const trackCells = solutionTrack
      .map((v, i) => (v ? i : -1))
      .filter((i) => i >= 0 && i !== startCell && i !== endCell);
    for (let i = trackCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [trackCells[i], trackCells[j]] = [trackCells[j], trackCells[i]];
    }
    for (let i = 0; i < fixedCount && i < trackCells.length; i++) {
      track[trackCells[i]] = true;
      fixed[trackCells[i]] = true;
    }

    return {
      size,
      startCell,
      endCell,
      track,
      fixed,
      rowCounts,
      colCounts,
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: TrainTracksState): boolean {
    const { size, startCell, endCell, track, rowCounts, colCounts } = data;

    for (let r = 0; r < size; r++) {
      let count = 0;
      for (let c = 0; c < size; c++) {
        if (track[r * size + c]) count++;
      }
      if (count !== rowCounts[r]) return false;
    }
    for (let c = 0; c < size; c++) {
      let count = 0;
      for (let r = 0; r < size; r++) {
        if (track[r * size + c]) count++;
      }
      if (count !== colCounts[c]) return false;
    }

    for (let i = 0; i < size * size; i++) {
      if (!track[i]) continue;
      const row = Math.floor(i / size);
      const col = i % size;
      let adj = 0;
      if (row > 0 && track[(row - 1) * size + col]) adj++;
      if (row < size - 1 && track[(row + 1) * size + col]) adj++;
      if (col > 0 && track[row * size + col - 1]) adj++;
      if (col < size - 1 && track[row * size + col + 1]) adj++;

      if (i === startCell || i === endCell) {
        if (adj !== 1) return false;
      } else {
        if (adj !== 2) return false;
      }
    }

    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TrainTracksState>();

    switch (action.type) {
      case 'toggle': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= data.size * data.size) {
          return { success: false, error: 'Invalid cell index' };
        }
        if (data.fixed[index]) {
          return { success: false, error: 'Cannot modify fixed cell' };
        }

        data.track[index] = !data.track[index];
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
    return this.getData<TrainTracksState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<TrainTracksState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 8);
    return { [playerId]: score };
  }
}
