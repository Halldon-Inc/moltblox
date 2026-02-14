import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number;
  suit: Suit;
  faceUp: boolean;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ rank, suit, faceUp: false });
    }
  }
  return deck;
}

function shuffle(deck: Card[]): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Osmosis Solitaire:
 * 4 reserve piles of 4 cards each (only top face up).
 * 4 foundation piles. First foundation gets 1 starter card.
 * Remaining cards form the stock.
 *
 * Foundation 1: any card of its suit can be placed.
 * Foundations 2-4: a card can only be placed if the same rank is already
 * on the foundation row above it.
 *
 * Draw from stock to waste. Use waste or reserve tops to build foundations.
 */

interface OsmosisState {
  [key: string]: unknown;
  reserves: Card[][]; // 4 reserve piles
  foundations: Card[][]; // 4 foundation rows
  foundationSuits: (Suit | null)[]; // suit for each foundation
  stock: Card[];
  waste: Card[];
  moves: number;
  score: number;
  gameOver: boolean;
  won: boolean;
  playerId: string;
}

export class OsmosisGame extends BaseGame {
  readonly name = 'Osmosis Solitaire';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): OsmosisState {
    const deck = shuffle(createDeck());
    let idx = 0;

    // 4 reserve piles of 4 cards each, only top face up
    const reserves: Card[][] = [];
    for (let i = 0; i < 4; i++) {
      const pile: Card[] = [];
      for (let j = 0; j < 4; j++) {
        const card = { ...deck[idx++] };
        card.faceUp = j === 3; // only top card face up
        pile.push(card);
      }
      reserves.push(pile);
    }

    // First foundation card
    const starterCard = { ...deck[idx++], faceUp: true };
    const foundations: Card[][] = [[starterCard], [], [], []];
    const foundationSuits: (Suit | null)[] = [starterCard.suit, null, null, null];

    const stock = deck.slice(idx).map((c) => ({ ...c, faceUp: false }));

    return {
      reserves,
      foundations,
      foundationSuits,
      stock,
      waste: [],
      moves: 0,
      score: 0,
      gameOver: false,
      won: false,
      playerId: playerIds[0],
    };
  }

  private canPlaceOnFoundation(card: Card, fIdx: number, data: OsmosisState): boolean {
    const fnd = data.foundations[fIdx];

    // Check if this foundation already has a different suit
    if (data.foundationSuits[fIdx] !== null && data.foundationSuits[fIdx] !== card.suit) {
      return false;
    }

    // Check if rank already exists in this foundation
    if (fnd.some((c) => c.rank === card.rank)) return false;

    // First foundation: any card of its suit
    if (fIdx === 0) {
      return card.suit === data.foundationSuits[0];
    }

    // Foundation hasn't started yet: the rank must exist in the row above
    if (fnd.length === 0) {
      const above = data.foundations[fIdx - 1];
      return above.some((c) => c.rank === card.rank);
    }

    // Foundation has cards: must match suit AND rank must be on row above
    if (card.suit !== data.foundationSuits[fIdx]) return false;
    const above = data.foundations[fIdx - 1];
    return above.some((c) => c.rank === card.rank);
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<OsmosisState>();
    if (playerId !== data.playerId) return { success: false, error: 'Not your game' };

    if (action.type === 'draw') {
      if (data.stock.length === 0) {
        // Recycle waste
        if (data.waste.length === 0) return { success: false, error: 'No cards' };
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

    if (action.type === 'move') {
      const from = action.payload.from as string;
      const to = action.payload.to as string;

      let card: Card | undefined;
      let sourceRemove: () => void;

      if (from === 'waste') {
        if (data.waste.length === 0) return { success: false, error: 'Waste empty' };
        card = data.waste[data.waste.length - 1];
        sourceRemove = () => {
          data.waste.pop();
        };
      } else if (from.startsWith('reserve:')) {
        const rIdx = Number(from.split(':')[1]);
        if (rIdx < 0 || rIdx >= 4) return { success: false, error: 'Invalid reserve' };
        const pile = data.reserves[rIdx];
        if (pile.length === 0) return { success: false, error: 'Reserve empty' };
        card = pile[pile.length - 1];
        sourceRemove = () => {
          pile.pop();
          if (pile.length > 0) pile[pile.length - 1].faceUp = true;
        };
      } else {
        return { success: false, error: 'Invalid source' };
      }

      if (!card) return { success: false, error: 'No card' };

      if (!to.startsWith('foundation:')) {
        return { success: false, error: 'Can only move to foundations' };
      }

      const fIdx = Number(to.split(':')[1]);
      if (fIdx < 0 || fIdx >= 4) return { success: false, error: 'Invalid foundation' };

      if (!this.canPlaceOnFoundation(card, fIdx, data)) {
        return { success: false, error: 'Cannot place on this foundation' };
      }

      sourceRemove();
      const fnd = data.foundations[fIdx];
      fnd.push({ ...card, faceUp: true });

      if (fnd.length === 1) {
        data.foundationSuits[fIdx] = card.suit;
      }

      data.score += 10;
      data.moves++;

      // Check win: all foundations have 13 cards
      if (data.foundations.every((f) => f.length === 13)) {
        data.won = true;
        data.gameOver = true;
        data.score += 500;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  protected checkGameOver(): boolean {
    return this.getData<OsmosisState>().gameOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<OsmosisState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<OsmosisState>();
    return { [data.playerId]: data.score };
  }
}
