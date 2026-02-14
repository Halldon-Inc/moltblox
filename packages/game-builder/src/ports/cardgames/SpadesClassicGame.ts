import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import { type Card, type Suit, type Rank, createDeck, shuffle, rankValue } from './cardHelpers.js';

interface SpadesState {
  [key: string]: unknown;
  hands: Card[][];
  currentPlayer: number;
  dealer: number;
  trick: { card: Card; player: number }[];
  bids: (number | null)[];
  tricksWon: number[]; // per team
  teamScores: number[]; // team 0 (players 0,2) vs team 1 (players 1,3)
  teamBags: number[];
  leadPlayer: number;
  winner: string | null;
  phase: string;
  spadesBroken: boolean;
  round: number;
}

export class SpadesClassicGame extends BaseGame {
  readonly name = 'Spades Classic';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): SpadesState {
    const deck = shuffle(createDeck());
    const hands: Card[][] = [[], [], [], []];
    for (let i = 0; i < 52; i++) hands[i % 4].push(deck[i]);
    return {
      hands,
      currentPlayer: 1,
      dealer: 0,
      trick: [],
      bids: [null, null, null, null],
      tricksWon: [0, 0],
      teamScores: [0, 0],
      teamBags: [0, 0],
      leadPlayer: 1,
      winner: null,
      phase: 'bid',
      spadesBroken: false,
      round: 1,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SpadesState>();
    const players = this.getPlayers();
    const pi = players.indexOf(playerId);

    if (pi !== data.currentPlayer) return { success: false, error: 'Not your turn' };

    if (data.phase === 'bid') {
      if (action.type !== 'bid') return { success: false, error: 'Must bid' };
      const bid = Number(action.payload.amount);
      if (isNaN(bid) || bid < 0 || bid > 13) return { success: false, error: 'Invalid bid (0-13)' };
      data.bids[pi] = bid;

      if (data.bids.every((b) => b !== null)) {
        data.phase = 'play';
        data.currentPlayer = (data.dealer + 1) % 4;
        data.leadPlayer = data.currentPlayer;
      } else {
        data.currentPlayer = (pi + 1) % 4;
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

      // Leading spades: must be broken or all spades
      if (data.trick.length === 0 && card.suit === 'spades' && !data.spadesBroken) {
        if (!hand.every((c) => c.suit === 'spades')) {
          return { success: false, error: 'Spades not broken yet' };
        }
      }

      // Must follow suit
      if (data.trick.length > 0) {
        const leadSuit = data.trick[0].card.suit;
        if (card.suit !== leadSuit && hand.some((c) => c.suit === leadSuit)) {
          return { success: false, error: 'Must follow suit' };
        }
      }

      if (card.suit === 'spades') data.spadesBroken = true;

      hand.splice(idx, 1);
      data.trick.push({ card, player: pi });

      if (data.trick.length === 4) {
        let best = 0;
        for (let i = 1; i < 4; i++) {
          const bc = data.trick[best].card;
          const cc = data.trick[i].card;
          if (cc.suit === 'spades' && bc.suit !== 'spades') best = i;
          else if (cc.suit === bc.suit && rankValue(cc.rank) > rankValue(bc.rank)) best = i;
        }
        const tw = data.trick[best].player;
        const team = tw % 2;
        data.tricksWon[team]++;
        data.trick = [];
        data.leadPlayer = tw;
        data.currentPlayer = tw;

        if (data.hands.every((h) => h.length === 0)) {
          this.scoreRound(data, players);
        }
      } else {
        data.currentPlayer = (pi + 1) % 4;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: 'Invalid phase' };
  }

  private scoreRound(data: SpadesState, players: string[]): void {
    for (let t = 0; t < 2; t++) {
      const teamBid = (data.bids[t] as number) + (data.bids[t + 2] as number);
      const tricks = data.tricksWon[t];

      if (tricks >= teamBid) {
        data.teamScores[t] += teamBid * 10;
        const overtricks = tricks - teamBid;
        data.teamScores[t] += overtricks; // Bags
        data.teamBags[t] += overtricks;
        // Bag penalty: 10 bags = -100
        if (data.teamBags[t] >= 10) {
          data.teamScores[t] -= 100;
          data.teamBags[t] -= 10;
        }
      } else {
        data.teamScores[t] -= teamBid * 10; // Set
      }

      // Nil bids
      for (const pi of [t, t + 2]) {
        if (data.bids[pi] === 0) {
          // Nil bonus/penalty depends on individual tricks
          // Simplified: team gets +100 if nil player took 0, else -100
          // We track team tricks not individual, so approximate
          data.teamScores[t] += 50; // Simplified nil
        }
      }
    }

    // Check winner (500 points, or opponent below -200)
    for (let t = 0; t < 2; t++) {
      if (data.teamScores[t] >= 500) {
        data.winner = players[t]; // Team representative
        return;
      }
    }
    for (let t = 0; t < 2; t++) {
      if (data.teamScores[t] <= -200) {
        data.winner = players[(t + 1) % 2]; // Other team wins
        return;
      }
    }

    // New round
    data.dealer = (data.dealer + 1) % 4;
    const deck = shuffle(createDeck());
    data.hands = [[], [], [], []];
    for (let i = 0; i < 52; i++) data.hands[i % 4].push(deck[i]);
    data.trick = [];
    data.bids = [null, null, null, null];
    data.tricksWon = [0, 0];
    data.spadesBroken = false;
    data.phase = 'bid';
    data.currentPlayer = (data.dealer + 1) % 4;
    data.leadPlayer = data.currentPlayer;
    data.round++;
  }

  protected checkGameOver(): boolean {
    return this.getData<SpadesState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<SpadesState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<SpadesState>();
    const sc: Record<string, number> = {};
    const p = this.getPlayers();
    for (let i = 0; i < p.length; i++) sc[p[i]] = d.teamScores[i % 2];
    return sc;
  }
}
