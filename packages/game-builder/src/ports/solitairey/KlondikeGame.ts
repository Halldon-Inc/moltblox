import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number; // 1 (Ace) through 13 (King)
  suit: Suit;
  faceUp: boolean;
}

interface KlondikeState {
  [key: string]: unknown;
  tableau: Card[][]; // 7 columns
  foundations: Card[][]; // 4 piles (hearts, diamonds, clubs, spades)
  stock: Card[];
  waste: Card[];
  moves: number;
  score: number;
  gameOver: boolean;
  won: boolean;
  playerId: string;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

function isRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

function suitIndex(suit: Suit): number {
  return SUITS.indexOf(suit);
}

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ rank, suit, faceUp: false });
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
 * Klondike Solitaire: The classic solitaire card game.
 *
 * 7 tableau columns with cascading face-down cards and one face-up card on top.
 * Draw from stock to waste. Build tableau descending in alternating colors.
 * Build foundations up by suit from Ace to King.
 *
 * Actions: draw, move, flip
 */
export class KlondikeGame extends BaseGame {
  readonly name = 'Klondike Solitaire';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): KlondikeState {
    const seed = Date.now();
    const deck = shuffle(createDeck(), seed);

    const tableau: Card[][] = [];
    let idx = 0;
    for (let col = 0; col < 7; col++) {
      const pile: Card[] = [];
      for (let row = 0; row <= col; row++) {
        const card = { ...deck[idx++] };
        card.faceUp = row === col;
        pile.push(card);
      }
      tableau.push(pile);
    }

    const stock = deck.slice(idx).map((c) => ({ ...c, faceUp: false }));
    const foundations: Card[][] = [[], [], [], []];

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
    const data = this.getData<KlondikeState>();

    if (playerId !== data.playerId) {
      return { success: false, error: 'Not your game' };
    }

    switch (action.type) {
      case 'draw':
        return this.handleDraw(data);
      case 'move':
        return this.handleMove(data, action.payload);
      case 'flip':
        return this.handleFlip(data, action.payload);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handleDraw(data: KlondikeState): ActionResult {
    if (data.stock.length === 0) {
      // Recycle waste back to stock
      if (data.waste.length === 0) {
        return { success: false, error: 'No cards to draw' };
      }
      data.stock = data.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      data.waste = [];
    } else {
      const card = data.stock.pop()!;
      card.faceUp = true;
      data.waste.push(card);
    }

    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleMove(data: KlondikeState, payload: Record<string, unknown>): ActionResult {
    const from = payload.from as string; // 'waste', 'tableau:N', 'foundation:N'
    const to = payload.to as string; // 'tableau:N', 'foundation:N'
    const count = Number(payload.count ?? 1);

    const sourceCards = this.getSourceCards(data, from, count);
    if (!sourceCards) {
      return { success: false, error: 'Invalid source' };
    }

    if (to.startsWith('foundation:')) {
      const fIdx = Number(to.split(':')[1]);
      if (fIdx < 0 || fIdx > 3) return { success: false, error: 'Invalid foundation index' };
      if (count !== 1) return { success: false, error: 'Can only move one card to foundation' };
      const card = sourceCards[0];
      const foundation = data.foundations[fIdx];

      if (foundation.length === 0) {
        if (card.rank !== 1) return { success: false, error: 'Only Aces can start a foundation' };
        if (suitIndex(card.suit) !== fIdx)
          return { success: false, error: 'Wrong foundation for this suit' };
      } else {
        const top = foundation[foundation.length - 1];
        if (card.suit !== top.suit) return { success: false, error: 'Must match foundation suit' };
        if (card.rank !== top.rank + 1) return { success: false, error: 'Must be next rank up' };
      }

      this.removeSourceCards(data, from, count);
      foundation.push(card);
      data.score += 10;
    } else if (to.startsWith('tableau:')) {
      const tIdx = Number(to.split(':')[1]);
      if (tIdx < 0 || tIdx > 6) return { success: false, error: 'Invalid tableau index' };
      const targetPile = data.tableau[tIdx];
      const bottomCard = sourceCards[0];

      if (targetPile.length === 0) {
        if (bottomCard.rank !== 13)
          return { success: false, error: 'Only Kings can go on empty tableau' };
      } else {
        const topCard = targetPile[targetPile.length - 1];
        if (!topCard.faceUp) return { success: false, error: 'Target card is face down' };
        if (isRed(bottomCard.suit) === isRed(topCard.suit))
          return { success: false, error: 'Must alternate colors' };
        if (bottomCard.rank !== topCard.rank - 1)
          return { success: false, error: 'Must be one rank lower' };
      }

      this.removeSourceCards(data, from, count);
      targetPile.push(...sourceCards);
      data.score += 5;
    } else {
      return { success: false, error: 'Invalid destination' };
    }

    data.moves++;
    this.checkAutoFlip(data);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleFlip(data: KlondikeState, payload: Record<string, unknown>): ActionResult {
    const col = Number(payload.column);
    if (col < 0 || col > 6) return { success: false, error: 'Invalid column' };
    const pile = data.tableau[col];
    if (pile.length === 0) return { success: false, error: 'Column is empty' };
    const topCard = pile[pile.length - 1];
    if (topCard.faceUp) return { success: false, error: 'Card is already face up' };
    topCard.faceUp = true;
    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private getSourceCards(data: KlondikeState, from: string, count: number): Card[] | null {
    if (from === 'waste') {
      if (data.waste.length === 0 || count !== 1) return null;
      return [data.waste[data.waste.length - 1]];
    }
    if (from.startsWith('tableau:')) {
      const tIdx = Number(from.split(':')[1]);
      if (tIdx < 0 || tIdx > 6) return null;
      const pile = data.tableau[tIdx];
      if (count > pile.length || count < 1) return null;
      const startIdx = pile.length - count;
      const cards = pile.slice(startIdx);
      if (!cards.every((c) => c.faceUp)) return null;
      return cards;
    }
    if (from.startsWith('foundation:')) {
      const fIdx = Number(from.split(':')[1]);
      if (fIdx < 0 || fIdx > 3) return null;
      const foundation = data.foundations[fIdx];
      if (foundation.length === 0 || count !== 1) return null;
      return [foundation[foundation.length - 1]];
    }
    return null;
  }

  private removeSourceCards(data: KlondikeState, from: string, count: number): void {
    if (from === 'waste') {
      data.waste.pop();
    } else if (from.startsWith('tableau:')) {
      const tIdx = Number(from.split(':')[1]);
      data.tableau[tIdx].splice(data.tableau[tIdx].length - count, count);
    } else if (from.startsWith('foundation:')) {
      const fIdx = Number(from.split(':')[1]);
      data.foundations[fIdx].pop();
    }
  }

  private checkAutoFlip(data: KlondikeState): void {
    for (const pile of data.tableau) {
      if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
        pile[pile.length - 1].faceUp = true;
      }
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<KlondikeState>();
    if (data.foundations.every((f) => f.length === 13)) {
      data.won = true;
      data.gameOver = true;
      this.setData(data);
      return true;
    }
    return data.gameOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<KlondikeState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<KlondikeState>();
    return { [data.playerId]: data.score };
  }
}
