import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number;
  suit: Suit;
}

interface BakersDozenState {
  [key: string]: unknown;
  tableau: Card[][]; // 13 columns of 4 cards each
  foundations: Card[][]; // 4 foundation piles
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
 * Baker's Dozen Solitaire: 13 columns of 4 cards, all face up.
 *
 * Kings are always moved to the bottom of their column during setup
 * (they are "buried"). Only the top card of each column is playable.
 * Build foundations up by suit from Ace to King.
 * Tableau builds descending regardless of suit.
 * No stock, no waste, no free cells.
 *
 * Actions: move
 */
export class BakersDozenGame extends BaseGame {
  readonly name = "Baker's Dozen";
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): BakersDozenState {
    const seed = Date.now();
    const deck = shuffle(createDeck(), seed);

    // Deal into 13 columns of 4
    const tableau: Card[][] = [];
    let idx = 0;
    for (let col = 0; col < 13; col++) {
      const pile: Card[] = [];
      for (let row = 0; row < 4; row++) {
        pile.push({ ...deck[idx++] });
      }
      tableau.push(pile);
    }

    // Bury Kings: move any King to the bottom of its column
    for (let col = 0; col < 13; col++) {
      let moved = true;
      while (moved) {
        moved = false;
        for (let i = tableau[col].length - 1; i > 0; i--) {
          if (tableau[col][i].rank === 13) {
            // Move King to position 0 by shifting
            const king = tableau[col].splice(i, 1)[0];
            tableau[col].unshift(king);
            moved = true;
            break;
          }
        }
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
    const data = this.getData<BakersDozenState>();
    if (playerId !== data.playerId) {
      return { success: false, error: 'Not your game' };
    }

    if (action.type !== 'move') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    return this.handleMove(data, action.payload);
  }

  private handleMove(data: BakersDozenState, payload: Record<string, unknown>): ActionResult {
    const from = payload.from as string; // 'tableau:N'
    const to = payload.to as string; // 'tableau:N' or 'foundation:N'

    if (!from.startsWith('tableau:')) {
      return { success: false, error: 'Can only move from tableau' };
    }

    const fromCol = Number(from.split(':')[1]);
    if (fromCol < 0 || fromCol > 12) return { success: false, error: 'Invalid source column' };

    const sourcePile = data.tableau[fromCol];
    if (sourcePile.length === 0) return { success: false, error: 'Source column is empty' };

    const card = sourcePile[sourcePile.length - 1];

    if (to.startsWith('foundation:')) {
      const fIdx = Number(to.split(':')[1]);
      if (fIdx < 0 || fIdx > 3) return { success: false, error: 'Invalid foundation index' };

      const foundation = data.foundations[fIdx];
      if (foundation.length === 0) {
        if (card.rank !== 1) return { success: false, error: 'Only Aces start foundations' };
        if (suitIndex(card.suit) !== fIdx) return { success: false, error: 'Wrong foundation' };
      } else {
        const top = foundation[foundation.length - 1];
        if (card.suit !== top.suit) return { success: false, error: 'Must match suit' };
        if (card.rank !== top.rank + 1) return { success: false, error: 'Must be next rank up' };
      }

      sourcePile.pop();
      foundation.push(card);
      data.score += 10;
    } else if (to.startsWith('tableau:')) {
      const toCol = Number(to.split(':')[1]);
      if (toCol < 0 || toCol > 12 || toCol === fromCol) {
        return { success: false, error: 'Invalid destination column' };
      }

      const targetPile = data.tableau[toCol];
      if (targetPile.length === 0) {
        // Any card can go on an empty column (except some variants restrict to Kings,
        // but in Baker's Dozen, any card can fill an empty column)
      } else {
        const topCard = targetPile[targetPile.length - 1];
        // Build descending regardless of suit
        if (card.rank !== topCard.rank - 1) {
          return { success: false, error: 'Must be one rank lower' };
        }
      }

      sourcePile.pop();
      targetPile.push(card);
      data.score += 2;
    } else {
      return { success: false, error: 'Invalid destination' };
    }

    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<BakersDozenState>();
    if (data.foundations.every((f) => f.length === 13)) {
      data.won = true;
      data.gameOver = true;
      this.setData(data);
      return true;
    }
    return data.gameOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<BakersDozenState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<BakersDozenState>();
    return { [data.playerId]: data.score };
  }
}
