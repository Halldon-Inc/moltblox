import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number;
  suit: Suit;
  faceUp: boolean;
}

interface CanfieldState {
  [key: string]: unknown;
  tableau: Card[][]; // 4 columns
  foundations: Card[][]; // 4 foundation piles
  foundationBaseRank: number; // the rank that starts all foundations
  reserve: Card[]; // 13-card reserve pile (only top is playable)
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

function nextRank(rank: number): number {
  return rank === 13 ? 1 : rank + 1;
}

/**
 * Canfield Solitaire: A challenging solitaire variant.
 *
 * 13-card reserve pile (only top card is available).
 * 4 tableau columns, each starting with 1 card.
 * The first card dealt to the foundation determines the base rank for all foundations.
 * Foundations build up by suit, wrapping from King back to Ace.
 * Tableau builds descending in alternating colors, also wrapping.
 * Stock is dealt 3 cards at a time to waste.
 *
 * Actions: move, draw, flip
 */
export class CanfieldGame extends BaseGame {
  readonly name = 'Canfield Solitaire';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): CanfieldState {
    const seed = Date.now();
    const deck = shuffle(createDeck(), seed);
    let idx = 0;

    // Reserve: 13 cards, only top face up
    const reserve: Card[] = [];
    for (let i = 0; i < 13; i++) {
      const card = { ...deck[idx++] };
      card.faceUp = i === 12; // only the top (last) card is face up
      reserve.push(card);
    }

    // Foundation base card
    const baseCard = { ...deck[idx++], faceUp: true };
    const foundationBaseRank = baseCard.rank;
    const baseSuitIdx = suitIndex(baseCard.suit);
    const foundations: Card[][] = [[], [], [], []];
    foundations[baseSuitIdx].push(baseCard);

    // Tableau: 4 columns, 1 card each, face up
    const tableau: Card[][] = [];
    for (let col = 0; col < 4; col++) {
      const card = { ...deck[idx++], faceUp: true };
      tableau.push([card]);
    }

    // Stock: remaining cards
    const stock = deck.slice(idx).map((c) => ({ ...c, faceUp: false }));

    return {
      tableau,
      foundations,
      foundationBaseRank,
      reserve,
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
    const data = this.getData<CanfieldState>();
    if (playerId !== data.playerId) {
      return { success: false, error: 'Not your game' };
    }

    switch (action.type) {
      case 'move':
        return this.handleMove(data, action.payload);
      case 'draw':
        return this.handleDraw(data);
      case 'flip':
        return this.handleFlip(data, action.payload);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handleDraw(data: CanfieldState): ActionResult {
    if (data.stock.length === 0) {
      // Recycle waste
      if (data.waste.length === 0) {
        return { success: false, error: 'No cards to draw' };
      }
      data.stock = data.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      data.waste = [];
    } else {
      // Draw 3 cards (or fewer if stock is small)
      const drawCount = Math.min(3, data.stock.length);
      for (let i = 0; i < drawCount; i++) {
        const card = data.stock.pop()!;
        card.faceUp = true;
        data.waste.push(card);
      }
    }

    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleFlip(data: CanfieldState, payload: Record<string, unknown>): ActionResult {
    const col = Number(payload.column);
    if (col < 0 || col > 3) return { success: false, error: 'Invalid column' };

    const pile = data.tableau[col];
    if (pile.length === 0) return { success: false, error: 'Column is empty' };

    const topCard = pile[pile.length - 1];
    if (topCard.faceUp) return { success: false, error: 'Card is already face up' };

    topCard.faceUp = true;
    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleMove(data: CanfieldState, payload: Record<string, unknown>): ActionResult {
    const from = payload.from as string; // 'waste', 'reserve', 'tableau:N'
    const to = payload.to as string; // 'foundation:N', 'tableau:N'
    const count = Number(payload.count ?? 1);

    const sourceCard = this.getTopPlayableCard(data, from);
    if (!sourceCard) return { success: false, error: 'No playable card at source' };

    if (to.startsWith('foundation:')) {
      const fIdx = Number(to.split(':')[1]);
      if (fIdx < 0 || fIdx > 3) return { success: false, error: 'Invalid foundation' };
      if (count !== 1) return { success: false, error: 'Move one card at a time to foundation' };

      const foundation = data.foundations[fIdx];
      if (foundation.length === 0) {
        if (sourceCard.rank !== data.foundationBaseRank) {
          return {
            success: false,
            error: `Foundation must start with rank ${data.foundationBaseRank}`,
          };
        }
        if (suitIndex(sourceCard.suit) !== fIdx) {
          return { success: false, error: 'Wrong foundation for this suit' };
        }
      } else {
        const top = foundation[foundation.length - 1];
        if (sourceCard.suit !== top.suit) return { success: false, error: 'Must match suit' };
        if (sourceCard.rank !== nextRank(top.rank)) {
          return { success: false, error: 'Must be next rank (wrapping K to A)' };
        }
      }

      this.removeTopCard(data, from);
      foundation.push(sourceCard);
      data.score += 10;
    } else if (to.startsWith('tableau:')) {
      const tIdx = Number(to.split(':')[1]);
      if (tIdx < 0 || tIdx > 3) return { success: false, error: 'Invalid tableau column' };

      if (from.startsWith('tableau:') && count > 1) {
        return this.handleMultiTableauMove(data, from, to, count);
      }

      const targetPile = data.tableau[tIdx];
      if (targetPile.length === 0) {
        // Empty column: fill from reserve first
        if (data.reserve.length > 0) {
          // Automatically fill from reserve when column empties
        }
        // Any card can go on an empty column
      } else {
        const topCard = targetPile[targetPile.length - 1];
        if (!topCard.faceUp) return { success: false, error: 'Target card is face down' };
        if (isRed(sourceCard.suit) === isRed(topCard.suit)) {
          return { success: false, error: 'Must alternate colors' };
        }
        const expectedRank = topCard.rank === 1 ? 13 : topCard.rank - 1;
        if (sourceCard.rank !== expectedRank) {
          return { success: false, error: 'Must be one rank lower (wrapping)' };
        }
      }

      this.removeTopCard(data, from);
      targetPile.push(sourceCard);
    } else {
      return { success: false, error: 'Invalid destination' };
    }

    data.moves++;

    // If any tableau column is empty and reserve has cards, auto-fill
    this.fillEmptyTableauFromReserve(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleMultiTableauMove(
    data: CanfieldState,
    from: string,
    to: string,
    count: number,
  ): ActionResult {
    const fromCol = Number(from.split(':')[1]);
    const toCol = Number(to.split(':')[1]);

    const sourcePile = data.tableau[fromCol];
    if (count > sourcePile.length) return { success: false, error: 'Not enough cards' };

    const startIdx = sourcePile.length - count;
    const movingCards = sourcePile.slice(startIdx);

    // Validate sequence: alternating colors, descending (with wrapping)
    for (let i = 1; i < movingCards.length; i++) {
      if (!movingCards[i].faceUp || !movingCards[i - 1].faceUp) {
        return { success: false, error: 'Cannot move face-down cards' };
      }
      if (isRed(movingCards[i].suit) === isRed(movingCards[i - 1].suit)) {
        return { success: false, error: 'Sequence must alternate colors' };
      }
    }

    const targetPile = data.tableau[toCol];
    if (targetPile.length > 0) {
      const topCard = targetPile[targetPile.length - 1];
      if (!topCard.faceUp) return { success: false, error: 'Target card is face down' };
      if (isRed(movingCards[0].suit) === isRed(topCard.suit)) {
        return { success: false, error: 'Must alternate colors' };
      }
      const expectedRank = topCard.rank === 1 ? 13 : topCard.rank - 1;
      if (movingCards[0].rank !== expectedRank) {
        return { success: false, error: 'Must be one rank lower' };
      }
    }

    sourcePile.splice(startIdx, count);
    targetPile.push(...movingCards);
    data.moves++;

    this.fillEmptyTableauFromReserve(data);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private getTopPlayableCard(data: CanfieldState, from: string): Card | null {
    if (from === 'waste') {
      return data.waste.length > 0 ? data.waste[data.waste.length - 1] : null;
    }
    if (from === 'reserve') {
      return data.reserve.length > 0 ? data.reserve[data.reserve.length - 1] : null;
    }
    if (from.startsWith('tableau:')) {
      const col = Number(from.split(':')[1]);
      const pile = data.tableau[col];
      if (pile.length === 0) return null;
      const card = pile[pile.length - 1];
      return card.faceUp ? card : null;
    }
    return null;
  }

  private removeTopCard(data: CanfieldState, from: string): void {
    if (from === 'waste') {
      data.waste.pop();
    } else if (from === 'reserve') {
      data.reserve.pop();
      // Expose new top of reserve
      if (data.reserve.length > 0) {
        data.reserve[data.reserve.length - 1].faceUp = true;
      }
    } else if (from.startsWith('tableau:')) {
      const col = Number(from.split(':')[1]);
      data.tableau[col].pop();
    }
  }

  private fillEmptyTableauFromReserve(data: CanfieldState): void {
    for (let col = 0; col < 4; col++) {
      if (data.tableau[col].length === 0 && data.reserve.length > 0) {
        const card = data.reserve.pop()!;
        card.faceUp = true;
        data.tableau[col].push(card);
        // Expose new top of reserve
        if (data.reserve.length > 0) {
          data.reserve[data.reserve.length - 1].faceUp = true;
        }
      }
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<CanfieldState>();
    if (data.foundations.every((f) => f.length === 13)) {
      data.won = true;
      data.gameOver = true;
      this.setData(data);
      return true;
    }
    return data.gameOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<CanfieldState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<CanfieldState>();
    return { [data.playerId]: data.score };
  }
}
