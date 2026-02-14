/**
 * PearlGame (Masyu): Draw loop through circles.
 * Black = turn on circle, straight through neighbors.
 * White = straight on circle, turn on at least one neighbor.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface PearlConfig {
  size?: number;
}

type CircleType = 'black' | 'white' | null;

interface PearlState {
  [key: string]: unknown;
  size: number;
  circles: CircleType[];
  hEdges: boolean[];
  vEdges: boolean[];
  moves: number;
  solved: boolean;
}

export class PearlGame extends BaseGame {
  readonly name = 'Pearl';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): PearlState {
    const cfg = this.config as PearlConfig;
    const size = Math.max(5, Math.min(cfg.size ?? 7, 12));
    const total = size * size;

    const circles: CircleType[] = new Array(total).fill(null);
    const numCircles = Math.floor(total * 0.25);

    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (let i = 0; i < numCircles; i++) {
      circles[indices[i]] = Math.random() < 0.5 ? 'black' : 'white';
    }

    return {
      size,
      circles,
      hEdges: new Array(size * (size - 1)).fill(false),
      vEdges: new Array((size - 1) * size).fill(false),
      moves: 0,
      solved: false,
    };
  }

  private getEdges(
    data: PearlState,
    row: number,
    col: number,
  ): { up: boolean; down: boolean; left: boolean; right: boolean } {
    const { size, hEdges, vEdges } = data;
    return {
      up: row > 0 && vEdges[(row - 1) * size + col],
      down: row < size - 1 && vEdges[row * size + col],
      left: col > 0 && hEdges[row * (size - 1) + col - 1],
      right: col < size - 1 && hEdges[row * (size - 1) + col],
    };
  }

  private checkSolved(data: PearlState): boolean {
    const { size, circles } = data;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const edges = this.getEdges(data, r, c);
        const count = [edges.up, edges.down, edges.left, edges.right].filter(Boolean).length;

        if (count !== 0 && count !== 2) return false;

        const circle = circles[r * size + c];
        if (circle && count !== 2) return false;

        if (count === 2 && circle === 'black') {
          const isStraight = (edges.up && edges.down) || (edges.left && edges.right);
          if (isStraight) return false;
        }

        if (count === 2 && circle === 'white') {
          const isStraight = (edges.up && edges.down) || (edges.left && edges.right);
          if (!isStraight) return false;
        }
      }
    }

    let startR = -1;
    let startC = -1;
    let edgeTotal = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const edges = this.getEdges(data, r, c);
        const count = [edges.up, edges.down, edges.left, edges.right].filter(Boolean).length;
        if (count > 0) {
          if (startR === -1) {
            startR = r;
            startC = c;
          }
          edgeTotal += count;
        }
      }
    }

    if (startR === -1) return false;

    const visited = new Set<string>();
    const stack: [number, number][] = [[startR, startC]];
    let reachable = 0;

    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      visited.add(key);
      reachable++;

      const edges = this.getEdges(data, r, c);
      if (edges.up && !visited.has(`${r - 1},${c}`)) stack.push([r - 1, c]);
      if (edges.down && !visited.has(`${r + 1},${c}`)) stack.push([r + 1, c]);
      if (edges.left && !visited.has(`${r},${c - 1}`)) stack.push([r, c - 1]);
      if (edges.right && !visited.has(`${r},${c + 1}`)) stack.push([r, c + 1]);
    }

    const totalWithEdges = edgeTotal / 2;
    return reachable > 2 && reachable === visited.size;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PearlState>();

    switch (action.type) {
      case 'toggle_h': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= data.size * (data.size - 1)) {
          return { success: false, error: 'Invalid edge index' };
        }
        data.hEdges[index] = !data.hEdges[index];
        data.moves++;

        if (this.checkSolved(data)) {
          data.solved = true;
          this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      case 'toggle_v': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= (data.size - 1) * data.size) {
          return { success: false, error: 'Invalid edge index' };
        }
        data.vEdges[index] = !data.vEdges[index];
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
    return this.getData<PearlState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<PearlState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 8);
    return { [playerId]: score };
  }
}
