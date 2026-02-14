import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  rank: number;
  suit: Suit;
  faceUp: boolean;
}

interface TriPeaksCard {
  card: Card;
  removed: boolean;
  row: number;
  position: number;
  // Children indices for determining when a card becomes exposed
  childLeft: number;
  childRight: number;
}

interface TriPeaksState {
  [key: string]: unknown;
  peaks: TriPeaksCard[]; // 28 cards in 3-peak layout
  stock: Card[];
  waste: Card[]; // top of waste is active foundation
  combo: number; // current chain combo counter
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
 * TriPeaks Solitaire: Three overlapping peaks of cards.
 *
 * Layout: 3 peaks, each peak has 1 card at top, 2 in second row, 3 in third row,
 * plus a shared bottom row of 10 cards. Total 28 cards on the board.
 * Remove cards that are +1 or -1 from the waste pile top (wrapping: K-A).
 * Chain combos: consecutive removals without drawing give bonus points.
 * Draw from stock to waste when no plays are possible.
 *
 * Actions: select, draw
 */
export class TriPeaksGame extends BaseGame {
  readonly name = 'TriPeaks Solitaire';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): TriPeaksState {
    const seed = Date.now();
    const deck = shuffle(createDeck(), seed);

    // TriPeaks layout (28 cards):
    // Row 0: 3 peak tops (positions 0, 1, 2) | face down
    // Row 1: 6 cards (positions 0-5) | face down
    // Row 2: 9 cards (positions 0-8) | face down
    // Row 3: 10 cards (positions 0-9) | face up (bottom row)

    const peaks: TriPeaksCard[] = [];
    let idx = 0;

    // Row 0: 3 cards (peak tops)
    for (let p = 0; p < 3; p++) {
      peaks.push({
        card: { ...deck[idx++], faceUp: false },
        removed: false,
        row: 0,
        position: p,
        childLeft: 3 + p * 2, // index in peaks array
        childRight: 3 + p * 2 + 1,
      });
    }

    // Row 1: 6 cards
    for (let p = 0; p < 6; p++) {
      const peakGroup = Math.floor(p / 2);
      peaks.push({
        card: { ...deck[idx++], faceUp: false },
        removed: false,
        row: 1,
        position: p,
        childLeft: 9 + peakGroup * 3 + (p % 2),
        childRight: 9 + peakGroup * 3 + (p % 2) + 1,
      });
    }

    // Row 2: 9 cards
    for (let p = 0; p < 9; p++) {
      peaks.push({
        card: { ...deck[idx++], faceUp: false },
        removed: false,
        row: 2,
        position: p,
        childLeft: 18 + p,
        childRight: 18 + p + 1,
      });
    }

    // Row 3: 10 cards (bottom, all face up, no children)
    for (let p = 0; p < 10; p++) {
      peaks.push({
        card: { ...deck[idx++], faceUp: true },
        removed: false,
        row: 3,
        position: p,
        childLeft: -1,
        childRight: -1,
      });
    }

    // First stock card goes to waste as the initial foundation card
    const wasteCard = deck[idx++];
    wasteCard.faceUp = true;
    const stock = deck.slice(idx).map((c) => ({ ...c, faceUp: false }));

    return {
      peaks,
      stock,
      waste: [wasteCard],
      combo: 0,
      moves: 0,
      score: 0,
      gameOver: false,
      won: false,
      playerId: playerIds[0],
    };
  }

  private isExposed(peaks: TriPeaksCard[], index: number): boolean {
    const pc = peaks[index];
    if (pc.removed) return false;
    if (pc.row === 3) return true; // Bottom row is always exposed
    if (pc.childLeft < 0 || pc.childRight < 0) return true;
    // Validate bounds
    if (pc.childLeft >= peaks.length || pc.childRight >= peaks.length) return true;
    return peaks[pc.childLeft].removed && peaks[pc.childRight].removed;
  }

  private isAdjacent(rank1: number, rank2: number): boolean {
    const diff = Math.abs(rank1 - rank2);
    return diff === 1 || diff === 12;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TriPeaksState>();
    if (playerId !== data.playerId) {
      return { success: false, error: 'Not your game' };
    }

    switch (action.type) {
      case 'select':
        return this.handleSelect(data, action.payload);
      case 'draw':
        return this.handleDraw(data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handleSelect(data: TriPeaksState, payload: Record<string, unknown>): ActionResult {
    const peakIndex = Number(payload.index);
    if (peakIndex < 0 || peakIndex >= data.peaks.length) {
      return { success: false, error: 'Invalid card index' };
    }

    const pc = data.peaks[peakIndex];
    if (pc.removed) return { success: false, error: 'Card already removed' };
    if (!this.isExposed(data.peaks, peakIndex)) {
      return { success: false, error: 'Card is not exposed' };
    }

    const wasteTop = data.waste[data.waste.length - 1];
    if (!this.isAdjacent(pc.card.rank, wasteTop.rank)) {
      return { success: false, error: 'Card must be +/- 1 from waste top' };
    }

    // Remove card and add to waste
    pc.removed = true;
    const removedCard = { ...pc.card, faceUp: true };
    data.waste.push(removedCard);

    // Combo scoring
    data.combo++;
    data.score += data.combo * 10;

    // Expose newly uncovered cards
    this.updateExposure(data);

    data.moves++;

    // Check for peak clearance bonus
    const peakCleared = this.checkPeakClearance(data);
    if (peakCleared) {
      data.score += 50;
      this.emitEvent('peak_cleared', data.playerId, { bonus: 50 });
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleDraw(data: TriPeaksState): ActionResult {
    if (data.stock.length === 0) {
      data.gameOver = true;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    const card = data.stock.pop()!;
    card.faceUp = true;
    data.waste.push(card);
    data.combo = 0; // Reset combo on draw
    data.moves++;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private updateExposure(data: TriPeaksState): void {
    // Flip newly exposed cards face up
    for (let i = 0; i < data.peaks.length; i++) {
      if (!data.peaks[i].removed && !data.peaks[i].card.faceUp && this.isExposed(data.peaks, i)) {
        data.peaks[i].card.faceUp = true;
      }
    }
  }

  private checkPeakClearance(data: TriPeaksState): boolean {
    // Check if any peak top was just cleared
    for (let p = 0; p < 3; p++) {
      if (data.peaks[p].removed) {
        // This peak's top is cleared
        // Check if this is new (simple: we emit only once based on score events)
        // For simplicity, we return true if a peak top was the card just removed
        const lastWaste = data.waste[data.waste.length - 1];
        if (
          data.peaks[p].card.rank === lastWaste.rank &&
          data.peaks[p].card.suit === lastWaste.suit
        ) {
          return true;
        }
      }
    }
    return false;
  }

  protected checkGameOver(): boolean {
    const data = this.getData<TriPeaksState>();
    // Win: all peaks cards removed
    if (data.peaks.every((pc) => pc.removed)) {
      data.won = true;
      data.gameOver = true;
      this.setData(data);
      return true;
    }
    if (data.gameOver) return true;

    // Check if stuck: no stock and no playable cards
    if (data.stock.length === 0) {
      const wasteTop = data.waste[data.waste.length - 1];
      const hasPlay = data.peaks.some((pc, idx) => {
        if (pc.removed) return false;
        if (!this.isExposed(data.peaks, idx)) return false;
        return this.isAdjacent(pc.card.rank, wasteTop.rank);
      });
      if (!hasPlay) {
        data.gameOver = true;
        this.setData(data);
        return true;
      }
    }
    return false;
  }

  protected determineWinner(): string | null {
    const data = this.getData<TriPeaksState>();
    return data.won ? data.playerId : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<TriPeaksState>();
    return { [data.playerId]: data.score };
  }
}
