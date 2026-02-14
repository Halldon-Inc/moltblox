import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number;
  suit: Suit;
  faceUp: boolean;
}

interface SpiderState {
  [key: string]: unknown;
  tableau: Card[][]; // 10 columns
  stock: Card[]; // remaining cards dealt in rows of 10
  completedSuits: number; // suits removed (need 8 to win)
  moves: number;
  score: number;
  gameOver: boolean;
  won: boolean;
  playerId: string;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

function createDoubleDeck(): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < 2; d++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ rank, suit, faceUp: false });
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
 * Spider Solitaire: Uses two full decks (104 cards).
 *
 * 10 tableau columns. First 4 columns get 6 cards each, remaining 6 get 5 each.
 * Only the top card of each column is face up initially.
 * Build descending sequences in tableau. Complete same-suit K-to-A runs are removed.
 * Deal a new row of 10 cards from stock when no moves are available.
 * Win by completing all 8 suit runs.
 *
 * Actions: move, deal
 */
export class SpiderGame extends BaseGame {
  readonly name = 'Spider Solitaire';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): SpiderState {
    const seed = Date.now();
    const deck = shuffle(createDoubleDeck(), seed);

    const tableau: Card[][] = Array.from({ length: 10 }, () => []);
    let idx = 0;

    // First 4 columns: 6 cards each; remaining 6 columns: 5 cards each
    for (let col = 0; col < 10; col++) {
      const count = col < 4 ? 6 : 5;
      for (let r = 0; r < count; r++) {
        const card = { ...deck[idx++] };
        card.faceUp = r === count - 1;
        tableau[col].push(card);
      }
    }

    const stock = deck.slice(idx).map((c) => ({ ...c, faceUp: false }));

    return {
      tableau,
      stock,
      completedSuits: 0,
      moves: 0,
      score: 500,
      gameOver: false,
      won: false,
      playerId: playerIds[0],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SpiderState>();
    if (playerId !== data.playerId) {
      return { success: false, error: 'Not your game' };
    }

    switch (action.type) {
      case 'move':
        return this.handleMove(data, action.payload);
      case 'deal':
        return this.handleDeal(data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handleMove(data: SpiderState, payload: Record<string, unknown>): ActionResult {
    const fromCol = Number(payload.fromCol);
    const toCol = Number(payload.toCol);
    const count = Number(payload.count ?? 1);

    if (fromCol < 0 || fromCol > 9 || toCol < 0 || toCol > 9 || fromCol === toCol) {
      return { success: false, error: 'Invalid column indices' };
    }

    const sourcePile = data.tableau[fromCol];
    if (count < 1 || count > sourcePile.length) {
      return { success: false, error: 'Invalid card count' };
    }

    // Cards being moved must form a descending same-suit sequence
    const startIdx = sourcePile.length - count;
    const movingCards = sourcePile.slice(startIdx);
    if (!movingCards.every((c) => c.faceUp)) {
      return { success: false, error: 'Cannot move face-down cards' };
    }

    for (let i = 1; i < movingCards.length; i++) {
      if (movingCards[i].suit !== movingCards[0].suit) {
        return { success: false, error: 'Moved sequence must be same suit' };
      }
      if (movingCards[i].rank !== movingCards[i - 1].rank - 1) {
        return { success: false, error: 'Moved sequence must be descending' };
      }
    }

    const targetPile = data.tableau[toCol];
    if (targetPile.length > 0) {
      const topCard = targetPile[targetPile.length - 1];
      if (movingCards[0].rank !== topCard.rank - 1) {
        return { success: false, error: 'Must place on card one rank higher' };
      }
    }

    // Execute move
    sourcePile.splice(startIdx, count);
    targetPile.push(...movingCards);

    // Flip newly exposed card
    if (sourcePile.length > 0 && !sourcePile[sourcePile.length - 1].faceUp) {
      sourcePile[sourcePile.length - 1].faceUp = true;
    }

    data.moves++;
    data.score = Math.max(0, data.score - 1);

    // Check for completed suit run (K through A, same suit, 13 cards)
    this.checkCompletedRuns(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleDeal(data: SpiderState): ActionResult {
    if (data.stock.length < 10) {
      return { success: false, error: 'Not enough cards in stock to deal' };
    }

    // Cannot deal if any tableau column is empty
    for (let col = 0; col < 10; col++) {
      if (data.tableau[col].length === 0) {
        return { success: false, error: 'All columns must have at least one card before dealing' };
      }
    }

    // Deal one card face up to each column
    for (let col = 0; col < 10; col++) {
      const card = data.stock.pop()!;
      card.faceUp = true;
      data.tableau[col].push(card);
    }

    data.moves++;

    // Check for completed runs after dealing
    this.checkCompletedRuns(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private checkCompletedRuns(data: SpiderState): void {
    for (let col = 0; col < 10; col++) {
      const pile = data.tableau[col];
      if (pile.length < 13) continue;

      // Check if the bottom 13 face-up cards form K-A same suit
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
    const data = this.getData<SpiderState>();
    if (data.completedSuits >= 8) {
      data.won = true;
      data.gameOver = true;
      this.setData(data);
      return true;
    }
    return data.gameOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<SpiderState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SpiderState>();
    return { [data.playerId]: data.score };
  }
}
