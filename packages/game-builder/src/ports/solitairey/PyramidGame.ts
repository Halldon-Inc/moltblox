import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number;
  suit: Suit;
}

interface PyramidCard {
  card: Card;
  removed: boolean;
  row: number;
  col: number;
}

interface PyramidState {
  [key: string]: unknown;
  pyramid: PyramidCard[]; // 28 cards in 7 rows (row 0 = 1 card, row 6 = 7 cards)
  stock: Card[];
  waste: Card[];
  recyclesLeft: number;
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
 * Pyramid Solitaire: 28 cards arranged in a 7-row pyramid.
 *
 * Remove pairs of exposed cards that sum to 13.
 * Kings (rank 13) are removed alone.
 * A card is exposed when both cards covering it (in the row below) have been removed.
 * Draw from stock to waste when needed.
 * Two recycles of waste back to stock allowed.
 *
 * Actions: pair, draw, recycle
 */
export class PyramidGame extends BaseGame {
  readonly name = 'Pyramid Solitaire';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private getCardIndex(row: number, col: number): number {
    // Row r has r+1 cards, starting at index r*(r+1)/2
    return (row * (row + 1)) / 2 + col;
  }

  private isExposed(pyramid: PyramidCard[], row: number, col: number): boolean {
    if (row === 6) return true; // Bottom row is always exposed
    // Covered by (row+1, col) and (row+1, col+1)
    const leftChild = this.getCardIndex(row + 1, col);
    const rightChild = this.getCardIndex(row + 1, col + 1);
    return pyramid[leftChild].removed && pyramid[rightChild].removed;
  }

  protected initializeState(playerIds: string[]): PyramidState {
    const seed = Date.now();
    const deck = shuffle(createDeck(), seed);

    const pyramid: PyramidCard[] = [];
    let idx = 0;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col <= row; col++) {
        pyramid.push({
          card: deck[idx++],
          removed: false,
          row,
          col,
        });
      }
    }

    const stock = deck.slice(28);

    return {
      pyramid,
      stock,
      waste: [],
      recyclesLeft: 2,
      moves: 0,
      score: 0,
      gameOver: false,
      won: false,
      playerId: playerIds[0],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PyramidState>();
    if (playerId !== data.playerId) {
      return { success: false, error: 'Not your game' };
    }

    switch (action.type) {
      case 'pair':
        return this.handlePair(data, action.payload);
      case 'draw':
        return this.handleDraw(data);
      case 'recycle':
        return this.handleRecycle(data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handlePair(data: PyramidState, payload: Record<string, unknown>): ActionResult {
    // Payload can reference pyramid positions and/or waste
    // card1: 'pyramid:row:col' or 'waste'
    // card2: 'pyramid:row:col' or 'waste' or omitted (for King removal)
    const card1Ref = payload.card1 as string;
    const card2Ref = payload.card2 as string | undefined;

    const card1Info = this.resolveCard(data, card1Ref);
    if (!card1Info) return { success: false, error: 'Invalid first card reference' };

    // King removal (rank 13, no pair needed)
    if (card1Info.card.rank === 13 && !card2Ref) {
      this.removeResolvedCard(data, card1Ref);
      data.score += 13;
      data.moves++;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (!card2Ref) {
      return { success: false, error: 'Must specify two cards (or a King alone)' };
    }

    const card2Info = this.resolveCard(data, card2Ref);
    if (!card2Info) return { success: false, error: 'Invalid second card reference' };

    if (card1Info.card.rank + card2Info.card.rank !== 13) {
      return { success: false, error: 'Cards must sum to 13' };
    }

    this.removeResolvedCard(data, card1Ref);
    this.removeResolvedCard(data, card2Ref);
    data.score += 13;
    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleDraw(data: PyramidState): ActionResult {
    if (data.stock.length === 0) {
      return { success: false, error: 'Stock is empty' };
    }

    const card = data.stock.pop()!;
    data.waste.push(card);
    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleRecycle(data: PyramidState): ActionResult {
    if (data.recyclesLeft <= 0) {
      return { success: false, error: 'No recycles remaining' };
    }
    if (data.waste.length === 0) {
      return { success: false, error: 'Waste is empty' };
    }

    data.stock = data.waste.reverse();
    data.waste = [];
    data.recyclesLeft--;
    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private resolveCard(data: PyramidState, ref: string): { card: Card; source: string } | null {
    if (ref === 'waste') {
      if (data.waste.length === 0) return null;
      return { card: data.waste[data.waste.length - 1], source: 'waste' };
    }
    if (ref.startsWith('pyramid:')) {
      const parts = ref.split(':');
      const row = Number(parts[1]);
      const col = Number(parts[2]);
      if (row < 0 || row > 6 || col < 0 || col > row) return null;
      const idx = this.getCardIndex(row, col);
      const pc = data.pyramid[idx];
      if (pc.removed) return null;
      if (!this.isExposed(data.pyramid, row, col)) return null;
      return { card: pc.card, source: ref };
    }
    return null;
  }

  private removeResolvedCard(data: PyramidState, ref: string): void {
    if (ref === 'waste') {
      data.waste.pop();
    } else if (ref.startsWith('pyramid:')) {
      const parts = ref.split(':');
      const row = Number(parts[1]);
      const col = Number(parts[2]);
      const idx = this.getCardIndex(row, col);
      data.pyramid[idx].removed = true;
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<PyramidState>();
    // Win: all pyramid cards removed
    if (data.pyramid.every((pc) => pc.removed)) {
      data.won = true;
      data.gameOver = true;
      this.setData(data);
      return true;
    }
    return data.gameOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<PyramidState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<PyramidState>();
    return { [data.playerId]: data.score };
  }
}
