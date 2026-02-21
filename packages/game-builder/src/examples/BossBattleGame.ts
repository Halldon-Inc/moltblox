/**
 * BossBattleGame: Cooperative boss raid for 1-4 players
 *
 * Players team up against a powerful boss that transitions through
 * phases as its HP drops. Boss enrages after a timer, doubling its
 * attack power. Optional role system (tank, dps, healer, support).
 *
 * Actions: attack, dodge, heal, taunt, use_ability, revive_ally
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface BossBattleConfig {
  bossTemplate?: 'dragon' | 'titan' | 'hydra' | 'kraken' | 'demon-lord';
  phaseCount?: number;
  enrageTimer?: number;
  playerRoles?: boolean;
  theme?: {
    bossArenaColors?: Record<string, string>;
    healthBarColors?: Record<string, string>;
    phaseTransitionColor?: string;
  };
  gameplay?: {
    playerHp?: number;
    tankHp?: number;
    baseDamage?: number;
    dpsMultiplier?: number;
    healAmount?: number;
    healerHealAmount?: number;
    bossDamageScale?: number;
    phaseAtkBonus?: number;
    reviveCooldown?: number;
    reviveHpPercent?: number;
    dodgeChance?: number;
  };
  content?: {
    bossDefinitions?: Record<
      string,
      {
        hp: number;
        atk: number;
        abilities: Array<{ name: string; type: string; damage: number; cooldown: number }>;
      }
    >;
    attackPatterns?: string[];
  };
}

interface BossAbility {
  name: string;
  type: 'aoe' | 'single' | 'heal' | 'debuff';
  damage: number;
  cooldown: number;
  currentCooldown: number;
  extra?: Record<string, unknown>;
}

interface Boss {
  hp: number;
  maxHp: number;
  atk: number;
  baseAtk: number;
  phase: number;
  abilities: BossAbility[];
  enraged: boolean;
  turnsSinceStart: number;
  [key: string]: unknown;
}

interface Debuff {
  type: string;
  turnsLeft: number;
  value: number;
}

interface BBPlayer {
  id: string;
  hp: number;
  maxHp: number;
  role: string | null;
  alive: boolean;
  dodging: boolean;
  taunting: boolean;
  cooldowns: Record<string, number>;
  debuffs: Debuff[];
  damageDealt: number;
  [key: string]: unknown;
}

interface BossBattleState {
  boss: Boss;
  players: Record<string, BBPlayer>;
  turnCount: number;
  phaseThresholds: number[];
  allDead: boolean;
  bossDefeated: boolean;
  matchOver: boolean;
  enrageTimer: number;
  playerRoles: boolean;
  totalScore: Record<string, number>;
  [key: string]: unknown;
}

const BOSS_TEMPLATES: Record<
  string,
  { hp: number; atk: number; abilities: Omit<BossAbility, 'currentCooldown'>[] }
> = {
  dragon: {
    hp: 500,
    atk: 20,
    abilities: [
      { name: 'fire_breath', type: 'aoe', damage: 15, cooldown: 3 },
      { name: 'tail_swipe', type: 'single', damage: 30, cooldown: 2 },
    ],
  },
  titan: {
    hp: 700,
    atk: 25,
    abilities: [
      { name: 'ground_slam', type: 'aoe', damage: 20, cooldown: 3 },
      { name: 'grab', type: 'single', damage: 40, cooldown: 4, extra: { skipTurn: true } },
    ],
  },
  hydra: {
    hp: 400,
    atk: 15,
    abilities: [
      { name: 'multi_head', type: 'aoe', damage: 10, cooldown: 2 },
      { name: 'regrow', type: 'heal', damage: 30, cooldown: 3 },
    ],
  },
  kraken: {
    hp: 600,
    atk: 18,
    abilities: [
      { name: 'tentacle', type: 'single', damage: 25, cooldown: 2 },
      { name: 'ink', type: 'debuff', damage: 0, cooldown: 4, extra: { accuracy: -50, turns: 2 } },
    ],
  },
  'demon-lord': {
    hp: 550,
    atk: 22,
    abilities: [
      { name: 'dark_pulse', type: 'aoe', damage: 18, cooldown: 3 },
      { name: 'curse', type: 'debuff', damage: 0, cooldown: 5, extra: { dot: 3, turns: 5 } },
    ],
  },
};

const DEFAULT_PLAYER_HP = 100;
const DEFAULT_TANK_HP = 200;
const DEFAULT_BASE_DAMAGE = 15;
const DEFAULT_DPS_MULTIPLIER = 1.5;
const DEFAULT_HEAL_AMOUNT = 10;
const DEFAULT_HEALER_HEAL_AMOUNT = 20;
const DEFAULT_PHASE_ATK_BONUS = 5;
const DEFAULT_REVIVE_COOLDOWN = 5;
const DEFAULT_REVIVE_HP_PERCENT = 0.3;
const DEFAULT_DODGE_CHANCE = 0.65;

export class BossBattleGame extends BaseGame {
  readonly name = 'Boss Battle';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): BossBattleState {
    const cfg = this.config as BossBattleConfig;
    const templateName = cfg.bossTemplate ?? 'dragon';
    const phaseCount = cfg.phaseCount ?? 3;
    const enrageTimer = cfg.enrageTimer ?? 30;
    const playerRoles = cfg.playerRoles ?? false;

    const template = BOSS_TEMPLATES[templateName] ?? BOSS_TEMPLATES.dragon;

    const boss: Boss = {
      hp: template.hp,
      maxHp: template.hp,
      atk: template.atk,
      baseAtk: template.atk,
      phase: 1,
      abilities: template.abilities.map((a) => ({ ...a, currentCooldown: 0 })),
      enraged: false,
      turnsSinceStart: 0,
    };

    // Phase thresholds at 75%, 50%, 25%
    const phaseThresholds: number[] = [];
    for (let i = 1; i <= phaseCount; i++) {
      phaseThresholds.push(Math.floor((1 - i * (0.75 / phaseCount)) * template.hp));
    }

    const players: Record<string, BBPlayer> = {};
    const totalScore: Record<string, number> = {};
    const roles = ['tank', 'dps', 'healer', 'support'];

    const defaultHp = (cfg.gameplay?.playerHp as number) ?? DEFAULT_PLAYER_HP;
    const tankHp = (cfg.gameplay?.tankHp as number) ?? DEFAULT_TANK_HP;

    for (let i = 0; i < playerIds.length; i++) {
      const pid = playerIds[i];
      const role = playerRoles ? roles[i % roles.length] : null;
      let maxHp = defaultHp;
      if (role === 'tank') maxHp = tankHp;

      players[pid] = {
        id: pid,
        hp: maxHp,
        maxHp,
        role,
        alive: true,
        dodging: false,
        taunting: false,
        cooldowns: { revive: 0 },
        debuffs: [],
        damageDealt: 0,
      };
      totalScore[pid] = 0;
    }

    return {
      boss,
      players,
      turnCount: 0,
      phaseThresholds,
      allDead: false,
      bossDefeated: false,
      matchOver: false,
      enrageTimer,
      playerRoles,
      totalScore,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<BossBattleState>();

    if (data.matchOver) {
      return { success: false, error: 'Battle is already over' };
    }

    const player = data.players[playerId];
    if (!player) {
      return { success: false, error: 'Player not in battle' };
    }
    if (!player.alive) {
      // Dead players can only attempt revive_ally if someone else does it
      if (action.type !== 'revive_ally') {
        return { success: false, error: 'Player is down' };
      }
    }

    let result: ActionResult;

    switch (action.type) {
      case 'attack':
        result = this.handleAttack(playerId, data);
        break;
      case 'dodge':
        result = this.handleDodge(playerId, data);
        break;
      case 'heal':
        result = this.handleHeal(playerId, action, data);
        break;
      case 'taunt':
        result = this.handleTaunt(playerId, data);
        break;
      case 'use_ability':
        result = this.handleUseAbility(playerId, action, data);
        break;
      case 'revive_ally':
        result = this.handleRevive(playerId, action, data);
        break;
      default:
        result = { success: false, error: `Unknown action: ${action.type}` };
    }

    return result;
  }

  private getAtkMultiplier(player: BBPlayer): number {
    const cfg = this.config as BossBattleConfig;
    if (player.role === 'dps')
      return (cfg.gameplay?.dpsMultiplier as number) ?? DEFAULT_DPS_MULTIPLIER;
    return 1;
  }

  private handleAttack(playerId: string, data: BossBattleState): ActionResult {
    const player = data.players[playerId];
    if (!player.alive) {
      return { success: false, error: 'Player is down' };
    }

    // Check blind debuff (accuracy reduction)
    const blind = player.debuffs.find((d) => d.type === 'blind');
    if (blind && Math.random() < 0.5) {
      this.emitEvent('miss', playerId, { reason: 'blind' });
      this.processBossTurn(data);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    const cfg = this.config as BossBattleConfig;
    const baseDmg = (cfg.gameplay?.baseDamage as number) ?? DEFAULT_BASE_DAMAGE;
    const damage = Math.floor(baseDmg * this.getAtkMultiplier(player));
    data.boss.hp -= damage;
    player.damageDealt += damage;
    data.totalScore[playerId] = (data.totalScore[playerId] ?? 0) + damage;

    this.emitEvent('attack', playerId, { damage });

    if (data.boss.hp <= 0) {
      data.boss.hp = 0;
      data.bossDefeated = true;
      data.matchOver = true;
      this.emitEvent('boss_defeated', playerId, {});
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    this.checkPhaseTransition(data);
    this.processBossTurn(data);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleDodge(playerId: string, data: BossBattleState): ActionResult {
    const player = data.players[playerId];
    if (!player.alive) {
      return { success: false, error: 'Player is down' };
    }

    player.dodging = true;
    this.emitEvent('dodge', playerId, {});
    this.processBossTurn(data);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleHeal(playerId: string, action: GameAction, data: BossBattleState): ActionResult {
    const player = data.players[playerId];
    if (!player.alive) {
      return { success: false, error: 'Player is down' };
    }

    const targetId = (action.payload?.targetId as string) ?? playerId;
    const target = data.players[targetId];
    if (!target || !target.alive) {
      return { success: false, error: 'Invalid heal target' };
    }

    const cfg = this.config as BossBattleConfig;
    const baseHeal = (cfg.gameplay?.healAmount as number) ?? DEFAULT_HEAL_AMOUNT;
    const healerHeal = (cfg.gameplay?.healerHealAmount as number) ?? DEFAULT_HEALER_HEAL_AMOUNT;
    const healAmount = player.role === 'healer' ? healerHeal : baseHeal;
    target.hp = Math.min(target.maxHp, target.hp + healAmount);

    this.emitEvent('heal', playerId, { target: targetId, amount: healAmount });
    this.processBossTurn(data);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleTaunt(playerId: string, data: BossBattleState): ActionResult {
    const player = data.players[playerId];
    if (!player.alive) {
      return { success: false, error: 'Player is down' };
    }

    // Clear other taunts
    for (const p of Object.values(data.players)) {
      p.taunting = false;
    }
    player.taunting = true;

    this.emitEvent('taunt', playerId, {});
    this.processBossTurn(data);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleUseAbility(
    playerId: string,
    action: GameAction,
    data: BossBattleState,
  ): ActionResult {
    const player = data.players[playerId];
    if (!player.alive) {
      return { success: false, error: 'Player is down' };
    }

    if (!data.playerRoles || !player.role) {
      return { success: false, error: 'Roles not enabled' };
    }

    // Support can buff team
    if (player.role === 'support') {
      const cooldown = player.cooldowns['buff'] ?? 0;
      if (cooldown > 0) {
        return { success: false, error: 'Ability on cooldown' };
      }
      // Buff all alive players +5 atk equivalent (tracked as debuff with positive effect)
      for (const p of Object.values(data.players)) {
        if (p.alive) {
          p.debuffs.push({ type: 'atk_buff', turnsLeft: 3, value: 5 });
        }
      }
      player.cooldowns['buff'] = 4;
      this.emitEvent('buff', playerId, { effect: 'team_atk_up' });
    }

    this.processBossTurn(data);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleRevive(playerId: string, action: GameAction, data: BossBattleState): ActionResult {
    const player = data.players[playerId];
    if (!player.alive) {
      return { success: false, error: 'Cannot revive while down' };
    }

    const targetId = action.payload?.targetId as string;
    if (!targetId) {
      return { success: false, error: 'Must specify target' };
    }
    const target = data.players[targetId];
    if (!target) {
      return { success: false, error: 'Invalid target' };
    }
    if (target.alive) {
      return { success: false, error: 'Target is not down' };
    }

    const cooldown = player.cooldowns['revive'] ?? 0;
    if (cooldown > 0) {
      return { success: false, error: 'Revive on cooldown' };
    }

    const cfg = this.config as BossBattleConfig;
    const reviveHpPct = (cfg.gameplay?.reviveHpPercent as number) ?? DEFAULT_REVIVE_HP_PERCENT;
    const reviveCd = (cfg.gameplay?.reviveCooldown as number) ?? DEFAULT_REVIVE_COOLDOWN;
    target.alive = true;
    target.hp = Math.floor(target.maxHp * reviveHpPct);
    player.cooldowns['revive'] = reviveCd;

    this.emitEvent('revive', playerId, { target: targetId, hp: target.hp });
    this.processBossTurn(data);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private checkPhaseTransition(data: BossBattleState): void {
    const thresholds = data.phaseThresholds;
    for (let i = 0; i < thresholds.length; i++) {
      const cfg = this.config as BossBattleConfig;
      const phaseAtkBonus = (cfg.gameplay?.phaseAtkBonus as number) ?? DEFAULT_PHASE_ATK_BONUS;
      if (data.boss.hp <= thresholds[i] && data.boss.phase <= i + 1) {
        data.boss.phase = i + 2;
        data.boss.atk = data.boss.baseAtk + (data.boss.phase - 1) * phaseAtkBonus;
        this.emitEvent('phase_transition', undefined, { phase: data.boss.phase });
      }
    }
  }

  private processBossTurn(data: BossBattleState): void {
    if (data.bossDefeated || data.matchOver) return;

    data.turnCount++;
    data.boss.turnsSinceStart++;

    // Enrage check
    if (!data.boss.enraged && data.boss.turnsSinceStart >= data.enrageTimer) {
      data.boss.enraged = true;
      data.boss.atk = data.boss.baseAtk * 2;
      this.emitEvent('enrage', undefined, {});
    }

    // Decrease ability cooldowns
    for (const ability of data.boss.abilities) {
      if (ability.currentCooldown > 0) {
        ability.currentCooldown--;
      }
    }

    // Decrease player cooldowns and debuffs
    for (const p of Object.values(data.players)) {
      for (const key of Object.keys(p.cooldowns)) {
        if (p.cooldowns[key] > 0) p.cooldowns[key]--;
      }
      // Process DOT debuffs
      p.debuffs = p.debuffs.filter((d) => {
        if (d.type === 'dot' && p.alive) {
          p.hp -= d.value;
          if (p.hp <= 0) {
            p.hp = 0;
            p.alive = false;
          }
        }
        d.turnsLeft--;
        return d.turnsLeft > 0;
      });
    }

    const attackCount = data.boss.enraged ? 2 : 1;

    for (let a = 0; a < attackCount; a++) {
      if (data.matchOver) break;

      // Try to use an ability first
      const readyAbility = data.boss.abilities.find((ab) => ab.currentCooldown === 0);

      if (readyAbility) {
        readyAbility.currentCooldown = readyAbility.cooldown;
        this.executeBossAbility(readyAbility, data);
      } else {
        // Basic attack on taunting or random target
        this.bossBasicAttack(data);
      }

      // Check if all dead
      const anyAlive = Object.values(data.players).some((p) => p.alive);
      if (!anyAlive) {
        data.allDead = true;
        data.matchOver = true;
        this.emitEvent('party_wipe', undefined, {});
        return;
      }
    }

    // Reset dodge state
    for (const p of Object.values(data.players)) {
      p.dodging = false;
    }
  }

  private executeBossAbility(ability: BossAbility, data: BossBattleState): void {
    const alivePlayers = Object.values(data.players).filter((p) => p.alive);
    if (alivePlayers.length === 0) return;

    switch (ability.type) {
      case 'aoe': {
        for (const p of alivePlayers) {
          if (
            p.dodging &&
            Math.random() <
              ((this.config as BossBattleConfig).gameplay?.dodgeChance ?? DEFAULT_DODGE_CHANCE)
          ) {
            this.emitEvent('dodge_success', p.id, { ability: ability.name });
            continue;
          }
          p.hp -= ability.damage;
          if (p.hp <= 0) {
            p.hp = 0;
            p.alive = false;
          }
        }
        this.emitEvent('boss_ability', undefined, { name: ability.name, type: 'aoe' });
        break;
      }
      case 'single': {
        const target = this.getBossTarget(alivePlayers);
        if (
          target.dodging &&
          Math.random() <
            ((this.config as BossBattleConfig).gameplay?.dodgeChance ?? DEFAULT_DODGE_CHANCE)
        ) {
          this.emitEvent('dodge_success', target.id, { ability: ability.name });
          break;
        }
        target.hp -= ability.damage;
        if (ability.extra?.skipTurn) {
          // Target skips next turn (simplified: just extra damage)
          target.hp -= 5;
        }
        if (target.hp <= 0) {
          target.hp = 0;
          target.alive = false;
        }
        this.emitEvent('boss_ability', undefined, {
          name: ability.name,
          type: 'single',
          target: target.id,
        });
        break;
      }
      case 'heal': {
        data.boss.hp = Math.min(data.boss.maxHp, data.boss.hp + ability.damage);
        this.emitEvent('boss_ability', undefined, {
          name: ability.name,
          type: 'heal',
          amount: ability.damage,
        });
        break;
      }
      case 'debuff': {
        if (ability.extra?.accuracy) {
          // Blind all players
          for (const p of alivePlayers) {
            p.debuffs.push({
              type: 'blind',
              turnsLeft: (ability.extra.turns as number) ?? 2,
              value: ability.extra.accuracy as number,
            });
          }
        }
        if (ability.extra?.dot) {
          // Curse random target
          const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
          target.debuffs.push({
            type: 'dot',
            turnsLeft: (ability.extra.turns as number) ?? 5,
            value: (ability.extra.dot as number) ?? 3,
          });
        }
        this.emitEvent('boss_ability', undefined, { name: ability.name, type: 'debuff' });
        break;
      }
    }
  }

  private bossBasicAttack(data: BossBattleState): void {
    const alivePlayers = Object.values(data.players).filter((p) => p.alive);
    if (alivePlayers.length === 0) return;

    const target = this.getBossTarget(alivePlayers);

    if (
      target.dodging &&
      Math.random() <
        ((this.config as BossBattleConfig).gameplay?.dodgeChance ?? DEFAULT_DODGE_CHANCE)
    ) {
      this.emitEvent('dodge_success', target.id, { ability: 'basic_attack' });
      return;
    }

    target.hp -= data.boss.atk;
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
    }
    this.emitEvent('boss_attack', undefined, { target: target.id, damage: data.boss.atk });
  }

  private getBossTarget(alivePlayers: BBPlayer[]): BBPlayer {
    // Prefer taunting target
    const taunter = alivePlayers.find((p) => p.taunting);
    if (taunter) return taunter;
    return alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
  }

  protected checkGameOver(): boolean {
    const data = this.getData<BossBattleState>();
    return data.matchOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<BossBattleState>();
    if (data.bossDefeated) {
      // All players win; return highest damage dealer
      let best: string | null = null;
      let bestDmg = -1;
      for (const p of Object.values(data.players)) {
        if (p.damageDealt > bestDmg) {
          bestDmg = p.damageDealt;
          best = p.id;
        }
      }
      return best;
    }
    return null; // Party wipe = no winner
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<BossBattleState>();
    const scores: Record<string, number> = {};
    for (const p of Object.values(data.players)) {
      scores[p.id] = p.damageDealt + data.turnCount;
    }
    return scores;
  }
}
