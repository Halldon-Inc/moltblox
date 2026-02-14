/**
 * ProgressQuestGame: Auto-RPG where the character automatically
 * fights monsters, gains loot, and levels up. The player makes
 * strategic decisions about stat allocation, equipment, and
 * which zone to fight in.
 *
 * Actions: allocate_stat, equip, sell_loot, change_zone
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Equipment {
  id: string;
  name: string;
  slot: string;
  attackBonus: number;
  defenseBonus: number;
  quality: number;
  [key: string]: unknown;
}

interface Zone {
  id: string;
  name: string;
  minLevel: number;
  enemyBaseHP: number;
  enemyBaseAtk: number;
  lootQuality: number;
  xpMultiplier: number;
  [key: string]: unknown;
}

interface CharacterStats {
  strength: number;
  vitality: number;
  dexterity: number;
  intelligence: number;
  luck: number;
  [key: string]: unknown;
}

interface ProgressQuestState {
  level: number;
  xp: number;
  xpToNext: number;
  statPoints: number;
  stats: CharacterStats;
  hp: number;
  maxHP: number;
  attack: number;
  defense: number;
  gold: number;
  totalGold: number;
  equipment: Record<string, Equipment | null>;
  inventory: Equipment[];
  maxInventory: number;
  currentZone: string;
  zones: Zone[];
  monstersKilled: number;
  bossesKilled: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const ZONES: Zone[] = [
  {
    id: 'forest',
    name: 'Dark Forest',
    minLevel: 1,
    enemyBaseHP: 20,
    enemyBaseAtk: 3,
    lootQuality: 1,
    xpMultiplier: 1,
  },
  {
    id: 'caves',
    name: 'Crystal Caves',
    minLevel: 5,
    enemyBaseHP: 50,
    enemyBaseAtk: 8,
    lootQuality: 2,
    xpMultiplier: 1.5,
  },
  {
    id: 'desert',
    name: 'Scorched Desert',
    minLevel: 10,
    enemyBaseHP: 120,
    enemyBaseAtk: 15,
    lootQuality: 3,
    xpMultiplier: 2,
  },
  {
    id: 'volcano',
    name: 'Volcanic Depths',
    minLevel: 20,
    enemyBaseHP: 300,
    enemyBaseAtk: 35,
    lootQuality: 5,
    xpMultiplier: 3,
  },
  {
    id: 'abyss',
    name: 'The Abyss',
    minLevel: 35,
    enemyBaseHP: 800,
    enemyBaseAtk: 80,
    lootQuality: 8,
    xpMultiplier: 5,
  },
  {
    id: 'void',
    name: 'The Void',
    minLevel: 50,
    enemyBaseHP: 2000,
    enemyBaseAtk: 200,
    lootQuality: 12,
    xpMultiplier: 8,
  },
];

const SLOT_NAMES = ['weapon', 'armor', 'helmet', 'boots', 'ring'];
const ITEM_PREFIXES = [
  'Rusty',
  'Iron',
  'Steel',
  'Silver',
  'Golden',
  'Mythril',
  'Adamant',
  'Divine',
];
const ITEM_TYPES: Record<string, string[]> = {
  weapon: ['Sword', 'Axe', 'Mace', 'Dagger', 'Staff'],
  armor: ['Plate', 'Chainmail', 'Robe', 'Leather'],
  helmet: ['Helm', 'Hood', 'Crown', 'Circlet'],
  boots: ['Greaves', 'Sandals', 'Sabatons'],
  ring: ['Ring', 'Band', 'Signet'],
};

export class ProgressQuestGame extends BaseGame {
  readonly name = 'Progress Quest';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): ProgressQuestState {
    return {
      level: 1,
      xp: 0,
      xpToNext: 100,
      statPoints: 0,
      stats: {
        strength: 5,
        vitality: 5,
        dexterity: 5,
        intelligence: 5,
        luck: 5,
      },
      hp: 100,
      maxHP: 100,
      attack: 10,
      defense: 5,
      gold: 0,
      totalGold: 0,
      equipment: {
        weapon: null,
        armor: null,
        helmet: null,
        boots: null,
        ring: null,
      },
      inventory: [],
      maxInventory: 20,
      currentZone: 'forest',
      zones: ZONES.map((z) => ({ ...z })),
      monstersKilled: 0,
      bossesKilled: 0,
      tickCount: 0,
      score: 0,
    };
  }

  private recalcCombatStats(data: ProgressQuestState): void {
    let baseAtk = data.stats.strength * 2 + data.stats.dexterity;
    let baseDef = data.stats.vitality + data.stats.dexterity * 0.5;
    data.maxHP = 50 + data.stats.vitality * 10 + data.level * 5;

    // Equipment bonuses
    for (const slot of SLOT_NAMES) {
      const item = data.equipment[slot] as Equipment | null;
      if (item) {
        baseAtk += item.attackBonus;
        baseDef += item.defenseBonus;
      }
    }

    data.attack = Math.floor(baseAtk);
    data.defense = Math.floor(baseDef);
  }

  private generateLoot(quality: number, tickSeed: number): Equipment {
    const prefixIdx = Math.min(ITEM_PREFIXES.length - 1, Math.floor(quality / 2));
    const slot = SLOT_NAMES[tickSeed % SLOT_NAMES.length];
    const types = ITEM_TYPES[slot] ?? ['Item'];
    const typeIdx = tickSeed % types.length;
    const name = `${ITEM_PREFIXES[prefixIdx]} ${types[typeIdx]}`;

    const atkBonus =
      slot === 'weapon' ? Math.floor(quality * 3 + (tickSeed % 5)) : Math.floor(quality * 0.5);
    const defBonus =
      slot === 'armor' || slot === 'helmet' || slot === 'boots'
        ? Math.floor(quality * 2 + (tickSeed % 3))
        : Math.floor(quality * 0.3);

    return {
      id: `loot_${tickSeed}`,
      name,
      slot,
      attackBonus: atkBonus,
      defenseBonus: defBonus,
      quality,
    };
  }

  private tickCombat(data: ProgressQuestState): void {
    data.tickCount++;

    const zone = data.zones.find((z) => z.id === data.currentZone);
    if (!zone) return;

    // Auto-fight
    const enemyHP = zone.enemyBaseHP + (data.tickCount % 10);
    const enemyAtk = zone.enemyBaseAtk;

    const playerDamage = Math.max(1, data.attack - Math.floor(enemyAtk * 0.2));
    const enemyDamage = Math.max(1, enemyAtk - Math.floor(data.defense * 0.3));

    // Simplified combat: can we kill the enemy?
    const roundsToKill = Math.ceil(enemyHP / playerDamage);
    const damageTaken = roundsToKill * enemyDamage;

    data.hp -= damageTaken;

    if (data.hp > 0) {
      // Enemy defeated
      data.monstersKilled++;
      const xpGained = Math.floor(10 * zone.xpMultiplier * data.level * 0.5);
      data.xp += xpGained;

      // Gold drop
      const goldDrop = Math.floor(zone.lootQuality * 5 + (data.tickCount % 10));
      data.gold += goldDrop;
      data.totalGold += goldDrop;

      // Loot drop (every few kills based on luck)
      const luckBonus = data.stats.luck * 0.02;
      if (data.tickCount % Math.max(1, Math.floor(10 - luckBonus * 5)) === 0) {
        if (data.inventory.length < data.maxInventory) {
          const loot = this.generateLoot(zone.lootQuality, data.tickCount);
          data.inventory.push(loot);
        }
      }

      // Boss every 10 kills
      if (data.monstersKilled % 10 === 0) {
        data.bossesKilled++;
        data.gold += goldDrop * 5;
        data.totalGold += goldDrop * 5;
        data.score += 50;
      }

      // Level up check
      while (data.xp >= data.xpToNext) {
        data.xp -= data.xpToNext;
        data.level++;
        data.statPoints += 3;
        data.xpToNext = Math.floor(100 * Math.pow(1.2, data.level));
        data.score += 20;
      }
    }

    // Heal
    data.hp = Math.min(data.maxHP, data.hp + Math.floor(data.maxHP * 0.1));
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ProgressQuestState>();

    this.tickCombat(data);

    switch (action.type) {
      case 'allocate_stat': {
        const stat = String(action.payload.stat);
        const points = Math.max(1, Number(action.payload.points ?? 1));
        const validStats = ['strength', 'vitality', 'dexterity', 'intelligence', 'luck'];
        if (!validStats.includes(stat)) {
          return { success: false, error: `Invalid stat. Choose: ${validStats.join(', ')}` };
        }
        if (data.statPoints < points) {
          return { success: false, error: `Not enough stat points (have ${data.statPoints})` };
        }

        data.statPoints -= points;
        (data.stats as Record<string, number>)[stat] += points;
        this.recalcCombatStats(data);
        data.score += points;
        this.emitEvent('allocate_stat', playerId, {
          stat,
          points,
          value: (data.stats as Record<string, number>)[stat],
        });
        break;
      }

      case 'equip': {
        const itemId = String(action.payload.itemId);
        const itemIdx = data.inventory.findIndex((i) => i.id === itemId);
        if (itemIdx === -1) return { success: false, error: 'Item not in inventory' };

        const item = data.inventory[itemIdx];
        const slot = item.slot;

        // Unequip current item in slot (if any)
        const current = data.equipment[slot] as Equipment | null;
        if (current) {
          data.inventory.push(current);
        }

        // Equip new item
        data.equipment[slot] = item;
        data.inventory.splice(itemIdx, 1);
        this.recalcCombatStats(data);
        data.score += 5;
        this.emitEvent('equip', playerId, { item: item.name, slot });
        break;
      }

      case 'sell_loot': {
        const itemId = String(action.payload.itemId ?? 'all');

        if (itemId === 'all') {
          let totalValue = 0;
          for (const item of data.inventory) {
            totalValue += item.quality * 10;
          }
          data.gold += totalValue;
          data.totalGold += totalValue;
          data.inventory = [];
          this.emitEvent('sell_all', playerId, { value: totalValue });
        } else {
          const idx = data.inventory.findIndex((i) => i.id === itemId);
          if (idx === -1) return { success: false, error: 'Item not found' };
          const item = data.inventory[idx];
          const value = item.quality * 10;
          data.gold += value;
          data.totalGold += value;
          data.inventory.splice(idx, 1);
          this.emitEvent('sell_loot', playerId, { item: item.name, value });
        }
        data.score += 3;
        break;
      }

      case 'change_zone': {
        const zoneId = String(action.payload.zoneId);
        const zone = data.zones.find((z) => z.id === zoneId);
        if (!zone) return { success: false, error: 'Unknown zone' };
        if (data.level < zone.minLevel) {
          return { success: false, error: `Need level ${zone.minLevel} for ${zone.name}` };
        }
        data.currentZone = zoneId;
        this.emitEvent('change_zone', playerId, { zone: zone.name });
        break;
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<ProgressQuestState>();
    return data.level >= 100;
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<ProgressQuestState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}
