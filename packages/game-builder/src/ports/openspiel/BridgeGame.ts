import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Card {
  suit: number;
  rank: number;
}
// Suits: 0=clubs, 1=diamonds, 2=hearts, 3=spades, 4=notrump (bidding only)

interface BridgeState {
  [key: string]: unknown;
  hands: Record<string, Card[]>;
  currentTrick: { player: string; card: Card }[];
  bids: { player: string; level: number; suit: number }[];
  contract: { level: number; suit: number; declarer: string } | null;
  tricksTaken: number[];
  currentPlayer: number;
  phase: string;
  passCount: number;
  scores: number[];
  winner: string | null;
  dealer: number;
}

export class BridgeGame extends BaseGame {
  readonly name = 'Bridge (Simplified)';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  private createDeck(): Card[] {
    const deck: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 2; rank <= 14; rank++) deck.push({ suit, rank });
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  protected initializeState(playerIds: string[]): BridgeState {
    const deck = this.createDeck();
    const hands: Record<string, Card[]> = {};
    for (let i = 0; i < 4; i++) hands[playerIds[i]] = deck.slice(i * 13, (i + 1) * 13);
    return {
      hands,
      currentTrick: [],
      bids: [],
      contract: null,
      tricksTaken: [0, 0],
      currentPlayer: 0,
      phase: 'bidding',
      passCount: 0,
      scores: [0, 0],
      winner: null,
      dealer: 0,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<BridgeState>();
    const players = this.getPlayers();

    if (data.phase === 'bidding') {
      if (players[data.currentPlayer] !== playerId)
        return { success: false, error: 'Not your turn' };

      if (action.type === 'bid') {
        const level = Number(action.payload.level);
        const suit = Number(action.payload.suit);
        if (isNaN(level) || level < 1 || level > 7)
          return { success: false, error: 'Level must be 1-7' };
        if (isNaN(suit) || suit < 0 || suit > 4)
          return { success: false, error: 'Suit must be 0-4' };

        // Must be higher than previous bid
        if (data.bids.length > 0) {
          const last = data.bids[data.bids.length - 1];
          if (level < last.level || (level === last.level && suit <= last.suit)) {
            return { success: false, error: 'Must bid higher' };
          }
        }

        data.bids.push({ player: playerId, level, suit });
        data.passCount = 0;
      } else if (action.type === 'pass') {
        data.passCount++;
        if (data.passCount >= 3 && data.bids.length > 0) {
          const lastBid = data.bids[data.bids.length - 1];
          data.contract = { level: lastBid.level, suit: lastBid.suit, declarer: lastBid.player };
          data.phase = 'play';
          data.currentPlayer = (players.indexOf(lastBid.player) + 1) % 4;
        } else if (data.passCount >= 4 && data.bids.length === 0) {
          // All pass, re-deal
          const deck = this.createDeck();
          for (let i = 0; i < 4; i++) data.hands[players[i]] = deck.slice(i * 13, (i + 1) * 13);
          data.bids = [];
          data.passCount = 0;
          data.currentPlayer = 0;
          this.setData(data);
          return { success: true, newState: this.getState() };
        }
      } else {
        return { success: false, error: 'Must bid or pass' };
      }

      data.currentPlayer = (data.currentPlayer + 1) % 4;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase !== 'play') return { success: false, error: 'Invalid phase' };
    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'play') return { success: false, error: `Unknown action: ${action.type}` };

    const cardIdx = Number(action.payload.cardIndex);
    if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= data.hands[playerId].length)
      return { success: false, error: 'Invalid card' };

    const card = data.hands[playerId][cardIdx];

    if (data.currentTrick.length > 0) {
      const leadSuit = data.currentTrick[0].card.suit;
      if (card.suit !== leadSuit && data.hands[playerId].some((c) => c.suit === leadSuit)) {
        return { success: false, error: 'Must follow suit' };
      }
    }

    data.hands[playerId].splice(cardIdx, 1);
    data.currentTrick.push({ player: playerId, card });

    if (data.currentTrick.length === 4) {
      const leadSuit = data.currentTrick[0].card.suit;
      const trumpSuit = data.contract!.suit < 4 ? data.contract!.suit : -1;
      let winnerEntry = data.currentTrick[0];
      let bestPower = this.cardPower(winnerEntry.card, trumpSuit, leadSuit);

      for (let i = 1; i < 4; i++) {
        const power = this.cardPower(data.currentTrick[i].card, trumpSuit, leadSuit);
        if (power > bestPower) {
          bestPower = power;
          winnerEntry = data.currentTrick[i];
        }
      }

      const winnerIdx = players.indexOf(winnerEntry.player);
      data.tricksTaken[winnerIdx % 2]++;
      data.currentPlayer = winnerIdx;
      data.currentTrick = [];

      const totalTricks = data.tricksTaken[0] + data.tricksTaken[1];
      if (totalTricks >= 13) {
        const declarerTeam = players.indexOf(data.contract!.declarer) % 2;
        const needed = data.contract!.level + 6;
        if (data.tricksTaken[declarerTeam] >= needed) {
          data.scores[declarerTeam] += (data.tricksTaken[declarerTeam] - 6) * 10;
        } else {
          data.scores[(declarerTeam + 1) % 2] += (needed - data.tricksTaken[declarerTeam]) * 10;
        }

        if (data.scores[0] >= 100 || data.scores[1] >= 100) {
          data.winner = data.scores[0] >= 100 ? players[0] : players[1];
        } else {
          const deck = this.createDeck();
          data.dealer = (data.dealer + 1) % 4;
          for (let i = 0; i < 4; i++) data.hands[players[i]] = deck.slice(i * 13, (i + 1) * 13);
          data.bids = [];
          data.passCount = 0;
          data.tricksTaken = [0, 0];
          data.contract = null;
          data.phase = 'bidding';
          data.currentPlayer = (data.dealer + 1) % 4;
        }
      }
    } else {
      data.currentPlayer = (data.currentPlayer + 1) % 4;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private cardPower(card: Card, trump: number, lead: number): number {
    if (trump >= 0 && card.suit === trump) return 50 + card.rank;
    if (card.suit === lead) return card.rank;
    return 0;
  }

  protected checkGameOver(): boolean {
    return this.getData<BridgeState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<BridgeState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const data = this.getData<BridgeState>();
    const players = this.getPlayers();
    const scores: Record<string, number> = {};
    for (let i = 0; i < 4; i++) scores[players[i]] = data.scores[i % 2];
    return scores;
  }
}
