import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type Card,
  type Rank,
  type Suit,
  createDeck,
  shuffle,
  rankValue,
  RANKS,
  SUITS,
} from './cardHelpers.js';

interface Meld {
  cards: Card[];
  type: 'set' | 'run';
}

interface RummyState {
  [key: string]: unknown;
  hands: Card[][];
  drawPile: Card[];
  discardPile: Card[];
  melds: Meld[][];
  currentPlayer: number;
  scores: number[];
  winner: string | null;
  phase: string; // 'draw' | 'play'
  hasDrawn: boolean;
}

export class RummyGame extends BaseGame {
  readonly name = 'Rummy';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): RummyState {
    const n = playerIds.length;
    const deck = shuffle(createDeck());
    const cardsPerPlayer = n <= 2 ? 10 : 7;
    const hands: Card[][] = [];
    for (let i = 0; i < n; i++) hands.push(deck.splice(0, cardsPerPlayer));
    return {
      hands,
      drawPile: deck,
      discardPile: [deck.pop()!],
      melds: Array.from({ length: n }, () => []),
      currentPlayer: 0,
      scores: Array(n).fill(0),
      winner: null,
      phase: 'draw',
      hasDrawn: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<RummyState>();
    const players = this.getPlayers();
    const pi = players.indexOf(playerId);
    if (pi !== data.currentPlayer) return { success: false, error: 'Not your turn' };

    if (action.type === 'draw') {
      if (data.hasDrawn) return { success: false, error: 'Already drew' };
      if (data.drawPile.length === 0) {
        // Reshuffle discard pile
        const top = data.discardPile.pop()!;
        data.drawPile = shuffle(data.discardPile);
        data.discardPile = [top];
      }
      data.hands[pi].push(data.drawPile.pop()!);
      data.hasDrawn = true;
      data.phase = 'play';
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'draw_discard') {
      if (data.hasDrawn) return { success: false, error: 'Already drew' };
      if (data.discardPile.length === 0) return { success: false, error: 'Discard pile empty' };
      data.hands[pi].push(data.discardPile.pop()!);
      data.hasDrawn = true;
      data.phase = 'play';
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'meld') {
      if (!data.hasDrawn) return { success: false, error: 'Must draw first' };
      const cardKeys = action.payload.cards as string[];
      if (!Array.isArray(cardKeys) || cardKeys.length < 3)
        return { success: false, error: 'Need 3+ cards' };

      const cards: Card[] = [];
      for (const k of cardKeys) {
        const [r, s] = k.split('_');
        const ci = data.hands[pi].findIndex((c) => c.rank === r && c.suit === s);
        if (ci === -1) return { success: false, error: `Card not in hand: ${k}` };
        cards.push(data.hands[pi].splice(ci, 1)[0]);
      }

      // Check if valid set or run
      const isSet = this.isValidSet(cards);
      const isRun = this.isValidRun(cards);
      if (!isSet && !isRun) {
        data.hands[pi].push(...cards);
        return { success: false, error: 'Invalid meld' };
      }

      data.melds[pi].push({ cards, type: isSet ? 'set' : 'run' });

      if (data.hands[pi].length === 0) {
        this.scoreRound(data, pi, players);
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'discard') {
      if (!data.hasDrawn) return { success: false, error: 'Must draw first' };
      const [r, s] = (action.payload.card as string).split('_');
      const ci = data.hands[pi].findIndex((c) => c.rank === r && c.suit === s);
      if (ci === -1) return { success: false, error: 'Card not in hand' };
      data.discardPile.push(data.hands[pi].splice(ci, 1)[0]);

      if (data.hands[pi].length === 0) {
        this.scoreRound(data, pi, players);
      } else {
        data.currentPlayer = (pi + 1) % players.length;
        data.phase = 'draw';
        data.hasDrawn = false;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  private isValidSet(cards: Card[]): boolean {
    if (cards.length < 3 || cards.length > 4) return false;
    const rank = cards[0].rank;
    const suits = new Set<Suit>();
    for (const c of cards) {
      if (c.rank !== rank) return false;
      if (suits.has(c.suit)) return false;
      suits.add(c.suit);
    }
    return true;
  }

  private isValidRun(cards: Card[]): boolean {
    if (cards.length < 3) return false;
    const suit = cards[0].suit;
    if (!cards.every((c) => c.suit === suit)) return false;
    const indices = cards.map((c) => RANKS.indexOf(c.rank)).sort((a, b) => a - b);
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] !== indices[i - 1] + 1) return false;
    }
    return true;
  }

  private cardPoints(card: Card): number {
    if (card.rank === 'A') return 1;
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    return parseInt(card.rank, 10);
  }

  private scoreRound(data: RummyState, winnerIdx: number, players: string[]): void {
    // Winner scores 0, others score their deadwood
    for (let i = 0; i < players.length; i++) {
      if (i === winnerIdx) continue;
      let deadwood = 0;
      for (const c of data.hands[i]) deadwood += this.cardPoints(c);
      data.scores[winnerIdx] += deadwood;
    }

    if (data.scores[winnerIdx] >= 100) {
      data.winner = players[winnerIdx];
    } else {
      // New round
      const deck = shuffle(createDeck());
      const n = players.length;
      const cpe = n <= 2 ? 10 : 7;
      for (let i = 0; i < n; i++) data.hands[i] = deck.splice(0, cpe);
      data.drawPile = deck;
      data.discardPile = [data.drawPile.pop()!];
      data.melds = Array.from({ length: n }, () => []);
      data.currentPlayer = (data.currentPlayer + 1) % n;
      data.phase = 'draw';
      data.hasDrawn = false;
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<RummyState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<RummyState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<RummyState>();
    const sc: Record<string, number> = {};
    const p = this.getPlayers();
    for (let i = 0; i < p.length; i++) sc[p[i]] = d.scores[i];
    return sc;
  }
}
