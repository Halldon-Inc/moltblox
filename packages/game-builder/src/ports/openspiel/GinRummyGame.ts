import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Card {
  suit: number;
  rank: number;
}

interface GinRummyState {
  [key: string]: unknown;
  deck: Card[];
  hands: Record<string, Card[]>;
  discardPile: Card[];
  currentPlayer: number;
  phase: string;
  scores: Record<string, number>;
  winner: string | null;
  targetScore: number;
}

export class GinRummyGame extends BaseGame {
  readonly name = 'Gin Rummy';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  private createDeck(): Card[] {
    const deck: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) deck.push({ suit, rank });
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  protected initializeState(playerIds: string[]): GinRummyState {
    const deck = this.createDeck();
    const hands: Record<string, Card[]> = {};
    for (const p of playerIds) {
      hands[p] = [];
      for (let i = 0; i < 10; i++) hands[p].push(deck.pop()!);
    }
    const discardPile = [deck.pop()!];
    const scores: Record<string, number> = {};
    for (const p of playerIds) scores[p] = 0;
    return {
      deck,
      hands,
      discardPile,
      currentPlayer: 0,
      phase: 'draw',
      scores,
      winner: null,
      targetScore: 100,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<GinRummyState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    if (data.phase === 'draw') {
      if (action.type === 'draw_deck') {
        if (data.deck.length === 0) return { success: false, error: 'Deck is empty' };
        data.hands[playerId].push(data.deck.pop()!);
        data.phase = 'discard';
      } else if (action.type === 'draw_discard') {
        if (data.discardPile.length === 0)
          return { success: false, error: 'Discard pile is empty' };
        data.hands[playerId].push(data.discardPile.pop()!);
        data.phase = 'discard';
      } else {
        return { success: false, error: 'Must draw a card first' };
      }
    } else if (data.phase === 'discard') {
      if (action.type === 'discard') {
        const cardIdx = Number(action.payload.cardIndex);
        if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= data.hands[playerId].length) {
          return { success: false, error: 'Invalid card index' };
        }
        data.discardPile.push(data.hands[playerId].splice(cardIdx, 1)[0]);
        data.phase = 'draw';
        data.currentPlayer = (data.currentPlayer + 1) % 2;
      } else if (action.type === 'knock') {
        const cardIdx = Number(action.payload.cardIndex);
        if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= data.hands[playerId].length) {
          return { success: false, error: 'Invalid card index' };
        }
        data.discardPile.push(data.hands[playerId].splice(cardIdx, 1)[0]);

        const deadwood = this.calculateDeadwood(data.hands[playerId]);
        if (deadwood > 10) return { success: false, error: 'Deadwood must be 10 or less to knock' };

        const opponent = players[(data.currentPlayer + 1) % 2];
        const oppDeadwood = this.calculateDeadwood(data.hands[opponent]);

        if (deadwood === 0) {
          // Gin bonus
          data.scores[playerId] += oppDeadwood + 25;
        } else if (oppDeadwood <= deadwood) {
          // Undercut
          data.scores[opponent] += deadwood - oppDeadwood + 25;
        } else {
          data.scores[playerId] += oppDeadwood - deadwood;
        }

        if (data.scores[playerId] >= data.targetScore) data.winner = playerId;
        else if (data.scores[opponent] >= data.targetScore) data.winner = opponent;
        else {
          // New hand
          const newDeck = this.createDeck();
          for (const p of players) {
            data.hands[p] = [];
            for (let i = 0; i < 10; i++) data.hands[p].push(newDeck.pop()!);
          }
          data.deck = newDeck;
          data.discardPile = [data.deck.pop()!];
          data.currentPlayer = 0;
          data.phase = 'draw';
        }
      } else {
        return { success: false, error: 'Must discard or knock' };
      }
    }

    // Draw from empty deck
    if (data.deck.length === 0 && data.discardPile.length > 1) {
      const top = data.discardPile.pop()!;
      data.deck = data.discardPile;
      data.discardPile = [top];
      for (let i = data.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [data.deck[i], data.deck[j]] = [data.deck[j], data.deck[i]];
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private calculateDeadwood(hand: Card[]): number {
    const melds = this.findMelds(hand);
    let bestDeadwood = Infinity;

    for (const meldSet of melds) {
      const inMeld = new Set<number>();
      for (const meld of meldSet) {
        for (const idx of meld) inMeld.add(idx);
      }
      let deadwood = 0;
      for (let i = 0; i < hand.length; i++) {
        if (!inMeld.has(i)) {
          deadwood += Math.min(hand[i].rank, 10);
        }
      }
      if (deadwood < bestDeadwood) bestDeadwood = deadwood;
    }

    return bestDeadwood === Infinity
      ? hand.reduce((s, c) => s + Math.min(c.rank, 10), 0)
      : bestDeadwood;
  }

  private findMelds(hand: Card[]): number[][][] {
    const results: number[][][] = [[]];

    // Find all possible sets (same rank, different suits)
    const byRank = new Map<number, number[]>();
    for (let i = 0; i < hand.length; i++) {
      const r = hand[i].rank;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r)!.push(i);
    }
    for (const indices of byRank.values()) {
      if (indices.length >= 3) results.push([indices.slice(0, 3)]);
      if (indices.length >= 4) results.push([indices]);
    }

    // Find all possible runs (same suit, consecutive ranks)
    const bySuit = new Map<number, number[]>();
    for (let i = 0; i < hand.length; i++) {
      const s = hand[i].suit;
      if (!bySuit.has(s)) bySuit.set(s, []);
      bySuit.get(s)!.push(i);
    }
    for (const indices of bySuit.values()) {
      const sorted = indices.sort((a, b) => hand[a].rank - hand[b].rank);
      for (let start = 0; start < sorted.length - 2; start++) {
        const run = [sorted[start]];
        for (let j = start + 1; j < sorted.length; j++) {
          if (hand[sorted[j]].rank === hand[run[run.length - 1]].rank + 1) {
            run.push(sorted[j]);
          }
        }
        if (run.length >= 3) results.push([run]);
      }
    }

    return results;
  }

  protected checkGameOver(): boolean {
    return this.getData<GinRummyState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<GinRummyState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<GinRummyState>().scores };
  }

  getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as GinRummyState;
    const masked: Record<string, Card[]> = {};
    for (const [p, cards] of Object.entries(data.hands)) {
      masked[p] = p === playerId ? cards : cards.map(() => ({ suit: -1, rank: -1 }));
    }
    return { ...state, data: { ...data, hands: masked } };
  }
}
