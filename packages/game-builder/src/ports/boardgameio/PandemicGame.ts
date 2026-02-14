import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface PandemicConfig {
  difficulty?: number;
}

/**
 * Pandemic (simplified cooperative): Cities with disease cubes, players move
 * between cities, treat disease, share knowledge, discover cures.
 * Win by curing all 4 diseases. Lose if outbreaks reach 8 or cubes run out.
 * Simplified: 12 cities, 4 diseases, 2-4 players with roles.
 */

type DiseaseColor = 'red' | 'blue' | 'yellow' | 'black';
const DISEASE_COLORS: DiseaseColor[] = ['red', 'blue', 'yellow', 'black'];

interface City {
  name: string;
  color: DiseaseColor;
  connections: number[];
}

const CITIES: City[] = [
  { name: 'Atlanta', color: 'blue', connections: [1, 3] },
  { name: 'Chicago', color: 'blue', connections: [0, 2, 4] },
  { name: 'Montreal', color: 'blue', connections: [1, 5] },
  { name: 'Miami', color: 'yellow', connections: [0, 6, 7] },
  { name: 'Los Angeles', color: 'yellow', connections: [1, 6] },
  { name: 'New York', color: 'blue', connections: [2, 7, 8] },
  { name: 'Mexico City', color: 'yellow', connections: [3, 4, 9] },
  { name: 'London', color: 'blue', connections: [3, 5, 8] },
  { name: 'Paris', color: 'blue', connections: [5, 7, 10] },
  { name: 'Lima', color: 'yellow', connections: [6, 11] },
  { name: 'Cairo', color: 'black', connections: [8, 11] },
  { name: 'Sao Paulo', color: 'yellow', connections: [9, 10] },
];

const ROLES = ['Medic', 'Scientist', 'Researcher', 'Dispatcher'];

interface PandemicState {
  [key: string]: unknown;
  cubes: number[][]; // cubes[cityIdx][colorIdx]
  playerPositions: Record<string, number>;
  playerRoles: Record<string, string>;
  playerHands: Record<string, number[]>; // city card indices
  cured: Record<DiseaseColor, boolean>;
  eradicated: Record<DiseaseColor, boolean>;
  outbreaks: number;
  infectionRate: number;
  infectionDeck: number[];
  infectionDiscard: number[];
  playerDeck: number[];
  actionsLeft: number;
  currentPlayer: number;
  cubeSupply: Record<DiseaseColor, number>;
  winner: string | null;
  lost: boolean;
}

export class PandemicGame extends BaseGame {
  readonly name = 'Pandemic';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  protected initializeState(playerIds: string[]): PandemicState {
    const difficulty = (this.config as PandemicConfig).difficulty ?? 4;
    const cubes: number[][] = Array.from({ length: CITIES.length }, () => Array(4).fill(0));
    const cubeSupply: Record<DiseaseColor, number> = { red: 24, blue: 24, yellow: 24, black: 24 };

    // Assign roles
    const shuffledRoles = this.shuffle(ROLES);
    const playerRoles: Record<string, string> = {};
    const playerPositions: Record<string, number> = {};
    const playerHands: Record<string, number[]> = {};
    for (let i = 0; i < playerIds.length; i++) {
      playerRoles[playerIds[i]] = shuffledRoles[i % ROLES.length];
      playerPositions[playerIds[i]] = 0; // Start at Atlanta
      playerHands[playerIds[i]] = [];
    }

    // Infection deck
    const infectionDeck = this.shuffle(Array.from({ length: CITIES.length }, (_, i) => i));
    const infectionDiscard: number[] = [];

    // Initial infections: 3 cities with 3 cubes, 3 with 2, 3 with 1
    for (let level = 3; level >= 1; level--) {
      for (let i = 0; i < 3; i++) {
        const cityIdx = infectionDeck.pop()!;
        infectionDiscard.push(cityIdx);
        const colorIdx = DISEASE_COLORS.indexOf(CITIES[cityIdx].color);
        cubes[cityIdx][colorIdx] = level;
        cubeSupply[CITIES[cityIdx].color] -= level;
      }
    }

    // Player deck (city cards) + epidemic cards
    const baseDeck = this.shuffle(Array.from({ length: CITIES.length }, (_, i) => i));
    // Deal initial hands
    const handSize = playerIds.length <= 2 ? 4 : playerIds.length === 3 ? 3 : 2;
    for (const pid of playerIds) {
      for (let i = 0; i < handSize && baseDeck.length > 0; i++) {
        playerHands[pid].push(baseDeck.pop()!);
      }
    }
    // Epidemic cards are represented as -1
    const playerDeck: number[] = [];
    const pileSize = Math.ceil(baseDeck.length / difficulty);
    for (let i = 0; i < difficulty; i++) {
      const pile = baseDeck.splice(0, pileSize);
      pile.push(-1); // epidemic
      playerDeck.push(...this.shuffle(pile));
    }
    playerDeck.push(...baseDeck);

    return {
      cubes,
      playerPositions,
      playerRoles,
      playerHands,
      cured: { red: false, blue: false, yellow: false, black: false },
      eradicated: { red: false, blue: false, yellow: false, black: false },
      outbreaks: 0,
      infectionRate: 2,
      infectionDeck,
      infectionDiscard,
      playerDeck,
      actionsLeft: 4,
      currentPlayer: 0,
      cubeSupply,
      winner: null,
      lost: false,
    };
  }

  private infect(
    data: PandemicState,
    cityIdx: number,
    colorIdx: number,
    chainSet: Set<number>,
  ): void {
    if (data.eradicated[DISEASE_COLORS[colorIdx]]) return;
    if (cubeAt(data, cityIdx, colorIdx) >= 3) {
      // Outbreak
      if (chainSet.has(cityIdx)) return;
      chainSet.add(cityIdx);
      data.outbreaks++;
      this.emitEvent('outbreak', undefined, {
        city: CITIES[cityIdx].name,
        outbreaks: data.outbreaks,
      });
      for (const neighbor of CITIES[cityIdx].connections) {
        this.infect(data, neighbor, colorIdx, chainSet);
      }
      return;
    }
    data.cubes[cityIdx][colorIdx]++;
    data.cubeSupply[DISEASE_COLORS[colorIdx]]--;
  }

  private drawPlayerCards(data: PandemicState, playerId: string): void {
    for (let i = 0; i < 2; i++) {
      if (data.playerDeck.length === 0) {
        data.lost = true;
        return;
      }
      const card = data.playerDeck.pop()!;
      if (card === -1) {
        // Epidemic
        this.handleEpidemic(data);
      } else {
        data.playerHands[playerId].push(card);
      }
    }
    // Hand limit: 7
    if (data.playerHands[playerId].length > 7) {
      // Auto-discard oldest
      while (data.playerHands[playerId].length > 7) {
        data.playerHands[playerId].shift();
      }
    }
  }

  private handleEpidemic(data: PandemicState): void {
    // Increase infection rate
    if (data.infectionRate < 4) data.infectionRate++;
    // Infect bottom of infection deck
    if (data.infectionDeck.length > 0) {
      const cityIdx = data.infectionDeck.shift()!;
      const colorIdx = DISEASE_COLORS.indexOf(CITIES[cityIdx].color);
      data.cubes[cityIdx][colorIdx] = 3;
      data.cubeSupply[CITIES[cityIdx].color] -= 3 - cubeAt(data, cityIdx, colorIdx);
      data.infectionDiscard.push(cityIdx);
    }
    // Shuffle discard back on top
    data.infectionDeck.push(...this.shuffle(data.infectionDiscard));
    data.infectionDiscard = [];
    this.emitEvent('epidemic', undefined, {});
  }

  private doInfectionPhase(data: PandemicState): void {
    for (let i = 0; i < data.infectionRate; i++) {
      if (data.infectionDeck.length === 0) break;
      const cityIdx = data.infectionDeck.pop()!;
      data.infectionDiscard.push(cityIdx);
      const colorIdx = DISEASE_COLORS.indexOf(CITIES[cityIdx].color);
      this.infect(data, cityIdx, colorIdx, new Set());
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PandemicState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (action.type === 'move') {
      const target = Number(action.payload.city);
      if (isNaN(target) || target < 0 || target >= CITIES.length) {
        return { success: false, error: 'Invalid city' };
      }
      const current = data.playerPositions[playerId];
      if (!CITIES[current].connections.includes(target)) {
        // Check if player has city card for direct flight
        const cardIdx = data.playerHands[playerId].indexOf(target);
        if (cardIdx === -1) {
          return { success: false, error: 'Not adjacent and no city card for direct flight' };
        }
        data.playerHands[playerId].splice(cardIdx, 1);
      }
      data.playerPositions[playerId] = target;
    } else if (action.type === 'treat') {
      const color = action.payload.color as DiseaseColor;
      const colorIdx = DISEASE_COLORS.indexOf(color);
      if (colorIdx === -1) return { success: false, error: 'Invalid disease color' };
      const city = data.playerPositions[playerId];
      if (data.cubes[city][colorIdx] <= 0) {
        return { success: false, error: 'No cubes of that color here' };
      }
      const remove =
        data.playerRoles[playerId] === 'Medic' || data.cured[color]
          ? data.cubes[city][colorIdx]
          : 1;
      data.cubes[city][colorIdx] -= remove;
      data.cubeSupply[color] += remove;
    } else if (action.type === 'cure') {
      const color = action.payload.color as DiseaseColor;
      if (data.cured[color]) return { success: false, error: 'Already cured' };
      const needed = data.playerRoles[playerId] === 'Scientist' ? 4 : 5;
      const colorIdx = DISEASE_COLORS.indexOf(color);
      const matchingCards = data.playerHands[playerId].filter(
        (c) => c >= 0 && CITIES[c] && DISEASE_COLORS.indexOf(CITIES[c].color) === colorIdx,
      );
      if (matchingCards.length < needed) {
        return { success: false, error: `Need ${needed} ${color} city cards to cure` };
      }
      // Discard cards
      let removed = 0;
      data.playerHands[playerId] = data.playerHands[playerId].filter((c) => {
        if (removed >= needed) return true;
        if (c >= 0 && CITIES[c] && DISEASE_COLORS.indexOf(CITIES[c].color) === colorIdx) {
          removed++;
          return false;
        }
        return true;
      });
      data.cured[color] = true;
      this.emitEvent('disease_cured', playerId, { color });

      // Check if all cured
      if (DISEASE_COLORS.every((c) => data.cured[c])) {
        data.winner = 'cooperative'; // All players win
      }
    } else if (action.type === 'share') {
      const targetPlayer = action.payload.targetPlayer as string;
      const cardIdx = Number(action.payload.cardIndex);
      if (!data.playerHands[targetPlayer])
        return { success: false, error: 'Invalid target player' };
      const hand = data.playerHands[playerId];
      if (cardIdx < 0 || cardIdx >= hand.length)
        return { success: false, error: 'Invalid card index' };
      // Must be in same city
      if (data.playerPositions[playerId] !== data.playerPositions[targetPlayer]) {
        return { success: false, error: 'Must be in the same city to share' };
      }
      const card = hand.splice(cardIdx, 1)[0];
      data.playerHands[targetPlayer].push(card);
    } else {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    data.actionsLeft--;

    if (data.actionsLeft <= 0) {
      // Draw phase
      this.drawPlayerCards(data, playerId);
      // Infection phase
      if (!data.lost) {
        this.doInfectionPhase(data);
      }
      // Check loss conditions
      if (data.outbreaks >= 8) data.lost = true;
      for (const color of DISEASE_COLORS) {
        if (data.cubeSupply[color] < 0) data.lost = true;
      }

      // Next player
      data.currentPlayer = (pIdx + 1) % players.length;
      data.actionsLeft = 4;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<PandemicState>();
    return data.winner !== null || data.lost;
  }

  protected determineWinner(): string | null {
    const data = this.getData<PandemicState>();
    if (data.lost) return null;
    if (data.winner === 'cooperative') return this.getPlayers()[0]; // Cooperative win
    return data.winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<PandemicState>();
    const won = data.winner !== null && !data.lost;
    const curedCount = DISEASE_COLORS.filter((c) => data.cured[c]).length;
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      scores[p] = won ? 10 + curedCount * 5 : curedCount;
    }
    return scores;
  }
}

function cubeAt(data: PandemicState, cityIdx: number, colorIdx: number): number {
  return data.cubes[cityIdx][colorIdx];
}
