import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number;
  suit: Suit;
}

interface MonteCarloState {
  [key: string]: unknown;
  grid: (Card | null)[][]; // 5x5 grid
  stock: Card[];
  moves: number;
  score: number;
  pairsRemoved: number;
  gameOver: boolean;
  won: boolean;
  playerId: string;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffle(deck: Card[], seed: number): Card[] {
  const arr = [...deck];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Monte Carlo Solitaire: A 5x5 grid of cards.
 *
 * Remove pairs of adjacent cards (horizontally, vertically, or diagonally)
 * that share the same rank. After removing pairs, compact the grid
 * (shift cards to fill gaps) and refill from stock.
 * Win by removing all 26 pairs (52 cards).
 *
 * Actions: pair, compact
 */
export class MonteCarloGame extends BaseGame {
  readonly name = 'Monte Carlo Solitaire';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): MonteCarloState {
    const seed = Date.now();
    const deck = shuffle(createDeck(), seed);

    // Fill 5x5 grid (25 cards)
    const grid: (Card | null)[][] = [];
    let idx = 0;
    for (let row = 0; row < 5; row++) {
      const r: (Card | null)[] = [];
      for (let col = 0; col < 5; col++) {
        r.push({ ...deck[idx++] });
      }
      grid.push(r);
    }

    const stock = deck.slice(idx);

    return {
      grid,
      stock,
      moves: 0,
      score: 0,
      pairsRemoved: 0,
      gameOver: false,
      won: false,
      playerId: playerIds[0],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MonteCarloState>();
    if (playerId !== data.playerId) {
      return { success: false, error: 'Not your game' };
    }

    switch (action.type) {
      case 'pair':
        return this.handlePair(data, action.payload);
      case 'compact':
        return this.handleCompact(data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handlePair(data: MonteCarloState, payload: Record<string, unknown>): ActionResult {
    const row1 = Number(payload.row1);
    const col1 = Number(payload.col1);
    const row2 = Number(payload.row2);
    const col2 = Number(payload.col2);

    if (!this.isValidPosition(row1, col1) || !this.isValidPosition(row2, col2)) {
      return { success: false, error: 'Invalid grid position' };
    }

    if (row1 === row2 && col1 === col2) {
      return { success: false, error: 'Must select two different cards' };
    }

    const card1 = data.grid[row1][col1];
    const card2 = data.grid[row2][col2];

    if (!card1 || !card2) {
      return { success: false, error: 'One or both positions are empty' };
    }

    // Check adjacency (including diagonal)
    const rowDiff = Math.abs(row1 - row2);
    const colDiff = Math.abs(col1 - col2);
    if (rowDiff > 1 || colDiff > 1) {
      return { success: false, error: 'Cards must be adjacent (including diagonally)' };
    }

    // Check same rank
    if (card1.rank !== card2.rank) {
      return { success: false, error: 'Cards must have the same rank' };
    }

    // Remove the pair
    data.grid[row1][col1] = null;
    data.grid[row2][col2] = null;
    data.pairsRemoved++;
    data.score += 10;
    data.moves++;

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleCompact(data: MonteCarloState): ActionResult {
    // Collect all remaining cards in row-major order
    const cards: Card[] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (data.grid[row][col] !== null) {
          cards.push(data.grid[row][col]!);
        }
      }
    }

    // Refill from stock to get back to 25 cards (or as many as available)
    while (cards.length < 25 && data.stock.length > 0) {
      cards.push(data.stock.pop()!);
    }

    // Place back into grid
    let idx = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (idx < cards.length) {
          data.grid[row][col] = cards[idx++];
        } else {
          data.grid[row][col] = null;
        }
      }
    }

    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < 5 && col >= 0 && col < 5;
  }

  protected checkGameOver(): boolean {
    const data = this.getData<MonteCarloState>();

    // Win: all 26 pairs removed
    if (data.pairsRemoved >= 26) {
      data.won = true;
      data.gameOver = true;
      this.setData(data);
      return true;
    }

    if (data.gameOver) return true;

    // Check if any valid pair exists
    const hasValidPair = this.hasAdjacentPair(data);
    if (!hasValidPair && data.stock.length === 0) {
      // Check if compacting would create new pairs
      // If no stock and no pairs even after hypothetical compact, game over
      data.gameOver = true;
      this.setData(data);
      return true;
    }

    return false;
  }

  private hasAdjacentPair(data: MonteCarloState): boolean {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const card = data.grid[row][col];
        if (!card) continue;
        // Check all 8 neighbors
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = row + dr;
            const nc = col + dc;
            if (!this.isValidPosition(nr, nc)) continue;
            const neighbor = data.grid[nr][nc];
            if (neighbor && neighbor.rank === card.rank) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  protected determineWinner(): string | null {
    const data = this.getData<MonteCarloState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MonteCarloState>();
    return { [data.playerId]: data.score };
  }
}
