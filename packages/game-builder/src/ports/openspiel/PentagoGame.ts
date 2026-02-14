import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface PentagoState {
  [key: string]: unknown;
  board: (string | null)[][];
  currentPlayer: number;
  winner: string | null;
}

export class PentagoGame extends BaseGame {
  readonly name = 'Pentago';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): PentagoState {
    const board: (string | null)[][] = [];
    for (let r = 0; r < 6; r++) board.push(Array(6).fill(null));
    return { board, currentPlayer: 0, winner: null };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PentagoState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'place_and_rotate')
      return { success: false, error: `Unknown action: ${action.type}` };

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);
    const quadrant = Number(action.payload.quadrant); // 0-3 (TL, TR, BL, BR)
    const direction = String(action.payload.direction); // 'cw' or 'ccw'

    if (isNaN(row) || isNaN(col) || row < 0 || row >= 6 || col < 0 || col >= 6) {
      return { success: false, error: 'Invalid position' };
    }
    if (data.board[row][col] !== null) return { success: false, error: 'Cell occupied' };
    if (isNaN(quadrant) || quadrant < 0 || quadrant > 3)
      return { success: false, error: 'Invalid quadrant (0-3)' };
    if (direction !== 'cw' && direction !== 'ccw')
      return { success: false, error: 'Direction must be cw or ccw' };

    data.board[row][col] = playerId;
    this.rotateQuadrant(data.board, quadrant, direction === 'cw');

    // Check win for both players
    for (const p of players) {
      if (this.hasFiveInRow(data.board, p)) {
        data.winner = p;
      }
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private rotateQuadrant(board: (string | null)[][], quadrant: number, clockwise: boolean): void {
    const startR = quadrant < 2 ? 0 : 3;
    const startC = quadrant % 2 === 0 ? 0 : 3;

    const sub: (string | null)[][] = [];
    for (let r = 0; r < 3; r++) {
      sub.push([]);
      for (let c = 0; c < 3; c++) {
        sub[r].push(board[startR + r][startC + c]);
      }
    }

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (clockwise) {
          board[startR + c][startC + 2 - r] = sub[r][c];
        } else {
          board[startR + 2 - c][startC + r] = sub[r][c];
        }
      }
    }
  }

  private hasFiveInRow(board: (string | null)[][], player: string): boolean {
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (board[r][c] !== player) continue;
        for (const [dr, dc] of dirs) {
          let count = 1;
          for (let i = 1; i < 5; i++) {
            const nr = r + dr * i,
              nc = c + dc * i;
            if (nr >= 0 && nr < 6 && nc >= 0 && nc < 6 && board[nr][nc] === player) count++;
            else break;
          }
          if (count >= 5) return true;
        }
      }
    }
    return false;
  }

  protected checkGameOver(): boolean {
    const data = this.getData<PentagoState>();
    if (data.winner !== null) return true;
    // Board full
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (data.board[r][c] === null) return false;
      }
    }
    return true;
  }

  protected determineWinner(): string | null {
    return this.getData<PentagoState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
