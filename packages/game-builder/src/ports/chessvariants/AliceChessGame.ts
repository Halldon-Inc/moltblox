import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type PieceType,
  type ChessPiece,
  type Board,
  setupStandardBoard,
  createEmptyBoard,
  isPseudoLegalMove,
  findKing,
  isPathClear,
} from './chessHelpers.js';

/**
 * Alice Chess: Two 8x8 boards.
 * After a move on one board, the piece teleports to the same square on the other board.
 * The destination square on the other board must be empty.
 */
interface AliceState {
  [key: string]: unknown;
  boards: Board[];
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  enPassantTarget: [number, number] | null;
  enPassantBoard: number | null;
  castlingRights: { kingSide: boolean; queenSide: boolean }[];
}

export class AliceChessGame extends BaseGame {
  readonly name = 'Alice Chess';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): AliceState {
    return {
      boards: [setupStandardBoard(playerIds), createEmptyBoard(8, 8)],
      currentPlayer: 0,
      winner: null,
      draw: false,
      enPassantTarget: null,
      enPassantBoard: null,
      castlingRights: [
        { kingSide: true, queenSide: true },
        { kingSide: true, queenSide: true },
      ],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<AliceState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const boardIdx = Number(action.payload.board ?? 0);
    if (boardIdx !== 0 && boardIdx !== 1) return { success: false, error: 'Invalid board' };

    const from = this.parseCoords(action.payload.from as string);
    const to = this.parseCoords(action.payload.to as string);
    if (!from || !to) return { success: false, error: 'Invalid coordinates' };
    const [fromR, fromC] = from;
    const [toR, toC] = to;

    const board = data.boards[boardIdx];
    const otherBoard = data.boards[1 - boardIdx];

    const piece = board[fromR]?.[fromC];
    if (!piece || piece.owner !== playerId) return { success: false, error: 'No valid piece' };

    // Check pseudo-legal on the source board
    const ep = data.enPassantBoard === boardIdx ? data.enPassantTarget : null;
    if (!isPseudoLegalMove(board, piece, fromR, fromC, toR, toC, data.currentPlayer, ep)) {
      // Also allow castling
      if (!(piece.type === 'K' && Math.abs(toC - fromC) === 2)) {
        return { success: false, error: 'Illegal move on this board' };
      }
    }

    // The destination square on the OTHER board must be empty (piece teleports there)
    if (otherBoard[toR][toC] !== null) {
      return { success: false, error: 'Destination occupied on mirror board' };
    }

    // Simulate the move
    const captured = board[toR][toC];

    // En passant
    if (piece.type === 'P' && ep && toR === ep[0] && toC === ep[1]) {
      board[fromR][toC] = null;
    }

    // Castling
    if (piece.type === 'K' && Math.abs(toC - fromC) === 2) {
      if (toC > fromC) {
        // Rook also teleports to other board
        const rook = board[fromR][7];
        board[fromR][7] = null;
        if (rook) {
          rook.moved = true;
          otherBoard[fromR][5] = rook; // Rook lands on other board
        }
      } else {
        const rook = board[fromR][0];
        board[fromR][0] = null;
        if (rook) {
          rook.moved = true;
          otherBoard[fromR][3] = rook;
        }
      }
    }

    board[fromR][fromC] = null;
    // Piece teleports to other board at (toR, toC)
    otherBoard[toR][toC] = piece;
    piece.moved = true;

    // Promotion
    if (piece.type === 'P' && (toR === 0 || toR === 7)) {
      const promotion = action.payload.promotion as PieceType | undefined;
      const valid: PieceType[] = ['Q', 'R', 'B', 'N'];
      piece.type = promotion && valid.includes(promotion) ? promotion : 'Q';
    }

    // Check if own king is in check on either board
    if (this.isKingInCheckAlice(data.boards, playerId, players)) {
      // Undo
      board[fromR][fromC] = piece;
      otherBoard[toR][toC] = null;
      if (captured) board[toR][toC] = captured;
      return { success: false, error: 'Move leaves king in check' };
    }

    // En passant target
    if (piece.type === 'P' && Math.abs(toR - fromR) === 2) {
      data.enPassantTarget = [(fromR + toR) / 2, fromC];
      data.enPassantBoard = 1 - boardIdx; // The pawn is now on the other board
    } else {
      data.enPassantTarget = null;
      data.enPassantBoard = null;
    }

    if (piece.type === 'K') {
      data.castlingRights[data.currentPlayer] = { kingSide: false, queenSide: false };
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;

    // Check for checkmate/stalemate
    const opponent = players[data.currentPlayer];
    const inCheck = this.isKingInCheckAlice(data.boards, opponent, players);
    const hasMoves = this.hasAnyMoveAlice(data, opponent, data.currentPlayer, players);

    if (!hasMoves) {
      if (inCheck) {
        data.winner = playerId;
        this.emitEvent('checkmate', playerId, {});
      } else {
        data.draw = true;
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private isKingInCheckAlice(boards: Board[], player: string, players: string[]): boolean {
    // Find king on either board
    for (let b = 0; b < 2; b++) {
      const king = findKing(boards[b], player);
      if (!king) continue;
      const [kr, kc] = king;
      // Can be attacked from same board
      for (let i = 0; i < players.length; i++) {
        if (players[i] === player) continue;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = boards[b][r][c];
            if (p && p.owner === players[i]) {
              if (isPseudoLegalMove(boards[b], p, r, c, kr, kc, i, null)) return true;
            }
          }
        }
      }
    }
    return false;
  }

  private hasAnyMoveAlice(
    data: AliceState,
    player: string,
    playerIdx: number,
    players: string[],
  ): boolean {
    for (let b = 0; b < 2; b++) {
      const board = data.boards[b];
      const otherBoard = data.boards[1 - b];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (!piece || piece.owner !== player) continue;
          const ep = data.enPassantBoard === b ? data.enPassantTarget : null;
          for (let tr = 0; tr < 8; tr++) {
            for (let tc = 0; tc < 8; tc++) {
              if (!isPseudoLegalMove(board, piece, r, c, tr, tc, playerIdx, ep)) continue;
              if (otherBoard[tr][tc] !== null) continue;
              // Simulate
              const saved = board[tr][tc];
              board[r][c] = null;
              otherBoard[tr][tc] = piece;
              const inCheck = this.isKingInCheckAlice(data.boards, player, players);
              board[r][c] = piece;
              otherBoard[tr][tc] = null;
              if (saved) board[tr][tc] = saved;
              if (!inCheck) return true;
            }
          }
        }
      }
    }
    return false;
  }

  private parseCoords(s: string): [number, number] | null {
    if (!s || s.length < 2) return null;
    const col = s.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(s.substring(1), 10);
    if (isNaN(row) || col < 0 || col > 7 || row < 0 || row > 7) return null;
    return [row, col];
  }

  protected checkGameOver(): boolean {
    const data = this.getData<AliceState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<AliceState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<AliceState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      if (data.draw) scores[p] = 0.5;
      else scores[p] = p === data.winner ? 1 : 0;
    }
    return scores;
  }
}
