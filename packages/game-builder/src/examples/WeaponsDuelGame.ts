/**
 * WeaponsDuelGame: Blade-to-blade combat with parry timing,
 * distance management, and wound mechanics.
 *
 * Features: 5 weapon types with different reach/damage/speed/parry bonuses,
 * guard zones (high/mid/low), feints, wounds with bleed, stamina management,
 * and round-based matches.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface WeaponsDuelConfig {
  weaponPool?: string[];
  woundSeverity?: number;
  staminaRegenRate?: number;
  distanceSteps?: number;
  roundsToWin?: number;
  theme?: {
    arenaBackground?: string;
    weaponGlowColors?: Record<string, string>;
    bloodEffectColor?: string;
  };
  gameplay?: {
    playerHp?: number;
    playerStamina?: number;
    weaponDamage?: Record<string, number>;
    parryWindow?: number;
    parryRiposteMultiplier?: number;
    lungeMultiplier?: number;
    thrustMultiplier?: number;
    guardReduction?: number;
    staminaCosts?: Record<string, number>;
    durability?: number;
  };
  content?: {
    weaponDefinitions?: Record<
      string,
      { reach: number; damage: number; speed: number; parryBonus: number }
    >;
    fightingStyles?: string[];
  };
}

interface WeaponDef {
  name: string;
  reach: number;
  damage: number;
  speed: number;
  parryBonus: number; // percentage bonus to parry success
}

const DEFAULT_WEAPONS: Record<string, WeaponDef> = {
  dagger: { name: 'dagger', reach: 1, damage: 8, speed: 12, parryBonus: 15 },
  rapier: { name: 'rapier', reach: 2, damage: 10, speed: 10, parryBonus: 10 },
  sword: { name: 'sword', reach: 2, damage: 14, speed: 8, parryBonus: 5 },
  axe: { name: 'axe', reach: 2, damage: 18, speed: 5, parryBonus: 0 },
  spear: { name: 'spear', reach: 3, damage: 12, speed: 7, parryBonus: -5 },
};

const ALL_WEAPONS = Object.keys(DEFAULT_WEAPONS);

const DEFAULT_PLAYER_HP = 100;
const DEFAULT_PLAYER_STAMINA = 50;
const DEFAULT_PARRY_RIPOSTE_MULTIPLIER = 0.5;
const DEFAULT_LUNGE_MULTIPLIER = 1.3;
const DEFAULT_THRUST_MULTIPLIER = 0.8;
const DEFAULT_GUARD_REDUCTION = 0.5;

interface Wound {
  severity: number;
  bleedPerTurn: number;
}

interface Duelist {
  id: string;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  weapon: string;
  position: number;
  wounds: Wound[];
  guard: 'high' | 'mid' | 'low' | 'none';
  roundWins: number;
  feintZone: string | null; // zone that was feinted (removes opponent's guard next turn)
  parriesLanded: number;
  woundsInflicted: number;
  [key: string]: unknown;
}

interface WeaponsDuelState {
  duelists: Record<string, Duelist>;
  currentRound: number;
  roundOver: boolean;
  matchOver: boolean;
  turnOrder: string[];
  currentTurnIndex: number;
  woundSeverity: number;
  staminaRegenRate: number;
  distanceSteps: number;
  roundsToWin: number;
  lastAttackZone: Record<string, string | null>;
  [key: string]: unknown;
}

// Stamina costs
const DEFAULT_STAMINA_COSTS: Record<string, number> = {
  thrust: 8,
  slash: 10,
  lunge: 15,
  parry: 5,
  advance: 3,
  retreat: 3,
  feint: 4,
  guard: 0,
};

export class WeaponsDuelGame extends BaseGame {
  readonly name = 'Weapons Duel';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): WeaponsDuelState {
    const cfg = this.config as WeaponsDuelConfig;
    const weaponPool = cfg.weaponPool ?? ALL_WEAPONS;
    const woundSeverity = cfg.woundSeverity ?? 2;
    const staminaRegenRate = cfg.staminaRegenRate ?? 8;
    const distanceSteps = cfg.distanceSteps ?? 7;
    const roundsToWin = cfg.roundsToWin ?? 2;

    const allIds = [...playerIds];
    if (playerIds.length === 1) {
      allIds.push('cpu');
    }

    const duelists: Record<string, Duelist> = {};
    for (let i = 0; i < allIds.length; i++) {
      const pid = allIds[i];
      const weaponName = weaponPool[i % weaponPool.length];
      const hp = (cfg.gameplay?.playerHp as number) ?? DEFAULT_PLAYER_HP;
      const stamina = (cfg.gameplay?.playerStamina as number) ?? DEFAULT_PLAYER_STAMINA;
      duelists[pid] = {
        id: pid,
        hp,
        maxHp: hp,
        stamina,
        maxStamina: stamina,
        weapon: weaponName,
        position: i === 0 ? 1 : distanceSteps - 1,
        wounds: [],
        guard: 'none',
        roundWins: 0,
        feintZone: null,
        parriesLanded: 0,
        woundsInflicted: 0,
      };
    }

    // Turn order by weapon speed (higher first)
    const weapons =
      (cfg.content?.weaponDefinitions as Record<string, WeaponDef>) ?? DEFAULT_WEAPONS;
    const turnOrder = allIds.sort((a, b) => {
      const weapA = weapons[duelists[b].weapon] ?? weapons['sword'];
      const weapB = weapons[duelists[a].weapon] ?? weapons['sword'];
      return weapA.speed - weapB.speed;
    });

    const lastAttackZone: Record<string, string | null> = {};
    for (const id of allIds) {
      lastAttackZone[id] = null;
    }

    return {
      duelists,
      currentRound: 1,
      roundOver: false,
      matchOver: false,
      turnOrder,
      currentTurnIndex: 0,
      woundSeverity,
      staminaRegenRate,
      distanceSteps,
      roundsToWin,
      lastAttackZone,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<WeaponsDuelState>();

    if (data.matchOver) {
      return { success: false, error: 'Match is already over' };
    }

    if (data.roundOver) {
      if (action.type === 'next_round') {
        return this.handleNextRound(data);
      }
      return { success: false, error: 'Round is over' };
    }

    const duelist = data.duelists[playerId];
    if (!duelist) {
      return { success: false, error: 'Duelist not found' };
    }

    // Apply bleed from wounds at start of turn
    this.applyBleed(duelist, data);
    if (duelist.hp <= 0) {
      this.resolveRoundEnd(playerId, data);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    // Stamina regen
    duelist.stamina = Math.min(duelist.maxStamina, duelist.stamina + data.staminaRegenRate);

    // Clear opponent's feint effect from last turn
    const opponent = this.getOpponent(playerId, data);
    if (opponent && duelist.feintZone) {
      // Feint opened opponent's guard on that zone
      if (opponent.guard === duelist.feintZone) {
        opponent.guard = 'none';
      }
      duelist.feintZone = null;
    }

    let result: ActionResult;

    switch (action.type) {
      case 'advance':
        result = this.handleAdvance(playerId, data);
        break;
      case 'retreat':
        result = this.handleRetreat(playerId, data);
        break;
      case 'thrust':
        result = this.handleStrike(playerId, 'thrust', action, data);
        break;
      case 'slash':
        result = this.handleStrike(playerId, 'slash', action, data);
        break;
      case 'lunge':
        result = this.handleLunge(playerId, action, data);
        break;
      case 'parry':
        result = this.handleParry(playerId, action, data);
        break;
      case 'feint':
        result = this.handleFeint(playerId, action, data);
        break;
      case 'guard':
        result = this.handleGuard(playerId, action, data);
        break;
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    if (!result.success) {
      return result;
    }

    if (!data.roundOver) {
      data.currentTurnIndex = (data.currentTurnIndex + 1) % data.turnOrder.length;
      // CPU turn
      if (!data.roundOver) {
        this.runCpuTurn(data);
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private getOpponent(playerId: string, data: WeaponsDuelState): Duelist | null {
    const ids = Object.keys(data.duelists);
    const oppId = ids.find((id) => id !== playerId);
    return oppId ? data.duelists[oppId] : null;
  }

  private getWeapons(): Record<string, WeaponDef> {
    const cfg = this.config as WeaponsDuelConfig;
    return (cfg.content?.weaponDefinitions as Record<string, WeaponDef>) ?? DEFAULT_WEAPONS;
  }

  private getStaminaCosts(): Record<string, number> {
    const cfg = this.config as WeaponsDuelConfig;
    return (cfg.gameplay?.staminaCosts as Record<string, number>) ?? DEFAULT_STAMINA_COSTS;
  }

  private getDistance(a: Duelist, b: Duelist): number {
    return Math.abs(a.position - b.position);
  }

  private hasStamina(duelist: Duelist, actionType: string): boolean {
    const costs = this.getStaminaCosts();
    const cost = costs[actionType] ?? 0;
    return duelist.stamina >= cost;
  }

  private spendStamina(duelist: Duelist, actionType: string): void {
    const costs = this.getStaminaCosts();
    const cost = costs[actionType] ?? 0;
    duelist.stamina = Math.max(0, duelist.stamina - cost);
  }

  private applyBleed(duelist: Duelist, _data: WeaponsDuelState): void {
    for (const wound of duelist.wounds) {
      duelist.hp = Math.max(0, duelist.hp - wound.bleedPerTurn);
    }
  }

  private handleAdvance(playerId: string, data: WeaponsDuelState): ActionResult {
    const duelist = data.duelists[playerId];
    if (!this.hasStamina(duelist, 'advance')) {
      return { success: false, error: 'Not enough stamina' };
    }

    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    const dir = duelist.position < opponent.position ? 1 : -1;
    const newPos = duelist.position + dir;
    // Cannot move through opponent
    if (newPos !== opponent.position && newPos >= 0 && newPos < data.distanceSteps) {
      duelist.position = newPos;
    }

    this.spendStamina(duelist, 'advance');
    this.emitEvent('advance', playerId, { position: duelist.position });
    return { success: true, newState: this.getState() };
  }

  private handleRetreat(playerId: string, data: WeaponsDuelState): ActionResult {
    const duelist = data.duelists[playerId];
    if (!this.hasStamina(duelist, 'retreat')) {
      return { success: false, error: 'Not enough stamina' };
    }

    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    const dir = duelist.position < opponent.position ? -1 : 1;
    const newPos = Math.max(0, Math.min(data.distanceSteps - 1, duelist.position + dir));
    duelist.position = newPos;

    this.spendStamina(duelist, 'retreat');
    this.emitEvent('retreat', playerId, { position: duelist.position });
    return { success: true, newState: this.getState() };
  }

  private handleStrike(
    playerId: string,
    strikeType: 'thrust' | 'slash',
    action: GameAction,
    data: WeaponsDuelState,
  ): ActionResult {
    const duelist = data.duelists[playerId];
    if (!this.hasStamina(duelist, strikeType)) {
      return { success: false, error: 'Not enough stamina' };
    }

    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    const cfg = this.config as WeaponsDuelConfig;
    const weapons = this.getWeapons();
    const weapon = weapons[duelist.weapon] ?? weapons['sword'];
    const distance = this.getDistance(duelist, opponent);

    if (distance > weapon.reach) {
      return { success: false, error: 'Out of reach' };
    }

    const targetZone = (action.payload.target as string) || 'mid';
    data.lastAttackZone[playerId] = targetZone;

    const thrustMult = (cfg.gameplay?.thrustMultiplier as number) ?? DEFAULT_THRUST_MULTIPLIER;
    const damageMultiplier = strikeType === 'thrust' ? thrustMult : 1.0;
    let damage = Math.floor(weapon.damage * damageMultiplier);

    // Guard check
    const guardReduction = (cfg.gameplay?.guardReduction as number) ?? DEFAULT_GUARD_REDUCTION;
    if (opponent.guard === targetZone) {
      damage = Math.floor(damage * guardReduction);
    }

    opponent.hp = Math.max(0, opponent.hp - damage);
    this.spendStamina(duelist, strikeType);

    // Wound chance
    this.tryInflictWound(duelist, opponent, data);

    this.emitEvent(strikeType, playerId, { target: targetZone, damage });

    if (opponent.hp <= 0) {
      const winnerId = playerId;
      this.resolveRoundEnd(this.getOpponentId(playerId, data) ?? '', data, winnerId);
    }

    return { success: true, newState: this.getState() };
  }

  private handleLunge(playerId: string, action: GameAction, data: WeaponsDuelState): ActionResult {
    const duelist = data.duelists[playerId];
    if (!this.hasStamina(duelist, 'lunge')) {
      return { success: false, error: 'Not enough stamina' };
    }

    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    // Lunge advances 1 position toward opponent before attacking
    const dir = duelist.position < opponent.position ? 1 : -1;
    const newPos = duelist.position + dir;
    if (newPos !== opponent.position && newPos >= 0 && newPos < data.distanceSteps) {
      duelist.position = newPos;
    }

    const cfg = this.config as WeaponsDuelConfig;
    const weapons = this.getWeapons();
    const weapon = weapons[duelist.weapon] ?? weapons['sword'];
    const distance = this.getDistance(duelist, opponent);

    if (distance > weapon.reach) {
      // Even after advancing, out of reach
      this.spendStamina(duelist, 'lunge');
      return { success: false, error: 'Still out of reach after lunge' };
    }

    const targetZone = (action.payload.target as string) || 'mid';
    data.lastAttackZone[playerId] = targetZone;

    const lungeMult = (cfg.gameplay?.lungeMultiplier as number) ?? DEFAULT_LUNGE_MULTIPLIER;
    let damage = Math.floor(weapon.damage * lungeMult);

    // Guard check
    const guardReduction = (cfg.gameplay?.guardReduction as number) ?? DEFAULT_GUARD_REDUCTION;
    if (opponent.guard === targetZone) {
      damage = Math.floor(damage * guardReduction);
    }

    opponent.hp = Math.max(0, opponent.hp - damage);
    this.spendStamina(duelist, 'lunge');

    // Wound chance (higher on lunge)
    this.tryInflictWound(duelist, opponent, data);

    this.emitEvent('lunge', playerId, { target: targetZone, damage, position: duelist.position });

    if (opponent.hp <= 0) {
      const winnerId = playerId;
      this.resolveRoundEnd(this.getOpponentId(playerId, data) ?? '', data, winnerId);
    }

    return { success: true, newState: this.getState() };
  }

  private handleParry(playerId: string, action: GameAction, data: WeaponsDuelState): ActionResult {
    const duelist = data.duelists[playerId];
    if (!this.hasStamina(duelist, 'parry')) {
      return { success: false, error: 'Not enough stamina' };
    }

    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    const parryZone = (action.payload.zone as string) || 'mid';
    const opponentLastZone = data.lastAttackZone[opponent.id];

    this.spendStamina(duelist, 'parry');

    if (opponentLastZone && parryZone === opponentLastZone) {
      // Successful parry: riposte damage
      const cfg = this.config as WeaponsDuelConfig;
      const weapons = this.getWeapons();
      const weapon = weapons[duelist.weapon] ?? weapons['sword'];
      const riposteMult =
        (cfg.gameplay?.parryRiposteMultiplier as number) ?? DEFAULT_PARRY_RIPOSTE_MULTIPLIER;
      const riposteDamage = Math.floor(weapon.damage * riposteMult);
      opponent.hp = Math.max(0, opponent.hp - riposteDamage);
      duelist.parriesLanded++;

      this.emitEvent('parry_success', playerId, { zone: parryZone, riposte: riposteDamage });

      if (opponent.hp <= 0) {
        const winnerId = playerId;
        this.resolveRoundEnd(this.getOpponentId(playerId, data) ?? '', data, winnerId);
      }
    } else {
      this.emitEvent('parry_miss', playerId, { zone: parryZone });
    }

    // Clear opponent's last attack zone after parry attempt
    data.lastAttackZone[opponent.id] = null;

    return { success: true, newState: this.getState() };
  }

  private handleFeint(playerId: string, action: GameAction, data: WeaponsDuelState): ActionResult {
    const duelist = data.duelists[playerId];
    if (!this.hasStamina(duelist, 'feint')) {
      return { success: false, error: 'Not enough stamina' };
    }

    const fakeZone = (action.payload.fake as string) || 'high';
    duelist.feintZone = fakeZone;
    this.spendStamina(duelist, 'feint');

    this.emitEvent('feint', playerId, { fakeZone });
    return { success: true, newState: this.getState() };
  }

  private handleGuard(playerId: string, action: GameAction, data: WeaponsDuelState): ActionResult {
    const duelist = data.duelists[playerId];
    const zone = (action.payload.zone as string) || 'mid';

    if (zone !== 'high' && zone !== 'mid' && zone !== 'low') {
      return { success: false, error: 'Invalid guard zone' };
    }

    duelist.guard = zone as 'high' | 'mid' | 'low';
    this.emitEvent('guard', playerId, { zone });
    return { success: true, newState: this.getState() };
  }

  private handleNextRound(data: WeaponsDuelState): ActionResult {
    if (!data.roundOver || data.matchOver) {
      return { success: false, error: 'Cannot start next round' };
    }

    data.currentRound++;
    data.roundOver = false;
    data.currentTurnIndex = 0;

    const ids = Object.keys(data.duelists);
    for (let i = 0; i < ids.length; i++) {
      const d = data.duelists[ids[i]];
      d.hp = d.maxHp;
      d.stamina = d.maxStamina;
      d.wounds = [];
      d.guard = 'none';
      d.feintZone = null;
      d.position = i === 0 ? 1 : data.distanceSteps - 1;
      data.lastAttackZone[ids[i]] = null;
    }

    this.emitEvent('round_started', undefined, { round: data.currentRound });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private tryInflictWound(attacker: Duelist, defender: Duelist, data: WeaponsDuelState): void {
    const chance = data.woundSeverity * 10; // 10-30% based on severity config
    if (Math.random() * 100 < chance) {
      const wound: Wound = {
        severity: data.woundSeverity,
        bleedPerTurn: data.woundSeverity,
      };
      defender.wounds.push(wound);
      attacker.woundsInflicted++;
      this.emitEvent('wound_inflicted', attacker.id, {
        severity: wound.severity,
        bleed: wound.bleedPerTurn,
      });
    }
  }

  private getOpponentId(playerId: string, data: WeaponsDuelState): string | null {
    const ids = Object.keys(data.duelists);
    return ids.find((id) => id !== playerId) ?? null;
  }

  private resolveRoundEnd(loserId: string, data: WeaponsDuelState, winnerId?: string): void {
    const actualWinner = winnerId ?? this.getOpponentId(loserId, data);
    if (!actualWinner) return;

    const winner = data.duelists[actualWinner];
    if (winner) {
      winner.roundWins++;
    }
    data.roundOver = true;

    if (winner && winner.roundWins >= data.roundsToWin) {
      data.matchOver = true;
      this.emitEvent('match_won', actualWinner, { rounds: winner.roundWins });
    } else {
      this.emitEvent('round_won', actualWinner, { round: data.currentRound });
    }
  }

  private runCpuTurn(data: WeaponsDuelState): void {
    const cpu = data.duelists['cpu'];
    if (!cpu || data.roundOver) return;

    // Apply bleed
    this.applyBleed(cpu, data);
    if (cpu.hp <= 0) {
      this.resolveRoundEnd('cpu', data);
      return;
    }

    // Stamina regen
    cpu.stamina = Math.min(cpu.maxStamina, cpu.stamina + data.staminaRegenRate);

    const player = this.getOpponent('cpu', data);
    if (!player) return;

    const cfg = this.config as WeaponsDuelConfig;
    const weapons = this.getWeapons();
    const staminaCosts = this.getStaminaCosts();
    const distance = this.getDistance(cpu, player);
    const weapon = weapons[cpu.weapon] ?? weapons['sword'];

    // Simple AI
    if (cpu.stamina < 8) {
      // Low stamina: guard or retreat
      cpu.guard = 'mid';
      return;
    }

    if (distance > weapon.reach) {
      // Advance
      const dir = cpu.position < player.position ? 1 : -1;
      const newPos = cpu.position + dir;
      if (newPos !== player.position && newPos >= 0 && newPos < data.distanceSteps) {
        cpu.position = newPos;
      }
      cpu.stamina = Math.max(0, cpu.stamina - (staminaCosts['advance'] ?? 0));
    } else {
      const roll = Math.random();
      const zones: Array<'high' | 'mid' | 'low'> = ['high', 'mid', 'low'];
      const zone = zones[Math.floor(Math.random() * zones.length)];
      const guardReduction = (cfg.gameplay?.guardReduction as number) ?? DEFAULT_GUARD_REDUCTION;

      if (roll < 0.4) {
        // Slash
        let damage = Math.floor(weapon.damage * 1.0);
        if (player.guard === zone) damage = Math.floor(damage * guardReduction);
        player.hp = Math.max(0, player.hp - damage);
        cpu.stamina = Math.max(0, cpu.stamina - (staminaCosts['slash'] ?? 0));
        data.lastAttackZone['cpu'] = zone;
        this.tryInflictWound(cpu, player, data);
      } else if (roll < 0.7) {
        // Thrust
        const thrustMult = (cfg.gameplay?.thrustMultiplier as number) ?? DEFAULT_THRUST_MULTIPLIER;
        let damage = Math.floor(weapon.damage * thrustMult);
        if (player.guard === zone) damage = Math.floor(damage * guardReduction);
        player.hp = Math.max(0, player.hp - damage);
        cpu.stamina = Math.max(0, cpu.stamina - (staminaCosts['thrust'] ?? 0));
        data.lastAttackZone['cpu'] = zone;
      } else {
        // Guard
        cpu.guard = zone;
      }

      if (player.hp <= 0) {
        this.resolveRoundEnd(player.id, data, 'cpu');
      }
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<WeaponsDuelState>();
    return data.matchOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<WeaponsDuelState>();
    let bestPlayer: string | null = null;
    let bestWins = -1;
    for (const duelist of Object.values(data.duelists)) {
      if (duelist.roundWins > bestWins) {
        bestWins = duelist.roundWins;
        bestPlayer = duelist.id;
      }
    }
    return bestPlayer;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<WeaponsDuelState>();
    const scores: Record<string, number> = {};
    for (const duelist of Object.values(data.duelists)) {
      scores[duelist.id] =
        duelist.roundWins * 100 + duelist.woundsInflicted * 25 + duelist.parriesLanded * 10;
    }
    return scores;
  }
}
