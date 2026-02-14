import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Card {
  suit: number;
  rank: number;
}

interface WarState {
  [key: string]: unknown;
  decks: Record<string, Card[]>;
  currentCards: Record<string, Card | null>;
  warPile: Card[];
  winner: string | null;
  roundCount: number;
  maxRounds: number;
}

export class WarGame extends BaseGame {
  readonly name = 'War';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): WarState {
    const deck: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 2; rank <= 14; rank++) deck.push({ suit, rank });
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const decks: Record<string, Card[]> = {};
    decks[playerIds[0]] = deck.slice(0, 26);
    decks[playerIds[1]] = deck.slice(26);

    return {
      decks,
      currentCards: { [playerIds[0]]: null, [playerIds[1]]: null },
      warPile: [],
      winner: null,
      roundCount: 0,
      maxRounds: 1000,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<WarState>();
    const players = this.getPlayers();

    if (action.type !== 'flip') return { success: false, error: `Unknown action: ${action.type}` };

    // Both players flip simultaneously (first player triggers the flip)
    if (playerId !== players[0]) return { success: false, error: 'Player 1 controls the flip' };

    if (data.decks[players[0]].length === 0 || data.decks[players[1]].length === 0) {
      return { success: false, error: 'Game is over' };
    }

    const card0 = data.decks[players[0]].pop()!;
    const card1 = data.decks[players[1]].pop()!;
    data.currentCards[players[0]] = card0;
    data.currentCards[players[1]] = card1;
    data.roundCount++;

    const allCards = [card0, card1, ...data.warPile];
    data.warPile = [];

    if (card0.rank > card1.rank) {
      data.decks[players[0]].unshift(...allCards);
      this.emitEvent('round_win', players[0], { card0, card1 });
    } else if (card1.rank > card0.rank) {
      data.decks[players[1]].unshift(...allCards);
      this.emitEvent('round_win', players[1], { card0, card1 });
    } else {
      // War! Each player puts 3 face-down cards in the pile
      this.emitEvent('war', undefined, { rank: card0.rank });
      data.warPile.push(...allCards);
      for (let i = 0; i < 3; i++) {
        if (data.decks[players[0]].length > 0) data.warPile.push(data.decks[players[0]].pop()!);
        if (data.decks[players[1]].length > 0) data.warPile.push(data.decks[players[1]].pop()!);
      }
    }

    // Check for winner
    if (data.decks[players[0]].length === 0) data.winner = players[1];
    else if (data.decks[players[1]].length === 0) data.winner = players[0];
    else if (data.roundCount >= data.maxRounds) {
      data.winner =
        data.decks[players[0]].length > data.decks[players[1]].length ? players[0] : players[1];
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<WarState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<WarState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<WarState>();
    const players = this.getPlayers();
    return {
      [players[0]]: data.decks[players[0]].length,
      [players[1]]: data.decks[players[1]].length,
    };
  }
}
