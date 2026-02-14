import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface PresidentConfig {
  rounds?: number;
}

interface Card {
  rank: number; // 3-15 (3 lowest, 15=2 which is highest, 14=Ace)
  suit: number; // 0-3
}

interface PresidentState {
  [key: string]: unknown;
  hands: Record<string, Card[]>;
  currentPlay: Card[];
  currentPlayRank: number;
  currentPlayCount: number;
  passCount: number;
  currentPlayer: number;
  finishOrder: string[];
  lastPlayer: string | null;
  phase: string; // 'play' | 'done'
  winner: string | null;
  rankings: Record<string, string>; // playerId to rank title
}

function presidentRank(rank: number): number {
  // In President, 2 is highest, then A, K, Q, ... 3 is lowest
  if (rank === 2) return 15;
  return rank;
}

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const RANK_TITLES = ['President', 'Vice President', 'Citizen', 'Vice Scum', 'Scum', 'Ultra Scum'];

/**
 * President (also known as Scum):
 * 3-6 players. Deal all cards. Play singles, pairs, or triples that beat
 * the current play. Pass if you cannot or choose not to play.
 * When all but one player pass, the pile is cleared and the last player leads.
 * First to empty hand = President, last = Scum.
 * Actions: play, pass.
 */
export class PresidentGame extends BaseGame {
  readonly name = 'President';
  readonly version = '1.0.0';
  readonly maxPlayers = 6;

  protected initializeState(playerIds: string[]): PresidentState {
    const deck = createDeck();
    const hands: Record<string, Card[]> = {};
    let cardIdx = 0;
    for (const pid of playerIds) hands[pid] = [];
    while (cardIdx < deck.length) {
      for (const pid of playerIds) {
        if (cardIdx < deck.length) {
          hands[pid].push(deck[cardIdx++]);
        }
      }
    }
    // Sort each hand by rank
    for (const pid of playerIds) {
      hands[pid].sort((a, b) => presidentRank(a.rank) - presidentRank(b.rank));
    }
    return {
      hands,
      currentPlay: [],
      currentPlayRank: 0,
      currentPlayCount: 0,
      passCount: 0,
      currentPlayer: 0,
      finishOrder: [],
      lastPlayer: null,
      phase: 'play',
      winner: null,
      rankings: {},
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PresidentState>();
    const players = this.getPlayers();
    const activePlayers = players.filter(
      (p) => data.hands[p].length > 0 && !data.finishOrder.includes(p),
    );
    const pIdx = players.indexOf(playerId);

    if (pIdx !== data.currentPlayer) {
      return { success: false, error: 'Not your turn' };
    }

    if (action.type === 'pass') {
      if (data.currentPlay.length === 0 && data.hands[playerId].length > 0) {
        return { success: false, error: 'Cannot pass when leading' };
      }
      data.passCount++;

      // Check if all other active players have passed
      const activeCount = activePlayers.length;
      if (data.passCount >= activeCount - 1) {
        // Clear the pile, last player leads
        data.currentPlay = [];
        data.currentPlayRank = 0;
        data.currentPlayCount = 0;
        data.passCount = 0;
        // Find the last player who played
        if (data.lastPlayer) {
          data.currentPlayer = players.indexOf(data.lastPlayer);
        }
      } else {
        this.advanceToNextActive(data, players);
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'play') {
      const cardIndices = action.payload.cardIndices as number[] | undefined;
      const singleIdx = action.payload.cardIndex as number | undefined;
      let indices: number[];

      if (Array.isArray(cardIndices)) {
        indices = cardIndices.map(Number);
      } else if (singleIdx !== undefined) {
        indices = [Number(singleIdx)];
      } else {
        return { success: false, error: 'Must specify cardIndex or cardIndices' };
      }

      const hand = data.hands[playerId];
      for (const idx of indices) {
        if (isNaN(idx) || idx < 0 || idx >= hand.length) {
          return { success: false, error: 'Invalid card index' };
        }
      }

      const cards = indices.map((i) => hand[i]);

      // All played cards must be the same rank
      const playRank = presidentRank(cards[0].rank);
      if (!cards.every((c) => presidentRank(c.rank) === playRank)) {
        return { success: false, error: 'All played cards must be the same rank' };
      }

      // Must match the count of the current play (if there is one)
      if (data.currentPlayCount > 0 && cards.length !== data.currentPlayCount) {
        return { success: false, error: `Must play exactly ${data.currentPlayCount} cards` };
      }

      // Must beat the current play rank
      if (playRank <= data.currentPlayRank) {
        return { success: false, error: 'Must play higher rank than current' };
      }

      // Remove cards from hand (highest index first)
      const sorted = [...indices].sort((a, b) => b - a);
      for (const idx of sorted) {
        hand.splice(idx, 1);
      }

      data.currentPlay = cards;
      data.currentPlayRank = playRank;
      data.currentPlayCount = cards.length;
      data.passCount = 0;
      data.lastPlayer = playerId;

      this.emitEvent('cards_played', playerId, { rank: playRank, count: cards.length });

      // Check if player finished
      if (hand.length === 0) {
        data.finishOrder.push(playerId);
        const titleIdx = Math.min(data.finishOrder.length - 1, RANK_TITLES.length - 1);
        data.rankings[playerId] = RANK_TITLES[titleIdx];
        this.emitEvent('player_finished', playerId, { rank: data.rankings[playerId] });

        // Check if game is over (only 1 active player left)
        const remaining = players.filter(
          (p) => data.hands[p].length > 0 && !data.finishOrder.includes(p),
        );
        if (remaining.length <= 1) {
          if (remaining.length === 1) {
            data.finishOrder.push(remaining[0]);
            const lastTitle = Math.min(data.finishOrder.length - 1, RANK_TITLES.length - 1);
            data.rankings[remaining[0]] = RANK_TITLES[lastTitle];
          }
          data.phase = 'done';
          data.winner = data.finishOrder[0];
          this.setData(data);
          return { success: true, newState: this.getState() };
        }
      }

      this.advanceToNextActive(data, players);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  private advanceToNextActive(data: PresidentState, players: string[]): void {
    let next = (data.currentPlayer + 1) % players.length;
    let attempts = 0;
    while (attempts < players.length) {
      if (data.hands[players[next]].length > 0 && !data.finishOrder.includes(players[next])) {
        break;
      }
      next = (next + 1) % players.length;
      attempts++;
    }
    data.currentPlayer = next;
  }

  protected checkGameOver(): boolean {
    return this.getData<PresidentState>().phase === 'done';
  }

  protected determineWinner(): string | null {
    return this.getData<PresidentState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<PresidentState>();
    const scores: Record<string, number> = {};
    const players = this.getPlayers();
    for (let i = 0; i < data.finishOrder.length; i++) {
      // Higher score for finishing earlier
      scores[data.finishOrder[i]] = players.length - i;
    }
    // Any remaining players get 0
    for (const p of players) {
      if (!(p in scores)) scores[p] = 0;
    }
    return scores;
  }
}
