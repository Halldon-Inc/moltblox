import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface HexConfig {
  boardSize?: number;
}

interface HexState {
  [key: string]: unknown;
  board: (string | null)[][];
  currentPlayer: number;
  size: number;
  winner: string | null;
}

export class HexGame extends BaseGame {
  readonly name = 'Hex';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): HexState {
    const size = (this.config as HexConfig).boardSize ?? 11;
    const board: (string | null)[][] = [];
    for (let r = 0; r < size; r++) board.push(Array(size).fill(null));
    return { board, currentPlayer: 0, size, winner: null };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<HexState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'place') return { success: false, error: `Unknown action: ${action.type}` };

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);
    if (isNaN(row) || isNaN(col) || row < 0 || row >= data.size || col < 0 || col >= data.size) {
      return { success: false, error: 'Invalid position' };
    }
    if (data.board[row][col] !== null) return { success: false, error: 'Cell occupied' };

    data.board[row][col] = playerId;

    // Player 0 connects top to bottom, Player 1 connects left to right
    if (this.checkConnection(data, playerId, data.currentPlayer)) {
      data.winner = playerId;
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private checkConnection(data: HexState, player: string, playerIdx: number): boolean {
    const visited = new Set<string>();
    const queue: [number, number][] = [];

    // Player 0: top row start, bottom row target
    // Player 1: left col start, right col target
    for (let i = 0; i < data.size; i++) {
      if (playerIdx === 0 && data.board[0][i] === player) {
        queue.push([0, i]);
        visited.add(`0,${i}`);
      } else if (playerIdx === 1 && data.board[i][0] === player) {
        queue.push([i, 0]);
        visited.add(`${i},0`);
      }
    }

    const neighbors = [
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
    ];
    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      if (playerIdx === 0 && r === data.size - 1) return true;
      if (playerIdx === 1 && c === data.size - 1) return true;

      for (const [dr, dc] of neighbors) {
        const nr = r + dr,
          nc = c + dc;
        const key = `${nr},${nc}`;
        if (
          nr >= 0 &&
          nr < data.size &&
          nc >= 0 &&
          nc < data.size &&
          !visited.has(key) &&
          data.board[nr][nc] === player
        ) {
          visited.add(key);
          queue.push([nr, nc]);
        }
      }
    }
    return false;
  }

  protected checkGameOver(): boolean {
    return this.getData<HexState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<HexState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
