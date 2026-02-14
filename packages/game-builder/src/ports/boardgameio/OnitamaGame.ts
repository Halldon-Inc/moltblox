import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface OnitamaConfig {
  boardSize?: number;
}

/**
 * Onitama: Chess-like game on 5x5 board. Each player has a master + 4 students.
 * Movement is determined by shared movement cards (2 per player + 1 spare).
 * Win by capturing opponent's master or moving your master to opponent's throne.
 * After each move, the used card swaps with the spare card.
 */

interface MoveCard {
  name: string;
  moves: [number, number][]; // relative offsets [dr, dc] from player 0's perspective
}

const ALL_CARDS: MoveCard[] = [
  {
    name: 'Tiger',
    moves: [
      [-2, 0],
      [1, 0],
    ],
  },
  {
    name: 'Crab',
    moves: [
      [-1, 0],
      [0, -2],
      [0, 2],
    ],
  },
  {
    name: 'Monkey',
    moves: [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ],
  },
  {
    name: 'Crane',
    moves: [
      [-1, 0],
      [1, -1],
      [1, 1],
    ],
  },
  {
    name: 'Dragon',
    moves: [
      [-1, -2],
      [-1, 2],
      [1, -1],
      [1, 1],
    ],
  },
  {
    name: 'Elephant',
    moves: [
      [-1, -1],
      [-1, 1],
      [0, -1],
      [0, 1],
    ],
  },
  {
    name: 'Mantis',
    moves: [
      [-1, -1],
      [-1, 1],
      [1, 0],
    ],
  },
  {
    name: 'Boar',
    moves: [
      [-1, 0],
      [0, -1],
      [0, 1],
    ],
  },
  {
    name: 'Frog',
    moves: [
      [-1, -1],
      [0, -2],
      [1, 1],
    ],
  },
  {
    name: 'Goose',
    moves: [
      [-1, -1],
      [0, -1],
      [0, 1],
      [1, 1],
    ],
  },
  {
    name: 'Horse',
    moves: [
      [-1, 0],
      [0, -1],
      [1, 0],
    ],
  },
  {
    name: 'Eel',
    moves: [
      [-1, -1],
      [0, 1],
      [1, -1],
    ],
  },
  {
    name: 'Rabbit',
    moves: [
      [-1, 1],
      [0, 2],
      [1, -1],
    ],
  },
  {
    name: 'Rooster',
    moves: [
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
    ],
  },
  {
    name: 'Ox',
    moves: [
      [-1, 0],
      [0, 1],
      [1, 0],
    ],
  },
  {
    name: 'Cobra',
    moves: [
      [-1, 1],
      [0, -1],
      [1, 1],
    ],
  },
];

interface Piece {
  owner: number; // 0 or 1
  isMaster: boolean;
}

interface OnitamaState {
  [key: string]: unknown;
  board: (Piece | null)[][];
  playerCards: MoveCard[][]; // playerCards[0] = p0's cards, playerCards[1] = p1's cards
  spareCard: MoveCard;
  currentPlayer: number;
  winner: string | null;
}

export class OnitamaGame extends BaseGame {
  readonly name = 'Onitama';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(_playerIds: string[]): OnitamaState {
    const board: (Piece | null)[][] = Array.from({ length: 5 }, () => Array(5).fill(null));

    // Player 0 (bottom, row 4)
    for (let c = 0; c < 5; c++) {
      board[4][c] = { owner: 0, isMaster: c === 2 };
    }
    // Player 1 (top, row 0)
    for (let c = 0; c < 5; c++) {
      board[0][c] = { owner: 1, isMaster: c === 2 };
    }

    // Pick 5 random cards
    const shuffled = [...ALL_CARDS];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return {
      board,
      playerCards: [
        [shuffled[0], shuffled[1]],
        [shuffled[2], shuffled[3]],
      ],
      spareCard: shuffled[4],
      currentPlayer: 0,
      winner: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<OnitamaState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }
    if (action.type !== 'move') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const fromR = Number(action.payload.fromRow);
    const fromC = Number(action.payload.fromCol);
    const toR = Number(action.payload.toRow);
    const toC = Number(action.payload.toCol);
    const cardName = action.payload.card as string;

    if ([fromR, fromC, toR, toC].some((v) => isNaN(v) || v < 0 || v >= 5)) {
      return { success: false, error: 'Invalid coordinates' };
    }

    const piece = data.board[fromR][fromC];
    if (!piece || piece.owner !== pIdx) {
      return { success: false, error: 'No valid piece at source' };
    }

    // Find the card
    const cardIdx = data.playerCards[pIdx].findIndex((c) => c.name === cardName);
    if (cardIdx === -1) {
      return { success: false, error: 'Card not in your hand' };
    }

    const card = data.playerCards[pIdx][cardIdx];
    // Validate the move matches one of the card's offsets
    // Player 0 uses offsets as-is, player 1 mirrors them (negate)
    const dr = toR - fromR;
    const dc = toC - fromC;
    const validMove = card.moves.some(([mr, mc]) => {
      if (pIdx === 0) return mr === dr && mc === dc;
      return -mr === dr && -mc === dc;
    });

    if (!validMove) {
      return { success: false, error: 'Move does not match card pattern' };
    }

    // Cannot land on own piece
    const target = data.board[toR][toC];
    if (target && target.owner === pIdx) {
      return { success: false, error: 'Cannot capture your own piece' };
    }

    // Execute move
    data.board[fromR][fromC] = null;
    data.board[toR][toC] = piece;

    // Check win conditions
    // 1. Captured opponent's master
    if (target && target.isMaster) {
      data.winner = playerId;
      this.emitEvent('master_captured', playerId, { row: toR, col: toC });
    }

    // 2. Master reached opponent's throne (p0 throne = 0,2; p1 throne = 4,2)
    if (piece.isMaster) {
      const throneRow = pIdx === 0 ? 0 : 4;
      if (toR === throneRow && toC === 2) {
        data.winner = playerId;
        this.emitEvent('throne_reached', playerId, { row: toR, col: toC });
      }
    }

    // Swap card with spare
    const usedCard = data.playerCards[pIdx].splice(cardIdx, 1)[0];
    data.playerCards[pIdx].push(data.spareCard);
    data.spareCard = usedCard;

    data.currentPlayer = 1 - pIdx;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<OnitamaState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<OnitamaState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
