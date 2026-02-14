import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Card {
  suit: number;
  rank: number;
}

interface CrazyEightsState {
  [key: string]: unknown;
  deck: Card[];
  hands: Record<string, Card[]>;
  discardPile: Card[];
  currentPlayer: number;
  currentSuit: number;
  winner: string | null;
}

export class CrazyEightsGame extends BaseGame {
  readonly name = 'Crazy Eights';
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

  protected initializeState(playerIds: string[]): CrazyEightsState {
    const deck = this.createDeck();
    const hands: Record<string, Card[]> = {};
    for (const p of playerIds) {
      hands[p] = [];
      for (let i = 0; i < 5; i++) hands[p].push(deck.pop()!);
    }
    const firstCard = deck.pop()!;
    return {
      deck,
      hands,
      discardPile: [firstCard],
      currentPlayer: 0,
      currentSuit: firstCard.suit,
      winner: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CrazyEightsState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    if (action.type === 'draw') {
      if (data.deck.length === 0) {
        // Reshuffle discard pile
        const topCard = data.discardPile.pop()!;
        data.deck = data.discardPile;
        data.discardPile = [topCard];
        for (let i = data.deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [data.deck[i], data.deck[j]] = [data.deck[j], data.deck[i]];
        }
      }
      if (data.deck.length > 0) {
        data.hands[playerId].push(data.deck.pop()!);
      }
      data.currentPlayer = (data.currentPlayer + 1) % players.length;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'play') return { success: false, error: `Unknown action: ${action.type}` };

    const cardIdx = Number(action.payload.cardIndex);
    if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= data.hands[playerId].length) {
      return { success: false, error: 'Invalid card index' };
    }

    const card = data.hands[playerId][cardIdx];
    const topCard = data.discardPile[data.discardPile.length - 1];

    // Eights are wild
    if (card.rank === 8) {
      const newSuit = Number(action.payload.suit ?? action.payload.newSuit);
      data.hands[playerId].splice(cardIdx, 1);
      data.discardPile.push(card);
      data.currentSuit = isNaN(newSuit) ? card.suit : newSuit;
    } else {
      if (card.suit !== data.currentSuit && card.rank !== topCard.rank) {
        return { success: false, error: 'Card must match suit or rank' };
      }
      data.hands[playerId].splice(cardIdx, 1);
      data.discardPile.push(card);
      data.currentSuit = card.suit;
    }

    if (data.hands[playerId].length === 0) {
      data.winner = playerId;
    }

    data.currentPlayer = (data.currentPlayer + 1) % players.length;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<CrazyEightsState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<CrazyEightsState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<CrazyEightsState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      let penalty = 0;
      for (const c of data.hands[p]) {
        if (c.rank === 8) penalty += 50;
        else if (c.rank >= 10) penalty += 10;
        else penalty += c.rank;
      }
      scores[p] = p === data.winner ? 100 : -penalty;
    }
    return scores;
  }
}
