import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Card {
  suit: number;
  rank: number;
}

interface RummyState {
  [key: string]: unknown;
  deck: Card[];
  hands: Record<string, Card[]>;
  discardPile: Card[];
  melds: Record<string, Card[][]>;
  currentPlayer: number;
  hasDrawn: boolean;
  winner: string | null;
}

export class RummyGame extends BaseGame {
  readonly name = 'Rummy';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

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

  protected initializeState(playerIds: string[]): RummyState {
    const deck = this.createDeck();
    const hands: Record<string, Card[]> = {};
    const melds: Record<string, Card[][]> = {};
    const cardsPerPlayer = playerIds.length <= 2 ? 10 : 7;

    for (const p of playerIds) {
      hands[p] = deck.splice(0, cardsPerPlayer);
      melds[p] = [];
    }

    const discardPile = [deck.pop()!];

    return { deck, hands, discardPile, melds, currentPlayer: 0, hasDrawn: false, winner: null };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<RummyState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    switch (action.type) {
      case 'draw_deck': {
        if (data.hasDrawn) return { success: false, error: 'Already drawn this turn' };
        if (data.deck.length === 0) {
          const top = data.discardPile.pop()!;
          data.deck = data.discardPile;
          data.discardPile = [top];
          for (let i = data.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [data.deck[i], data.deck[j]] = [data.deck[j], data.deck[i]];
          }
        }
        if (data.deck.length > 0) data.hands[playerId].push(data.deck.pop()!);
        data.hasDrawn = true;
        break;
      }
      case 'draw_discard': {
        if (data.hasDrawn) return { success: false, error: 'Already drawn this turn' };
        if (data.discardPile.length === 0)
          return { success: false, error: 'Discard pile is empty' };
        data.hands[playerId].push(data.discardPile.pop()!);
        data.hasDrawn = true;
        break;
      }
      case 'meld': {
        if (!data.hasDrawn) return { success: false, error: 'Must draw before melding' };
        const indices = (action.payload.cardIndices as number[]) || [];
        if (indices.length < 3) return { success: false, error: 'Meld requires at least 3 cards' };

        const sortedIndices = [...indices].sort((a, b) => b - a);
        for (const idx of sortedIndices) {
          if (idx < 0 || idx >= data.hands[playerId].length)
            return { success: false, error: 'Invalid card index' };
        }

        const cards = sortedIndices.map((idx) => data.hands[playerId][idx]);

        if (!this.isValidMeld(cards)) {
          return {
            success: false,
            error: 'Invalid meld: must be a set (same rank) or run (same suit, consecutive)',
          };
        }

        for (const idx of sortedIndices) data.hands[playerId].splice(idx, 1);
        data.melds[playerId].push(cards);

        if (data.hands[playerId].length === 0) data.winner = playerId;
        break;
      }
      case 'discard': {
        if (!data.hasDrawn) return { success: false, error: 'Must draw before discarding' };
        const cardIdx = Number(action.payload.cardIndex);
        if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= data.hands[playerId].length) {
          return { success: false, error: 'Invalid card index' };
        }

        data.discardPile.push(data.hands[playerId].splice(cardIdx, 1)[0]);
        data.hasDrawn = false;

        if (data.hands[playerId].length === 0) {
          data.winner = playerId;
        } else {
          data.currentPlayer = (data.currentPlayer + 1) % players.length;
        }
        break;
      }
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private isValidMeld(cards: Card[]): boolean {
    if (cards.length < 3) return false;

    if (cards.every((c) => c.rank === cards[0].rank)) {
      const suits = new Set(cards.map((c) => c.suit));
      return suits.size === cards.length;
    }

    if (cards.every((c) => c.suit === cards[0].suit)) {
      const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
      for (let i = 1; i < ranks.length; i++) {
        if (ranks[i] !== ranks[i - 1] + 1) return false;
      }
      return true;
    }

    return false;
  }

  protected checkGameOver(): boolean {
    return this.getData<RummyState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<RummyState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<RummyState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      let handValue = 0;
      for (const card of data.hands[p]) handValue += Math.min(card.rank, 10);
      scores[p] = p === data.winner ? 100 : -handValue;
    }
    return scores;
  }

  getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const d = state.data as RummyState;
    const maskedHands: Record<string, Card[]> = {};
    for (const [p, cards] of Object.entries(d.hands)) {
      maskedHands[p] = p === playerId ? cards : cards.map(() => ({ suit: -1, rank: -1 }));
    }
    return { ...state, data: { ...d, hands: maskedHands, deck: [] } };
  }
}
