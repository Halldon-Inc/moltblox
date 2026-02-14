import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface AmazonsState {
  [key: string]: unknown;
  board: (string | null)[][];
  currentPlayer: number;
  winner: string | null;
}

export class AmazonsGame extends BaseGame {
  readonly name = 'Amazons';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): AmazonsState {
    const board: (string | null)[][] = [];
    for (let r = 0; r < 10; r++) board.push(Array(10).fill(null));
    // Standard starting positions
    const p0Positions = [
      [0, 3],
      [0, 6],
      [3, 0],
      [3, 9],
    ]; // white
    const p1Positions = [
      [6, 0],
      [6, 9],
      [9, 3],
      [9, 6],
    ]; // black
    for (const [r, c] of p0Positions) board[r][c] = playerIds[0];
    for (const [r, c] of p1Positions) board[r][c] = playerIds[1];
    return { board, currentPlayer: 0, winner: null };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<AmazonsState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move_and_shoot')
      return { success: false, error: `Unknown action: ${action.type}` };

    const fromR = Number(action.payload.fromRow);
    const fromC = Number(action.payload.fromCol);
    const toR = Number(action.payload.toRow);
    const toC = Number(action.payload.toCol);
    const arrowR = Number(action.payload.arrowRow);
    const arrowC = Number(action.payload.arrowCol);

    if ([fromR, fromC, toR, toC, arrowR, arrowC].some((v) => isNaN(v))) {
      return { success: false, error: 'Invalid coordinates' };
    }

    if (data.board[fromR]?.[fromC] !== playerId)
      return { success: false, error: 'No amazon at source' };

    // Validate queen-like move
    if (!this.isQueenMove(data.board, fromR, fromC, toR, toC)) {
      return { success: false, error: 'Invalid amazon move' };
    }

    // Move amazon
    data.board[fromR][fromC] = null;
    data.board[toR][toC] = playerId;

    // Validate arrow (queen-like move from new position)
    if (!this.isQueenMove(data.board, toR, toC, arrowR, arrowC)) {
      // Undo move
      data.board[toR][toC] = null;
      data.board[fromR][fromC] = playerId;
      return { success: false, error: 'Invalid arrow shot' };
    }

    data.board[arrowR][arrowC] = 'X'; // Blocked

    // Check if opponent can move
    const opponent = players[(data.currentPlayer + 1) % 2];
    if (!this.canPlayerMove(data.board, opponent)) {
      data.winner = playerId;
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private isQueenMove(
    board: (string | null)[][],
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
  ): boolean {
    if (toR < 0 || toR >= 10 || toC < 0 || toC >= 10) return false;
    if (fromR === toR && fromC === toC) return false;

    const dr = Math.sign(toR - fromR);
    const dc = Math.sign(toC - fromC);
    const dist = Math.max(Math.abs(toR - fromR), Math.abs(toC - fromC));

    if (
      Math.abs(toR - fromR) !== 0 &&
      Math.abs(toC - fromC) !== 0 &&
      Math.abs(toR - fromR) !== Math.abs(toC - fromC)
    ) {
      return false;
    }

    for (let i = 1; i <= dist; i++) {
      const r = fromR + dr * i,
        c = fromC + dc * i;
      if (i < dist && board[r][c] !== null) return false;
      if (i === dist && board[r][c] !== null) return false;
    }
    return true;
  }

  private canPlayerMove(board: (string | null)[][], player: string): boolean {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (board[r][c] !== player) continue;
        for (const [dr, dc] of [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ]) {
          const nr = r + dr,
            nc = c + dc;
          if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && board[nr][nc] === null) return true;
        }
      }
    }
    return false;
  }

  protected checkGameOver(): boolean {
    return this.getData<AmazonsState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<AmazonsState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
