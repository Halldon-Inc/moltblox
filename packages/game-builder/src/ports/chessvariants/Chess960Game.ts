import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type PieceType,
  type Board,
  createEmptyBoard,
  isKingInCheck,
  isLegalMoveStandard,
  hasAnyLegalMove,
} from './chessHelpers.js';

interface Chess960State {
  [key: string]: unknown;
  board: Board;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  enPassantTarget: [number, number] | null;
  halfMoveClock: number;
  castlingRights: { kingSide: boolean; queenSide: boolean }[];
}

function generateFischerRandom(): PieceType[] {
  const row: (PieceType | null)[] = Array(8).fill(null);

  // Place bishops on opposite colors
  const lightSquares = [0, 2, 4, 6];
  const darkSquares = [1, 3, 5, 7];
  row[lightSquares[Math.floor(Math.random() * 4)]] = 'B';
  row[darkSquares[Math.floor(Math.random() * 4)]] = 'B';

  // Place queen on random empty square
  const empty1 = row.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
  row[empty1[Math.floor(Math.random() * empty1.length)]] = 'Q';

  // Place knights on random 2 of remaining empty squares
  const empty2 = row.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
  const n1Idx = Math.floor(Math.random() * empty2.length);
  row[empty2[n1Idx]] = 'N';
  empty2.splice(n1Idx, 1);
  row[empty2[Math.floor(Math.random() * empty2.length)]] = 'N';

  // Place R, K, R on remaining 3 squares (king between rooks)
  const empty3 = row.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
  row[empty3[0]] = 'R';
  row[empty3[1]] = 'K';
  row[empty3[2]] = 'R';

  return row as PieceType[];
}

export class Chess960Game extends BaseGame {
  readonly name = 'Chess960';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): Chess960State {
    const board = createEmptyBoard(8, 8);
    const backRow = generateFischerRandom();

    for (let c = 0; c < 8; c++) {
      board[0][c] = { type: backRow[c], owner: playerIds[1], moved: false };
      board[1][c] = { type: 'P', owner: playerIds[1], moved: false };
      board[6][c] = { type: 'P', owner: playerIds[0], moved: false };
      board[7][c] = { type: backRow[c], owner: playerIds[0], moved: false };
    }

    return {
      board,
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
    const data = this.getData<Chess960State>();
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
    const data = this.getData<Chess960State>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<Chess960State>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<Chess960State>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      if (data.draw) scores[p] = 0.5;
      else scores[p] = p === data.winner ? 1 : 0;
    }
    return scores;
  }
}
