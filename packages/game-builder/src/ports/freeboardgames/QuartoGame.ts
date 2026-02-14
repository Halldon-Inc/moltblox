import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

// 16 pieces: each has 4 binary attributes (tall/short, dark/light, square/round, hollow/solid)
// Represented as 0-15 (4-bit number)
interface QuartoState {
  [key: string]: unknown;
  board: (number | null)[]; // 4x4 = 16 cells
  availablePieces: number[];
  selectedPiece: number | null;
  currentPlayer: number;
  phase: string; // 'select' (pick piece for opponent) or 'place' (place selected piece)
  winner: string | null;
  gameEnded: boolean;
}

function checkLine(pieces: (number | null)[]): boolean {
  if (pieces.some((p) => p === null)) return false;
  // Check if all 4 pieces share at least one attribute value
  for (let bit = 0; bit < 4; bit++) {
    const vals = pieces.map((p) => (p! >> bit) & 1);
    if (vals.every((v) => v === 0) || vals.every((v) => v === 1)) return true;
  }
  return false;
}

export class QuartoGame extends BaseGame {
  readonly name = 'Quarto';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): QuartoState {
    return {
      board: Array(16).fill(null),
      availablePieces: Array.from({ length: 16 }, (_, i) => i),
      selectedPiece: null,
      currentPlayer: 0,
      phase: 'select',
      winner: null,
      gameEnded: false,
    };
  }

  private hasWinningLine(board: (number | null)[]): boolean {
    // Rows
    for (let r = 0; r < 4; r++) {
      if (checkLine([board[r * 4], board[r * 4 + 1], board[r * 4 + 2], board[r * 4 + 3]]))
        return true;
    }
    // Columns
    for (let c = 0; c < 4; c++) {
      if (checkLine([board[c], board[4 + c], board[8 + c], board[12 + c]])) return true;
    }
    // Diagonals
    if (checkLine([board[0], board[5], board[10], board[15]])) return true;
    if (checkLine([board[3], board[6], board[9], board[12]])) return true;
    return false;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<QuartoState>();
    const players = this.getPlayers();
    const currentId = players[data.currentPlayer];

    if (playerId !== currentId) return { success: false, error: 'Not your turn' };

    if (data.phase === 'select') {
      if (action.type !== 'select')
        return { success: false, error: 'Must select a piece for opponent' };
      const piece = Number(action.payload.piece);
      const idx = data.availablePieces.indexOf(piece);
      if (idx === -1) return { success: false, error: 'Piece not available' };

      data.selectedPiece = piece;
      data.availablePieces.splice(idx, 1);
      data.phase = 'place';
      data.currentPlayer = 1 - data.currentPlayer; // Opponent places
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'place') {
      if (action.type !== 'place')
        return { success: false, error: 'Must place the selected piece' };
      const position = Number(action.payload.position);
      if (position < 0 || position >= 16) return { success: false, error: 'Invalid position' };
      if (data.board[position] !== null) return { success: false, error: 'Cell occupied' };
      if (data.selectedPiece === null) return { success: false, error: 'No piece selected' };

      data.board[position] = data.selectedPiece;
      data.selectedPiece = null;

      if (this.hasWinningLine(data.board)) {
        data.gameEnded = true;
        data.winner = playerId;
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      // Check draw
      if (data.board.every((c) => c !== null)) {
        data.gameEnded = true;
        data.winner = null;
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      data.phase = 'select';
      // Current player now selects piece for opponent
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: 'Invalid state' };
  }

  protected checkGameOver(): boolean {
    return this.getData<QuartoState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<QuartoState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
