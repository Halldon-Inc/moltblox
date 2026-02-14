import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number;
  suit: Suit;
}

interface FortyThievesState {
  [key: string]: unknown;
  tableau: Card[][]; // 10 columns
  foundations: Card[][]; // 8 foundation piles (2 per suit)
  stock: Card[];
  waste: Card[];
  moves: number;
  score: number;
  gameOver: boolean;
  won: boolean;
  playerId: string;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

function suitIndex(suit: Suit): number {
  return SUITS.indexOf(suit);
}

function createDoubleDeck(): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < 2; d++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ rank, suit });
      }
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
 * Forty Thieves Solitaire: Uses two standard decks (104 cards).
 *
 * 10 tableau columns, each starting with 4 cards (all face up).
 * 8 foundation piles (2 per suit), built up by suit from Ace to King.
 * Tableau builds descending by same suit (stricter than alternating colors).
 * Only one card can be moved at a time in the tableau.
 * Draw one card at a time from stock to waste.
 *
 * Actions: move, draw
 */
export class FortyThievesGame extends BaseGame {
  readonly name = 'Forty Thieves';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): FortyThievesState {
    const seed = Date.now();
    const deck = shuffle(createDoubleDeck(), seed);

    // Deal 4 cards to each of 10 columns (40 cards total)
    const tableau: Card[][] = [];
    let idx = 0;
    for (let col = 0; col < 10; col++) {
      const pile: Card[] = [];
      for (let row = 0; row < 4; row++) {
        pile.push({ ...deck[idx++] });
      }
      tableau.push(pile);
    }

    // 8 foundation piles (2 per suit: foundations 0,4 = hearts; 1,5 = diamonds; etc.)
    const foundations: Card[][] = Array.from({ length: 8 }, () => []);
    const stock = deck.slice(idx);

    return {
      tableau,
      foundations,
      stock,
      waste: [],
      moves: 0,
      score: 0,
      gameOver: false,
      won: false,
      playerId: playerIds[0],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<FortyThievesState>();
    if (playerId !== data.playerId) {
      return { success: false, error: 'Not your game' };
    }

    switch (action.type) {
      case 'move':
        return this.handleMove(data, action.payload);
      case 'draw':
        return this.handleDraw(data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handleDraw(data: FortyThievesState): ActionResult {
    if (data.stock.length === 0) {
      return { success: false, error: 'Stock is empty' };
    }

    const card = data.stock.pop()!;
    data.waste.push(card);
    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleMove(data: FortyThievesState, payload: Record<string, unknown>): ActionResult {
    const from = payload.from as string; // 'tableau:N' or 'waste'
    const to = payload.to as string; // 'tableau:N' or 'foundation:N'

    // Get source card
    let sourceCard: Card | null = null;
    if (from === 'waste') {
      if (data.waste.length === 0) return { success: false, error: 'Waste is empty' };
      sourceCard = data.waste[data.waste.length - 1];
    } else if (from.startsWith('tableau:')) {
      const col = Number(from.split(':')[1]);
      if (col < 0 || col > 9) return { success: false, error: 'Invalid source column' };
      const pile = data.tableau[col];
      if (pile.length === 0) return { success: false, error: 'Source column is empty' };
      sourceCard = pile[pile.length - 1];
    } else {
      return { success: false, error: 'Invalid source' };
    }

    if (to.startsWith('foundation:')) {
      const fIdx = Number(to.split(':')[1]);
      if (fIdx < 0 || fIdx > 7) return { success: false, error: 'Invalid foundation index' };

      const foundation = data.foundations[fIdx];
      if (foundation.length === 0) {
        if (sourceCard.rank !== 1) return { success: false, error: 'Only Aces start foundations' };
        // Check suit matches: foundation 0,4 = hearts; 1,5 = diamonds; 2,6 = clubs; 3,7 = spades
        const expectedSuit = SUITS[fIdx % 4];
        if (sourceCard.suit !== expectedSuit)
          return { success: false, error: 'Wrong foundation for this suit' };
      } else {
        const top = foundation[foundation.length - 1];
        if (sourceCard.suit !== top.suit) return { success: false, error: 'Must match suit' };
        if (sourceCard.rank !== top.rank + 1)
          return { success: false, error: 'Must be next rank up' };
      }

      this.removeTopCard(data, from);
      foundation.push(sourceCard);
      data.score += 10;
    } else if (to.startsWith('tableau:')) {
      const toCol = Number(to.split(':')[1]);
      if (toCol < 0 || toCol > 9) return { success: false, error: 'Invalid destination column' };

      const targetPile = data.tableau[toCol];
      if (targetPile.length > 0) {
        const topCard = targetPile[targetPile.length - 1];
        // Build descending same suit
        if (sourceCard.suit !== topCard.suit) {
          return { success: false, error: 'Must match suit in tableau' };
        }
        if (sourceCard.rank !== topCard.rank - 1) {
          return { success: false, error: 'Must be one rank lower' };
        }
      }
      // Empty columns accept any card

      this.removeTopCard(data, from);
      targetPile.push(sourceCard);
      data.score += 2;
    } else {
      return { success: false, error: 'Invalid destination' };
    }

    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private removeTopCard(data: FortyThievesState, from: string): void {
    if (from === 'waste') {
      data.waste.pop();
    } else if (from.startsWith('tableau:')) {
      const col = Number(from.split(':')[1]);
      data.tableau[col].pop();
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<FortyThievesState>();
    if (data.foundations.every((f) => f.length === 13)) {
      data.won = true;
      data.gameOver = true;
      this.setData(data);
      return true;
    }
    return data.gameOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<FortyThievesState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<FortyThievesState>();
    return { [data.playerId]: data.score };
  }
}
