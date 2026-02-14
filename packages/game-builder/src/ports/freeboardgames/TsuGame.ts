import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

/**
 * Tsu: Abstract territory control on a hex grid.
 * Players place stones to claim territory. When a group is surrounded, it is captured.
 * Similar to Go but on a hex grid with 6 neighbors per cell.
 */

const HEX_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

interface TsuState {
  [key: string]: unknown;
  board: (number | null)[][]; // null=empty, 0=p1, 1=p2
  boardSize: number;
  currentPlayer: number;
  passes: number;
  captured: [number, number]; // captured counts per player
  winner: string | null;
  gameEnded: boolean;
}

export class TsuGame extends BaseGame {
  readonly name = 'Tsu';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): TsuState {
    const size = 9;
    const board = Array.from({ length: size }, () => Array(size).fill(null));
    return {
      board,
      boardSize: size,
      currentPlayer: 0,
      passes: 0,
      captured: [0, 0],
      winner: null,
      gameEnded: false,
    };
  }

  private neighbors(r: number, c: number, size: number): [number, number][] {
    return HEX_DIRS.map(([dr, dc]) => [r + dr, c + dc] as [number, number]).filter(
      ([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size,
    );
  }

  private getGroup(
    board: (number | null)[][],
    r: number,
    c: number,
    size: number,
  ): {
    cells: [number, number][];
    liberties: number;
  } {
    const color = board[r][c];
    if (color === null) return { cells: [], liberties: 0 };

    const visited = new Set<string>();
    const queue: [number, number][] = [[r, c]];
    visited.add(`${r},${c}`);
    const cells: [number, number][] = [];
    let liberties = 0;
    const libertySet = new Set<string>();

    while (queue.length > 0) {
      const [cr, cc] = queue.shift()!;
      cells.push([cr, cc]);
      for (const [nr, nc] of this.neighbors(cr, cc, size)) {
        const key = `${nr},${nc}`;
        if (visited.has(key)) continue;
        if (board[nr][nc] === color) {
          visited.add(key);
          queue.push([nr, nc]);
        } else if (board[nr][nc] === null && !libertySet.has(key)) {
          libertySet.add(key);
          liberties++;
        }
      }
    }

    return { cells, liberties };
  }

  private captureDeadGroups(board: (number | null)[][], color: number, size: number): number {
    let captured = 0;
    const checked = new Set<string>();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] === color && !checked.has(`${r},${c}`)) {
          const group = this.getGroup(board, r, c, size);
          for (const [gr, gc] of group.cells) checked.add(`${gr},${gc}`);
          if (group.liberties === 0) {
            for (const [gr, gc] of group.cells) {
              board[gr][gc] = null;
              captured++;
            }
          }
        }
      }
    }
    return captured;
  }

  private countTerritory(board: (number | null)[][], size: number): [number, number] {
    const visited = new Set<string>();
    const territory: [number, number] = [0, 0];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== null || visited.has(`${r},${c}`)) continue;

        const queue: [number, number][] = [[r, c]];
        const cells: [number, number][] = [];
        visited.add(`${r},${c}`);
        const adjacentColors = new Set<number>();

        while (queue.length > 0) {
          const [cr, cc] = queue.shift()!;
          cells.push([cr, cc]);
          for (const [nr, nc] of this.neighbors(cr, cc, size)) {
            const key = `${nr},${nc}`;
            if (visited.has(key)) continue;
            if (board[nr][nc] === null) {
              visited.add(key);
              queue.push([nr, nc]);
            } else {
              adjacentColors.add(board[nr][nc]!);
            }
          }
        }

        if (adjacentColors.size === 1) {
          const owner = adjacentColors.values().next().value!;
          territory[owner] += cells.length;
        }
      }
    }

    return territory;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TsuState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) return { success: false, error: 'Not your turn' };

    if (action.type === 'pass') {
      data.passes++;
      if (data.passes >= 2) {
        // Game over: count territory
        const territory = this.countTerritory(data.board, data.boardSize);
        const s0 = territory[0] + data.captured[1]; // p1 territory + p1's captures of p2
        const s1 = territory[1] + data.captured[0];
        data.gameEnded = true;
        if (s0 > s1) data.winner = players[0];
        else if (s1 > s0) data.winner = players[1];
        else data.winner = null;
      }
      data.currentPlayer = 1 - pIdx;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'place') return { success: false, error: 'Must place or pass' };

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);

    if (row < 0 || row >= data.boardSize || col < 0 || col >= data.boardSize) {
      return { success: false, error: 'Out of bounds' };
    }
    if (data.board[row][col] !== null) return { success: false, error: 'Cell occupied' };

    data.board[row][col] = pIdx;
    data.passes = 0;

    // Capture opponent dead groups first
    const oppCaptured = this.captureDeadGroups(data.board, 1 - pIdx, data.boardSize);
    data.captured[pIdx] += oppCaptured;

    // Check self-capture (suicide rule)
    const selfGroup = this.getGroup(data.board, row, col, data.boardSize);
    if (selfGroup.liberties === 0) {
      // Suicide: not allowed
      data.board[row][col] = null;
      return { success: false, error: 'Suicide move not allowed' };
    }

    data.currentPlayer = 1 - pIdx;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<TsuState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<TsuState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<TsuState>();
    const players = this.getPlayers();
    const territory = this.countTerritory(data.board, data.boardSize);
    return {
      [players[0]]: territory[0] + data.captured[0],
      [players[1]]: territory[1] + data.captured[1],
    };
  }
}
