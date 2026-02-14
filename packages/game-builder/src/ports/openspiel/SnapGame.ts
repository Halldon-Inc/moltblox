import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Card {
  suit: number;
  rank: number;
}

interface SnapState {
  [key: string]: unknown;
  decks: Record<string, Card[]>;
  piles: Record<string, Card[]>;
  centralPile: Card[];
  currentPlayer: number;
  winner: string | null;
}

export class SnapGame extends BaseGame {
  readonly name = 'Snap';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): SnapState {
    const deck: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) deck.push({ suit, rank });
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const decks: Record<string, Card[]> = {};
    const piles: Record<string, Card[]> = {};
    const perPlayer = Math.floor(deck.length / playerIds.length);
    for (let i = 0; i < playerIds.length; i++) {
      decks[playerIds[i]] = deck.slice(i * perPlayer, (i + 1) * perPlayer);
      piles[playerIds[i]] = [];
    }

    return { decks, piles, centralPile: [], currentPlayer: 0, winner: null };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SnapState>();
    const players = this.getPlayers();

    if (action.type === 'flip') {
      if (players[data.currentPlayer] !== playerId)
        return { success: false, error: 'Not your turn to flip' };
      if (data.decks[playerId].length === 0) return { success: false, error: 'No cards left' };

      const card = data.decks[playerId].pop()!;
      data.centralPile.push(card);
      data.currentPlayer = (data.currentPlayer + 1) % players.length;

      // Skip players with no cards
      let attempts = 0;
      while (data.decks[players[data.currentPlayer]].length === 0 && attempts < players.length) {
        data.currentPlayer = (data.currentPlayer + 1) % players.length;
        attempts++;
      }
    } else if (action.type === 'snap') {
      // Check if top two cards match
      if (data.centralPile.length < 2) return { success: false, error: 'Not enough cards to snap' };
      const top = data.centralPile[data.centralPile.length - 1];
      const second = data.centralPile[data.centralPile.length - 2];

      if (top.rank === second.rank) {
        // Valid snap: player takes all central cards
        data.decks[playerId].unshift(...data.centralPile);
        data.centralPile = [];
        this.emitEvent('snap', playerId, { rank: top.rank });
      } else {
        // Penalty: lose top card
        if (data.decks[playerId].length > 0) {
          data.centralPile.push(data.decks[playerId].pop()!);
        }
      }
    } else {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    // Check for winner: last player with cards
    const withCards = players.filter((p) => data.decks[p].length > 0);
    if (withCards.length <= 1 && data.centralPile.length === 0) {
      data.winner = withCards[0] || null;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<SnapState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<SnapState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const data = this.getData<SnapState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = data.decks[p].length;
    return scores;
  }
}
