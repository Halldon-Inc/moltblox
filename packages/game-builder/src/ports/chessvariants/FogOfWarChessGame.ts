import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult, GameState } from '@moltblox/protocol';
import {
  type PieceType,
  type Board,
  setupStandardBoard,
  inBounds,
  isPseudoLegalMove,
  isKingInCheck,
  isLegalMoveStandard,
  hasAnyLegalMove,
} from './chessHelpers.js';

interface FogState {
  [key: string]: unknown;
  board: Board;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  enPassantTarget: [number, number] | null;
  halfMoveClock: number;
  castlingRights: { kingSide: boolean; queenSide: boolean }[];
}

export class FogOfWarChessGame extends BaseGame {
  readonly name = 'Fog of War Chess';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): FogState {
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

  override getStateForPlayer(playerId: string): GameState {
    const state = this.getState();
    const data = state.data as FogState;
    const players = this.getPlayers();
    const playerIdx = players.indexOf(playerId);
    if (playerIdx === -1) return state;

    const visibleSquares = this.getVisibleSquares(
      data.board,
      playerId,
      playerIdx,
      data.enPassantTarget,
    );
    const fogBoard = data.board.map((row, r) =>
      row.map((cell, c) => (visibleSquares.has(`${r},${c}`) ? cell : null)),
    );

    return {
      ...state,
      data: { ...data, board: fogBoard },
    };
  }

  private getVisibleSquares(
    board: Board,
    player: string,
    playerIdx: number,
    enPassant: [number, number] | null,
  ): Set<string> {
    const visible = new Set<string>();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece || piece.owner !== player) continue;

        // The square the piece is on is visible
        visible.add(`${r},${c}`);

        // All squares this piece can move to are visible
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            if (isPseudoLegalMove(board, piece, r, c, tr, tc, playerIdx, enPassant)) {
              visible.add(`${tr},${tc}`);
            }
          }
        }

        // For sliding pieces, add squares along their lines of sight (up to and including first blocking piece)
        if (piece.type === 'R' || piece.type === 'Q') {
          for (const [dr, dc] of [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ]) {
            let nr = r + dr,
              nc = c + dc;
            while (inBounds(nr, nc)) {
              visible.add(`${nr},${nc}`);
              if (board[nr][nc]) break;
              nr += dr;
              nc += dc;
            }
          }
        }
        if (piece.type === 'B' || piece.type === 'Q') {
          for (const [dr, dc] of [
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
          ]) {
            let nr = r + dr,
              nc = c + dc;
            while (inBounds(nr, nc)) {
              visible.add(`${nr},${nc}`);
              if (board[nr][nc]) break;
              nr += dr;
              nc += dc;
            }
          }
        }
      }
    }

    return visible;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<FogState>();
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

    const captured = data.board[toR][toC];

    if (
      piece.type === 'P' &&
      data.enPassantTarget &&
      toR === data.enPassantTarget[0] &&
      toC === data.enPassantTarget[1]
    ) {
      data.board[fromR][toC] = null;
    }

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

    if (piece.type === 'P' && Math.abs(toR - fromR) === 2) {
      data.enPassantTarget = [(fromR + toR) / 2, fromC];
    } else {
      data.enPassantTarget = null;
    }

    data.board[toR][toC] = piece;
    data.board[fromR][fromC] = null;
    piece.moved = true;

    if (piece.type === 'P' && (toR === 0 || toR === 7)) {
      const promotion = action.payload.promotion as PieceType | undefined;
      const valid: PieceType[] = ['Q', 'R', 'B', 'N'];
      piece.type = promotion && valid.includes(promotion) ? promotion : 'Q';
    }

    if (piece.type === 'K') {
      data.castlingRights[data.currentPlayer] = { kingSide: false, queenSide: false };
    }

    if (piece.type === 'P' || captured) data.halfMoveClock = 0;
    else data.halfMoveClock++;

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    const opponent = players[data.currentPlayer];
    const inCheck = isKingInCheck(data.board, opponent, players, data.enPassantTarget);
    const hasMoves = hasAnyLegalMove(
      data.board,
      opponent,
      data.currentPlayer,
      players,
      data.enPassantTarget,
      data.castlingRights,
    );

    if (!hasMoves) {
      if (inCheck) {
        data.winner = playerId;
        this.emitEvent('checkmate', playerId, {});
      } else {
        data.draw = true;
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
    const data = this.getData<FogState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<FogState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<FogState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      if (data.draw) scores[p] = 0.5;
      else scores[p] = p === data.winner ? 1 : 0;
    }
    return scores;
  }
}
