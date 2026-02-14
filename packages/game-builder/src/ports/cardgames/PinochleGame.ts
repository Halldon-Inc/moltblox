import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import { type Card, type Suit, type Rank, shuffle } from './cardHelpers.js';

const PIN_RANKS: Rank[] = ['9', '10', 'J', 'Q', 'K', 'A'];
const PIN_SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

function createPinochleDeck(): Card[] {
  const deck: Card[] = [];
  for (let c = 0; c < 2; c++)
    for (const suit of PIN_SUITS) for (const rank of PIN_RANKS) deck.push({ rank, suit });
  return deck;
}

interface PinochleState {
  [key: string]: unknown;
  hands: Card[][];
  currentPlayer: number;
  dealer: number;
  trumpSuit: Suit | null;
  phase: string;
  bids: (number | null)[];
  highBidder: number;
  highBid: number;
  scores: number[];
  trick: { card: Card; player: number }[];
  tricksWon: number[];
  cardsPlayed: number;
  winner: string | null;
}

export class PinochleGame extends BaseGame {
  readonly name = 'Pinochle';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): PinochleState {
    const deck = shuffle(createPinochleDeck());
    const n = playerIds.length;
    const hands: Card[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < deck.length; i++) hands[i % n].push(deck[i]);
    return {
      hands,
      currentPlayer: 1,
      dealer: 0,
      trumpSuit: null,
      phase: 'bid',
      bids: Array(n).fill(null),
      highBidder: -1,
      highBid: 0,
      scores: Array(n).fill(0),
      trick: [],
      tricksWon: Array(n).fill(0),
      cardsPlayed: 0,
      winner: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PinochleState>();
    const players = this.getPlayers();
    const pi = players.indexOf(playerId);
    if (pi !== data.currentPlayer) return { success: false, error: 'Not your turn' };

    if (data.phase === 'bid') {
      if (action.type !== 'bid') return { success: false, error: 'Must bid' };
      if (action.payload.pass) {
        data.bids[pi] = -1;
      } else {
        const bid = Number(action.payload.amount);
        if (isNaN(bid) || (data.highBid > 0 && bid <= data.highBid))
          return { success: false, error: 'Bid too low' };
        data.bids[pi] = bid;
        data.highBidder = pi;
        data.highBid = bid;
      }
      let active = 0;
      for (let i = 0; i < players.length; i++) if (data.bids[i] !== -1) active++;
      if (active <= 1 && data.highBidder >= 0) {
        data.phase = 'trump';
        data.currentPlayer = data.highBidder;
      } else {
        let next = (pi + 1) % players.length;
        while (data.bids[next] === -1) next = (next + 1) % players.length;
        data.currentPlayer = next;
      }
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'trump') {
      if (action.type !== 'declare_trump') return { success: false, error: 'Must declare trump' };
      const suit = action.payload.suit as Suit;
      if (!PIN_SUITS.includes(suit)) return { success: false, error: 'Invalid suit' };
      data.trumpSuit = suit;
      data.phase = 'play';
      data.currentPlayer = data.highBidder;
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
        const lead = data.trick[0].card.suit;
        if (card.suit !== lead && hand.some((c) => c.suit === lead))
          return { success: false, error: 'Must follow suit' };
      }

      hand.splice(idx, 1);
      data.trick.push({ card, player: pi });
      data.cardsPlayed++;

      if (data.trick.length === players.length) {
        let best = 0;
        for (let i = 1; i < data.trick.length; i++) {
          const bc = data.trick[best].card;
          const cc = data.trick[i].card;
          if (cc.suit === data.trumpSuit && bc.suit !== data.trumpSuit) best = i;
          else if (cc.suit === bc.suit && this.pv(cc.rank) > this.pv(bc.rank)) best = i;
        }
        const tw = data.trick[best].player;
        data.tricksWon[tw]++;
        let tp = 0;
        for (const t of data.trick) if (['A', '10', 'K'].includes(t.card.rank)) tp++;
        data.scores[tw] += tp;
        data.trick = [];
        data.currentPlayer = tw;

        if (data.hands.every((h) => h.length === 0)) {
          data.scores[tw] += 1;
          if (data.scores[data.highBidder] < data.highBid)
            data.scores[data.highBidder] -= data.highBid;
          for (let i = 0; i < players.length; i++) {
            if (data.scores[i] >= 150) {
              data.winner = players[i];
              break;
            }
          }
          if (!data.winner) this.newRound(data, players);
        }
      } else {
        data.currentPlayer = (pi + 1) % players.length;
      }
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: 'Invalid phase' };
  }

  private pv(rank: Rank): number {
    const v: Record<string, number> = { '9': 0, J: 2, Q: 3, K: 4, '10': 10, A: 11 };
    return v[rank] ?? 0;
  }

  private newRound(data: PinochleState, players: string[]): void {
    data.dealer = (data.dealer + 1) % players.length;
    const deck = shuffle(createPinochleDeck());
    const n = players.length;
    data.hands = Array.from({ length: n }, () => []);
    for (let i = 0; i < deck.length; i++) data.hands[i % n].push(deck[i]);
    data.trumpSuit = null;
    data.phase = 'bid';
    data.bids = Array(n).fill(null);
    data.highBidder = -1;
    data.highBid = 0;
    data.trick = [];
    data.tricksWon = Array(n).fill(0);
    data.cardsPlayed = 0;
    data.currentPlayer = (data.dealer + 1) % n;
  }

  protected checkGameOver(): boolean {
    return this.getData<PinochleState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<PinochleState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<PinochleState>();
    const s: Record<string, number> = {};
    const p = this.getPlayers();
    for (let i = 0; i < p.length; i++) s[p[i]] = d.scores[i];
    return s;
  }
}
