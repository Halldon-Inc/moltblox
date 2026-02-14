import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface LeducHoldemConfig {
  startingChips?: number;
}

/**
 * Leduc Hold'em: Simplified poker. 6-card deck (J, Q, K in 2 suits).
 * Each player gets 1 card, 2 rounds of betting. In round 2 a community
 * card is revealed. Pair with community card beats high card.
 * Max 2 raises per round. Fixed bet sizes: round 1 = 2, round 2 = 4.
 */

type LeducCard = { rank: string; suit: number };

interface LeducHoldemState {
  [key: string]: unknown;
  deck: LeducCard[];
  holeCards: Record<string, LeducCard>;
  communityCard: LeducCard | null;
  pot: number;
  bets: number[];
  currentPlayer: number;
  round: number;
  raises: number;
  folded: number; // -1 if no one folded, else player index who folded
  winner: string | null;
  roundBetSizes: number[];
  chips: number[];
  lastAction: string | null;
  actionsInRound: number;
}

const RANKS = ['J', 'Q', 'K'];

function createDeck(): LeducCard[] {
  const deck: LeducCard[] = [];
  for (const rank of RANKS) {
    for (let suit = 0; suit < 2; suit++) {
      deck.push({ rank, suit });
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handStrength(hole: LeducCard, community: LeducCard | null): number {
  const rankValue: Record<string, number> = { J: 1, Q: 2, K: 3 };
  if (community && hole.rank === community.rank) {
    return 10 + rankValue[hole.rank]; // Pair
  }
  return rankValue[hole.rank]; // High card
}

export class LeducHoldemGame extends BaseGame {
  readonly name = 'Leduc Holdem';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  override initialize(playerIds: string[]): void {
    while (playerIds.length < 2) {
      playerIds.push(`bot-${playerIds.length}`);
    }
    super.initialize(playerIds);
  }

  protected initializeState(playerIds: string[]): LeducHoldemState {
    const startingChips = (this.config as LeducHoldemConfig).startingChips ?? 10;
    const deck = createDeck();
    const holeCards: Record<string, LeducCard> = {};
    for (const pid of playerIds) {
      holeCards[pid] = deck.pop()!;
    }
    // Ante: 1 chip each
    return {
      deck,
      holeCards,
      communityCard: null,
      pot: 2,
      bets: [1, 1],
      currentPlayer: 0,
      round: 1,
      raises: 0,
      folded: -1,
      winner: null,
      roundBetSizes: [2, 4],
      chips: [startingChips - 1, startingChips - 1],
      lastAction: null,
      actionsInRound: 0,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<LeducHoldemState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    const act = action.type;
    if (!['fold', 'check', 'call', 'raise'].includes(act)) {
      return { success: false, error: `Unknown action: ${act}. Use fold, check, call, or raise` };
    }

    const betSize = data.roundBetSizes[data.round - 1];
    const otherIdx = 1 - pIdx;

    if (act === 'fold') {
      data.folded = pIdx;
      data.winner = players[otherIdx];
      this.emitEvent('fold', playerId, {});
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (act === 'check') {
      if (data.bets[pIdx] < data.bets[otherIdx]) {
        return { success: false, error: 'Cannot check, must call or raise' };
      }
      data.lastAction = 'check';
      data.actionsInRound++;
    } else if (act === 'call') {
      const diff = data.bets[otherIdx] - data.bets[pIdx];
      if (diff <= 0) {
        return { success: false, error: 'Nothing to call, use check' };
      }
      const actual = Math.min(diff, data.chips[pIdx]);
      data.chips[pIdx] -= actual;
      data.bets[pIdx] += actual;
      data.pot += actual;
      data.lastAction = 'call';
      data.actionsInRound++;
    } else if (act === 'raise') {
      if (data.raises >= 2) {
        return { success: false, error: 'Max 2 raises per round' };
      }
      const diff = data.bets[otherIdx] - data.bets[pIdx];
      const total = diff + betSize;
      const actual = Math.min(total, data.chips[pIdx]);
      data.chips[pIdx] -= actual;
      data.bets[pIdx] += actual;
      data.pot += actual;
      data.raises++;
      data.lastAction = 'raise';
      data.actionsInRound++;
    }

    // Check if round ends
    const roundEnds =
      data.lastAction === 'call' || (data.lastAction === 'check' && data.actionsInRound >= 2);

    if (roundEnds) {
      if (data.round === 1) {
        // Reveal community card
        data.communityCard = data.deck.pop()!;
        data.round = 2;
        data.raises = 0;
        data.actionsInRound = 0;
        data.lastAction = null;
        data.currentPlayer = 0; // Player 0 acts first in round 2
      } else {
        // Showdown
        const p0Str = handStrength(data.holeCards[players[0]], data.communityCard);
        const p1Str = handStrength(data.holeCards[players[1]], data.communityCard);
        if (p0Str > p1Str) {
          data.winner = players[0];
        } else if (p1Str > p0Str) {
          data.winner = players[1];
        } else {
          data.winner = null; // Tie, split pot
        }
        this.emitEvent('showdown', undefined, {
          hands: { [players[0]]: p0Str, [players[1]]: p1Str },
        });
      }
    } else {
      data.currentPlayer = otherIdx;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  override getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as LeducHoldemState;
    const players = this.getPlayers();
    // Hide opponent's hole card
    if (!this.isGameOver()) {
      const hidden: Record<string, LeducCard> = {};
      for (const pid of players) {
        hidden[pid] = pid === playerId ? data.holeCards[pid] : { rank: '?', suit: -1 };
      }
      data.holeCards = hidden;
    }
    return state;
  }

  protected checkGameOver(): boolean {
    const data = this.getData<LeducHoldemState>();
    return data.winner !== null || data.folded >= 0;
  }

  protected determineWinner(): string | null {
    return this.getData<LeducHoldemState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<LeducHoldemState>();
    const players = this.getPlayers();
    const scores: Record<string, number> = {};
    const winner = data.winner;
    if (winner) {
      for (const p of players) scores[p] = p === winner ? data.pot : 0;
    } else {
      // Split
      for (const p of players) scores[p] = Math.floor(data.pot / 2);
    }
    return scores;
  }
}
