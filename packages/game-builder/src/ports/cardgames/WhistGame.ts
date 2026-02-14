import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import { type Card, type Suit, type Rank, createDeck, shuffle, rankValue } from './cardHelpers.js';

interface WhistState {
  [key: string]: unknown;
  hands: Card[][];
  currentPlayer: number;
  dealer: number;
  trumpSuit: Suit;
  trick: { card: Card; player: number }[];
  tricksWon: number[]; // per team: [team0, team1]
  scores: number[];
  leadPlayer: number;
  winner: string | null;
  round: number;
}

export class WhistGame extends BaseGame {
  readonly name = 'Whist';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): WhistState {
    const deck = shuffle(createDeck());
    const hands: Card[][] = [[], [], [], []];
    for (let i = 0; i < 52; i++) hands[i % 4].push(deck[i]);
    // Trump is the last card dealt (dealer's last card)
    const trumpCard = hands[0][hands[0].length - 1];
    return {
      hands,
      currentPlayer: 1,
      dealer: 0,
      trumpSuit: trumpCard.suit,
      trick: [],
      tricksWon: [0, 0],
      scores: [0, 0],
      leadPlayer: 1,
      winner: null,
      round: 1,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<WhistState>();
    const players = this.getPlayers();
    const pi = players.indexOf(playerId);
    if (pi !== data.currentPlayer) return { success: false, error: 'Not your turn' };
    if (action.type !== 'play') return { success: false, error: 'Must play a card' };

    const [r, s] = (action.payload.card as string).split('_');
    const card: Card = { rank: r as Rank, suit: s as Suit };
    const hand = data.hands[pi];
    const idx = hand.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
    if (idx === -1) return { success: false, error: 'Card not in hand' };

    // Must follow suit
    if (data.trick.length > 0) {
      const leadSuit = data.trick[0].card.suit;
      if (card.suit !== leadSuit && hand.some((c) => c.suit === leadSuit)) {
        return { success: false, error: 'Must follow suit' };
      }
    }

    hand.splice(idx, 1);
    data.trick.push({ card, player: pi });

    if (data.trick.length === 4) {
      const leadSuit = data.trick[0].card.suit;
      let best = 0;
      for (let i = 1; i < 4; i++) {
        const bc = data.trick[best].card;
        const cc = data.trick[i].card;
        if (cc.suit === data.trumpSuit && bc.suit !== data.trumpSuit) best = i;
        else if (cc.suit === bc.suit && rankValue(cc.rank) > rankValue(bc.rank)) best = i;
      }
      const tw = data.trick[best].player;
      const team = tw % 2; // Teams: 0&2 vs 1&3
      data.tricksWon[team]++;
      data.trick = [];
      data.leadPlayer = tw;
      data.currentPlayer = tw;

      // All cards played?
      if (data.hands.every((h) => h.length === 0)) {
        // Score: tricks over 6 count as points
        for (let t = 0; t < 2; t++) {
          if (data.tricksWon[t] > 6) data.scores[t] += data.tricksWon[t] - 6;
        }
        // Check for winner (first to 5)
        for (let t = 0; t < 2; t++) {
          if (data.scores[t] >= 5) {
            data.winner = players[t]; // Team representative
            this.setData(data);
            return { success: true, newState: this.getState() };
          }
        }
        // New round
        this.newRound(data);
      }
    } else {
      data.currentPlayer = (pi + 1) % 4;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private newRound(data: WhistState): void {
    data.dealer = (data.dealer + 1) % 4;
    const deck = shuffle(createDeck());
    data.hands = [[], [], [], []];
    for (let i = 0; i < 52; i++) data.hands[i % 4].push(deck[i]);
    data.trumpSuit = data.hands[data.dealer][data.hands[data.dealer].length - 1].suit;
    data.trick = [];
    data.tricksWon = [0, 0];
    data.currentPlayer = (data.dealer + 1) % 4;
    data.leadPlayer = data.currentPlayer;
    data.round++;
  }

  protected checkGameOver(): boolean {
    return this.getData<WhistState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<WhistState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<WhistState>();
    const sc: Record<string, number> = {};
    const p = this.getPlayers();
    for (let i = 0; i < p.length; i++) sc[p[i]] = d.scores[i % 2];
    return sc;
  }
}
