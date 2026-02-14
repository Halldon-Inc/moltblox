import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

// Polyomino shapes: each is an array of [row, col] offsets
const PIECES: number[][][] = [
  [[0, 0]], // 1-cell
  [
    [0, 0],
    [0, 1],
  ], // domino
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ], // I3
  [
    [0, 0],
    [0, 1],
    [1, 0],
  ], // L3
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ], // I4
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
  ], // L4
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
  ], // S4
  [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ], // O4
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
  ], // T4
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
  ], // I5
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 0],
  ], // L5
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
  ], // N5
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
  ], // P5
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
    [2, 1],
  ], // T5
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
    [2, 2],
  ], // W5
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [2, 0],
  ], // V5
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
    [2, 2],
  ], // Z5
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 2],
  ], // U5
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 0],
    [2, 1],
  ], // S5
  [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 1],
  ], // +5
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 1],
  ], // Y5
];

const BOARD_SIZE = 20;

interface BlokusPlayerState {
  pieces: number[][][]; // remaining pieces (each is array of cell offsets)
  placed: boolean; // has placed at least one
  passed: boolean;
  score: number;
}

interface BlokusState {
  [key: string]: unknown;
  board: number[][]; // -1=empty, 0-3=player
  players: Record<string, BlokusPlayerState>;
  currentPlayer: number;
  winner: string | null;
  gameEnded: boolean;
}

const CORNERS: [number, number][] = [
  [0, 0],
  [0, 19],
  [19, 0],
  [19, 19],
];

export class BlokusGame extends BaseGame {
  readonly name = 'Blokus';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): BlokusState {
    const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(-1));
    const players: Record<string, BlokusPlayerState> = {};
    for (const pid of playerIds) {
      players[pid] = {
        pieces: PIECES.map((p) => p.map((cell) => [...cell])),
        placed: false,
        passed: false,
        score: 0,
      };
    }
    return { board, players, currentPlayer: 0, winner: null, gameEnded: false };
  }

  private rotatePiece(cells: number[][]): number[][] {
    return cells.map(([r, c]) => [c, -r]);
  }

  private normalizePiece(cells: number[][]): number[][] {
    const minR = Math.min(...cells.map(([r]) => r));
    const minC = Math.min(...cells.map(([, c]) => c));
    return cells.map(([r, c]) => [r - minR, c - minC]);
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<BlokusState>();
    const playerOrder = this.getPlayers();
    const pIdx = data.currentPlayer;
    const currentId = playerOrder[pIdx];

    if (playerId !== currentId) return { success: false, error: 'Not your turn' };

    if (action.type === 'pass') {
      data.players[playerId].passed = true;
      this.advanceTurn(data, playerOrder);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'place') return { success: false, error: 'Must place or pass' };

    const pieceIdx = Number(action.payload.pieceIndex);
    const row = Number(action.payload.row);
    const col = Number(action.payload.col);
    const rotation = Number(action.payload.rotation || 0);
    const flip = Boolean(action.payload.flip);

    const ps = data.players[playerId];
    if (pieceIdx < 0 || pieceIdx >= ps.pieces.length) {
      return { success: false, error: 'Invalid piece' };
    }

    let cells = ps.pieces[pieceIdx].map(([r, c]) => [r, c]);
    if (flip) cells = cells.map(([r, c]) => [r, -c]);
    for (let i = 0; i < rotation % 4; i++) cells = this.rotatePiece(cells);
    cells = this.normalizePiece(cells);

    // Compute absolute positions
    const absolute = cells.map(([r, c]) => [row + r, col + c]);

    // Validate placement
    for (const [r, c] of absolute) {
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
        return { success: false, error: 'Out of bounds' };
      }
      if (data.board[r][c] !== -1) return { success: false, error: 'Space occupied' };
    }

    // No edge-adjacent to same color
    for (const [r, c] of absolute) {
      const adj = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ];
      for (const [ar, ac] of adj) {
        if (
          ar >= 0 &&
          ar < BOARD_SIZE &&
          ac >= 0 &&
          ac < BOARD_SIZE &&
          data.board[ar][ac] === pIdx
        ) {
          return { success: false, error: 'Cannot be edge-adjacent to your own pieces' };
        }
      }
    }

    // Must be corner-adjacent to same color (or first piece on corner)
    if (!ps.placed) {
      const corner = CORNERS[pIdx] || CORNERS[0];
      if (!absolute.some(([r, c]) => r === corner[0] && c === corner[1])) {
        return { success: false, error: 'First piece must cover your corner' };
      }
    } else {
      let hasCornerAdj = false;
      for (const [r, c] of absolute) {
        const diag = [
          [r - 1, c - 1],
          [r - 1, c + 1],
          [r + 1, c - 1],
          [r + 1, c + 1],
        ];
        for (const [dr, dc] of diag) {
          if (
            dr >= 0 &&
            dr < BOARD_SIZE &&
            dc >= 0 &&
            dc < BOARD_SIZE &&
            data.board[dr][dc] === pIdx
          ) {
            hasCornerAdj = true;
            break;
          }
        }
        if (hasCornerAdj) break;
      }
      if (!hasCornerAdj) return { success: false, error: 'Must touch your piece diagonally' };
    }

    // Place piece
    for (const [r, c] of absolute) data.board[r][c] = pIdx;
    ps.pieces.splice(pieceIdx, 1);
    ps.placed = true;
    ps.score += absolute.length;

    this.advanceTurn(data, playerOrder);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private advanceTurn(data: BlokusState, playerOrder: string[]): void {
    let attempts = 0;
    do {
      data.currentPlayer = (data.currentPlayer + 1) % playerOrder.length;
      attempts++;
    } while (data.players[playerOrder[data.currentPlayer]].passed && attempts < playerOrder.length);

    if (attempts >= playerOrder.length) {
      data.gameEnded = true;
      let bestScore = -1;
      let best: string | null = null;
      for (const pid of playerOrder) {
        if (data.players[pid].score > bestScore) {
          bestScore = data.players[pid].score;
          best = pid;
        }
      }
      data.winner = best;
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<BlokusState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<BlokusState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<BlokusState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      // Score = cells placed minus cells remaining
      const remaining = data.players[p].pieces.reduce((sum, piece) => sum + piece.length, 0);
      scores[p] = data.players[p].score - remaining;
    }
    return scores;
  }
}
