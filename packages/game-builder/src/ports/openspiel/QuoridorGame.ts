import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface QuoridorConfig {
  boardSize?: number;
  wallsPerPlayer?: number;
}

interface QuoridorState {
  [key: string]: unknown;
  positions: [number, number][];
  walls: { row: number; col: number; orientation: 'h' | 'v' }[];
  wallsRemaining: number[];
  currentPlayer: number;
  size: number;
  winner: string | null;
}

export class QuoridorGame extends BaseGame {
  readonly name = 'Quoridor';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): QuoridorState {
    const cfg = this.config as QuoridorConfig;
    const size = cfg.boardSize ?? 9;
    const walls = cfg.wallsPerPlayer ?? 10;
    const mid = Math.floor(size / 2);
    return {
      positions: [
        [size - 1, mid],
        [0, mid],
      ],
      walls: [],
      wallsRemaining: [walls, walls],
      currentPlayer: 0,
      size,
      winner: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<QuoridorState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    if (action.type === 'move') {
      const row = Number(action.payload.row);
      const col = Number(action.payload.col);
      if (isNaN(row) || isNaN(col)) return { success: false, error: 'Invalid position' };

      const [curR, curC] = data.positions[data.currentPlayer];
      const dr = Math.abs(row - curR);
      const dc = Math.abs(col - curC);

      if (row < 0 || row >= data.size || col < 0 || col >= data.size) {
        return { success: false, error: 'Out of bounds' };
      }

      // Normal move: one step orthogonally
      if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
        if (this.isBlocked(data, curR, curC, row, col)) {
          return { success: false, error: 'Blocked by wall' };
        }
        // Check if opponent is there
        const oppIdx = (data.currentPlayer + 1) % 2;
        const [oppR, oppC] = data.positions[oppIdx];
        if (row === oppR && col === oppC) {
          return { success: false, error: 'Opponent occupies that cell' };
        }
      } else if (dr + dc === 2) {
        // Jump over opponent
        const oppIdx = (data.currentPlayer + 1) % 2;
        const [oppR, oppC] = data.positions[oppIdx];
        if (dr === 2 && dc === 0) {
          const midR = (curR + row) / 2;
          if (midR !== oppR || curC !== oppC)
            return { success: false, error: 'No opponent to jump over' };
          if (
            this.isBlocked(data, curR, curC, midR, curC) ||
            this.isBlocked(data, midR, curC, row, col)
          ) {
            return { success: false, error: 'Blocked by wall' };
          }
        } else if (dr === 0 && dc === 2) {
          const midC = (curC + col) / 2;
          if (curR !== oppR || midC !== oppC)
            return { success: false, error: 'No opponent to jump over' };
          if (
            this.isBlocked(data, curR, curC, curR, midC) ||
            this.isBlocked(data, curR, midC, row, col)
          ) {
            return { success: false, error: 'Blocked by wall' };
          }
        } else if (dr === 1 && dc === 1) {
          // Diagonal jump (when straight jump is blocked)
          const oppIdx2 = (data.currentPlayer + 1) % 2;
          const [oR, oC] = data.positions[oppIdx2];
          const straightR = curR + (row - curR > 0 ? 1 : row - curR < 0 ? -1 : 0) * 2;
          const straightC = curC + (col - curC > 0 ? 1 : col - curC < 0 ? -1 : 0) * 2;
          // Must be adjacent to opponent
          const adjR = Math.abs(curR - oR) === 1 && curC === oC;
          const adjC = Math.abs(curC - oC) === 1 && curR === oR;
          if (!adjR && !adjC) return { success: false, error: 'Invalid jump' };
        } else {
          return { success: false, error: 'Invalid move distance' };
        }
      } else {
        return { success: false, error: 'Invalid move distance' };
      }

      data.positions[data.currentPlayer] = [row, col];

      // Check win
      if (data.currentPlayer === 0 && row === 0) data.winner = playerId;
      if (data.currentPlayer === 1 && row === data.size - 1) data.winner = playerId;
    } else if (action.type === 'wall') {
      if (data.wallsRemaining[data.currentPlayer] <= 0) {
        return { success: false, error: 'No walls remaining' };
      }

      const row = Number(action.payload.row);
      const col = Number(action.payload.col);
      const orientation = String(action.payload.orientation) as 'h' | 'v';

      if (orientation !== 'h' && orientation !== 'v')
        return { success: false, error: 'Invalid orientation' };
      if (
        isNaN(row) ||
        isNaN(col) ||
        row < 0 ||
        row >= data.size - 1 ||
        col < 0 ||
        col >= data.size - 1
      ) {
        return { success: false, error: 'Invalid wall position' };
      }

      // Check overlap
      for (const w of data.walls) {
        if (w.row === row && w.col === col) return { success: false, error: 'Wall overlaps' };
        if (w.orientation === orientation) {
          if (orientation === 'h' && w.row === row && Math.abs(w.col - col) === 1)
            return { success: false, error: 'Wall overlaps' };
          if (orientation === 'v' && w.col === col && Math.abs(w.row - row) === 1)
            return { success: false, error: 'Wall overlaps' };
        }
      }

      // Place wall temporarily and check path exists
      data.walls.push({ row, col, orientation });
      if (!this.hasPath(data, 0) || !this.hasPath(data, 1)) {
        data.walls.pop();
        return { success: false, error: 'Wall would block all paths' };
      }

      data.wallsRemaining[data.currentPlayer]--;
    } else {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private isBlocked(
    data: QuoridorState,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
  ): boolean {
    for (const w of data.walls) {
      if (w.orientation === 'h') {
        // Horizontal wall blocks vertical movement between rows w.row and w.row+1
        if (fromC === toC && toC >= w.col && toC <= w.col + 1) {
          if ((fromR === w.row && toR === w.row + 1) || (fromR === w.row + 1 && toR === w.row))
            return true;
        }
      } else {
        // Vertical wall blocks horizontal movement between cols w.col and w.col+1
        if (fromR === toR && toR >= w.row && toR <= w.row + 1) {
          if ((fromC === w.col && toC === w.col + 1) || (fromC === w.col + 1 && toC === w.col))
            return true;
        }
      }
    }
    return false;
  }

  private hasPath(data: QuoridorState, playerIdx: number): boolean {
    const [startR, startC] = data.positions[playerIdx];
    const targetRow = playerIdx === 0 ? 0 : data.size - 1;
    const visited = new Set<string>();
    const queue: [number, number][] = [[startR, startC]];
    visited.add(`${startR},${startC}`);

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      if (r === targetRow) return true;
      for (const [nr, nc] of [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ]) {
        if (nr >= 0 && nr < data.size && nc >= 0 && nc < data.size && !visited.has(`${nr},${nc}`)) {
          if (!this.isBlocked(data, r, c, nr, nc)) {
            visited.add(`${nr},${nc}`);
            queue.push([nr, nc]);
          }
        }
      }
    }
    return false;
  }

  protected checkGameOver(): boolean {
    return this.getData<QuoridorState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<QuoridorState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
