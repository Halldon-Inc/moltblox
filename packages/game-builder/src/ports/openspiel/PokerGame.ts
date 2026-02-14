import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Card {
  suit: number;
  rank: number;
}

interface PokerState {
  [key: string]: unknown;
  deck: Card[];
  holeCards: Record<string, Card[]>;
  communityCards: Card[];
  pot: number;
  bets: Record<string, number>;
  chips: Record<string, number>;
  currentPlayer: number;
  phase: string;
  folded: Record<string, boolean>;
  lastRaise: number;
  currentBet: number;
  actedThisRound: Record<string, boolean>;
  winner: string | null;
  smallBlind: number;
  bigBlind: number;
}

export class PokerGame extends BaseGame {
  readonly name = 'Texas Holdem Poker';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  private createDeck(): Card[] {
    const deck: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 2; rank <= 14; rank++) {
        deck.push({ suit, rank });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  protected initializeState(playerIds: string[]): PokerState {
    const deck = this.createDeck();
    const holeCards: Record<string, Card[]> = {};
    const chips: Record<string, number> = {};
    const bets: Record<string, number> = {};
    const folded: Record<string, boolean> = {};
    const actedThisRound: Record<string, boolean> = {};

    for (const p of playerIds) {
      holeCards[p] = [deck.pop()!, deck.pop()!];
      chips[p] = 1000;
      bets[p] = 0;
      folded[p] = false;
      actedThisRound[p] = false;
    }

    const smallBlind = 5;
    const bigBlind = 10;
    chips[playerIds[0]] -= smallBlind;
    bets[playerIds[0]] = smallBlind;
    chips[playerIds[1]] -= bigBlind;
    bets[playerIds[1]] = bigBlind;

    return {
      deck,
      holeCards,
      communityCards: [],
      pot: smallBlind + bigBlind,
      bets,
      chips,
      currentPlayer: 0,
      phase: 'preflop',
      folded,
      lastRaise: bigBlind,
      currentBet: bigBlind,
      actedThisRound,
      winner: null,
      smallBlind,
      bigBlind,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PokerState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (data.folded[playerId]) return { success: false, error: 'You have folded' };

    switch (action.type) {
      case 'fold': {
        data.folded[playerId] = true;
        const remaining = players.filter((p) => !data.folded[p]);
        if (remaining.length === 1) {
          data.winner = remaining[0];
          data.chips[remaining[0]] += data.pot;
        }
        break;
      }
      case 'call': {
        const toCall = data.currentBet - data.bets[playerId];
        if (toCall > data.chips[playerId]) return { success: false, error: 'Not enough chips' };
        data.chips[playerId] -= toCall;
        data.bets[playerId] = data.currentBet;
        data.pot += toCall;
        data.actedThisRound[playerId] = true;
        break;
      }
      case 'check': {
        if (data.bets[playerId] < data.currentBet)
          return { success: false, error: 'Cannot check, must call or raise' };
        data.actedThisRound[playerId] = true;
        break;
      }
      case 'raise':
      case 'bet': {
        const amount = Number(action.payload.amount);
        if (isNaN(amount) || amount < data.bigBlind)
          return { success: false, error: 'Invalid raise amount' };
        const totalBet = data.currentBet + amount;
        const toAdd = totalBet - data.bets[playerId];
        if (toAdd > data.chips[playerId]) return { success: false, error: 'Not enough chips' };
        data.chips[playerId] -= toAdd;
        data.pot += toAdd;
        data.bets[playerId] = totalBet;
        data.currentBet = totalBet;
        data.lastRaise = amount;
        // Reset acted for others
        for (const p of players) {
          if (p !== playerId && !data.folded[p]) data.actedThisRound[p] = false;
        }
        data.actedThisRound[playerId] = true;
        break;
      }
      case 'all_in': {
        const allIn = data.chips[playerId];
        data.pot += allIn;
        data.bets[playerId] += allIn;
        if (data.bets[playerId] > data.currentBet) {
          data.currentBet = data.bets[playerId];
          for (const p of players) {
            if (p !== playerId && !data.folded[p]) data.actedThisRound[p] = false;
          }
        }
        data.chips[playerId] = 0;
        data.actedThisRound[playerId] = true;
        break;
      }
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    if (data.winner) {
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    // Switch to next active player
    data.currentPlayer = (data.currentPlayer + 1) % 2;
    while (data.folded[players[data.currentPlayer]]) {
      data.currentPlayer = (data.currentPlayer + 1) % 2;
    }

    // Check if round is complete
    const activePlayers = players.filter((p) => !data.folded[p]);
    const allActed = activePlayers.every((p) => data.actedThisRound[p]);
    const allEqualBets = activePlayers.every(
      (p) => data.bets[p] === data.currentBet || data.chips[p] === 0,
    );

    if (allActed && allEqualBets) {
      this.advancePhase(data, players);
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private advancePhase(data: PokerState, players: string[]): void {
    // Reset round
    for (const p of players) {
      data.bets[p] = 0;
      data.actedThisRound[p] = false;
    }
    data.currentBet = 0;
    data.currentPlayer = 0;
    while (data.folded[players[data.currentPlayer]]) {
      data.currentPlayer = (data.currentPlayer + 1) % 2;
    }

    switch (data.phase) {
      case 'preflop':
        data.communityCards.push(data.deck.pop()!, data.deck.pop()!, data.deck.pop()!);
        data.phase = 'flop';
        break;
      case 'flop':
        data.communityCards.push(data.deck.pop()!);
        data.phase = 'turn';
        break;
      case 'turn':
        data.communityCards.push(data.deck.pop()!);
        data.phase = 'river';
        break;
      case 'river':
        this.showdown(data, players);
        break;
    }
  }

  private showdown(data: PokerState, players: string[]): void {
    const activePlayers = players.filter((p) => !data.folded[p]);
    if (activePlayers.length === 1) {
      data.winner = activePlayers[0];
      data.chips[data.winner] += data.pot;
      return;
    }

    let bestHand = -1;
    let bestPlayer: string | null = null;
    for (const p of activePlayers) {
      const allCards = [...data.holeCards[p], ...data.communityCards];
      const score = this.evaluateHand(allCards);
      if (score > bestHand) {
        bestHand = score;
        bestPlayer = p;
      }
    }
    if (bestPlayer) {
      data.winner = bestPlayer;
      data.chips[bestPlayer] += data.pot;
    }
  }

  private evaluateHand(cards: Card[]): number {
    // Find best 5-card hand from 7 cards
    let bestScore = 0;
    const combos = this.getCombinations(cards, 5);
    for (const combo of combos) {
      const score = this.scoreHand(combo);
      if (score > bestScore) bestScore = score;
    }
    return bestScore;
  }

  private getCombinations(arr: Card[], k: number): Card[][] {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    const [first, ...rest] = arr;
    const withFirst = this.getCombinations(rest, k - 1).map((c) => [first, ...c]);
    const withoutFirst = this.getCombinations(rest, k);
    return [...withFirst, ...withoutFirst];
  }

  private scoreHand(hand: Card[]): number {
    const ranks = hand.map((c) => c.rank).sort((a, b) => b - a);
    const suits = hand.map((c) => c.suit);
    const isFlush = suits.every((s) => s === suits[0]);
    const isStraight = this.checkStraight(ranks);

    const rankCounts = new Map<number, number>();
    for (const r of ranks) rankCounts.set(r, (rankCounts.get(r) || 0) + 1);
    const counts = [...rankCounts.values()].sort((a, b) => b - a);
    const highRanks = [...rankCounts.entries()]
      .sort((a, b) => b[1] - a[1] || b[0] - a[0])
      .map((e) => e[0]);

    let base = 0;
    if (isFlush && isStraight) base = 8000000;
    else if (counts[0] === 4) base = 7000000;
    else if (counts[0] === 3 && counts[1] === 2) base = 6000000;
    else if (isFlush) base = 5000000;
    else if (isStraight) base = 4000000;
    else if (counts[0] === 3) base = 3000000;
    else if (counts[0] === 2 && counts[1] === 2) base = 2000000;
    else if (counts[0] === 2) base = 1000000;

    let tiebreaker = 0;
    for (let i = 0; i < highRanks.length; i++) {
      tiebreaker += highRanks[i] * Math.pow(15, highRanks.length - 1 - i);
    }
    return base + tiebreaker;
  }

  private checkStraight(ranks: number[]): boolean {
    const sorted = [...new Set(ranks)].sort((a, b) => b - a);
    if (sorted.length < 5) return false;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i] - sorted[i + 1] !== 1) {
        // Check for ace-low straight
        if (i === 3 && sorted[0] === 14 && sorted[4] === 2) return true;
        return false;
      }
    }
    return true;
  }

  protected checkGameOver(): boolean {
    return this.getData<PokerState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<PokerState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<PokerState>();
    return { ...data.chips };
  }

  getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as PokerState;
    const masked: Record<string, Card[]> = {};
    for (const [p, cards] of Object.entries(data.holeCards)) {
      masked[p] = p === playerId ? cards : cards.map(() => ({ suit: -1, rank: -1 }));
    }
    return { ...state, data: { ...data, holeCards: masked } };
  }
}
