/**
 * RPGGame - Turn-based RPG combat
 *
 * Battle through encounters using attacks, skills, and items!
 * Demonstrates:
 * - Stat-based character system (HP, ATK, DEF, SPD)
 * - Turn-based combat with action selection
 * - Item and skill management
 * - Encounter variety with multiple enemy types
 *
 * WHY turn-based RPG works:
 * Turn-based combat is one of the most accessible game formats because it
 * removes time pressure and lets players think through each decision. This
 * makes it ideal for AI agents — they can evaluate all options on their turn
 * without needing real-time reflexes. The stat system creates a numbers game
 * that AIs can optimize, while the variety of enemy types prevents any single
 * strategy from dominating.
 *
 * WHY stat systems create depth:
 * Four stats (HP, ATK, DEF, SPD) is the minimum needed for interesting
 * combat math. ATK vs DEF creates the damage formula. SPD determines turn
 * order, adding a layer of tactical consideration. HP is the loss condition.
 * More stats would add complexity without proportional depth at this scale.
 *
 * This is a ~250 line complete game that bots can study and modify.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface RPGConfig {
  maxEncounters?: number;
  startingHp?: number;
  startingAtk?: number;
  startingDef?: number;
  secondaryMechanic?: 'rhythm' | 'puzzle' | 'timing' | 'resource';
  /** If true, a shop phase appears between encounters (default false). */
  shopBetweenEncounters?: boolean;
  /** If true, enemy selection is randomized instead of sequential (default false). */
  randomEncounters?: boolean;
  /** Encounter indices where bosses appear (default [10]). */
  bossEncounterAt?: number[];
  /** If false, no stat increases between encounters (default true). */
  levelUpBetweenEncounters?: boolean;
}

interface CharacterStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  mp: number; // Mana for skills
  maxMp: number;
}

interface Skill {
  name: string;
  mpCost: number;
  damage: number; // Multiplier on ATK
  effect?: 'heal' | 'buff_atk' | 'buff_def';
  effectValue?: number;
}

/**
 * WHY encounter variety prevents monotony: If every enemy is the same,
 * players find one optimal strategy and repeat it forever. Different enemy
 * types (tanky, fast, magical) force players to adapt their approach,
 * keeping each encounter feeling fresh even with the same combat system.
 */
interface Enemy {
  name: string;
  stats: CharacterStats;
  reward: number; // XP reward on defeat
}

interface RPGState {
  [key: string]: unknown;
  players: Record<
    string,
    {
      stats: CharacterStats;
      level: number;
      xp: number;
      xpToLevel: number;
      skills: Skill[];
      items: Record<string, number>; // item name -> quantity
      buffs: Record<string, number>; // buff type -> turns remaining
    }
  >;
  currentEnemy: Enemy | null;
  encounter: number; // Current encounter number
  maxEncounters: number;
  turnOrder: string[]; // Who acts next (player IDs + 'enemy')
  currentTurnIndex: number;
  combatLog: string[]; // Recent combat messages
}

/**
 * Predefined enemy templates.
 * WHY enemies scale with encounter number: Early encounters teach mechanics
 * with forgiving enemies. Later encounters test mastery with tougher foes.
 * This is the classic RPG difficulty curve — it mirrors the player's growing
 * power and keeps the challenge consistent.
 */
const ENEMY_TEMPLATES = [
  { name: 'Slime', baseHp: 30, atk: 5, def: 2, spd: 3, reward: 20 },
  { name: 'Goblin', baseHp: 45, atk: 8, def: 4, spd: 6, reward: 35 },
  { name: 'Skeleton', baseHp: 60, atk: 12, def: 8, spd: 4, reward: 50 },
  { name: 'Dark Knight', baseHp: 100, atk: 18, def: 12, spd: 5, reward: 80 },
  { name: 'Dragon', baseHp: 200, atk: 25, def: 15, spd: 7, reward: 150 },
];

const STARTER_SKILLS: Skill[] = [
  { name: 'Power Strike', mpCost: 5, damage: 2.0 },
  { name: 'Heal', mpCost: 8, damage: 0, effect: 'heal', effectValue: 30 },
  { name: 'War Cry', mpCost: 6, damage: 0, effect: 'buff_atk', effectValue: 3 },
  { name: 'Shield Up', mpCost: 4, damage: 0, effect: 'buff_def', effectValue: 3 },
];

export class RPGGame extends BaseGame {
  readonly name = 'Dungeon Crawl';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): RPGState {
    const cfg = this.config as RPGConfig;
    const maxEncounters = cfg.maxEncounters ?? 10;
    const startingHp = cfg.startingHp ?? 100;
    const startingAtk = cfg.startingAtk ?? 12;
    const startingDef = cfg.startingDef ?? 8;

    const players: RPGState['players'] = {};

    for (const pid of playerIds) {
      players[pid] = {
        stats: {
          hp: startingHp,
          maxHp: startingHp,
          atk: startingAtk,
          def: startingDef,
          spd: 5,
          mp: 30,
          maxMp: 30,
        },
        level: 1,
        xp: 0,
        xpToLevel: 50,
        skills: [...STARTER_SKILLS],
        items: { Potion: 3, Ether: 2 },
        buffs: {},
      };
    }

    return {
      players,
      currentEnemy: null,
      encounter: 0,
      maxEncounters,
      turnOrder: [],
      currentTurnIndex: 0,
      combatLog: [],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<RPGState>();

    switch (action.type) {
      /**
       * Start a new encounter.
       * WHY player-initiated encounters: Like tower defense waves, letting
       * players choose when to fight gives them time to heal, use items, and
       * plan. This pacing control reduces frustration and increases agency.
       */
      case 'start_encounter': {
        if (data.currentEnemy) {
          return { success: false, error: 'Already in combat' };
        }
        if (data.encounter >= data.maxEncounters) {
          return { success: false, error: 'All encounters completed' };
        }

        data.encounter++;
        const cfgEnc = this.config as RPGConfig;
        const useRandom = cfgEnc.randomEncounters ?? false;
        const bossAt = cfgEnc.bossEncounterAt ?? [10];

        let templateIndex: number;
        if (useRandom) {
          templateIndex = Math.floor(Math.random() * ENEMY_TEMPLATES.length);
        } else {
          templateIndex = Math.min(
            Math.floor((data.encounter - 1) / 2),
            ENEMY_TEMPLATES.length - 1,
          );
        }

        // If this encounter is a boss encounter, use the last (strongest) template
        const isBoss = bossAt.includes(data.encounter);
        if (isBoss) {
          templateIndex = ENEMY_TEMPLATES.length - 1;
        }

        const template = ENEMY_TEMPLATES[templateIndex];
        const scale = 1 + (data.encounter - 1) * 0.15;
        const bossMult = isBoss ? 1.5 : 1.0;

        data.currentEnemy = {
          name: isBoss ? `Boss ${template.name}` : template.name,
          stats: {
            hp: Math.floor(template.baseHp * scale * bossMult),
            maxHp: Math.floor(template.baseHp * scale * bossMult),
            atk: Math.floor(template.atk * scale * bossMult),
            def: Math.floor(template.def * scale * bossMult),
            spd: Math.floor(template.spd * scale),
            mp: 0,
            maxMp: 0,
          },
          reward: Math.floor(template.reward * scale * bossMult),
        };

        // Determine turn order based on SPD
        // WHY SPD matters: Turn order creates a "who goes first" dynamic that
        // adds real tactical weight. A fast character can finish off a wounded
        // enemy before it attacks, or heal an ally just in time.
        const participants = [
          ...this.getPlayers().map((pid) => ({
            id: pid,
            spd: data.players[pid].stats.spd,
          })),
          { id: 'enemy', spd: data.currentEnemy.stats.spd },
        ];
        participants.sort((a, b) => b.spd - a.spd);
        data.turnOrder = participants.map((p) => p.id);
        data.currentTurnIndex = 0;

        this.emitEvent('encounter_started', playerId, {
          encounter: data.encounter,
          enemy: data.currentEnemy.name,
        });
        this.setData(data);
        this.autoResolveEnemyTurns(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * Basic attack action.
       * WHY damage = ATK - DEF/2: This formula means defense reduces damage
       * but never negates it entirely (minimum 1). Players always feel like
       * their attacks accomplish something, preventing stalemates.
       */
      case 'attack': {
        if (!data.currentEnemy) {
          // Auto-start next encounter if available
          if (data.encounter < data.maxEncounters) {
            const autoResult = this.processAction(playerId, {
              type: 'start_encounter',
              payload: {},
              timestamp: Date.now(),
            });
            // Return immediately: encounter was started, player attacks on next action
            return autoResult;
          } else {
            return { success: false, error: 'Not in combat and all encounters completed' };
          }
        }
        if (!data.currentEnemy) {
          return { success: false, error: 'Failed to start encounter' };
        }
        if (data.turnOrder[data.currentTurnIndex] !== playerId) {
          return { success: false, error: 'Not your turn' };
        }

        const player = data.players[playerId];
        const atkBonus = player.buffs['buff_atk'] ? 5 : 0;
        const damage = Math.max(
          1,
          player.stats.atk + atkBonus - Math.floor(data.currentEnemy.stats.def / 2),
        );
        data.currentEnemy.stats.hp -= damage;

        data.combatLog.push(`${playerId} attacks ${data.currentEnemy.name} for ${damage} damage`);
        this.emitEvent('attack', playerId, { target: 'enemy', damage });

        this.advanceTurn(data);
        this.setData(data);
        this.autoResolveEnemyTurns(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * Use a skill (costs MP).
       * WHY MP creates resource management: Skills are stronger than basic
       * attacks but cost a limited resource. This creates a strategic layer:
       * "Do I use my powerful skill now, or save MP for a harder fight later?"
       * Resource management across encounters is a key RPG depth mechanism.
       */
      case 'use_skill': {
        if (!data.currentEnemy) {
          return { success: false, error: 'Not in combat' };
        }
        if (data.turnOrder[data.currentTurnIndex] !== playerId) {
          return { success: false, error: 'Not your turn' };
        }

        const skillIndex = Number(action.payload.skillIndex);
        const player = data.players[playerId];
        const skill = player.skills[skillIndex];

        if (!skill) {
          return { success: false, error: 'Invalid skill index' };
        }
        if (player.stats.mp < skill.mpCost) {
          return { success: false, error: 'Not enough MP' };
        }

        player.stats.mp -= skill.mpCost;

        if (skill.effect === 'heal') {
          const healAmount = skill.effectValue || 0;
          player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healAmount);
          data.combatLog.push(`${playerId} uses ${skill.name}, heals ${healAmount} HP`);
        } else if (skill.effect === 'buff_atk' || skill.effect === 'buff_def') {
          player.buffs[skill.effect] = skill.effectValue || 3;
          data.combatLog.push(
            `${playerId} uses ${skill.name}, gains ${skill.effect} for ${skill.effectValue} turns`,
          );
        } else {
          const atkBonus = player.buffs['buff_atk'] ? 5 : 0;
          const damage = Math.max(
            1,
            Math.floor((player.stats.atk + atkBonus) * skill.damage) -
              Math.floor(data.currentEnemy.stats.def / 2),
          );
          data.currentEnemy.stats.hp -= damage;
          data.combatLog.push(`${playerId} uses ${skill.name} for ${damage} damage`);
        }

        this.emitEvent('skill_used', playerId, { skill: skill.name });
        this.advanceTurn(data);
        this.setData(data);
        this.autoResolveEnemyTurns(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * Use an item.
       * WHY consumable items exist: Items are a safety net that lets players
       * recover from mistakes. Without them, one bad turn could end the game.
       * Limited quantities force players to use them wisely, not recklessly.
       */
      case 'use_item': {
        const itemName = String(action.payload.item);
        const player = data.players[playerId];

        if (!player.items[itemName] || player.items[itemName] <= 0) {
          return { success: false, error: 'Item not available' };
        }

        player.items[itemName]--;

        if (itemName === 'Potion') {
          player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 50);
          data.combatLog.push(`${playerId} uses Potion, restores 50 HP`);
        } else if (itemName === 'Ether') {
          player.stats.mp = Math.min(player.stats.maxMp, player.stats.mp + 20);
          data.combatLog.push(`${playerId} uses Ether, restores 20 MP`);
        }

        if (data.currentEnemy) {
          this.advanceTurn(data);
        }
        this.setData(data);
        if (data.currentEnemy) {
          this.autoResolveEnemyTurns(data);
        }
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  /**
   * Advance to the next turn in combat.
   * When it's the enemy's turn, auto-attack the player with the lowest HP.
   * WHY enemies target lowest HP: This creates urgency to heal wounded
   * allies and adds tactical depth around protecting weak party members.
   */
  private advanceTurn(data: RPGState): void {
    // Tick down buffs for current player
    const currentId = data.turnOrder[data.currentTurnIndex];
    if (currentId !== 'enemy' && data.players[currentId]) {
      for (const buff of Object.keys(data.players[currentId].buffs)) {
        data.players[currentId].buffs[buff]--;
        if (data.players[currentId].buffs[buff] <= 0) {
          delete data.players[currentId].buffs[buff];
        }
      }
    }

    // Check if enemy is dead
    if (data.currentEnemy && data.currentEnemy.stats.hp <= 0) {
      const cfgAdv = this.config as RPGConfig;
      const allowLevelUp = cfgAdv.levelUpBetweenEncounters ?? true;
      const showShop = cfgAdv.shopBetweenEncounters ?? false;
      const reward = data.currentEnemy.reward;
      for (const pid of this.getPlayers()) {
        data.players[pid].xp += reward;
        // Level up check (only if enabled)
        if (allowLevelUp && data.players[pid].xp >= data.players[pid].xpToLevel) {
          data.players[pid].level++;
          data.players[pid].xp -= data.players[pid].xpToLevel;
          data.players[pid].xpToLevel = Math.floor(data.players[pid].xpToLevel * 1.5);
          data.players[pid].stats.maxHp += 10;
          data.players[pid].stats.hp = data.players[pid].stats.maxHp;
          data.players[pid].stats.atk += 2;
          data.players[pid].stats.def += 1;
          data.players[pid].stats.maxMp += 5;
          data.players[pid].stats.mp = data.players[pid].stats.maxMp;
          this.emitEvent('level_up', pid, { level: data.players[pid].level });
        }
      }
      data.combatLog.push(`${data.currentEnemy.name} defeated! +${reward} XP`);
      for (const pid of this.getPlayers()) {
        const p = data.players[pid];
        data.combatLog.push(
          `${pid}: Level ${p.level}, XP ${p.xp}/${p.xpToLevel}, HP ${p.stats.hp}/${p.stats.maxHp}`,
        );
      }
      if (showShop && data.encounter < data.maxEncounters) {
        // Add shop items: Potion +1, Ether +1 after each encounter
        for (const pid of this.getPlayers()) {
          data.players[pid].items['Potion'] = (data.players[pid].items['Potion'] ?? 0) + 1;
          data.players[pid].items['Ether'] = (data.players[pid].items['Ether'] ?? 0) + 1;
        }
        data.combatLog.push('Shop: +1 Potion, +1 Ether added to inventory.');
      }
      if (data.encounter < data.maxEncounters) {
        data.combatLog.push('Use start_encounter to begin the next battle.');
      }
      data.currentEnemy = null;
      data.turnOrder = [];
      // Bound combatLog to prevent unbounded growth
      if (data.combatLog.length > 50) {
        data.combatLog.splice(0, data.combatLog.length - 50);
      }
      return;
    }

    // Advance turn index
    data.currentTurnIndex = (data.currentTurnIndex + 1) % data.turnOrder.length;

    // Skip dead players (guard: max iterations = turnOrder.length to prevent infinite loop)
    let skipChecks = 0;
    while (
      skipChecks < data.turnOrder.length &&
      data.turnOrder[data.currentTurnIndex] !== 'enemy' &&
      data.players[data.turnOrder[data.currentTurnIndex]]?.stats.hp <= 0
    ) {
      data.currentTurnIndex = (data.currentTurnIndex + 1) % data.turnOrder.length;
      skipChecks++;
    }

    // If all players are dead, end combat
    const allPlayersDead = this.getPlayers().every((pid) => data.players[pid].stats.hp <= 0);
    if (skipChecks >= data.turnOrder.length || allPlayersDead) {
      data.combatLog.push('All heroes have fallen!');
      data.currentEnemy = null;
      data.turnOrder = [];
      return;
    }
  }

  /**
   * Auto-resolve enemy/NPC turns until it is a real player's turn.
   * Call this after advanceTurn + setData so the player never sees
   * "Not your turn" because the turn index points at an enemy.
   */
  private autoResolveEnemyTurns(data: RPGState): void {
    const playerSet = new Set(this.getPlayers());
    // Guard: max iterations = turnOrder.length to prevent infinite loops
    let iterations = 0;
    while (
      iterations < data.turnOrder.length &&
      data.turnOrder.length > 0 &&
      data.currentEnemy &&
      !playerSet.has(data.turnOrder[data.currentTurnIndex])
    ) {
      iterations++;
      const enemyId = data.turnOrder[data.currentTurnIndex];
      if (enemyId === 'enemy' || !playerSet.has(enemyId)) {
        // Enemy attacks the player with lowest HP
        let target: string | null = null;
        let lowestHp = Infinity;
        for (const pid of this.getPlayers()) {
          if (data.players[pid].stats.hp > 0 && data.players[pid].stats.hp < lowestHp) {
            lowestHp = data.players[pid].stats.hp;
            target = pid;
          }
        }

        if (target) {
          const defBonus = data.players[target].buffs['buff_def'] ? 5 : 0;
          const damage = Math.max(
            1,
            data.currentEnemy.stats.atk -
              Math.floor((data.players[target].stats.def + defBonus) / 2),
          );
          data.players[target].stats.hp -= damage;
          data.combatLog.push(`${data.currentEnemy.name} attacks ${target} for ${damage} damage`);

          if (data.players[target].stats.hp <= 0) {
            data.combatLog.push(`${target} has fallen!`);
            this.emitEvent('player_defeated', target, {});
          }
        }

        // Advance past this enemy turn
        this.advanceTurn(data);
        this.setData(data);
        // If advanceTurn cleared turnOrder (enemy died or all players dead), stop
        if (data.turnOrder.length === 0) break;
      }
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<RPGState>();

    // Game over if all players are dead
    const allDead = this.getPlayers().every((pid) => data.players[pid].stats.hp <= 0);
    if (allDead) return true;

    // Game over if all encounters completed and not in combat
    return data.encounter >= data.maxEncounters && !data.currentEnemy;
  }

  protected determineWinner(): string | null {
    const data = this.getData<RPGState>();

    // If all players died, no winner
    const allDead = this.getPlayers().every((pid) => data.players[pid].stats.hp <= 0);
    if (allDead) return null;

    // Highest level + remaining HP determines winner
    let bestPlayer: string | null = null;
    let bestScore = -1;
    for (const pid of this.getPlayers()) {
      const p = data.players[pid];
      const score = p.level * 1000 + p.stats.hp;
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = pid;
      }
    }
    return bestPlayer;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<RPGState>();
    const scores: Record<string, number> = {};
    for (const pid of this.getPlayers()) {
      const p = data.players[pid];
      // Score = level * 100 + encounters survived * 50 + remaining HP
      scores[pid] = p.level * 100 + data.encounter * 50 + Math.max(0, p.stats.hp);
    }
    return scores;
  }
}
