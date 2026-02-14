import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import { type Card, type Suit, type Rank, createDeck, shuffle, rankValue } from './cardHelpers.js';

interface OhHellState {
  [key: string]: unknown;
  hands: Card[][];
  currentPlayer: number;
  dealer: number;
  trumpSuit: Suit | null;
  trick: { card: Card; player: number }[];
  bids: (number | null)[];
  tricksWon: number[];
  scores: number[];
  leadPlayer: number;
  winner: string | null;
  phase: string; // 'bid' | 'play'
  handSize: number;
  direction: number; // 1 = increasing, -1 = decreasing
  round: number;
}

export class OhHellGame extends BaseGame {
  readonly name = 'Oh Hell';
  readonly version = '1.0.0';
  readonly maxPlayers = 6;

  protected initializeState(playerIds: string[]): OhHellState {
    const n = playerIds.length;
    const maxHand = Math.floor(52 / n);
    const deck = shuffle(createDeck());
    const hands: Card[][] = [];
    for (let i = 0; i < n; i++) hands.push(deck.splice(0, 1));
    const trumpCard = deck.length > 0 ? deck[0] : null;

    return {
      hands,
      currentPlayer: 1,
      dealer: 0,
      trumpSuit: trumpCard ? trumpCard.suit : null,
      trick: [],
      bids: Array(n).fill(null),
      tricksWon: Array(n).fill(0),
      scores: Array(n).fill(0),
      leadPlayer: 1,
      winner: null,
      phase: 'bid',
      handSize: 1,
      direction: 1,
      round: 1,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<OhHellState>();
    const players = this.getPlayers();
    const pi = players.indexOf(playerId);
    const n = players.length;

    if (pi !== data.currentPlayer) return { success: false, error: 'Not your turn' };

    if (data.phase === 'bid') {
      if (action.type !== 'bid') return { success: false, error: 'Must bid' };
      const bid = Number(action.payload.amount);
      if (isNaN(bid) || bid < 0 || bid > data.handSize)
        return { success: false, error: 'Invalid bid' };
      data.bids[pi] = bid;

      // Check if all have bid
      const next = (pi + 1) % n;
      if (data.bids.every((b) => b !== null)) {
        data.phase = 'play';
        data.currentPlayer = (data.dealer + 1) % n;
        data.leadPlayer = data.currentPlayer;
      } else {
        data.currentPlayer = next;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'play') {
      if (action.type !== 'play') return { success: false, error: 'Must play a card' };
      const [r, s] = (action.payload.card as string).split('_');
      const card: Card = { rank: r as Rank, suit: s as Suit };
      const hand = data.hands[pi];
      const idx = hand.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
      if (idx === -1) return { success: false, error: 'Card not in hand' };

      if (data.trick.length > 0) {
        const leadSuit = data.trick[0].card.suit;
        if (card.suit !== leadSuit && hand.some((c) => c.suit === leadSuit)) {
          return { success: false, error: 'Must follow suit' };
        }
      }

      hand.splice(idx, 1);
      data.trick.push({ card, player: pi });

      if (data.trick.length === n) {
        let best = 0;
        for (let i = 1; i < n; i++) {
          const bc = data.trick[best].card;
          const cc = data.trick[i].card;
          if (data.trumpSuit && cc.suit === data.trumpSuit && bc.suit !== data.trumpSuit) best = i;
          else if (cc.suit === bc.suit && rankValue(cc.rank) > rankValue(bc.rank)) best = i;
        }
        const tw = data.trick[best].player;
        data.tricksWon[tw]++;
        data.trick = [];
        data.leadPlayer = tw;
        data.currentPlayer = tw;

        if (data.hands.every((h) => h.length === 0)) {
          // Score: exact bid = 10 + bid
          for (let i = 0; i < n; i++) {
            if (data.tricksWon[i] === data.bids[i]) {
              data.scores[i] += 10 + (data.bids[i] as number);
            }
          }

          // Check winner (first to 100)
          for (let i = 0; i < n; i++) {
            if (data.scores[i] >= 100) {
              data.winner = players[i];
              this.setData(data);
              return { success: true, newState: this.getState() };
            }
          }

          // Next round
          const maxHand = Math.floor(52 / n);
          if (data.direction === 1) {
            if (data.handSize >= maxHand) data.direction = -1;
            else data.handSize++;
          }
          if (data.direction === -1) {
            data.handSize--;
            if (data.handSize <= 0) {
              data.handSize = 1;
              data.direction = 1;
            }
          }

          data.dealer = (data.dealer + 1) % n;
          const deck = shuffle(createDeck());
          for (let i = 0; i < n; i++) data.hands[i] = deck.splice(0, data.handSize);
          data.trumpSuit = deck.length > 0 ? deck[0].suit : null;
          data.bids = Array(n).fill(null);
          data.tricksWon = Array(n).fill(0);
          data.phase = 'bid';
          data.currentPlayer = (data.dealer + 1) % n;
          data.round++;
        }
      } else {
        data.currentPlayer = (pi + 1) % n;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: 'Invalid phase' };
  }

  protected checkGameOver(): boolean {
    return this.getData<OhHellState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<OhHellState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<OhHellState>();
    const sc: Record<string, number> = {};
    const p = this.getPlayers();
    for (let i = 0; i < p.length; i++) sc[p[i]] = d.scores[i];
    return sc;
  }
}
