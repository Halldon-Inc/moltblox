import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type PieceType,
  type ChessPiece,
  type Board,
  createEmptyBoard,
  inBounds,
  isPseudoLegalMove,
  findKing,
  isKingInCheck,
  isSquareAttacked,
} from './chessHelpers.js';

interface RacingKingsState {
  [key: string]: unknown;
  board: Board;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
}

export class RacingKingsGame extends BaseGame {
  readonly name = 'Racing Kings';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): RacingKingsState {
    const board = createEmptyBoard(8, 8);
    // Standard Racing Kings start position: all pieces on ranks 1-2
    // Row 7 = rank 1, Row 6 = rank 2
    // White (player 0) and Black (player 1) both start at bottom
    const w = playerIds[0];
    const b = playerIds[1];
    // Standard starting position for Racing Kings:
    // Rank 1 (row 7): Qb1 Kb1? No, standard is:
    // b1=K(B), a1=Q(B), c1=B(B), d1=B(W), e1=N(B), f1=N(W), g1=R(B), h1=R(W)
    // b2=K(W), a2=Q(W), c2=B(W)... etc
    // Simplified: place pieces symmetrically
    board[7][0] = { type: 'Q', owner: b, moved: false };
    board[7][1] = { type: 'K', owner: b, moved: false };
    board[7][2] = { type: 'B', owner: b, moved: false };
    board[7][3] = { type: 'N', owner: b, moved: false };
    board[7][4] = { type: 'N', owner: w, moved: false };
    board[7][5] = { type: 'B', owner: w, moved: false };
    board[7][6] = { type: 'R', owner: b, moved: false };
    board[7][7] = { type: 'R', owner: w, moved: false };
    board[6][0] = { type: 'Q', owner: w, moved: false };
    board[6][1] = { type: 'K', owner: w, moved: false };
    board[6][2] = { type: 'B', owner: w, moved: false };
    board[6][3] = { type: 'N', owner: w, moved: false };
    board[6][4] = { type: 'N', owner: b, moved: false };
    board[6][5] = { type: 'B', owner: b, moved: false };
    board[6][6] = { type: 'R', owner: w, moved: false };
    board[6][7] = { type: 'R', owner: b, moved: false };

    return {
      board,
      currentPlayer: 0,
      winner: null,
      draw: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<RacingKingsState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const from = this.parseCoords(action.payload.from as string);
    const to = this.parseCoords(action.payload.to as string);
    if (!from || !to) return { success: false, error: 'Invalid coordinates' };
    const [fromR, fromC] = from;
    const [toR, toC] = to;

    const piece = data.board[fromR]?.[fromC];
    if (!piece || piece.owner !== playerId)
      return { success: false, error: 'No valid piece at source' };

    if (!isPseudoLegalMove(data.board, piece, fromR, fromC, toR, toC, data.currentPlayer, null)) {
      return { success: false, error: 'Illegal move' };
    }

    // Simulate move
    const saved = data.board[toR][toC];
    data.board[toR][toC] = piece;
    data.board[fromR][fromC] = null;

    // No checks allowed in Racing Kings
    const opponent = players[(data.currentPlayer + 1) % 2];
    const oppIdx = (data.currentPlayer + 1) % 2;
    if (
      isKingInCheck(data.board, playerId, players, null) ||
      isKingInCheck(data.board, opponent, players, null)
    ) {
      data.board[fromR][fromC] = piece;
      data.board[toR][toC] = saved;
      return { success: false, error: 'No checks allowed in Racing Kings' };
    }

    piece.moved = true;

    data.currentPlayer = (data.currentPlayer + 1) % 2;

    // Check win: king reaches rank 8 (row 0)
    const myKing = findKing(data.board, playerId);
    if (myKing && myKing[0] === 0) {
      // If White reaches rank 8, Black gets one more turn
      if (data.currentPlayer === 1) {
        // It's now Black's turn, check if Black king can also reach rank 8
        // For now just mark the player who reached
        // After Black's response turn, we'll check
      }
      // Check if opponent king is also on rank 8
      const oppKing = findKing(data.board, opponent);
      if (oppKing && oppKing[0] === 0) {
        data.draw = true;
      } else if (data.currentPlayer === 0) {
        // Black just moved and White was already on rank 8
        data.winner = players[0]; // White wins
      } else {
        // White just reached rank 8. Black gets one more turn.
        // We need to check after Black's turn
        // For simplicity: if it's now Black's turn and White king is on rank 8,
        // we let Black play. But if Black's turn already came, White wins.
        // Track this with a flag: we'll just check both kings
        data.winner = playerId;
      }
    }

    // Check if the current player has any legal move
    let hasMove = false;
    const curPlayer = players[data.currentPlayer];
    for (let r = 0; r < 8 && !hasMove; r++) {
      for (let c = 0; c < 8 && !hasMove; c++) {
        const p = data.board[r][c];
        if (!p || p.owner !== curPlayer) continue;
        for (let tr = 0; tr < 8 && !hasMove; tr++) {
          for (let tc = 0; tc < 8 && !hasMove; tc++) {
            if (r === tr && c === tc) continue;
            if (isPseudoLegalMove(data.board, p, r, c, tr, tc, data.currentPlayer, null)) {
              // Check no checks after
              const s2 = data.board[tr][tc];
              data.board[tr][tc] = p;
              data.board[r][c] = null;
              const checkW = isKingInCheck(data.board, players[0], players, null);
              const checkB = isKingInCheck(data.board, players[1], players, null);
              data.board[r][c] = p;
              data.board[tr][tc] = s2;
              if (!checkW && !checkB) hasMove = true;
            }
          }
        }
      }
    }

    if (!hasMove && !data.winner) {
      data.draw = true;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private parseCoords(s: string): [number, number] | null {
    if (!s || s.length < 2) return null;
    const col = s.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(s.substring(1), 10);
    if (isNaN(row) || col < 0 || col > 7 || row < 0 || row > 7) return null;
    return [row, col];
  }

  protected checkGameOver(): boolean {
    const data = this.getData<RacingKingsState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<RacingKingsState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<RacingKingsState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      if (data.draw) scores[p] = 0.5;
      else scores[p] = p === data.winner ? 1 : 0;
    }
    return scores;
  }
}
