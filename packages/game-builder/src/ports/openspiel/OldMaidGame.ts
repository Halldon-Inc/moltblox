import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Card {
  suit: number;
  rank: number;
}

interface OldMaidState {
  [key: string]: unknown;
  hands: Record<string, Card[]>;
  currentPlayer: number;
  targetPlayer: number;
  eliminated: Record<string, boolean>;
  loser: string | null;
  gameOver: boolean;
}

export class OldMaidGame extends BaseGame {
  readonly name = 'Old Maid';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): OldMaidState {
    const deck: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) {
        if (suit === 0 && rank === 12) continue; // Remove one queen
        deck.push({ suit, rank });
      }
    }

    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const hands: Record<string, Card[]> = {};
    const eliminated: Record<string, boolean> = {};
    for (const p of playerIds) {
      hands[p] = [];
      eliminated[p] = false;
    }
    for (let i = 0; i < deck.length; i++) {
      hands[playerIds[i % playerIds.length]].push(deck[i]);
    }

    for (const p of playerIds) {
      hands[p] = this.removePairs(hands[p]);
      if (hands[p].length === 0) eliminated[p] = true;
    }

    let current = 0;
    while (eliminated[playerIds[current]] && current < playerIds.length - 1) current++;
    let target = (current + 1) % playerIds.length;
    while (eliminated[playerIds[target]] && target !== current)
      target = (target + 1) % playerIds.length;

    return {
      hands,
      currentPlayer: current,
      targetPlayer: target,
      eliminated,
      loser: null,
      gameOver: false,
    };
  }

  private removePairs(hand: Card[]): Card[] {
    const rankGroups = new Map<number, Card[]>();
    for (const card of hand) {
      const group = rankGroups.get(card.rank) || [];
      group.push(card);
      rankGroups.set(card.rank, group);
    }

    const remaining: Card[] = [];
    for (const [, group] of rankGroups) {
      if (group.length % 2 === 1) remaining.push(group[0]);
    }
    return remaining;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<OldMaidState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'draw') return { success: false, error: `Unknown action: ${action.type}` };

    const targetId = players[data.targetPlayer];
    const cardIdx = Number(action.payload.cardIndex);

    if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= data.hands[targetId].length) {
      return { success: false, error: 'Invalid card index from target hand' };
    }

    const drawn = data.hands[targetId].splice(cardIdx, 1)[0];
    data.hands[playerId].push(drawn);
    data.hands[playerId] = this.removePairs(data.hands[playerId]);

    if (data.hands[playerId].length === 0) data.eliminated[playerId] = true;
    if (data.hands[targetId].length === 0) data.eliminated[targetId] = true;

    const activePlayers = players.filter((p) => !data.eliminated[p]);

    if (activePlayers.length <= 1) {
      data.gameOver = true;
      data.loser = activePlayers.length === 1 ? activePlayers[0] : null;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    data.currentPlayer = (data.currentPlayer + 1) % players.length;
    while (data.eliminated[players[data.currentPlayer]]) {
      data.currentPlayer = (data.currentPlayer + 1) % players.length;
    }

    data.targetPlayer = (data.currentPlayer + 1) % players.length;
    while (data.eliminated[players[data.targetPlayer]]) {
      data.targetPlayer = (data.targetPlayer + 1) % players.length;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<OldMaidState>().gameOver;
  }

  protected determineWinner(): string | null {
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<OldMaidState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === data.loser ? 0 : 100;
    return scores;
  }

  getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const d = state.data as OldMaidState;
    const maskedHands: Record<string, Card[]> = {};
    for (const [p, cards] of Object.entries(d.hands)) {
      maskedHands[p] = p === playerId ? cards : cards.map(() => ({ suit: -1, rank: -1 }));
    }
    return { ...state, data: { ...d, hands: maskedHands } };
  }
}
