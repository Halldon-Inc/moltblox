import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number;
  suit: Suit;
}

interface GolfState {
  [key: string]: unknown;
  tableau: Card[][]; // 7 columns of 5
  foundation: Card[]; // single discard/foundation pile
  stock: Card[];
  moves: number;
  score: number;
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
 * Golf Solitaire: 7 columns of 5 cards each (35 cards dealt).
 *
 * Only the top card of each column is playable.
 * Build the foundation pile up or down regardless of suit (wrapping allowed:
 * Ace connects to 2 and King).
 * Draw from stock when no plays are available.
 * Win by clearing all tableau columns.
 * Score is the number of cards remaining in the tableau (lower is better).
 *
 * Actions: play, draw
 */
export class GolfGame extends BaseGame {
  readonly name = 'Golf Solitaire';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): GolfState {
    const seed = Date.now();
    const deck = shuffle(createDeck(), seed);

    const tableau: Card[][] = [];
    let idx = 0;
    for (let col = 0; col < 7; col++) {
      const pile: Card[] = [];
      for (let row = 0; row < 5; row++) {
        pile.push(deck[idx++]);
      }
      tableau.push(pile);
    }

    // First stock card goes to foundation
    const foundation: Card[] = [deck[idx++]];
    const stock = deck.slice(idx);

    return {
      tableau,
      foundation,
      stock,
      moves: 0,
      score: 35, // start at 35 (number of tableau cards)
      gameOver: false,
      won: false,
      playerId: playerIds[0],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<GolfState>();
    if (playerId !== data.playerId) {
      return { success: false, error: 'Not your game' };
    }

    switch (action.type) {
      case 'play':
        return this.handlePlay(data, action.payload);
      case 'draw':
        return this.handleDraw(data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private isAdjacent(rank1: number, rank2: number): boolean {
    // Ranks are adjacent if they differ by 1, with wrapping (K-A)
    const diff = Math.abs(rank1 - rank2);
    return diff === 1 || diff === 12;
  }

  private handlePlay(data: GolfState, payload: Record<string, unknown>): ActionResult {
    const col = Number(payload.column);
    if (col < 0 || col > 6) return { success: false, error: 'Invalid column' };

    const pile = data.tableau[col];
    if (pile.length === 0) return { success: false, error: 'Column is empty' };

    const card = pile[pile.length - 1];
    const foundationTop = data.foundation[data.foundation.length - 1];

    if (!this.isAdjacent(card.rank, foundationTop.rank)) {
      return { success: false, error: 'Card must be one rank higher or lower than foundation top' };
    }

    pile.pop();
    data.foundation.push(card);
    data.score--;
    data.moves++;

    // Check if all tableau columns are empty
    if (data.tableau.every((p) => p.length === 0)) {
      data.won = true;
      data.gameOver = true;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleDraw(data: GolfState): ActionResult {
    if (data.stock.length === 0) {
      // No more draws, check if game is stuck
      data.gameOver = true;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    const card = data.stock.pop()!;
    data.foundation.push(card);
    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<GolfState>();
    if (data.won || data.gameOver) return true;

    // Check if stuck: no stock and no playable tableau cards
    if (data.stock.length === 0) {
      const foundationTop = data.foundation[data.foundation.length - 1];
      const hasPlay = data.tableau.some((pile) => {
        if (pile.length === 0) return false;
        return this.isAdjacentRank(pile[pile.length - 1].rank, foundationTop.rank);
      });
      if (!hasPlay) {
        data.gameOver = true;
        this.setData(data);
        return true;
      }
    }
    return false;
  }

  private isAdjacentRank(rank1: number, rank2: number): boolean {
    const diff = Math.abs(rank1 - rank2);
    return diff === 1 || diff === 12;
  }

  protected determineWinner(): string | null {
    const data = this.getData<GolfState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<GolfState>();
    // In Golf, lower score (remaining cards) is better.
    // We invert for scoring: more cleared = higher score.
    const remaining = data.tableau.reduce((sum, pile) => sum + pile.length, 0);
    return { [data.playerId]: 35 - remaining };
  }
}
