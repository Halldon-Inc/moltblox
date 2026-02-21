/**
 * BeatEmUpRPGGame: Beat-em-up stages with RPG progression
 *
 * Features: XP, levels, skill trees (Power/Defense/Speed paths),
 * equipment, shops, stat growth curves, and stage-based combat.
 *
 * Actions: attack (aliases: punch, kick), skill (alias: special),
 *          combo, grab, dodge, use_item, allocate_stat, equip, shop_buy
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface BeatEmUpRPGConfig {
  maxLevel?: number;
  skillTreeDepth?: number;
  shopFrequency?: number;
  statGrowthCurve?: 'linear' | 'exponential' | 'plateau';
  totalStages?: number;
  theme?: {
    worldColors?: Record<string, string>;
    classColors?: Record<string, string>;
    uiTheme?: string;
  };
  gameplay?: {
    playerHp?: number;
    playerStr?: number;
    playerDef?: number;
    playerSpd?: number;
    playerLck?: number;
    xpPerEnemy?: number;
    goldPerEnemy?: number;
    levelUpBonuses?: { hp?: number; str?: number; def?: number; spd?: number; lck?: number };
    skillCosts?: Record<string, number>;
    grabDamageMultiplier?: number;
    stunChanceBase?: number;
  };
  content?: {
    classDefinitions?: Record<string, { hp: number; str: number; def: number; spd: number }>;
    enemyWaves?: Array<{ name: string; hp: number; atk: number; def: number }>;
    equipmentTable?: Array<{ id: string; name: string; slot: string; price: number }>;
  };
}

interface SkillDef {
  name: string;
  path: 'power' | 'defense' | 'speed';
  unlockLevel: number;
  description: string;
  cooldownMax: number; // 0 means passive
}

const SKILL_TREE: SkillDef[] = [
  {
    name: 'Fury Strike',
    path: 'power',
    unlockLevel: 3,
    description: '2x attack damage',
    cooldownMax: 0,
  },
  {
    name: 'Berserker',
    path: 'power',
    unlockLevel: 6,
    description: 'ATK+50% when HP below 30%',
    cooldownMax: 0,
  },
  {
    name: 'Devastation',
    path: 'power',
    unlockLevel: 9,
    description: '3x attack damage (3 turn cooldown)',
    cooldownMax: 3,
  },
  {
    name: 'Iron Skin',
    path: 'defense',
    unlockLevel: 3,
    description: 'DEF+5 permanent',
    cooldownMax: 0,
  },
  {
    name: 'Heal',
    path: 'defense',
    unlockLevel: 6,
    description: 'Restore 20 HP (4 turn cooldown)',
    cooldownMax: 4,
  },
  {
    name: 'Fortress',
    path: 'defense',
    unlockLevel: 9,
    description: 'Block all damage 1 turn',
    cooldownMax: 0,
  },
  {
    name: 'Double Strike',
    path: 'speed',
    unlockLevel: 3,
    description: 'Hit twice',
    cooldownMax: 0,
  },
  {
    name: 'Evasion',
    path: 'speed',
    unlockLevel: 6,
    description: '50% dodge chance (passive)',
    cooldownMax: 0,
  },
  {
    name: 'Blitz',
    path: 'speed',
    unlockLevel: 9,
    description: 'Hit all enemies once',
    cooldownMax: 0,
  },
];

interface EquipmentItem {
  id: string;
  name: string;
  slot: 'weapon' | 'armor' | 'accessory';
  atk?: number;
  def?: number;
  hp?: number;
  spd?: number;
  lck?: number;
  price: number;
}

const SHOP_ITEMS: EquipmentItem[] = [
  { id: 'iron-sword', name: 'Iron Sword', slot: 'weapon', atk: 3, price: 30 },
  { id: 'steel-sword', name: 'Steel Sword', slot: 'weapon', atk: 6, price: 60 },
  { id: 'flame-blade', name: 'Flame Blade', slot: 'weapon', atk: 10, price: 100 },
  { id: 'leather-armor', name: 'Leather Armor', slot: 'armor', def: 2, hp: 10, price: 25 },
  { id: 'chain-mail', name: 'Chain Mail', slot: 'armor', def: 5, hp: 20, price: 55 },
  { id: 'plate-armor', name: 'Plate Armor', slot: 'armor', def: 8, hp: 35, price: 90 },
  { id: 'swift-ring', name: 'Swift Ring', slot: 'accessory', spd: 3, price: 40 },
  { id: 'lucky-charm', name: 'Lucky Charm', slot: 'accessory', lck: 5, price: 45 },
  { id: 'health-potion', name: 'Health Potion', slot: 'accessory', hp: 30, price: 15 },
];

interface PlayerSkill {
  name: string;
  unlocked: boolean;
  cooldown: number;
  cooldownMax: number;
  path: 'power' | 'defense' | 'speed';
}

interface RPGEnemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  xpReward: number;
  goldReward: number;
  alive: boolean;
  [key: string]: unknown;
}

interface RPGPlayer {
  hp: number;
  maxHp: number;
  str: number;
  def: number;
  spd: number;
  lck: number;
  xp: number;
  level: number;
  skillPoints: number;
  skills: PlayerSkill[];
  equipment: {
    weapon: EquipmentItem | null;
    armor: EquipmentItem | null;
    accessory: EquipmentItem | null;
  };
  gold: number;
  inventory: EquipmentItem[];
  fortressActive: boolean;
  [key: string]: unknown;
}

interface BeatEmUpRPGState {
  player: RPGPlayer;
  playerId: string;
  currentStage: number;
  totalStages: number;
  enemies: RPGEnemy[];
  phase: 'combat' | 'shop' | 'levelup' | 'victory';
  stagesCleared: number;
  totalDamageDealt: number;
  maxLevel: number;
  shopFrequency: number;
  statGrowthCurve: 'linear' | 'exponential' | 'plateau';
  xpThresholds: number[];
  [key: string]: unknown;
}

const XP_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];

const DEFAULT_PLAYER_HP = 100;
const DEFAULT_PLAYER_STR = 10;
const DEFAULT_PLAYER_DEF = 5;
const DEFAULT_PLAYER_SPD = 5;
const DEFAULT_PLAYER_LCK = 5;
const DEFAULT_GRAB_DAMAGE_MULTIPLIER = 0.75;
const DEFAULT_STUN_CHANCE_BASE = 40;

function generateEnemies(stage: number): RPGEnemy[] {
  const count = 2 + Math.min(2, Math.floor(stage / 2));
  const enemies: RPGEnemy[] = [];
  const names = ['Thug', 'Brawler', 'Bruiser', 'Champion'];
  for (let i = 0; i < count; i++) {
    const tier = Math.min(names.length - 1, Math.floor(stage / 2));
    const scaling = 1 + stage * 0.3;
    const baseHp = 20 + tier * 15;
    const baseAtk = 4 + tier * 3;
    const baseDef = 1 + tier * 2;
    enemies.push({
      id: `enemy-s${stage}-${i}`,
      name: names[tier],
      hp: Math.floor(baseHp * scaling),
      maxHp: Math.floor(baseHp * scaling),
      atk: Math.floor(baseAtk * scaling),
      def: Math.floor(baseDef * scaling),
      xpReward: 15 + Math.floor(tier * 10 * scaling),
      goldReward: 10 + Math.floor(tier * 8 * scaling),
      alive: true,
    });
  }
  return enemies;
}

export class BeatEmUpRPGGame extends BaseGame {
  readonly name = 'Beat Em Up RPG';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): BeatEmUpRPGState {
    const cfg = this.config as BeatEmUpRPGConfig;
    const maxLevel = cfg.maxLevel ?? 10;
    const shopFrequency = cfg.shopFrequency ?? 2;
    const statGrowthCurve = cfg.statGrowthCurve ?? 'linear';
    const totalStages = cfg.totalStages ?? 5;

    const skills: PlayerSkill[] = SKILL_TREE.map((s) => ({
      name: s.name,
      unlocked: false,
      cooldown: 0,
      cooldownMax: s.cooldownMax,
      path: s.path,
    }));

    const pHp = (cfg.gameplay?.playerHp as number) ?? DEFAULT_PLAYER_HP;
    const pStr = (cfg.gameplay?.playerStr as number) ?? DEFAULT_PLAYER_STR;
    const pDef = (cfg.gameplay?.playerDef as number) ?? DEFAULT_PLAYER_DEF;
    const pSpd = (cfg.gameplay?.playerSpd as number) ?? DEFAULT_PLAYER_SPD;
    const pLck = (cfg.gameplay?.playerLck as number) ?? DEFAULT_PLAYER_LCK;

    const player: RPGPlayer = {
      hp: pHp,
      maxHp: pHp,
      str: pStr,
      def: pDef,
      spd: pSpd,
      lck: pLck,
      xp: 0,
      level: 1,
      skillPoints: 0,
      skills,
      equipment: { weapon: null, armor: null, accessory: null },
      gold: 0,
      inventory: [],
      fortressActive: false,
    };

    const enemies = generateEnemies(1);

    return {
      player,
      playerId: playerIds[0],
      currentStage: 1,
      totalStages,
      enemies,
      phase: 'combat',
      stagesCleared: 0,
      totalDamageDealt: 0,
      maxLevel,
      shopFrequency,
      statGrowthCurve,
      xpThresholds: XP_THRESHOLDS,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<BeatEmUpRPGState>();

    if (data.phase === 'victory') {
      return { success: false, error: 'Game is already won' };
    }

    switch (action.type) {
      case 'punch':
      case 'kick':
      case 'attack':
        return this.handleAttack(playerId, action, data);
      case 'special':
      case 'skill':
        return this.handleSkill(playerId, action, data);
      case 'combo':
        return this.handleCombo(playerId, data);
      case 'dodge':
        return this.handleDodge(playerId, data);
      case 'grab':
        return this.handleGrab(playerId, data);
      case 'use_item':
        return this.handleUseItem(action, data);
      case 'allocate_stat':
        return this.handleAllocateStat(action, data);
      case 'equip':
        return this.handleEquip(action, data);
      case 'shop_buy':
        return this.handleShopBuy(action, data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private getEffectiveStats(player: RPGPlayer): {
    atk: number;
    def: number;
    spd: number;
    lck: number;
    maxHp: number;
  } {
    let atk = player.str;
    let def = player.def;
    let spd = player.spd;
    let lck = player.lck;
    let maxHp = player.maxHp;

    if (player.equipment.weapon) {
      atk += player.equipment.weapon.atk ?? 0;
    }
    if (player.equipment.armor) {
      def += player.equipment.armor.def ?? 0;
      maxHp += player.equipment.armor.hp ?? 0;
    }
    if (player.equipment.accessory) {
      spd += player.equipment.accessory.spd ?? 0;
      lck += player.equipment.accessory.lck ?? 0;
      maxHp += player.equipment.accessory.hp ?? 0;
    }

    // Iron Skin passive
    const ironSkin = player.skills.find((s) => s.name === 'Iron Skin' && s.unlocked);
    if (ironSkin) {
      def += 5;
    }

    // Berserker passive
    const berserker = player.skills.find((s) => s.name === 'Berserker' && s.unlocked);
    if (berserker && player.hp < player.maxHp * 0.3) {
      atk = Math.floor(atk * 1.5);
    }

    return { atk, def, spd, lck, maxHp };
  }

  private handleAttack(
    _playerId: string,
    action: GameAction,
    data: BeatEmUpRPGState,
  ): ActionResult {
    if (data.phase !== 'combat') {
      return { success: false, error: 'Not in combat phase' };
    }

    const targetId = action.payload.targetId as string | undefined;
    const aliveEnemies = data.enemies.filter((e) => e.alive);
    if (aliveEnemies.length === 0) {
      return { success: false, error: 'No enemies alive' };
    }

    const target = targetId
      ? data.enemies.find((e) => e.id === targetId && e.alive)
      : aliveEnemies[0];
    if (!target) {
      return { success: false, error: 'Target not found or already dead' };
    }

    const stats = this.getEffectiveStats(data.player);
    let damage = Math.max(1, stats.atk - target.def);

    // Fury Strike passive (2x if unlocked)
    const furyStrike = data.player.skills.find((s) => s.name === 'Fury Strike' && s.unlocked);
    if (furyStrike) {
      damage *= 2;
    }

    // Crit check
    const critRoll = Math.random() * 100;
    if (critRoll < stats.lck) {
      damage *= 2;
      this.emitEvent('critical_hit', data.playerId, { damage });
    }

    target.hp = Math.max(0, target.hp - damage);
    data.totalDamageDealt += damage;

    this.emitEvent('attack', data.playerId, { target: target.id, damage });

    if (target.hp <= 0) {
      target.alive = false;
      data.player.xp += target.xpReward;
      data.player.gold += target.goldReward;
      this.emitEvent('enemy_defeated', data.playerId, {
        enemy: target.name,
        xp: target.xpReward,
        gold: target.goldReward,
      });
    }

    // Tick skill cooldowns
    this.tickCooldowns(data.player);

    // Enemy counterattack
    this.enemyCounterattack(data);

    // Check level up
    this.checkLevelUp(data);

    // Check stage clear
    if (data.enemies.every((e) => !e.alive) && data.player.hp > 0) {
      this.clearStage(data);
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleSkill(_playerId: string, action: GameAction, data: BeatEmUpRPGState): ActionResult {
    if (data.phase !== 'combat') {
      return { success: false, error: 'Not in combat phase' };
    }

    const skillName = action.payload.skillName as string;
    const skill = data.player.skills.find((s) => s.name === skillName);
    if (!skill) {
      return { success: false, error: 'Skill not found' };
    }
    if (!skill.unlocked) {
      return { success: false, error: 'Skill not unlocked' };
    }
    if (skill.cooldown > 0) {
      return { success: false, error: `Skill on cooldown (${skill.cooldown} turns remaining)` };
    }

    const aliveEnemies = data.enemies.filter((e) => e.alive);

    switch (skillName) {
      case 'Devastation': {
        if (aliveEnemies.length === 0) {
          return { success: false, error: 'No enemies alive' };
        }
        const target = aliveEnemies[0];
        const stats = this.getEffectiveStats(data.player);
        const damage = Math.max(1, stats.atk * 3 - target.def);
        target.hp = Math.max(0, target.hp - damage);
        data.totalDamageDealt += damage;
        skill.cooldown = skill.cooldownMax;
        this.emitEvent('skill_used', data.playerId, { skill: skillName, damage });
        if (target.hp <= 0) {
          target.alive = false;
          data.player.xp += target.xpReward;
          data.player.gold += target.goldReward;
        }
        break;
      }
      case 'Heal': {
        const healAmount = 20;
        data.player.hp = Math.min(data.player.maxHp, data.player.hp + healAmount);
        skill.cooldown = skill.cooldownMax;
        this.emitEvent('skill_used', data.playerId, { skill: skillName, heal: healAmount });
        break;
      }
      case 'Fortress': {
        data.player.fortressActive = true;
        this.emitEvent('skill_used', data.playerId, { skill: skillName });
        break;
      }
      case 'Double Strike': {
        if (aliveEnemies.length === 0) {
          return { success: false, error: 'No enemies alive' };
        }
        const target = aliveEnemies[0];
        const stats = this.getEffectiveStats(data.player);
        const dmgPerHit = Math.max(1, stats.atk - target.def);
        const totalDmg = dmgPerHit * 2;
        target.hp = Math.max(0, target.hp - totalDmg);
        data.totalDamageDealt += totalDmg;
        this.emitEvent('skill_used', data.playerId, { skill: skillName, damage: totalDmg });
        if (target.hp <= 0) {
          target.alive = false;
          data.player.xp += target.xpReward;
          data.player.gold += target.goldReward;
        }
        break;
      }
      case 'Blitz': {
        const stats = this.getEffectiveStats(data.player);
        let totalDmg = 0;
        for (const enemy of aliveEnemies) {
          const dmg = Math.max(1, stats.atk - enemy.def);
          enemy.hp = Math.max(0, enemy.hp - dmg);
          totalDmg += dmg;
          if (enemy.hp <= 0) {
            enemy.alive = false;
            data.player.xp += enemy.xpReward;
            data.player.gold += enemy.goldReward;
          }
        }
        data.totalDamageDealt += totalDmg;
        this.emitEvent('skill_used', data.playerId, { skill: skillName, damage: totalDmg });
        break;
      }
      default:
        return { success: false, error: `Skill ${skillName} cannot be activated directly` };
    }

    // Tick cooldowns
    this.tickCooldowns(data.player);

    // Enemy counterattack
    this.enemyCounterattack(data);

    // Check level up
    this.checkLevelUp(data);

    // Check stage clear
    if (data.enemies.every((e) => !e.alive) && data.player.hp > 0) {
      this.clearStage(data);
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleDodge(_playerId: string, data: BeatEmUpRPGState): ActionResult {
    if (data.phase !== 'combat') {
      return { success: false, error: 'Not in combat phase' };
    }

    // Dodge skips player attack but also avoids enemy counter
    this.tickCooldowns(data.player);
    this.emitEvent('dodge', data.playerId, {});
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleCombo(_playerId: string, data: BeatEmUpRPGState): ActionResult {
    if (data.phase !== 'combat') {
      return { success: false, error: 'Not in combat phase' };
    }

    // Combo uses the first available offensive skill; falls through to basic attack if none
    const offensiveSkills = ['Fury Strike', 'Devastation', 'Double Strike', 'Blitz'];
    const available = data.player.skills.find(
      (s) => offensiveSkills.includes(s.name) && s.unlocked && s.cooldown <= 0,
    );

    if (available) {
      // Delegate to handleSkill with the found skill
      return this.handleSkill(
        data.playerId,
        {
          type: 'skill',
          payload: { skillName: available.name },
          timestamp: Date.now(),
        } as unknown as GameAction,
        data,
      );
    }

    // No offensive skill available; fall through to a basic attack
    return this.handleAttack(
      data.playerId,
      {
        type: 'attack',
        payload: {},
        timestamp: Date.now(),
      } as unknown as GameAction,
      data,
    );
  }

  private handleGrab(_playerId: string, data: BeatEmUpRPGState): ActionResult {
    if (data.phase !== 'combat') {
      return { success: false, error: 'Not in combat phase' };
    }

    const aliveEnemies = data.enemies.filter((e) => e.alive);
    if (aliveEnemies.length === 0) {
      return { success: false, error: 'No enemies alive' };
    }

    const target = aliveEnemies[0];
    const stats = this.getEffectiveStats(data.player);

    const cfg = this.config as BeatEmUpRPGConfig;
    const grabMult =
      (cfg.gameplay?.grabDamageMultiplier as number) ?? DEFAULT_GRAB_DAMAGE_MULTIPLIER;
    let damage = Math.max(1, Math.floor((stats.atk - target.def) * grabMult));

    // Crit check
    const critRoll = Math.random() * 100;
    if (critRoll < stats.lck) {
      damage *= 2;
      this.emitEvent('critical_hit', data.playerId, { damage });
    }

    target.hp = Math.max(0, target.hp - damage);
    data.totalDamageDealt += damage;

    const stunBase = (cfg.gameplay?.stunChanceBase as number) ?? DEFAULT_STUN_CHANCE_BASE;
    const stunChance = stunBase + stats.lck;
    const stunRoll = Math.random() * 100;
    const stunned = stunRoll < stunChance;

    this.emitEvent('grab', data.playerId, { target: target.id, damage, stunned });

    if (target.hp <= 0) {
      target.alive = false;
      data.player.xp += target.xpReward;
      data.player.gold += target.goldReward;
      this.emitEvent('enemy_defeated', data.playerId, {
        enemy: target.name,
        xp: target.xpReward,
        gold: target.goldReward,
      });
    }

    // Tick cooldowns
    this.tickCooldowns(data.player);

    // Enemy counterattack (stunned enemy skips its attack)
    if (!stunned) {
      this.enemyCounterattack(data);
    } else {
      // Only non-stunned enemies counterattack
      // For simplicity, if the grabbed enemy was stunned, skip all counterattacks this turn
      this.emitEvent('enemy_stunned', data.playerId, { enemy: target.id });
    }

    // Check level up
    this.checkLevelUp(data);

    // Check stage clear
    if (data.enemies.every((e) => !e.alive) && data.player.hp > 0) {
      this.clearStage(data);
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleUseItem(action: GameAction, data: BeatEmUpRPGState): ActionResult {
    const itemId = action.payload.itemId as string;
    const itemIdx = data.player.inventory.findIndex((i) => i.id === itemId);
    if (itemIdx === -1) {
      return { success: false, error: 'Item not in inventory' };
    }

    const item = data.player.inventory[itemIdx];
    // Consumable: health potion
    if (item.id === 'health-potion') {
      data.player.hp = Math.min(data.player.maxHp, data.player.hp + (item.hp ?? 30));
      data.player.inventory.splice(itemIdx, 1);
      this.emitEvent('item_used', data.playerId, { item: item.name });
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleAllocateStat(action: GameAction, data: BeatEmUpRPGState): ActionResult {
    if (data.player.skillPoints <= 0) {
      return { success: false, error: 'No skill points available' };
    }

    const stat = action.payload.stat as string;
    switch (stat) {
      case 'str':
        data.player.str += 2;
        break;
      case 'def':
        data.player.def += 2;
        break;
      case 'spd':
        data.player.spd += 2;
        break;
      case 'lck':
        data.player.lck += 2;
        break;
      default:
        return { success: false, error: 'Invalid stat' };
    }

    data.player.skillPoints--;
    this.emitEvent('stat_allocated', data.playerId, { stat, remaining: data.player.skillPoints });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleEquip(action: GameAction, data: BeatEmUpRPGState): ActionResult {
    const itemId = action.payload.itemId as string;
    const itemIdx = data.player.inventory.findIndex((i) => i.id === itemId);
    if (itemIdx === -1) {
      return { success: false, error: 'Item not in inventory' };
    }

    const item = data.player.inventory[itemIdx];
    if (item.slot !== 'weapon' && item.slot !== 'armor' && item.slot !== 'accessory') {
      return { success: false, error: 'Item cannot be equipped' };
    }

    // Unequip current item of that slot back to inventory
    const currentEquip = data.player.equipment[item.slot];
    if (currentEquip) {
      data.player.inventory.push(currentEquip);
    }

    data.player.equipment[item.slot] = item;
    data.player.inventory.splice(itemIdx, 1);

    // Recalculate maxHp from armor
    const baseMaxHp = 100 + (data.player.level - 1) * 5;
    let bonusHp = 0;
    if (data.player.equipment.armor?.hp) bonusHp += data.player.equipment.armor.hp;
    if (data.player.equipment.accessory?.hp) bonusHp += data.player.equipment.accessory.hp;
    data.player.maxHp = baseMaxHp + bonusHp;
    if (data.player.hp > data.player.maxHp) {
      data.player.hp = data.player.maxHp;
    }

    this.emitEvent('equipped', data.playerId, { item: item.name, slot: item.slot });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleShopBuy(action: GameAction, data: BeatEmUpRPGState): ActionResult {
    if (data.phase !== 'shop') {
      return { success: false, error: 'Not in shop phase' };
    }

    const itemId = action.payload.itemId as string;
    const shopItem = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!shopItem) {
      return { success: false, error: 'Item not available in shop' };
    }
    if (data.player.gold < shopItem.price) {
      return { success: false, error: 'Not enough gold' };
    }

    data.player.gold -= shopItem.price;
    data.player.inventory.push({ ...shopItem });
    this.emitEvent('shop_purchase', data.playerId, { item: shopItem.name, price: shopItem.price });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private enemyCounterattack(data: BeatEmUpRPGState): void {
    if (data.player.hp <= 0) return;

    const aliveEnemies = data.enemies.filter((e) => e.alive);
    for (const enemy of aliveEnemies) {
      // Fortress blocks all damage
      if (data.player.fortressActive) {
        data.player.fortressActive = false;
        this.emitEvent('fortress_blocked', data.playerId, {});
        continue;
      }

      // Evasion passive
      const evasion = data.player.skills.find((s) => s.name === 'Evasion' && s.unlocked);
      if (evasion && Math.random() < 0.5) {
        this.emitEvent('evaded', data.playerId, { enemy: enemy.name });
        continue;
      }

      const stats = this.getEffectiveStats(data.player);
      const damage = Math.max(1, enemy.atk - stats.def);
      data.player.hp = Math.max(0, data.player.hp - damage);

      if (data.player.hp <= 0) {
        this.emitEvent('player_defeated', data.playerId, {});
        break;
      }
    }
  }

  private tickCooldowns(player: RPGPlayer): void {
    for (const skill of player.skills) {
      if (skill.cooldown > 0) {
        skill.cooldown--;
      }
    }
  }

  private checkLevelUp(data: BeatEmUpRPGState): void {
    const player = data.player;
    while (
      player.level < data.maxLevel &&
      player.level < data.xpThresholds.length &&
      player.xp >= data.xpThresholds[player.level]
    ) {
      player.level++;
      player.skillPoints++;

      // Stat growth based on curve
      this.applyStatGrowth(player, data.statGrowthCurve);

      this.emitEvent('level_up', data.playerId, { level: player.level });

      // Check if any skills can be unlocked
      for (const skillDef of SKILL_TREE) {
        if (player.level >= skillDef.unlockLevel) {
          const playerSkill = player.skills.find((s) => s.name === skillDef.name);
          if (playerSkill && !playerSkill.unlocked) {
            // Auto-unlock if player has skill points and it matches the path progression
            // Skills must be unlocked manually via allocate_stat or auto by reaching level
          }
        }
      }
    }
  }

  private applyStatGrowth(player: RPGPlayer, curve: string): void {
    switch (curve) {
      case 'linear':
        player.maxHp += 5;
        player.hp = Math.min(player.hp + 5, player.maxHp);
        player.str += 2;
        player.def += 1;
        player.spd += 1;
        player.lck += 1;
        break;
      case 'exponential':
        player.maxHp = Math.floor(player.maxHp * 1.15);
        player.hp = Math.min(player.hp + 10, player.maxHp);
        player.str = Math.floor(player.str * 1.15);
        player.def = Math.floor(player.def * 1.15);
        player.spd = Math.floor(player.spd * 1.15);
        player.lck = Math.floor(player.lck * 1.15);
        break;
      case 'plateau':
        if (player.level <= 5) {
          player.maxHp += 8;
          player.hp = Math.min(player.hp + 8, player.maxHp);
          player.str += 3;
          player.def += 2;
          player.spd += 2;
          player.lck += 2;
        } else {
          player.maxHp += 3;
          player.hp = Math.min(player.hp + 3, player.maxHp);
          player.str += 1;
          player.def += 1;
          player.spd += 1;
          player.lck += 1;
        }
        break;
    }
  }

  private clearStage(data: BeatEmUpRPGState): void {
    data.stagesCleared++;
    this.emitEvent('stage_cleared', data.playerId, { stage: data.currentStage });

    if (data.stagesCleared >= data.totalStages) {
      data.phase = 'victory';
      this.emitEvent('victory', data.playerId, { stagesCleared: data.stagesCleared });
      return;
    }

    // Shop phase every N stages
    if (data.stagesCleared % data.shopFrequency === 0) {
      data.phase = 'shop';
    } else {
      data.phase = 'combat';
    }

    // Advance to next stage
    data.currentStage++;
    data.enemies = generateEnemies(data.currentStage);
  }

  protected checkGameOver(): boolean {
    const data = this.getData<BeatEmUpRPGState>();
    return data.player.hp <= 0 || data.phase === 'victory';
  }

  protected determineWinner(): string | null {
    const data = this.getData<BeatEmUpRPGState>();
    if (data.phase === 'victory') {
      return data.playerId;
    }
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<BeatEmUpRPGState>();
    const score = data.totalDamageDealt + data.player.gold + data.stagesCleared * 100;
    return { [data.playerId]: score };
  }
}
