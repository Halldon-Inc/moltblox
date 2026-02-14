import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface GoConfig {
  boardSize?: number;
  komi?: number;
}

interface GoState {
  [key: string]: unknown;
  board: (string | null)[][];
  currentPlayer: number;
  size: number;
  captures: number[];
  koPoint: [number, number] | null;
  previousBoard: string;
  passCount: number;
  komi: number;
}

export class GoGame extends BaseGame {
  readonly name = 'Go';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): GoState {
    const cfg = this.config as GoConfig;
    const size = cfg.boardSize ?? 9;
    const board: (string | null)[][] = [];
    for (let r = 0; r < size; r++) board.push(Array(size).fill(null));
    return {
      board,
      currentPlayer: 0,
      size,
      captures: [0, 0],
      koPoint: null,
      previousBoard: this.serializeBoard(board),
      passCount: 0,
      komi: cfg.komi ?? 6.5,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<GoState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    if (action.type === 'pass') {
      data.passCount++;
      data.koPoint = null;
      data.currentPlayer = (data.currentPlayer + 1) % 2;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'place') return { success: false, error: `Unknown action: ${action.type}` };

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);
    if (isNaN(row) || isNaN(col) || row < 0 || row >= data.size || col < 0 || col >= data.size) {
      return { success: false, error: 'Invalid position' };
    }
    if (data.board[row][col] !== null) return { success: false, error: 'Cell occupied' };

    // Ko rule
    if (data.koPoint && data.koPoint[0] === row && data.koPoint[1] === col) {
      return { success: false, error: 'Ko: cannot recapture immediately' };
    }

    // Place stone
    data.board[row][col] = playerId;

    // Capture opponent groups with no liberties
    const opponent = players[(data.currentPlayer + 1) % 2];
    let capturedStones: [number, number][] = [];
    for (const [nr, nc] of this.getNeighbors(row, col, data.size)) {
      if (data.board[nr][nc] === opponent) {
        const group = this.getGroup(data.board, nr, nc, data.size);
        if (this.getLiberties(data.board, group, data.size) === 0) {
          capturedStones = capturedStones.concat(group);
          for (const [gr, gc] of group) data.board[gr][gc] = null;
        }
      }
    }

    data.captures[data.currentPlayer] += capturedStones.length;

    // Self-capture check
    const ownGroup = this.getGroup(data.board, row, col, data.size);
    if (this.getLiberties(data.board, ownGroup, data.size) === 0) {
      data.board[row][col] = null;
      return { success: false, error: 'Suicide is not allowed' };
    }

    // Ko detection: if exactly one stone captured, set ko point
    if (capturedStones.length === 1) {
      data.koPoint = capturedStones[0];
    } else {
      data.koPoint = null;
    }

    data.passCount = 0;
    data.previousBoard = this.serializeBoard(data.board);
    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private getNeighbors(r: number, c: number, size: number): [number, number][] {
    const result: [number, number][] = [];
    if (r > 0) result.push([r - 1, c]);
    if (r < size - 1) result.push([r + 1, c]);
    if (c > 0) result.push([r, c - 1]);
    if (c < size - 1) result.push([r, c + 1]);
    return result;
  }

  private getGroup(
    board: (string | null)[][],
    r: number,
    c: number,
    size: number,
  ): [number, number][] {
    const color = board[r][c];
    if (color === null) return [];
    const visited = new Set<string>();
    const group: [number, number][] = [];
    const stack: [number, number][] = [[r, c]];
    while (stack.length > 0) {
      const [cr, cc] = stack.pop()!;
      const key = `${cr},${cc}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (board[cr][cc] !== color) continue;
      group.push([cr, cc]);
      for (const [nr, nc] of this.getNeighbors(cr, cc, size)) {
        if (!visited.has(`${nr},${nc}`)) stack.push([nr, nc]);
      }
    }
    return group;
  }

  private getLiberties(
    board: (string | null)[][],
    group: [number, number][],
    size: number,
  ): number {
    const liberties = new Set<string>();
    for (const [r, c] of group) {
      for (const [nr, nc] of this.getNeighbors(r, c, size)) {
        if (board[nr][nc] === null) liberties.add(`${nr},${nc}`);
      }
    }
    return liberties.size;
  }

  private serializeBoard(board: (string | null)[][]): string {
    return board.map((row) => row.map((c) => c ?? '.').join('')).join('|');
  }

  protected checkGameOver(): boolean {
    return this.getData<GoState>().passCount >= 2;
  }

  protected determineWinner(): string | null {
    const data = this.getData<GoState>();
    const scores = this.calculateScores();
    const players = this.getPlayers();
    if (scores[players[0]] > scores[players[1]]) return players[0];
    if (scores[players[1]] > scores[players[0]]) return players[1];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<GoState>();
    const players = this.getPlayers();
    const territory = this.countTerritory(data);
    return {
      [players[0]]: territory[0] + data.captures[0],
      [players[1]]: territory[1] + data.captures[1] + data.komi,
    };
  }

  private countTerritory(data: GoState): [number, number] {
    const players = this.getPlayers();
    const visited = new Set<string>();
    const territory: [number, number] = [0, 0];

    for (let r = 0; r < data.size; r++) {
      for (let c = 0; c < data.size; c++) {
        if (data.board[r][c] !== null || visited.has(`${r},${c}`)) continue;
        const region: [number, number][] = [];
        const borders = new Set<string>();
        const stack: [number, number][] = [[r, c]];
        while (stack.length > 0) {
          const [cr, cc] = stack.pop()!;
          const key = `${cr},${cc}`;
          if (visited.has(key)) continue;
          visited.add(key);
          if (data.board[cr][cc] !== null) {
            borders.add(data.board[cr][cc]!);
            continue;
          }
          region.push([cr, cc]);
          for (const [nr, nc] of this.getNeighbors(cr, cc, data.size)) {
            if (!visited.has(`${nr},${nc}`)) stack.push([nr, nc]);
          }
        }
        if (borders.size === 1) {
          const owner = [...borders][0];
          const idx = owner === players[0] ? 0 : 1;
          territory[idx] += region.length;
        }
      }
    }
    return territory;
  }
}
