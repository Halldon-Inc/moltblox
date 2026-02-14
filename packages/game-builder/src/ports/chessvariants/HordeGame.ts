import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type PieceType,
  type ChessPiece,
  type Board,
  createEmptyBoard,
  standardBackRow,
  inBounds,
  isPseudoLegalMove,
  findKing,
  isKingInCheck,
  isLegalMoveStandard,
  hasAnyLegalMove,
} from './chessHelpers.js';

interface HordeState {
  [key: string]: unknown;
  board: Board;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  enPassantTarget: [number, number] | null;
  halfMoveClock: number;
  castlingRights: { kingSide: boolean; queenSide: boolean }[];
}

export class HordeGame extends BaseGame {
  readonly name = 'Horde Chess';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): HordeState {
    const board = createEmptyBoard(8, 8);
    const white = playerIds[0]; // Horde (36 pawns)
    const black = playerIds[1]; // Normal pieces

    // Black: standard back rank + pawns
    const backRow = standardBackRow();
    for (let c = 0; c < 8; c++) {
      board[0][c] = { type: backRow[c], owner: black, moved: false };
      board[1][c] = { type: 'P', owner: black, moved: false };
    }

    // White horde: pawns on ranks 1-4 (rows 4-7) plus some on rank 5 (row 3)
    for (let r = 4; r <= 7; r++) {
      for (let c = 0; c < 8; c++) {
        board[r][c] = { type: 'P', owner: white, moved: false };
      }
    }
    // Extra pawns on rank 5 (row 3): b5, c5, f5, g5
    board[3][1] = { type: 'P', owner: white, moved: false };
    board[3][2] = { type: 'P', owner: white, moved: false };
    board[3][5] = { type: 'P', owner: white, moved: false };
    board[3][6] = { type: 'P', owner: white, moved: false };

    return {
      board,
      currentPlayer: 0,
      winner: null,
      draw: false,
      enPassantTarget: null,
      halfMoveClock: 0,
      castlingRights: [
        { kingSide: false, queenSide: false }, // White horde: no castling
        { kingSide: true, queenSide: true },
      ],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<HordeState>();
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

    // White (horde) has no king, so no check validation for white
    const isWhite = data.currentPlayer === 0;

    if (isWhite) {
      if (!isPseudoLegalMove(data.board, piece, fromR, fromC, toR, toC, 0, data.enPassantTarget)) {
        return { success: false, error: 'Illegal move' };
      }
    } else {
      if (
        !isLegalMoveStandard(
          data.board,
          fromR,
          fromC,
          toR,
          toC,
          playerId,
          data.currentPlayer,
          players,
          data.enPassantTarget,
          data.castlingRights,
        )
      ) {
        return { success: false, error: 'Illegal move' };
      }
    }

    const captured = data.board[toR][toC];

    // En passant capture
    if (
      piece.type === 'P' &&
      data.enPassantTarget &&
      toR === data.enPassantTarget[0] &&
      toC === data.enPassantTarget[1]
    ) {
      data.board[fromR][toC] = null;
    }

    // Castling (only for black)
    if (!isWhite && piece.type === 'K' && Math.abs(toC - fromC) === 2) {
      if (toC > fromC) {
        data.board[fromR][5] = data.board[fromR][7];
        data.board[fromR][7] = null;
        if (data.board[fromR][5]) data.board[fromR][5]!.moved = true;
      } else {
        data.board[fromR][3] = data.board[fromR][0];
        data.board[fromR][0] = null;
        if (data.board[fromR][3]) data.board[fromR][3]!.moved = true;
      }
    }

    if (piece.type === 'P' && Math.abs(toR - fromR) === 2) {
      data.enPassantTarget = [(fromR + toR) / 2, fromC];
    } else {
      data.enPassantTarget = null;
    }

    data.board[toR][toC] = piece;
    data.board[fromR][fromC] = null;
    piece.moved = true;

    // Promotion
    if (piece.type === 'P' && (toR === 0 || toR === 7)) {
      const promotion = action.payload.promotion as PieceType | undefined;
      const valid: PieceType[] = ['Q', 'R', 'B', 'N'];
      piece.type = promotion && valid.includes(promotion) ? promotion : 'Q';
    }

    // Castling rights
    if (piece.type === 'K') {
      data.castlingRights[data.currentPlayer] = { kingSide: false, queenSide: false };
    }

    if (piece.type === 'P' || captured) data.halfMoveClock = 0;
    else data.halfMoveClock++;

    data.currentPlayer = (data.currentPlayer + 1) % 2;

    // Check win conditions
    // White wins by checkmating black's king
    if (isWhite) {
      const blackPlayer = players[1];
      const inCheck = isKingInCheck(data.board, blackPlayer, players, data.enPassantTarget);
      const hasMoves = hasAnyLegalMove(
        data.board,
        blackPlayer,
        1,
        players,
        data.enPassantTarget,
        data.castlingRights,
      );
      if (!hasMoves) {
        if (inCheck) {
          data.winner = players[0];
          this.emitEvent('checkmate', players[0], {});
        } else {
          data.draw = true;
        }
      }
    } else {
      // Black wins by capturing all white pawns/pieces
      let whitePieces = 0;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (data.board[r][c]?.owner === players[0]) whitePieces++;
        }
      }
      if (whitePieces === 0) {
        data.winner = players[1];
        this.emitEvent('horde_destroyed', players[1], {});
      }
    }

    if (data.halfMoveClock >= 100) data.draw = true;

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
    const data = this.getData<HordeState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<HordeState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<HordeState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      if (data.draw) scores[p] = 0.5;
      else scores[p] = p === data.winner ? 1 : 0;
    }
    return scores;
  }
}
