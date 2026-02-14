/**
 * BridgesGame (Hashiwokakero): Connect islands with 1-2 bridges.
 * Each island number = total bridges.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface BridgesConfig {
  width?: number;
  height?: number;
}

interface Island {
  row: number;
  col: number;
  target: number;
}

interface Bridge {
  from: number;
  to: number;
  count: number;
}

interface BridgesState {
  [key: string]: unknown;
  width: number;
  height: number;
  islands: Island[];
  bridges: Bridge[];
  moves: number;
  solved: boolean;
}

export class BridgesGame extends BaseGame {
  readonly name = 'Bridges';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): BridgesState {
    const cfg = this.config as BridgesConfig;
    const width = Math.max(5, Math.min(cfg.width ?? 7, 15));
    const height = Math.max(5, Math.min(cfg.height ?? 7, 15));

    const islands: Island[] = [];
    const grid: (number | null)[][] = Array.from({ length: height }, () =>
      new Array(width).fill(null),
    );
    const islandCount = Math.floor(width * height * 0.12) + 3;

    let placed = 0;
    let attempts = 0;
    while (placed < islandCount && attempts < 500) {
      const row = Math.floor(Math.random() * height);
      const col = Math.floor(Math.random() * width);
      if (grid[row][col] !== null) {
        attempts++;
        continue;
      }

      let tooClose = false;
      for (const isl of islands) {
        if (Math.abs(isl.row - row) + Math.abs(isl.col - col) < 2) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) {
        attempts++;
        continue;
      }

      grid[row][col] = placed;
      islands.push({ row, col, target: 0 });
      placed++;
      attempts++;
    }

    const solutionBridges: Bridge[] = [];
    for (let i = 0; i < islands.length; i++) {
      for (let j = i + 1; j < islands.length; j++) {
        if (islands[i].row !== islands[j].row && islands[i].col !== islands[j].col) continue;

        let blocked = false;
        if (islands[i].row === islands[j].row) {
          const r = islands[i].row;
          const minC = Math.min(islands[i].col, islands[j].col);
          const maxC = Math.max(islands[i].col, islands[j].col);
          for (let c = minC + 1; c < maxC; c++) {
            if (grid[r][c] !== null) {
              blocked = true;
              break;
            }
          }
        } else {
          const c = islands[i].col;
          const minR = Math.min(islands[i].row, islands[j].row);
          const maxR = Math.max(islands[i].row, islands[j].row);
          for (let r = minR + 1; r < maxR; r++) {
            if (grid[r][c] !== null) {
              blocked = true;
              break;
            }
          }
        }

        if (!blocked && Math.random() < 0.5) {
          const count = Math.random() < 0.5 ? 1 : 2;
          solutionBridges.push({ from: i, to: j, count });
          islands[i].target += count;
          islands[j].target += count;
        }
      }
    }

    for (let i = islands.length - 1; i >= 0; i--) {
      if (islands[i].target === 0) {
        const removed = islands.splice(i, 1)[0];
        grid[removed.row][removed.col] = null;
        for (let b = solutionBridges.length - 1; b >= 0; b--) {
          if (solutionBridges[b].from === i || solutionBridges[b].to === i) {
            solutionBridges.splice(b, 1);
          }
        }
      }
    }

    return {
      width,
      height,
      islands,
      bridges: [],
      moves: 0,
      solved: false,
    };
  }

  private checkSolved(data: BridgesState): boolean {
    const bridgeCounts = new Array(data.islands.length).fill(0);
    for (const bridge of data.bridges) {
      bridgeCounts[bridge.from] += bridge.count;
      bridgeCounts[bridge.to] += bridge.count;
    }
    for (let i = 0; i < data.islands.length; i++) {
      if (bridgeCounts[i] !== data.islands[i].target) return false;
    }

    if (data.islands.length === 0) return true;
    const adj: Set<number>[] = Array.from({ length: data.islands.length }, () => new Set());
    for (const bridge of data.bridges) {
      adj[bridge.from].add(bridge.to);
      adj[bridge.to].add(bridge.from);
    }
    const visited = new Set<number>();
    const stack = [0];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (visited.has(n)) continue;
      visited.add(n);
      for (const neighbor of adj[n]) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }
    return visited.size === data.islands.length;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<BridgesState>();

    switch (action.type) {
      case 'bridge': {
        const from = Number(action.payload.from);
        const to = Number(action.payload.to);
        if (from < 0 || from >= data.islands.length || to < 0 || to >= data.islands.length) {
          return { success: false, error: 'Invalid island index' };
        }
        if (from === to) return { success: false, error: 'Cannot bridge island to itself' };

        const a = Math.min(from, to);
        const b = Math.max(from, to);

        const existing = data.bridges.find((br) => br.from === a && br.to === b);
        if (existing) {
          if (existing.count >= 2) {
            data.bridges = data.bridges.filter((br) => br.from !== a || br.to !== b);
          } else {
            existing.count++;
          }
        } else {
          data.bridges.push({ from: a, to: b, count: 1 });
        }

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
    return this.getData<BridgesState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<BridgesState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}
