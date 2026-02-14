import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import { shuffle } from './cardHelpers.js';

// Pit: commodity trading card game
// 9 commodities, each with 9 cards. Players trade to corner a market.
const COMMODITIES = ['Wheat', 'Barley', 'Corn', 'Oats', 'Rye', 'Flax', 'Hay', 'Coffee', 'Sugar'];
const COMMODITY_VALUES: Record<string, number> = {
  Wheat: 100,
  Barley: 85,
  Corn: 75,
  Oats: 60,
  Rye: 50,
  Flax: 65,
  Hay: 40,
  Coffee: 80,
  Sugar: 55,
};

interface PitState {
  [key: string]: unknown;
  hands: string[][]; // commodity names
  currentOffers: { player: number; count: number; commodity?: string }[];
  scores: number[];
  winner: string | null;
  round: number;
  ringBell: number | null; // Player who rang the bell (won the round)
}

export class PitGame extends BaseGame {
  readonly name = 'Pit';
  readonly version = '1.0.0';
  readonly maxPlayers = 8;

  protected initializeState(playerIds: string[]): PitState {
    const n = playerIds.length;
    // Use n commodities, each with 9 cards
    const usedCommodities = COMMODITIES.slice(0, n);
    const deck: string[] = [];
    for (const c of usedCommodities) for (let i = 0; i < 9; i++) deck.push(c);
    const shuffled = shuffle(deck);
    const cardsPerPlayer = Math.floor(shuffled.length / n);
    const hands: string[][] = [];
    for (let i = 0; i < n; i++) hands.push(shuffled.splice(0, cardsPerPlayer));

    return {
      hands,
      currentOffers: [],
      scores: Array(n).fill(0),
      winner: null,
      round: 1,
      ringBell: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PitState>();
    const players = this.getPlayers();
    const pi = players.indexOf(playerId);
    const n = players.length;

    if (action.type === 'offer') {
      // Player offers N cards for trade
      const count = Number(action.payload.count);
      const commodity = action.payload.commodity as string;
      if (isNaN(count) || count < 1 || count > 4)
        return { success: false, error: 'Trade 1-4 cards' };

      // Verify player has enough of that commodity
      const matching = data.hands[pi].filter((c) => c === commodity);
      if (matching.length < count)
        return { success: false, error: 'Not enough cards of that commodity' };

      data.currentOffers.push({ player: pi, count, commodity });
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'accept_trade') {
      // Accept another player's offer
      const offerIdx = Number(action.payload.offerIndex);
      const myCommodity = action.payload.commodity as string;
      if (isNaN(offerIdx) || offerIdx >= data.currentOffers.length) {
        return { success: false, error: 'Invalid offer' };
      }

      const offer = data.currentOffers[offerIdx];
      if (offer.player === pi) return { success: false, error: 'Cannot trade with yourself' };

      // Verify acceptor has enough cards
      const myMatching = data.hands[pi].filter((c) => c === myCommodity);
      if (myMatching.length < offer.count) return { success: false, error: 'Not enough cards' };

      // Execute trade
      const offererCards: string[] = [];
      for (let i = 0; i < offer.count; i++) {
        const idx = data.hands[offer.player].indexOf(offer.commodity!);
        if (idx >= 0) {
          offererCards.push(data.hands[offer.player].splice(idx, 1)[0]);
        }
      }

      const acceptorCards: string[] = [];
      for (let i = 0; i < offer.count; i++) {
        const idx = data.hands[pi].indexOf(myCommodity);
        if (idx >= 0) {
          acceptorCards.push(data.hands[pi].splice(idx, 1)[0]);
        }
      }

      data.hands[pi].push(...offererCards);
      data.hands[offer.player].push(...acceptorCards);

      data.currentOffers.splice(offerIdx, 1);

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'ring_bell') {
      // Player claims to have cornered a market
      const hand = data.hands[pi];
      if (hand.length === 0) return { success: false, error: 'No cards' };

      const commodity = hand[0];
      if (!hand.every((c) => c === commodity)) {
        return { success: false, error: 'Must have all same commodity' };
      }

      data.ringBell = pi;
      data.scores[pi] += COMMODITY_VALUES[commodity] || 50;
      this.emitEvent('cornered_market', players[pi], { commodity });

      // Check for winner (500 points)
      if (data.scores[pi] >= 500) {
        data.winner = players[pi];
      } else {
        // New round
        const usedCommodities = COMMODITIES.slice(0, n);
        const deck: string[] = [];
        for (const c of usedCommodities) for (let i = 0; i < 9; i++) deck.push(c);
        const shuffled = shuffle(deck);
        const cpe = Math.floor(shuffled.length / n);
        for (let i = 0; i < n; i++) data.hands[i] = shuffled.splice(0, cpe);
        data.currentOffers = [];
        data.ringBell = null;
        data.round++;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  protected checkGameOver(): boolean {
    return this.getData<PitState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<PitState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<PitState>();
    const sc: Record<string, number> = {};
    const p = this.getPlayers();
    for (let i = 0; i < p.length; i++) sc[p[i]] = d.scores[i];
    return sc;
  }
}
