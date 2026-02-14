import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number;
  suit: Suit;
}

interface FreeCellState {
  [key: string]: unknown;
  tableau: Card[][]; // 8 columns
  freeCells: (Card | null)[]; // 4 free cells
  foundations: Card[][]; // 4 foundation piles (indexed by suit)
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
 * FreeCell Solitaire: All 52 cards are dealt face up into 8 columns.
 *
 * 4 free cells serve as temporary storage (one card each).
 * 4 foundations built up by suit from Ace to King.
 * Tableau built descending in alternating colors.
 * Only the top card of each column can be moved individually,
 * but sequences can be moved if enough free cells/empty columns allow it.
 *
 * Actions: move, auto_complete
 */
export class FreeCellGame extends BaseGame {
  readonly name = 'FreeCell';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): FreeCellState {
    const seed = Date.now();
    const deck = shuffle(createDeck(), seed);

    const tableau: Card[][] = Array.from({ length: 8 }, () => []);
    for (let i = 0; i < 52; i++) {
      tableau[i % 8].push(deck[i]);
    }

    return {
      tableau,
      freeCells: [null, null, null, null],
      foundations: [[], [], [], []],
      moves: 0,
      score: 0,
      gameOver: false,
      won: false,
      playerId: playerIds[0],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<FreeCellState>();
    if (playerId !== data.playerId) {
      return { success: false, error: 'Not your game' };
    }

    switch (action.type) {
      case 'move':
        return this.handleMove(data, action.payload);
      case 'auto_complete':
        return this.handleAutoComplete(data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handleMove(data: FreeCellState, payload: Record<string, unknown>): ActionResult {
    const from = payload.from as string; // 'tableau:N', 'freecell:N'
    const to = payload.to as string; // 'tableau:N', 'freecell:N', 'foundation:N'
    const count = Number(payload.count ?? 1);

    // Get source card(s)
    const sourceCard = this.getTopCard(data, from);
    if (!sourceCard) {
      return { success: false, error: 'No card at source' };
    }

    // Moving to foundation
    if (to.startsWith('foundation:')) {
      const fIdx = Number(to.split(':')[1]);
      if (fIdx < 0 || fIdx > 3) return { success: false, error: 'Invalid foundation index' };
      if (count !== 1) return { success: false, error: 'Can only move one card to foundation' };

      const foundation = data.foundations[fIdx];
      if (foundation.length === 0) {
        if (sourceCard.rank !== 1) return { success: false, error: 'Only Aces start foundations' };
        if (suitIndex(sourceCard.suit) !== fIdx)
          return { success: false, error: 'Wrong foundation for this suit' };
      } else {
        const top = foundation[foundation.length - 1];
        if (sourceCard.suit !== top.suit) return { success: false, error: 'Must match suit' };
        if (sourceCard.rank !== top.rank + 1) return { success: false, error: 'Must be next rank' };
      }

      this.removeCard(data, from);
      foundation.push(sourceCard);
      data.score += 10;
    }
    // Moving to free cell
    else if (to.startsWith('freecell:')) {
      const fcIdx = Number(to.split(':')[1]);
      if (fcIdx < 0 || fcIdx > 3) return { success: false, error: 'Invalid free cell index' };
      if (data.freeCells[fcIdx] !== null) return { success: false, error: 'Free cell is occupied' };
      if (count !== 1) return { success: false, error: 'Can only move one card to free cell' };

      this.removeCard(data, from);
      data.freeCells[fcIdx] = sourceCard;
    }
    // Moving to tableau
    else if (to.startsWith('tableau:')) {
      const tIdx = Number(to.split(':')[1]);
      if (tIdx < 0 || tIdx > 7) return { success: false, error: 'Invalid tableau column' };

      if (from.startsWith('tableau:') && count > 1) {
        return this.handleMultiMove(data, from, to, count);
      }

      const targetPile = data.tableau[tIdx];
      if (targetPile.length > 0) {
        const topCard = targetPile[targetPile.length - 1];
        if (isRed(sourceCard.suit) === isRed(topCard.suit)) {
          return { success: false, error: 'Must alternate colors' };
        }
        if (sourceCard.rank !== topCard.rank - 1) {
          return { success: false, error: 'Must be one rank lower' };
        }
      }

      this.removeCard(data, from);
      targetPile.push(sourceCard);
    } else {
      return { success: false, error: 'Invalid destination' };
    }

    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleMultiMove(
    data: FreeCellState,
    from: string,
    to: string,
    count: number,
  ): ActionResult {
    const fromIdx = Number(from.split(':')[1]);
    const toIdx = Number(to.split(':')[1]);
    const sourcePile = data.tableau[fromIdx];
    const targetPile = data.tableau[toIdx];

    if (count > sourcePile.length) {
      return { success: false, error: 'Not enough cards in source' };
    }

    // Check that the sequence is valid (descending, alternating colors)
    const startIdx = sourcePile.length - count;
    const movingCards = sourcePile.slice(startIdx);
    for (let i = 1; i < movingCards.length; i++) {
      if (isRed(movingCards[i].suit) === isRed(movingCards[i - 1].suit)) {
        return { success: false, error: 'Sequence must alternate colors' };
      }
      if (movingCards[i].rank !== movingCards[i - 1].rank - 1) {
        return { success: false, error: 'Sequence must descend by one' };
      }
    }

    // Check max movable: (1 + free cells) * 2^(empty columns excluding source and target)
    const emptyFreeCells = data.freeCells.filter((c) => c === null).length;
    let emptyColumns = 0;
    for (let i = 0; i < 8; i++) {
      if (i !== fromIdx && i !== toIdx && data.tableau[i].length === 0) {
        emptyColumns++;
      }
    }
    const maxMovable = (1 + emptyFreeCells) * Math.pow(2, emptyColumns);
    if (count > maxMovable) {
      return { success: false, error: 'Not enough free cells/columns to move that many cards' };
    }

    // Validate target
    if (targetPile.length > 0) {
      const topCard = targetPile[targetPile.length - 1];
      if (isRed(movingCards[0].suit) === isRed(topCard.suit)) {
        return { success: false, error: 'Must alternate colors at destination' };
      }
      if (movingCards[0].rank !== topCard.rank - 1) {
        return { success: false, error: 'Must be one rank lower at destination' };
      }
    }

    sourcePile.splice(startIdx, count);
    targetPile.push(...movingCards);

    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleAutoComplete(data: FreeCellState): ActionResult {
    let moved = true;
    while (moved) {
      moved = false;
      // Try to move from tableau and free cells to foundations
      for (let col = 0; col < 8; col++) {
        const pile = data.tableau[col];
        if (pile.length === 0) continue;
        const card = pile[pile.length - 1];
        const fIdx = suitIndex(card.suit);
        const foundation = data.foundations[fIdx];
        const needed = foundation.length === 0 ? 1 : foundation[foundation.length - 1].rank + 1;
        if (card.rank === needed) {
          pile.pop();
          foundation.push(card);
          data.score += 10;
          data.moves++;
          moved = true;
        }
      }
      for (let fc = 0; fc < 4; fc++) {
        const card = data.freeCells[fc];
        if (!card) continue;
        const fIdx = suitIndex(card.suit);
        const foundation = data.foundations[fIdx];
        const needed = foundation.length === 0 ? 1 : foundation[foundation.length - 1].rank + 1;
        if (card.rank === needed) {
          data.freeCells[fc] = null;
          foundation.push(card);
          data.score += 10;
          data.moves++;
          moved = true;
        }
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private getTopCard(data: FreeCellState, location: string): Card | null {
    if (location.startsWith('tableau:')) {
      const idx = Number(location.split(':')[1]);
      const pile = data.tableau[idx];
      return pile.length > 0 ? pile[pile.length - 1] : null;
    }
    if (location.startsWith('freecell:')) {
      const idx = Number(location.split(':')[1]);
      return data.freeCells[idx] ?? null;
    }
    return null;
  }

  private removeCard(data: FreeCellState, location: string): void {
    if (location.startsWith('tableau:')) {
      const idx = Number(location.split(':')[1]);
      data.tableau[idx].pop();
    } else if (location.startsWith('freecell:')) {
      const idx = Number(location.split(':')[1]);
      data.freeCells[idx] = null;
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<FreeCellState>();
    if (data.foundations.every((f) => f.length === 13)) {
      data.won = true;
      data.gameOver = true;
      this.setData(data);
      return true;
    }
    return data.gameOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<FreeCellState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<FreeCellState>();
    return { [data.playerId]: data.score };
  }
}
