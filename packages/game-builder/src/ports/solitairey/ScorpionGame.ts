import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number;
  suit: Suit;
  faceUp: boolean;
}

interface ScorpionState {
  [key: string]: unknown;
  tableau: Card[][]; // 7 columns
  reserve: Card[]; // 3 reserve cards dealt later
  completedSuits: number; // number of completed K-to-A same-suit runs removed
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
 * Scorpion Solitaire: 7 columns from a single deck.
 *
 * First 3 columns: 3 face-down cards + 4 face-up cards (7 each).
 * Columns 4-7: all 7 cards face up.
 * 3 reserve cards set aside, dealt onto first 3 columns later.
 * Build descending same suit in tableau. Any face-up card and all cards
 * below it can be moved as a group (unlike Spider, the group does not
 * need to be in sequence).
 * Complete K-through-A same-suit runs are removed from the tableau.
 * Win by completing all 4 suit runs.
 *
 * Actions: move, deal_reserve
 */
export class ScorpionGame extends BaseGame {
  readonly name = 'Scorpion Solitaire';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): ScorpionState {
    const seed = Date.now();
    const deck = shuffle(createDeck(), seed);

    const tableau: Card[][] = Array.from({ length: 7 }, () => []);
    let idx = 0;

    // Deal 7 cards to each of 7 columns
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 7; col++) {
        const card = { ...deck[idx++] };
        // First 3 columns, first 3 rows: face down
        if (col < 3 && row < 3) {
          card.faceUp = false;
        } else {
          card.faceUp = true;
        }
        tableau[col].push(card);
      }
    }

    // 3 reserve cards (49, 50, 51)
    const reserve = deck.slice(idx, idx + 3).map((c) => ({ ...c, faceUp: true }));

    return {
      tableau,
      reserve,
      completedSuits: 0,
      moves: 0,
      score: 0,
      gameOver: false,
      won: false,
      playerId: playerIds[0],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ScorpionState>();
    if (playerId !== data.playerId) {
      return { success: false, error: 'Not your game' };
    }

    switch (action.type) {
      case 'move':
        return this.handleMove(data, action.payload);
      case 'deal_reserve':
        return this.handleDealReserve(data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handleMove(data: ScorpionState, payload: Record<string, unknown>): ActionResult {
    const fromCol = Number(payload.fromCol);
    const toCol = Number(payload.toCol);
    const cardIndex = Number(payload.cardIndex); // index in the source column to start moving from

    if (fromCol < 0 || fromCol > 6 || toCol < 0 || toCol > 6 || fromCol === toCol) {
      return { success: false, error: 'Invalid column indices' };
    }

    const sourcePile = data.tableau[fromCol];
    if (cardIndex < 0 || cardIndex >= sourcePile.length) {
      return { success: false, error: 'Invalid card index' };
    }

    const movingCard = sourcePile[cardIndex];
    if (!movingCard.faceUp) {
      return { success: false, error: 'Cannot move face-down card' };
    }

    const targetPile = data.tableau[toCol];
    if (targetPile.length === 0) {
      // Only Kings can go on empty columns
      if (movingCard.rank !== 13) {
        return { success: false, error: 'Only Kings can be placed on empty columns' };
      }
    } else {
      const topCard = targetPile[targetPile.length - 1];
      if (!topCard.faceUp) {
        return { success: false, error: 'Target card is face down' };
      }
      // Must be same suit, one rank higher
      if (movingCard.suit !== topCard.suit) {
        return { success: false, error: 'Must match suit' };
      }
      if (movingCard.rank !== topCard.rank - 1) {
        return { success: false, error: 'Must be one rank lower than target' };
      }
    }

    // Move the card and everything below it
    const movingCards = sourcePile.splice(cardIndex);
    targetPile.push(...movingCards);

    // Flip newly exposed card
    if (sourcePile.length > 0 && !sourcePile[sourcePile.length - 1].faceUp) {
      sourcePile[sourcePile.length - 1].faceUp = true;
    }

    data.moves++;
    data.score += 5;

    // Check for completed runs
    this.checkCompletedRuns(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleDealReserve(data: ScorpionState): ActionResult {
    if (data.reserve.length === 0) {
      return { success: false, error: 'No reserve cards remaining' };
    }

    // Deal reserve cards to first 3 columns (1 each)
    for (let col = 0; col < 3 && data.reserve.length > 0; col++) {
      const card = data.reserve.pop()!;
      card.faceUp = true;
      data.tableau[col].push(card);
    }

    data.moves++;

    // Check for completed runs after dealing
    this.checkCompletedRuns(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private checkCompletedRuns(data: ScorpionState): void {
    for (let col = 0; col < 7; col++) {
      const pile = data.tableau[col];
      if (pile.length < 13) continue;

      // Check if the last 13 cards form K-A same suit
      const last13 = pile.slice(pile.length - 13);
      if (!last13.every((c) => c.faceUp)) continue;

      const suit = last13[0].suit;
      let valid = last13[0].rank === 13;
      for (let i = 1; i < 13 && valid; i++) {
        if (last13[i].suit !== suit || last13[i].rank !== 13 - i) {
          valid = false;
        }
      }

      if (valid) {
        pile.splice(pile.length - 13, 13);
        data.completedSuits++;
        data.score += 100;

        // Flip newly exposed card
        if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
          pile[pile.length - 1].faceUp = true;
        }

        this.emitEvent('suit_completed', data.playerId, { suit, total: data.completedSuits });
      }
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<ScorpionState>();
    if (data.completedSuits >= 4) {
      data.won = true;
      data.gameOver = true;
      this.setData(data);
      return true;
    }
    return data.gameOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<ScorpionState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<ScorpionState>();
    return { [data.playerId]: data.score };
  }
}
