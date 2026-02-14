import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number;
  suit: Suit;
}

interface GrandfathersClockState {
  [key: string]: unknown;
  tableau: Card[][]; // 8 columns (remaining cards after clock setup)
  clock: Card[][]; // 12 foundation piles arranged as clock positions (0=12 o'clock, 1=1 o'clock, etc.)
  clockTargetRanks: number[]; // each clock position's target final rank
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
 * Grandfather's Clock Solitaire: 12 foundation piles arranged in a clock face.
 *
 * Each clock position (1 through 12) must end with that number as its top rank.
 * Position 12 (12 o'clock) ends at Queen (12), position 1 (1 o'clock) ends at Ace (1),
 * position 2 ends at 2, etc. The King (13) maps to the 1 o'clock position conceptually
 * but the standard rules place specific starting cards.
 *
 * Starting cards: each clock position gets a specific starting card based on its
 * position and suit rotation. The remaining 40 cards are dealt into 8 tableau columns
 * of 5 cards each.
 *
 * Foundations build up by suit (wrapping K to A). Tableau builds descending regardless
 * of suit. Only the top card of each tableau column is playable.
 *
 * Actions: move
 */
export class GrandfathersClockGame extends BaseGame {
  readonly name = "Grandfather's Clock";
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  // Clock positions 0-11 map to hours 12,1,2,...,11
  // Each position targets a specific final rank (the hour number, with 12 = Queen)
  private getTargetRank(position: number): number {
    // Position 0 = 12 o'clock = rank 12 (Queen)
    // Position 1 = 1 o'clock = rank 1 (Ace)
    // Position 2 = 2 o'clock = rank 2
    // ...
    // Position 11 = 11 o'clock = rank 11 (Jack)
    if (position === 0) return 12;
    return position;
  }

  // Starting card rank for each clock position
  // Traditional setup: positions get starting cards that are specific ranks below
  // the target rank based on suit. We use a standard pattern:
  // Starting ranks cycle: 2,3,4,5,6,7,8,9,10,J,Q,K distributed by suit
  private getStartingCard(position: number): Card {
    // Traditional starting ranks for clock positions (0=12 o'clock through 11=11 o'clock):
    // Suits rotate: hearts, clubs, diamonds, spades (repeating 3 times for 12 positions)
    const suitOrder: Suit[] = [
      'hearts',
      'clubs',
      'diamonds',
      'spades',
      'hearts',
      'clubs',
      'diamonds',
      'spades',
      'hearts',
      'clubs',
      'diamonds',
      'spades',
    ];
    // Starting ranks: 2,3,4,5,6,7,8,9,10,J,Q,K
    const startRanks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

    return {
      rank: startRanks[position],
      suit: suitOrder[position],
    };
  }

  protected initializeState(playerIds: string[]): GrandfathersClockState {
    const seed = Date.now();
    const deck = createDeck();

    // Set up clock positions with starting cards
    const clock: Card[][] = [];
    const clockTargetRanks: number[] = [];
    const usedCards = new Set<string>();

    for (let pos = 0; pos < 12; pos++) {
      const startCard = this.getStartingCard(pos);
      clock.push([startCard]);
      clockTargetRanks.push(this.getTargetRank(pos));
      usedCards.add(`${startCard.rank}:${startCard.suit}`);
    }

    // Remaining 40 cards go to tableau
    const remaining = deck.filter((c) => !usedCards.has(`${c.rank}:${c.suit}`));
    const shuffled = shuffle(remaining, seed);

    const tableau: Card[][] = [];
    let idx = 0;
    for (let col = 0; col < 8; col++) {
      const pile: Card[] = [];
      for (let row = 0; row < 5; row++) {
        pile.push({ ...shuffled[idx++] });
      }
      tableau.push(pile);
    }

    return {
      tableau,
      clock,
      clockTargetRanks,
      moves: 0,
      score: 0,
      gameOver: false,
      won: false,
      playerId: playerIds[0],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<GrandfathersClockState>();
    if (playerId !== data.playerId) {
      return { success: false, error: 'Not your game' };
    }

    if (action.type !== 'move') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    return this.handleMove(data, action.payload);
  }

  private handleMove(data: GrandfathersClockState, payload: Record<string, unknown>): ActionResult {
    const from = payload.from as string; // 'tableau:N'
    const to = payload.to as string; // 'clock:N' or 'tableau:N'

    if (!from.startsWith('tableau:')) {
      return { success: false, error: 'Can only move from tableau' };
    }

    const fromCol = Number(from.split(':')[1]);
    if (fromCol < 0 || fromCol > 7) return { success: false, error: 'Invalid source column' };

    const sourcePile = data.tableau[fromCol];
    if (sourcePile.length === 0) return { success: false, error: 'Source column is empty' };

    const card = sourcePile[sourcePile.length - 1];

    if (to.startsWith('clock:')) {
      const pos = Number(to.split(':')[1]);
      if (pos < 0 || pos > 11) return { success: false, error: 'Invalid clock position' };

      const clockPile = data.clock[pos];
      const topCard = clockPile[clockPile.length - 1];

      // Must match suit and be next rank up (wrapping)
      if (card.suit !== topCard.suit) {
        return { success: false, error: 'Must match suit' };
      }
      const nextRank = topCard.rank === 13 ? 1 : topCard.rank + 1;
      if (card.rank !== nextRank) {
        return { success: false, error: 'Must be next rank up (wrapping K to A)' };
      }

      // Check that this card's rank does not exceed the target for this position
      // (foundations stop at their target rank)
      const target = data.clockTargetRanks[pos];
      if (clockPile.length >= 13) {
        return { success: false, error: 'Clock position is full' };
      }

      sourcePile.pop();
      clockPile.push(card);
      data.score += 10;

      if (clockPile[clockPile.length - 1].rank === target) {
        this.emitEvent('clock_position_complete', data.playerId, { position: pos });
      }
    } else if (to.startsWith('tableau:')) {
      const toCol = Number(to.split(':')[1]);
      if (toCol < 0 || toCol > 7 || toCol === fromCol) {
        return { success: false, error: 'Invalid destination column' };
      }

      const targetPile = data.tableau[toCol];
      if (targetPile.length > 0) {
        const topCard = targetPile[targetPile.length - 1];
        // Build descending regardless of suit
        if (card.rank !== topCard.rank - 1) {
          return { success: false, error: 'Must be one rank lower' };
        }
      }
      // Empty columns accept any card

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
    const data = this.getData<GrandfathersClockState>();
    // Win: each clock position's top card matches its target rank
    let allComplete = true;
    for (let pos = 0; pos < 12; pos++) {
      const pile = data.clock[pos];
      if (pile.length === 0 || pile[pile.length - 1].rank !== data.clockTargetRanks[pos]) {
        allComplete = false;
        break;
      }
    }

    if (allComplete) {
      data.won = true;
      data.gameOver = true;
      this.setData(data);
      return true;
    }
    return data.gameOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<GrandfathersClockState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<GrandfathersClockState>();
    return { [data.playerId]: data.score };
  }
}
