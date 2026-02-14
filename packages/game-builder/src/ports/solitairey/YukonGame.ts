import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number;
  suit: Suit;
  faceUp: boolean;
}

interface YukonState {
  [key: string]: unknown;
  tableau: Card[][]; // 7 columns
  foundations: Card[][]; // 4 foundation piles
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
 * Yukon Solitaire: Similar to Klondike but with no stock pile.
 *
 * All 52 cards are dealt to 7 tableau columns.
 * Column 1 gets 1 card (face up). Columns 2-7 get the standard Klondike
 * cascade PLUS 4 extra face-up cards each.
 * Key difference from Klondike: any group of face-up cards can be moved
 * together regardless of sequence. Only the card being placed on the
 * destination must follow alternating color, descending rank rules.
 * Build foundations up by suit from Ace to King.
 *
 * Actions: move, flip
 */
export class YukonGame extends BaseGame {
  readonly name = 'Yukon Solitaire';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): YukonState {
    const seed = Date.now();
    const deck = shuffle(createDeck(), seed);

    const tableau: Card[][] = Array.from({ length: 7 }, () => []);
    let idx = 0;

    // Deal like Klondike first: column i gets i+1 cards, top face up
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = { ...deck[idx++] };
        card.faceUp = row === col;
        tableau[col].push(card);
      }
    }

    // Deal remaining 24 cards: 4 face-up cards to each of columns 1-6
    for (let col = 1; col < 7; col++) {
      for (let extra = 0; extra < 4; extra++) {
        const card = { ...deck[idx++] };
        card.faceUp = true;
        tableau[col].push(card);
      }
    }

    const foundations: Card[][] = [[], [], [], []];

    return {
      tableau,
      foundations,
      moves: 0,
      score: 0,
      gameOver: false,
      won: false,
      playerId: playerIds[0],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<YukonState>();
    if (playerId !== data.playerId) {
      return { success: false, error: 'Not your game' };
    }

    switch (action.type) {
      case 'move':
        return this.handleMove(data, action.payload);
      case 'flip':
        return this.handleFlip(data, action.payload);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handleMove(data: YukonState, payload: Record<string, unknown>): ActionResult {
    const from = payload.from as string;
    const to = payload.to as string;
    const cardIndex = payload.cardIndex != null ? Number(payload.cardIndex) : undefined;

    if (to.startsWith('foundation:')) {
      const fIdx = Number(to.split(':')[1]);
      if (fIdx < 0 || fIdx > 3) return { success: false, error: 'Invalid foundation index' };

      // Can only move top card of tableau to foundation
      if (!from.startsWith('tableau:')) {
        return { success: false, error: 'Can only move from tableau to foundation' };
      }
      const fromCol = Number(from.split(':')[1]);
      if (fromCol < 0 || fromCol > 6) return { success: false, error: 'Invalid source column' };

      const pile = data.tableau[fromCol];
      if (pile.length === 0) return { success: false, error: 'Source column is empty' };

      const card = pile[pile.length - 1];
      if (!card.faceUp) return { success: false, error: 'Card is face down' };

      const foundation = data.foundations[fIdx];
      if (foundation.length === 0) {
        if (card.rank !== 1) return { success: false, error: 'Only Aces start foundations' };
        if (suitIndex(card.suit) !== fIdx)
          return { success: false, error: 'Wrong foundation for this suit' };
      } else {
        const top = foundation[foundation.length - 1];
        if (card.suit !== top.suit) return { success: false, error: 'Must match suit' };
        if (card.rank !== top.rank + 1) return { success: false, error: 'Must be next rank up' };
      }

      pile.pop();
      foundation.push(card);
      data.score += 15;
    } else if (to.startsWith('tableau:')) {
      const toCol = Number(to.split(':')[1]);
      if (toCol < 0 || toCol > 6) return { success: false, error: 'Invalid destination column' };

      if (!from.startsWith('tableau:')) {
        return { success: false, error: 'Can only move from tableau' };
      }
      const fromCol = Number(from.split(':')[1]);
      if (fromCol < 0 || fromCol > 6 || fromCol === toCol) {
        return { success: false, error: 'Invalid source column' };
      }

      const sourcePile = data.tableau[fromCol];
      // Determine which card in the source pile is the start of the move
      let startIdx: number;
      if (cardIndex !== undefined) {
        startIdx = cardIndex;
      } else {
        // Default: move just the top card
        startIdx = sourcePile.length - 1;
      }

      if (startIdx < 0 || startIdx >= sourcePile.length) {
        return { success: false, error: 'Invalid card index' };
      }

      const movingCard = sourcePile[startIdx];
      if (!movingCard.faceUp) {
        return { success: false, error: 'Cannot move face-down card' };
      }

      const targetPile = data.tableau[toCol];
      if (targetPile.length === 0) {
        if (movingCard.rank !== 13) {
          return { success: false, error: 'Only Kings can go on empty columns' };
        }
      } else {
        const topCard = targetPile[targetPile.length - 1];
        if (!topCard.faceUp) return { success: false, error: 'Target card is face down' };
        if (isRed(movingCard.suit) === isRed(topCard.suit)) {
          return { success: false, error: 'Must alternate colors' };
        }
        if (movingCard.rank !== topCard.rank - 1) {
          return { success: false, error: 'Must be one rank lower' };
        }
      }

      // Move the group of cards
      const movingCards = sourcePile.splice(startIdx);
      targetPile.push(...movingCards);
      data.score += 5;
    } else {
      return { success: false, error: 'Invalid destination' };
    }

    data.moves++;
    this.autoFlipTopCards(data);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleFlip(data: YukonState, payload: Record<string, unknown>): ActionResult {
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

  private autoFlipTopCards(data: YukonState): void {
    for (const pile of data.tableau) {
      if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
        pile[pile.length - 1].faceUp = true;
      }
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<YukonState>();
    if (data.foundations.every((f) => f.length === 13)) {
      data.won = true;
      data.gameOver = true;
      this.setData(data);
      return true;
    }
    return data.gameOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<YukonState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<YukonState>();
    return { [data.playerId]: data.score };
  }
}
