/**
 * LoopyGame (Slitherlink): Draw a single loop on grid edges.
 * Numbers indicate how many of the cell's edges are used by the loop.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface LoopyConfig {
  width?: number;
  height?: number;
}

interface LoopyState {
  [key: string]: unknown;
  width: number;
  height: number;
  clues: (number | null)[];
  hEdges: (boolean | null)[];
  vEdges: (boolean | null)[];
  moves: number;
  solved: boolean;
}

export class LoopyGame extends BaseGame {
  readonly name = 'Loopy';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): LoopyState {
    const cfg = this.config as LoopyConfig;
    const width = Math.max(3, Math.min(cfg.width ?? 5, 10));
    const height = Math.max(3, Math.min(cfg.height ?? 5, 10));

    const hEdgeSolution = new Array((height + 1) * width).fill(false);
    const vEdgeSolution = new Array(height * (width + 1)).fill(false);

    const loopCells = new Set<number>();
    const startR = Math.floor(height / 2);
    const startC = Math.floor(width / 2);
    const path: [number, number][] = [[startR, startC]];
    loopCells.add(startR * width + startC);

    let attempts = 0;
    while (path.length < Math.floor(width * height * 0.4) && attempts < 500) {
      const [r, c] = path[path.length - 1];
      const dirs: [number, number][] = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ];
      for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
      }

      let moved = false;
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < height && nc >= 0 && nc < width && !loopCells.has(nr * width + nc)) {
          path.push([nr, nc]);
          loopCells.add(nr * width + nc);
          moved = true;
          break;
        }
      }
      if (!moved) break;
      attempts++;
    }

    for (let i = 0; i < path.length; i++) {
      const [r1, c1] = path[i];
      const [r2, c2] = path[(i + 1) % path.length];
      if (r1 === r2) {
        const minC = Math.min(c1, c2);
        vEdgeSolution[r1 * (width + 1) + minC + 1] = true;
      } else {
        const minR = Math.min(r1, r2);
        hEdgeSolution[(minR + 1) * width + c1] = true;
      }
    }

    const clues: (number | null)[] = new Array(width * height).fill(null);
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (Math.random() < 0.45) {
          let count = 0;
          if (hEdgeSolution[r * width + c]) count++;
          if (hEdgeSolution[(r + 1) * width + c]) count++;
          if (vEdgeSolution[r * (width + 1) + c]) count++;
          if (vEdgeSolution[r * (width + 1) + c + 1]) count++;
          clues[r * width + c] = count;
        }
      }
    }

    return {
      width,
      height,
      clues,
      hEdges: new Array((height + 1) * width).fill(null),
      vEdges: new Array(height * (width + 1)).fill(null),
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: LoopyState): boolean {
    const { width, height, clues, hEdges, vEdges } = data;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (clues[r * width + c] !== null) {
          let count = 0;
          if (hEdges[r * width + c] === true) count++;
          if (hEdges[(r + 1) * width + c] === true) count++;
          if (vEdges[r * (width + 1) + c] === true) count++;
          if (vEdges[r * (width + 1) + c + 1] === true) count++;
          if (count !== clues[r * width + c]) return false;
        }
      }
    }

    const vertexRows = height + 1;
    const vertexCols = width + 1;
    const totalVertices = vertexRows * vertexCols;

    const degree = new Array(totalVertices).fill(0);

    for (let r = 0; r <= height; r++) {
      for (let c = 0; c < width; c++) {
        if (hEdges[r * width + c] === true) {
          degree[r * vertexCols + c]++;
          degree[r * vertexCols + c + 1]++;
        }
      }
    }
    for (let r = 0; r < height; r++) {
      for (let c = 0; c <= width; c++) {
        if (vEdges[r * (width + 1) + c] === true) {
          degree[r * vertexCols + c]++;
          degree[(r + 1) * vertexCols + c]++;
        }
      }
    }

    let edgeCount = 0;
    for (let i = 0; i < totalVertices; i++) {
      if (degree[i] !== 0 && degree[i] !== 2) return false;
      edgeCount += degree[i];
    }

    if (edgeCount === 0) return false;
    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<LoopyState>();

    switch (action.type) {
      case 'toggle_h_edge': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= (data.height + 1) * data.width) {
          return { success: false, error: 'Invalid edge index' };
        }
        data.hEdges[index] = data.hEdges[index] === true ? null : true;
        data.moves++;

        if (this.checkSolved(data)) {
          data.solved = true;
          this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      case 'toggle_v_edge': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= data.height * (data.width + 1)) {
          return { success: false, error: 'Invalid edge index' };
        }
        data.vEdges[index] = data.vEdges[index] === true ? null : true;
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
    return this.getData<LoopyState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<LoopyState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 8);
    return { [playerId]: score };
  }
}
