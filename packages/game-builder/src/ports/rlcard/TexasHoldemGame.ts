import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface TexasHoldemConfig {
  startingChips?: number;
  bigBlind?: number;
}

/**
 * Texas Hold'em (simplified, 2-player). Standard 52-card deck.
 * Each player gets 2 hole cards. Betting rounds: preflop, flop (3 community),
 * turn (1 community), river (1 community). Standard hand rankings.
 * Actions: fold, check, call, raise.
 */

interface Card {
  rank: number; // 2-14 (14 = Ace)
  suit: number; // 0-3
}

interface TexasHoldemState {
  [key: string]: unknown;
  deck: Card[];
  holeCards: Record<string, Card[]>;
  community: Card[];
  pot: number;
  bets: number[];
  chips: number[];
  currentPlayer: number;
  round: number; // 0=preflop, 1=flop, 2=turn, 3=river
  raises: number;
  maxRaises: number;
  folded: number;
  winner: string | null;
  lastAction: string | null;
  actionsInRound: number;
  bigBlind: number;
}

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (let rank = 2; rank <= 14; rank++) {
    for (let suit = 0; suit < 4; suit++) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function evaluateHand(cards: Card[]): number {
  // Simplified hand evaluation: returns a score for comparison
  // Higher is better. Categories: high card, pair, two pair, trips, straight,
  // flush, full house, quads, straight flush
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  // Count ranks
  const counts: Record<number, number> = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const groups = Object.entries(counts).map(([r, c]) => ({ rank: Number(r), count: c }));
  groups.sort((a, b) => b.count - a.count || b.rank - a.rank);

  // Check flush
  const suitCounts: Record<number, number> = {};
  for (const s of suits) suitCounts[s] = (suitCounts[s] || 0) + 1;
  const isFlush = Object.values(suitCounts).some((c) => c >= 5);

  // Check straight
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;
  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {
      isStraight = true;
      straightHigh = uniqueRanks[i];
      break;
    }
  }
  // Ace-low straight
  if (
    !isStraight &&
    uniqueRanks.includes(14) &&
    uniqueRanks.includes(5) &&
    uniqueRanks.includes(4) &&
    uniqueRanks.includes(3) &&
    uniqueRanks.includes(2)
  ) {
    isStraight = true;
    straightHigh = 5;
  }

  if (isStraight && isFlush) return 8000000 + straightHigh;
  if (groups[0].count === 4) return 7000000 + groups[0].rank * 100 + groups[1].rank;
  if (groups[0].count === 3 && groups[1].count >= 2)
    return 6000000 + groups[0].rank * 100 + groups[1].rank;
  if (isFlush) return 5000000 + ranks[0] * 10000 + ranks[1] * 100 + ranks[2];
  if (isStraight) return 4000000 + straightHigh;
  if (groups[0].count === 3)
    return 3000000 + groups[0].rank * 10000 + groups[1].rank * 100 + groups[2].rank;
  if (groups[0].count === 2 && groups[1].count === 2)
    return (
      2000000 +
      Math.max(groups[0].rank, groups[1].rank) * 10000 +
      Math.min(groups[0].rank, groups[1].rank) * 100 +
      groups[2].rank
    );
  if (groups[0].count === 2)
    return 1000000 + groups[0].rank * 10000 + groups[1].rank * 100 + groups[2].rank;
  return ranks[0] * 10000 + ranks[1] * 100 + ranks[2];
}

export class TexasHoldemGame extends BaseGame {
  readonly name = 'Texas Holdem';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  override initialize(playerIds: string[]): void {
    while (playerIds.length < 2) {
      playerIds.push(`bot-${playerIds.length}`);
    }
    super.initialize(playerIds);
  }

  protected initializeState(playerIds: string[]): TexasHoldemState {
    const cfg = this.config as TexasHoldemConfig;
    const startingChips = cfg.startingChips ?? 100;
    const bigBlind = cfg.bigBlind ?? 2;
    const deck = createDeck();
    const holeCards: Record<string, Card[]> = {};
    for (const pid of playerIds) {
      holeCards[pid] = [deck.pop()!, deck.pop()!];
    }
    // Blinds: player 0 = small blind (1), player 1 = big blind (2)
    const sb = Math.floor(bigBlind / 2);
    return {
      deck,
      holeCards,
      community: [],
      pot: sb + bigBlind,
      bets: [sb, bigBlind],
      chips: [startingChips - sb, startingChips - bigBlind],
      currentPlayer: 0,
      round: 0,
      raises: 0,
      maxRaises: 4,
      folded: -1,
      winner: null,
      lastAction: null,
      actionsInRound: 0,
      bigBlind,
    };
  }

  private advanceRound(data: TexasHoldemState): void {
    data.round++;
    data.raises = 0;
    data.actionsInRound = 0;
    data.lastAction = null;
    data.bets = [0, 0];
    data.currentPlayer = 0;

    if (data.round === 1) {
      // Flop: 3 community cards
      for (let i = 0; i < 3; i++) data.community.push(data.deck.pop()!);
    } else if (data.round === 2) {
      data.community.push(data.deck.pop()!);
    } else if (data.round === 3) {
      data.community.push(data.deck.pop()!);
    } else {
      // Showdown
      this.doShowdown(data);
    }
  }

  private doShowdown(data: TexasHoldemState): void {
    const players = this.getPlayers();
    const scores: number[] = [];
    for (const pid of players) {
      const allCards = [...data.holeCards[pid], ...data.community];
      scores.push(evaluateHand(allCards));
    }
    if (scores[0] > scores[1]) {
      data.winner = players[0];
    } else if (scores[1] > scores[0]) {
      data.winner = players[1];
    } else {
      data.winner = null; // Tie
    }
    this.emitEvent('showdown', undefined, {
      scores: { [players[0]]: scores[0], [players[1]]: scores[1] },
    });
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TexasHoldemState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    const act = action.type;
    if (!['fold', 'check', 'call', 'raise'].includes(act)) {
      return { success: false, error: `Unknown action: ${act}` };
    }

    const otherIdx = 1 - pIdx;

    if (act === 'fold') {
      data.folded = pIdx;
      data.winner = players[otherIdx];
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (act === 'check') {
      if (data.bets[pIdx] < data.bets[otherIdx]) {
        return { success: false, error: 'Cannot check when facing a bet' };
      }
      data.lastAction = 'check';
      data.actionsInRound++;
    } else if (act === 'call') {
      const diff = data.bets[otherIdx] - data.bets[pIdx];
      if (diff <= 0) return { success: false, error: 'Nothing to call' };
      const actual = Math.min(diff, data.chips[pIdx]);
      data.chips[pIdx] -= actual;
      data.bets[pIdx] += actual;
      data.pot += actual;
      data.lastAction = 'call';
      data.actionsInRound++;
    } else if (act === 'raise') {
      if (data.raises >= data.maxRaises) {
        return { success: false, error: 'Max raises reached' };
      }
      const raiseAmt = Number(action.payload.amount ?? data.bigBlind);
      const diff = data.bets[otherIdx] - data.bets[pIdx];
      const total = diff + raiseAmt;
      const actual = Math.min(total, data.chips[pIdx]);
      data.chips[pIdx] -= actual;
      data.bets[pIdx] += actual;
      data.pot += actual;
      data.raises++;
      data.lastAction = 'raise';
      data.actionsInRound++;
    }

    // Check round end
    const roundEnds =
      data.lastAction === 'call' || (data.lastAction === 'check' && data.actionsInRound >= 2);

    if (roundEnds) {
      this.advanceRound(data);
    } else {
      data.currentPlayer = otherIdx;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  override getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as TexasHoldemState;
    const players = this.getPlayers();
    if (!this.isGameOver()) {
      const hidden: Record<string, Card[]> = {};
      for (const pid of players) {
        hidden[pid] =
          pid === playerId
            ? data.holeCards[pid]
            : [
                { rank: 0, suit: -1 },
                { rank: 0, suit: -1 },
              ];
      }
      data.holeCards = hidden;
    }
    return state;
  }

  protected checkGameOver(): boolean {
    const data = this.getData<TexasHoldemState>();
    return data.winner !== null || data.folded >= 0;
  }

  protected determineWinner(): string | null {
    return this.getData<TexasHoldemState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<TexasHoldemState>();
    const players = this.getPlayers();
    const scores: Record<string, number> = {};
    const winner = data.winner;
    if (winner) {
      for (const p of players) scores[p] = p === winner ? data.pot : 0;
    } else {
      for (const p of players) scores[p] = Math.floor(data.pot / 2);
    }
    return scores;
  }
}
