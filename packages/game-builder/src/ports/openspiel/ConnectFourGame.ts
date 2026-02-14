import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface ConnectFourConfig {
  rows?: number;
  cols?: number;
  connectN?: number;
}

interface ConnectFourState {
  [key: string]: unknown;
  board: (string | null)[][];
  currentPlayer: number;
  winner: string | null;
  rows: number;
  cols: number;
  connectN: number;
}

export class ConnectFourGame extends BaseGame {
  readonly name = 'Connect Four';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): ConnectFourState {
    const cfg = this.config as ConnectFourConfig;
    const rows = cfg.rows ?? 6;
    const cols = cfg.cols ?? 7;
    const board: (string | null)[][] = [];
    for (let r = 0; r < rows; r++) {
      board.push(Array(cols).fill(null));
    }
    return {
      board,
      currentPlayer: 0,
      winner: null,
      rows,
      cols,
      connectN: cfg.connectN ?? 4,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ConnectFourState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }
    if (action.type !== 'drop') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const col = Number(action.payload.column ?? action.payload.col);
    if (isNaN(col) || col < 0 || col >= data.cols) {
      return { success: false, error: 'Invalid column' };
    }

    // Find lowest empty row
    let row = -1;
    for (let r = data.rows - 1; r >= 0; r--) {
      if (data.board[r][col] === null) {
        row = r;
        break;
      }
    }
    if (row === -1) {
      return { success: false, error: 'Column is full' };
    }

    data.board[row][col] = playerId;

    if (this.checkConnect(data, row, col, playerId)) {
      data.winner = playerId;
      this.emitEvent('win', playerId, { row, col });
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private checkConnect(data: ConnectFourState, row: number, col: number, player: string): boolean {
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (let d = 1; d < data.connectN; d++) {
        const r = row + dr * d,
          c = col + dc * d;
        if (r >= 0 && r < data.rows && c >= 0 && c < data.cols && data.board[r][c] === player)
          count++;
        else break;
      }
      for (let d = 1; d < data.connectN; d++) {
        const r = row - dr * d,
          c = col - dc * d;
        if (r >= 0 && r < data.rows && c >= 0 && c < data.cols && data.board[r][c] === player)
          count++;
        else break;
      }
      if (count >= data.connectN) return true;
    }
    return false;
  }

  protected checkGameOver(): boolean {
    const data = this.getData<ConnectFourState>();
    if (data.winner) return true;
    return data.board[0].every((cell) => cell !== null);
  }

  protected determineWinner(): string | null {
    return this.getData<ConnectFourState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
