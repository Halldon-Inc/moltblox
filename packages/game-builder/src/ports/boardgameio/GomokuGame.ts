import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface GomokuConfig {
  boardSize?: number;
  winLength?: number;
}

/**
 * Gomoku: Five-in-a-row on a 15x15 board. Two players alternate placing
 * stones. First to get 5 (or winLength) consecutive stones in a row,
 * column, or diagonal wins.
 */

interface GomokuState {
  [key: string]: unknown;
  board: (string | null)[][];
  currentPlayer: number;
  winner: string | null;
  size: number;
  winLength: number;
  moveCount: number;
}

export class GomokuGame extends BaseGame {
  readonly name = 'Gomoku';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  override initialize(playerIds: string[]): void {
    while (playerIds.length < 2) {
      playerIds.push(`bot-${playerIds.length}`);
    }
    super.initialize(playerIds);
  }

  protected initializeState(_playerIds: string[]): GomokuState {
    const cfg = this.config as GomokuConfig;
    const size = cfg.boardSize ?? 15;
    const board: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
    return {
      board,
      currentPlayer: 0,
      winner: null,
      size,
      winLength: cfg.winLength ?? 5,
      moveCount: 0,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<GomokuState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }
    if (action.type !== 'place') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);
    if (isNaN(row) || isNaN(col) || row < 0 || row >= data.size || col < 0 || col >= data.size) {
      return { success: false, error: 'Invalid position' };
    }
    if (data.board[row][col] !== null) {
      return { success: false, error: 'Position already occupied' };
    }

    data.board[row][col] = playerId;
    data.moveCount++;

    if (this.checkWinAt(data, row, col, playerId)) {
      data.winner = playerId;
      this.emitEvent('win', playerId, { row, col });
    }

    data.currentPlayer = 1 - data.currentPlayer;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private checkWinAt(data: GomokuState, row: number, col: number, player: string): boolean {
    const dirs: [number, number][] = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (let d = 1; d < data.winLength; d++) {
        const r = row + dr * d;
        const c = col + dc * d;
        if (r >= 0 && r < data.size && c >= 0 && c < data.size && data.board[r][c] === player)
          count++;
        else break;
      }
      for (let d = 1; d < data.winLength; d++) {
        const r = row - dr * d;
        const c = col - dc * d;
        if (r >= 0 && r < data.size && c >= 0 && c < data.size && data.board[r][c] === player)
          count++;
        else break;
      }
      if (count >= data.winLength) return true;
    }
    return false;
  }

  protected checkGameOver(): boolean {
    const data = this.getData<GomokuState>();
    if (data.winner) return true;
    return data.moveCount >= data.size * data.size;
  }

  protected determineWinner(): string | null {
    return this.getData<GomokuState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
