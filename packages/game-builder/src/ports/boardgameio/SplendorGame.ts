import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SplendorConfig {
  targetPrestige?: number;
}

/**
 * Splendor: Engine-building card game. Collect gem tokens, buy development
 * cards that provide permanent gem bonuses, attract nobles for prestige.
 * First to reach 15 prestige points triggers final round.
 * 5 gem types + gold (wild). 3 tiers of cards. Noble tiles.
 */

type GemType = 'diamond' | 'sapphire' | 'emerald' | 'ruby' | 'onyx';
const GEM_TYPES: GemType[] = ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx'];

interface Card {
  id: number;
  tier: number;
  prestige: number;
  bonus: GemType;
  cost: Record<GemType, number>;
}

interface Noble {
  id: number;
  prestige: number;
  requirement: Record<GemType, number>;
}

interface PlayerData {
  gems: Record<string, number>; // includes 'gold'
  bonuses: Record<GemType, number>;
  reserved: Card[];
  prestige: number;
}

interface SplendorState {
  [key: string]: unknown;
  decks: Card[][]; // 3 tiers
  displayed: Card[][]; // 3 tiers, 4 cards each
  nobles: Noble[];
  gems: Record<string, number>;
  players: Record<string, PlayerData>;
  currentPlayer: number;
  winner: string | null;
  finalRound: boolean;
  finalRoundStartPlayer: number;
  target: number;
}

let cardIdCounter = 0;

function makeCard(
  tier: number,
  prestige: number,
  bonus: GemType,
  cost: Partial<Record<GemType, number>>,
): Card {
  const full: Record<GemType, number> = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 };
  for (const g of GEM_TYPES) if (cost[g]) full[g] = cost[g]!;
  return { id: cardIdCounter++, tier, prestige, bonus, cost: full };
}

function generateDeck(): Card[][] {
  cardIdCounter = 0;
  // Simplified deck with representative cards per tier
  const tier1: Card[] = [
    makeCard(1, 0, 'diamond', { sapphire: 1, emerald: 1, ruby: 1, onyx: 1 }),
    makeCard(1, 0, 'sapphire', { diamond: 1, emerald: 1, ruby: 1, onyx: 1 }),
    makeCard(1, 0, 'emerald', { diamond: 1, sapphire: 1, ruby: 1, onyx: 1 }),
    makeCard(1, 0, 'ruby', { diamond: 1, sapphire: 1, emerald: 1, onyx: 1 }),
    makeCard(1, 0, 'onyx', { diamond: 1, sapphire: 1, emerald: 1, ruby: 1 }),
    makeCard(1, 0, 'diamond', { sapphire: 2, onyx: 1 }),
    makeCard(1, 0, 'sapphire', { emerald: 2, ruby: 1 }),
    makeCard(1, 0, 'emerald', { ruby: 2, diamond: 1 }),
    makeCard(1, 0, 'ruby', { onyx: 2, sapphire: 1 }),
    makeCard(1, 0, 'onyx', { diamond: 2, emerald: 1 }),
    makeCard(1, 1, 'diamond', { emerald: 4 }),
    makeCard(1, 1, 'sapphire', { ruby: 4 }),
    makeCard(1, 1, 'emerald', { onyx: 4 }),
    makeCard(1, 1, 'ruby', { diamond: 4 }),
    makeCard(1, 1, 'onyx', { sapphire: 4 }),
  ];
  const tier2: Card[] = [
    makeCard(2, 1, 'diamond', { sapphire: 2, emerald: 2, ruby: 3 }),
    makeCard(2, 1, 'sapphire', { emerald: 2, ruby: 2, onyx: 3 }),
    makeCard(2, 1, 'emerald', { diamond: 2, ruby: 2, onyx: 3 }),
    makeCard(2, 1, 'ruby', { diamond: 2, sapphire: 2, emerald: 3 }),
    makeCard(2, 1, 'onyx', { diamond: 3, sapphire: 2, emerald: 2 }),
    makeCard(2, 2, 'diamond', { ruby: 5 }),
    makeCard(2, 2, 'sapphire', { onyx: 5 }),
    makeCard(2, 2, 'emerald', { diamond: 5 }),
    makeCard(2, 2, 'ruby', { sapphire: 5 }),
    makeCard(2, 2, 'onyx', { emerald: 5 }),
  ];
  const tier3: Card[] = [
    makeCard(3, 3, 'diamond', { sapphire: 3, emerald: 3, ruby: 5, onyx: 3 }),
    makeCard(3, 3, 'sapphire', { diamond: 3, emerald: 3, ruby: 3, onyx: 5 }),
    makeCard(3, 3, 'emerald', { diamond: 5, sapphire: 3, ruby: 3, onyx: 3 }),
    makeCard(3, 3, 'ruby', { diamond: 3, sapphire: 5, emerald: 3, onyx: 3 }),
    makeCard(3, 3, 'onyx', { diamond: 3, sapphire: 3, emerald: 5, ruby: 3 }),
    makeCard(3, 4, 'diamond', { onyx: 7 }),
    makeCard(3, 4, 'sapphire', { diamond: 7 }),
    makeCard(3, 4, 'emerald', { sapphire: 7 }),
    makeCard(3, 4, 'ruby', { emerald: 7 }),
    makeCard(3, 4, 'onyx', { ruby: 7 }),
  ];
  // Shuffle each tier
  for (const deck of [tier1, tier2, tier3]) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  return [tier1, tier2, tier3];
}

function generateNobles(count: number): Noble[] {
  const all: Noble[] = [
    { id: 0, prestige: 3, requirement: { diamond: 3, sapphire: 3, emerald: 0, ruby: 0, onyx: 0 } },
    { id: 1, prestige: 3, requirement: { diamond: 3, sapphire: 0, emerald: 3, ruby: 0, onyx: 0 } },
    { id: 2, prestige: 3, requirement: { diamond: 0, sapphire: 3, emerald: 0, ruby: 3, onyx: 0 } },
    { id: 3, prestige: 3, requirement: { diamond: 0, sapphire: 0, emerald: 3, ruby: 0, onyx: 3 } },
    { id: 4, prestige: 3, requirement: { diamond: 0, sapphire: 0, emerald: 0, ruby: 3, onyx: 3 } },
    { id: 5, prestige: 3, requirement: { diamond: 4, sapphire: 0, emerald: 0, ruby: 0, onyx: 4 } },
    { id: 6, prestige: 3, requirement: { diamond: 0, sapphire: 4, emerald: 4, ruby: 0, onyx: 0 } },
    { id: 7, prestige: 3, requirement: { diamond: 0, sapphire: 0, emerald: 4, ruby: 4, onyx: 0 } },
    { id: 8, prestige: 3, requirement: { diamond: 4, sapphire: 4, emerald: 0, ruby: 0, onyx: 0 } },
    { id: 9, prestige: 3, requirement: { diamond: 0, sapphire: 4, emerald: 0, ruby: 0, onyx: 4 } },
  ];
  // Shuffle and take count
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, count);
}

export class SplendorGame extends BaseGame {
  readonly name = 'Splendor';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): SplendorState {
    const target = (this.config as SplendorConfig).targetPrestige ?? 15;
    const decks = generateDeck();
    const displayed: Card[][] = [];
    for (let tier = 0; tier < 3; tier++) {
      const row: Card[] = [];
      for (let i = 0; i < 4 && decks[tier].length > 0; i++) {
        row.push(decks[tier].pop()!);
      }
      displayed.push(row);
    }
    const gemCount = playerIds.length <= 2 ? 4 : playerIds.length === 3 ? 5 : 7;
    const gems: Record<string, number> = { gold: 5 };
    for (const g of GEM_TYPES) gems[g] = gemCount;

    const playerData: Record<string, PlayerData> = {};
    for (const pid of playerIds) {
      playerData[pid] = {
        gems: { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 0 },
        bonuses: { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 },
        reserved: [],
        prestige: 0,
      };
    }

    return {
      decks,
      displayed,
      nobles: generateNobles(playerIds.length + 1),
      gems,
      players: playerData,
      currentPlayer: 0,
      winner: null,
      finalRound: false,
      finalRoundStartPlayer: -1,
      target,
    };
  }

  private totalGems(gemMap: Record<string, number>): number {
    let total = 0;
    for (const v of Object.values(gemMap)) total += v;
    return total;
  }

  private canAfford(player: PlayerData, card: Card): boolean {
    let goldNeeded = 0;
    for (const g of GEM_TYPES) {
      const need = card.cost[g] - player.bonuses[g] - player.gems[g];
      if (need > 0) goldNeeded += need;
    }
    return goldNeeded <= player.gems.gold;
  }

  private payForCard(player: PlayerData, card: Card, bankGems: Record<string, number>): void {
    let goldUsed = 0;
    for (const g of GEM_TYPES) {
      const effective = Math.max(0, card.cost[g] - player.bonuses[g]);
      const fromGems = Math.min(effective, player.gems[g]);
      player.gems[g] -= fromGems;
      bankGems[g] += fromGems;
      const remainder = effective - fromGems;
      goldUsed += remainder;
    }
    player.gems.gold -= goldUsed;
    bankGems.gold += goldUsed;
  }

  private checkNobles(data: SplendorState, playerId: string): void {
    const player = data.players[playerId];
    for (let i = data.nobles.length - 1; i >= 0; i--) {
      const noble = data.nobles[i];
      let qualifies = true;
      for (const g of GEM_TYPES) {
        if (player.bonuses[g] < noble.requirement[g]) {
          qualifies = false;
          break;
        }
      }
      if (qualifies) {
        player.prestige += noble.prestige;
        data.nobles.splice(i, 1);
        this.emitEvent('noble_visit', playerId, { nobleId: noble.id });
        break; // Only one noble per turn
      }
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SplendorState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (action.type === 'take_gems') {
      const gems = action.payload.gems as Record<string, number>;
      if (!gems) return { success: false, error: 'Must specify gems' };

      const types = Object.keys(gems).filter((g) => (gems[g] ?? 0) > 0);
      const total = types.reduce((s, g) => s + (gems[g] ?? 0), 0);

      // Validate: 3 different colors (1 each) or 2 of same color (if 4+ available)
      if (total === 3 && types.length === 3 && types.every((g) => gems[g] === 1)) {
        for (const g of types) {
          if ((data.gems[g] ?? 0) < 1) return { success: false, error: `Not enough ${g} gems` };
        }
      } else if (total === 2 && types.length === 1 && gems[types[0]] === 2) {
        if ((data.gems[types[0]] ?? 0) < 4) {
          return { success: false, error: 'Need at least 4 gems in stack to take 2' };
        }
      } else {
        return { success: false, error: 'Take 3 different gems or 2 of the same' };
      }

      const player = data.players[playerId];
      for (const g of types) {
        const take = gems[g] ?? 0;
        data.gems[g] -= take;
        player.gems[g] = (player.gems[g] ?? 0) + take;
      }

      // Must discard if over 10
      if (this.totalGems(player.gems) > 10) {
        const discardGems = action.payload.discard as Record<string, number> | undefined;
        if (!discardGems) return { success: false, error: 'Must discard gems to stay at 10' };
        const discardTotal = Object.values(discardGems).reduce((a, b) => a + (b ?? 0), 0);
        if (this.totalGems(player.gems) - discardTotal > 10) {
          return { success: false, error: 'Still over 10 gems after discard' };
        }
        for (const [g, v] of Object.entries(discardGems)) {
          const amt = v ?? 0;
          player.gems[g] -= amt;
          data.gems[g] = (data.gems[g] ?? 0) + amt;
        }
      }
    } else if (action.type === 'buy_card') {
      const cardId = Number(action.payload.cardId);
      const fromReserve = action.payload.fromReserve === true;
      const player = data.players[playerId];
      let card: Card | null = null;
      let removeFrom: Card[] | null = null;

      if (fromReserve) {
        const idx = player.reserved.findIndex((c) => c.id === cardId);
        if (idx === -1) return { success: false, error: 'Card not in reserve' };
        card = player.reserved[idx];
        removeFrom = player.reserved;
      } else {
        for (const row of data.displayed) {
          const idx = row.findIndex((c) => c.id === cardId);
          if (idx !== -1) {
            card = row[idx];
            removeFrom = row;
            break;
          }
        }
      }

      if (!card || !removeFrom) return { success: false, error: 'Card not found' };
      if (!this.canAfford(player, card)) return { success: false, error: 'Cannot afford card' };

      this.payForCard(player, card, data.gems);
      const idx = removeFrom.indexOf(card);
      removeFrom.splice(idx, 1);
      player.bonuses[card.bonus]++;
      player.prestige += card.prestige;

      // Refill displayed if from display
      if (!fromReserve) {
        const tier = card.tier - 1;
        if (data.decks[tier].length > 0) {
          data.displayed[tier].push(data.decks[tier].pop()!);
        }
      }

      this.checkNobles(data, playerId);
    } else if (action.type === 'reserve') {
      const player = data.players[playerId];
      if (player.reserved.length >= 3) return { success: false, error: 'Max 3 reserved cards' };

      const cardId = action.payload.cardId !== undefined ? Number(action.payload.cardId) : -1;
      const fromDeck = action.payload.fromDeck === true;
      let card: Card | null = null;

      if (fromDeck) {
        const tier = Number(action.payload.tier ?? 1) - 1;
        if (tier < 0 || tier >= 3 || data.decks[tier].length === 0) {
          return { success: false, error: 'Invalid tier or empty deck' };
        }
        card = data.decks[tier].pop()!;
      } else {
        for (const row of data.displayed) {
          const idx = row.findIndex((c) => c.id === cardId);
          if (idx !== -1) {
            card = row.splice(idx, 1)[0];
            const tier = card.tier - 1;
            if (data.decks[tier].length > 0) {
              row.push(data.decks[tier].pop()!);
            }
            break;
          }
        }
      }

      if (!card) return { success: false, error: 'Card not found' };
      player.reserved.push(card);
      if (data.gems.gold > 0) {
        data.gems.gold--;
        player.gems.gold++;
      }
    } else {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    // Check for final round trigger
    const player = data.players[playerId];
    if (player.prestige >= data.target && !data.finalRound) {
      data.finalRound = true;
      data.finalRoundStartPlayer = pIdx;
    }

    // Advance turn
    data.currentPlayer = (pIdx + 1) % players.length;

    // Check if final round completed (back to start player)
    if (data.finalRound && data.currentPlayer === data.finalRoundStartPlayer) {
      let best: string | null = null;
      let bestPrestige = -1;
      for (const pid of players) {
        const p = data.players[pid];
        if (p.prestige > bestPrestige) {
          bestPrestige = p.prestige;
          best = pid;
        }
      }
      data.winner = best;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<SplendorState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<SplendorState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SplendorState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = data.players[p]?.prestige ?? 0;
    return scores;
  }
}
