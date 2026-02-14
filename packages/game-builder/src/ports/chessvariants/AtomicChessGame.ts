import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type PieceType,
  type ChessPiece,
  type Board,
  setupStandardBoard,
  inBounds,
  isPseudoLegalMove,
  findKing,
  isKingInCheck,
  isLegalMoveStandard,
} from './chessHelpers.js';

interface AtomicState {
  [key: string]: unknown;
  board: Board;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  enPassantTarget: [number, number] | null;
  halfMoveClock: number;
  castlingRights: { kingSide: boolean; queenSide: boolean }[];
}

export class AtomicChessGame extends BaseGame {
  readonly name = 'Atomic Chess';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): AtomicState {
    return {
      board: setupStandardBoard(playerIds),
      currentPlayer: 0,
      winner: null,
      draw: false,
      enPassantTarget: null,
      halfMoveClock: 0,
      castlingRights: [
        { kingSide: true, queenSide: true },
        { kingSide: true, queenSide: true },
      ],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<AtomicState>();
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

    const target = data.board[toR][toC];

    // In atomic chess, you cannot capture if it would destroy your own king
    // We check pseudo-legal first, then simulate explosion
    if (
      !isPseudoLegalMove(
        data.board,
        piece,
        fromR,
        fromC,
        toR,
        toC,
        data.currentPlayer,
        data.enPassantTarget,
      )
    ) {
      // Also allow castling
      if (!(piece.type === 'K' && Math.abs(toC - fromC) === 2)) {
        return { success: false, error: 'Illegal move' };
      }
    }

    const isCapture = target !== null;

    // Simulate
    if (isCapture) {
      // Explosion: destroy all non-pawn pieces in 3x3 area around (toR,toC), plus the capturing piece
      const boardCopy = data.board.map((row) => row.map((c) => (c ? { ...c } : null)));
      // Move piece
      boardCopy[toR][toC] = piece;
      boardCopy[fromR][fromC] = null;

      // Explode
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const er = toR + dr;
          const ec = toC + dc;
          if (inBounds(er, ec)) {
            const ep = boardCopy[er][ec];
            if (ep && ep.type !== 'P') {
              boardCopy[er][ec] = null;
            }
          }
        }
      }
      // The capturing piece is also destroyed (it's at toR,toC, which was already set to null or pawn)
      // Actually: the capturing piece goes to toR,toC, then explosion destroys everything non-pawn in 3x3
      // The capturing piece is at toR,toC so it's included in the blast if non-pawn
      // Pawns caught in blast ARE destroyed in original atomic chess, but the convention varies.
      // Standard: all pieces in blast radius destroyed, but pawns only if directly captured (not by explosion).
      // Let's follow Lichess rules: pawns survive explosions
      boardCopy[toR][toC] = null; // capturing piece always destroyed

      // Check if own king survived
      const ownKing = findKing(boardCopy, playerId);
      if (!ownKing) {
        return { success: false, error: 'Move would destroy your own king' };
      }

      // Apply explosion to actual board
      data.board[toR][toC] = piece;
      data.board[fromR][fromC] = null;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const er = toR + dr;
          const ec = toC + dc;
          if (inBounds(er, ec)) {
            const ep = data.board[er][ec];
            if (ep && ep.type !== 'P') {
              data.board[er][ec] = null;
            }
          }
        }
      }
      data.board[toR][toC] = null;

      // Check if opponent king was destroyed
      const oppKing = findKing(data.board, players[(data.currentPlayer + 1) % 2]);
      if (!oppKing) {
        data.winner = playerId;
        this.emitEvent('king_destroyed', playerId, {});
      }
    } else {
      // Non-capture: normal move, but must not leave own king in check
      // In atomic chess, you can move into "check" if opponent would have to capture your king (destroying their own)
      // Simplified: just do normal legality check for non-captures
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

      // Castling
      if (piece.type === 'K' && Math.abs(toC - fromC) === 2) {
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

      data.board[toR][toC] = piece;
      data.board[fromR][fromC] = null;
      piece.moved = true;

      // Promotion
      const promotion = action.payload.promotion as PieceType | undefined;
      if (piece.type === 'P' && (toR === 0 || toR === 7)) {
        const valid: PieceType[] = ['Q', 'R', 'B', 'N'];
        piece.type = promotion && valid.includes(promotion) ? promotion : 'Q';
      }
    }

    // En passant target
    if (piece.type === 'P' && Math.abs(toR - fromR) === 2 && !isCapture) {
      data.enPassantTarget = [(fromR + toR) / 2, fromC];
    } else {
      data.enPassantTarget = null;
    }

    // Update castling rights
    if (piece.type === 'K') {
      data.castlingRights[data.currentPlayer] = { kingSide: false, queenSide: false };
    }

    if (piece.type === 'P' || isCapture) data.halfMoveClock = 0;
    else data.halfMoveClock++;

    data.currentPlayer = (data.currentPlayer + 1) % 2;

    // Check for game over (opponent has no king or no legal moves)
    if (!data.winner) {
      const opponent = players[data.currentPlayer];
      const oppKing = findKing(data.board, opponent);
      if (!oppKing) {
        data.winner = playerId;
      } else {
        // Check stalemate: simplified, check if opponent has any pieces that can move
        let hasMove = false;
        for (let r = 0; r < 8 && !hasMove; r++) {
          for (let c = 0; c < 8 && !hasMove; c++) {
            const p = data.board[r][c];
            if (!p || p.owner !== opponent) continue;
            for (let tr = 0; tr < 8 && !hasMove; tr++) {
              for (let tc = 0; tc < 8 && !hasMove; tc++) {
                if (
                  isPseudoLegalMove(
                    data.board,
                    p,
                    r,
                    c,
                    tr,
                    tc,
                    data.currentPlayer,
                    data.enPassantTarget,
                  )
                ) {
                  hasMove = true;
                }
              }
            }
          }
        }
        if (!hasMove) {
          data.draw = true;
          this.emitEvent('stalemate', undefined, {});
        }
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
    const data = this.getData<AtomicState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<AtomicState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<AtomicState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      if (data.draw) scores[p] = 0.5;
      else scores[p] = p === data.winner ? 1 : 0;
    }
    return scores;
  }
}
