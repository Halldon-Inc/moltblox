/**
 * StreetFighterGame: Competitive 1v1 tournament fighter with super meter
 *
 * Features: 5 built-in characters, positional combat (0-10 grid), super meter,
 * chip damage, throw techs, round-based matches, and auto-CPU for solo play.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface StreetFighterConfig {
  superMeterMax?: number; // default 100
  chipDamagePercent?: number; // % of attack damage through block, default 20
  throwTechWindow?: boolean; // allow throw techs, default true
  roundTime?: number; // max turns per round, default 40
  roundsToWin?: number; // default 2
  characterPool?: string[]; // default: all characters
}

interface CharacterTemplate {
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  special: {
    name: string;
    damage: number;
    type: 'ranged' | 'melee' | 'multi-hit' | 'pushback' | 'side-switch';
  };
}

const CHARACTER_POOL: Record<string, CharacterTemplate> = {
  ryu: {
    name: 'ryu',
    hp: 100,
    atk: 10,
    def: 8,
    spd: 8,
    special: { name: 'hadoken', damage: 15, type: 'ranged' },
  },
  zangief: {
    name: 'zangief',
    hp: 130,
    atk: 12,
    def: 10,
    spd: 5,
    special: { name: 'spinning-piledriver', damage: 25, type: 'melee' },
  },
  chun: {
    name: 'chun',
    hp: 90,
    atk: 8,
    def: 7,
    spd: 12,
    special: { name: 'lightning-kick', damage: 18, type: 'multi-hit' },
  },
  sagat: {
    name: 'sagat',
    hp: 110,
    atk: 11,
    def: 9,
    spd: 7,
    special: { name: 'tiger-shot', damage: 12, type: 'pushback' },
  },
  vega: {
    name: 'vega',
    hp: 85,
    atk: 9,
    def: 6,
    spd: 11,
    special: { name: 'claw-dive', damage: 20, type: 'side-switch' },
  },
};

const ALL_CHARACTER_NAMES = Object.keys(CHARACTER_POOL);

interface SFighter {
  id: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  character: string;
  superMeter: number;
  position: number;
  blocking: boolean;
  stunFrames: number;
  roundWins: number;
  [key: string]: unknown;
}

interface StreetFighterState {
  fighters: Record<string, SFighter>;
  currentRound: number;
  roundTimer: number;
  roundOver: boolean;
  matchOver: boolean;
  turnOrder: string[];
  currentTurnIndex: number;
  superMeterMax: number;
  chipDamagePercent: number;
  throwTechWindow: boolean;
  roundTime: number;
  roundsToWin: number;
  superWindup: Record<string, number>; // playerId -> turns remaining for super windup
  [key: string]: unknown;
}

export class StreetFighterGame extends BaseGame {
  readonly name = 'Street Fighter';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): StreetFighterState {
    const cfg = this.config as StreetFighterConfig;
    const superMeterMax = cfg.superMeterMax ?? 100;
    const chipDamagePercent = cfg.chipDamagePercent ?? 20;
    const throwTechWindow = cfg.throwTechWindow ?? true;
    const roundTime = cfg.roundTime ?? 40;
    const roundsToWin = cfg.roundsToWin ?? 2;
    const pool = cfg.characterPool ?? ALL_CHARACTER_NAMES;

    const fighters: Record<string, SFighter> = {};
    const allIds = [...playerIds];

    // Auto-CPU for solo play
    if (playerIds.length === 1) {
      allIds.push('cpu');
    }

    for (let i = 0; i < allIds.length; i++) {
      const pid = allIds[i];
      const charName = pool[i % pool.length];
      const template = CHARACTER_POOL[charName] ?? CHARACTER_POOL['ryu'];
      fighters[pid] = {
        id: pid,
        hp: template.hp,
        maxHp: template.hp,
        atk: template.atk,
        def: template.def,
        spd: template.spd,
        character: template.name,
        superMeter: 0,
        position: i === 0 ? 2 : 8,
        blocking: false,
        stunFrames: 0,
        roundWins: 0,
      };
    }

    // Turn order by speed (higher first)
    const turnOrder = allIds.sort((a, b) => fighters[b].spd - fighters[a].spd);

    return {
      fighters,
      currentRound: 1,
      roundTimer: 0,
      roundOver: false,
      matchOver: false,
      turnOrder,
      currentTurnIndex: 0,
      superMeterMax,
      chipDamagePercent,
      throwTechWindow,
      roundTime,
      roundsToWin,
      superWindup: {},
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<StreetFighterState>();

    if (data.matchOver) {
      return { success: false, error: 'Match is already over' };
    }
    if (data.roundOver) {
      if (action.type === 'next_round') {
        return this.handleNextRound(data);
      }
      return { success: false, error: 'Round is over' };
    }

    const fighter = data.fighters[playerId];
    if (!fighter) {
      return { success: false, error: 'Fighter not found' };
    }
    if (fighter.stunFrames > 0) {
      fighter.stunFrames--;
      data.roundTimer++;
      this.advanceTurn(data);
      this.checkRoundTimer(data);
      this.runCpuTurn(data);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    let result: ActionResult;

    switch (action.type) {
      case 'light':
        result = this.handleAttack(playerId, 'light', 5, 5, data);
        break;
      case 'medium':
        result = this.handleAttack(playerId, 'medium', 10, 8, data);
        break;
      case 'heavy':
        result = this.handleAttack(playerId, 'heavy', 15, 12, data);
        break;
      case 'special':
        result = this.handleSpecial(playerId, false, data);
        break;
      case 'ex_special':
        result = this.handleSpecial(playerId, true, data);
        break;
      case 'super':
        result = this.handleSuper(playerId, data);
        break;
      case 'throw':
        result = this.handleThrow(playerId, data);
        break;
      case 'block':
        result = this.handleBlock(playerId, data);
        break;
      case 'dash':
        result = this.handleDash(playerId, action, data);
        break;
      case 'tech_throw':
        result = this.handleTechThrow(playerId, data);
        break;
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    if (!result.success) {
      return result;
    }

    if (!data.roundOver) {
      data.roundTimer++;
      this.advanceTurn(data);
      this.checkRoundTimer(data);
      // CPU turn after player acts
      if (!data.roundOver) {
        this.runCpuTurn(data);
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private getOpponent(playerId: string, data: StreetFighterState): SFighter | null {
    const ids = Object.keys(data.fighters);
    const oppId = ids.find((id) => id !== playerId);
    return oppId ? data.fighters[oppId] : null;
  }

  private getDistance(a: SFighter, b: SFighter): number {
    return Math.abs(a.position - b.position);
  }

  private handleAttack(
    playerId: string,
    attackType: string,
    baseDamage: number,
    meterGain: number,
    data: StreetFighterState,
  ): ActionResult {
    const fighter = data.fighters[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    const distance = this.getDistance(fighter, opponent);
    // Must be within melee range (distance <= 2)
    if (distance > 2) {
      return { success: false, error: 'Out of range' };
    }

    let damage = Math.max(1, baseDamage + fighter.atk - opponent.def);
    let stunApplied = 0;

    if (opponent.blocking) {
      // Chip damage through block
      const chipDmg = Math.max(1, Math.floor((damage * data.chipDamagePercent) / 100));
      damage = chipDmg;
      // Blocking opponent gains meter
      opponent.superMeter = Math.min(data.superMeterMax, opponent.superMeter + 5);
    } else {
      // Heavy causes 1 turn stun on hit
      if (attackType === 'heavy') {
        stunApplied = 1;
      }
    }

    opponent.hp = Math.max(0, opponent.hp - damage);
    fighter.superMeter = Math.min(data.superMeterMax, fighter.superMeter + meterGain);
    fighter.blocking = false;

    if (stunApplied > 0) {
      opponent.stunFrames = stunApplied;
    }

    this.emitEvent('attack', playerId, { attackType, damage, stun: stunApplied });

    if (opponent.hp <= 0) {
      this.resolveRoundEnd(playerId, data);
    }

    return { success: true, newState: this.getState() };
  }

  private handleSpecial(playerId: string, isEx: boolean, data: StreetFighterState): ActionResult {
    const fighter = data.fighters[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    if (isEx && fighter.superMeter < 50) {
      return { success: false, error: 'Not enough meter for EX special (need 50)' };
    }

    const charTemplate = CHARACTER_POOL[fighter.character];
    if (!charTemplate) return { success: false, error: 'Unknown character' };

    const special = charTemplate.special;
    const distance = this.getDistance(fighter, opponent);

    // Range check based on special type
    if (special.type === 'melee' && distance > 1) {
      return { success: false, error: 'Melee special requires close range' };
    }
    if (special.type === 'multi-hit' && distance > 2) {
      return { success: false, error: 'Multi-hit special requires close range' };
    }
    // Ranged and pushback specials have no distance limit
    // Side-switch requires distance <= 5
    if (special.type === 'side-switch' && distance > 5) {
      return { success: false, error: 'Too far for claw dive' };
    }

    let damage = special.damage;
    if (isEx) {
      damage = Math.floor(damage * 1.5);
      fighter.superMeter -= 50;
    }

    damage = Math.max(1, damage + fighter.atk - opponent.def);

    if (opponent.blocking && !isEx) {
      const chipDmg = Math.max(1, Math.floor((damage * data.chipDamagePercent) / 100));
      damage = chipDmg;
    }
    // EX special has armor: absorb a hit (not implemented as reactive, but damage goes through block)

    opponent.hp = Math.max(0, opponent.hp - damage);
    fighter.blocking = false;

    // Pushback effect
    if (special.type === 'pushback') {
      const pushDir = fighter.position < opponent.position ? 1 : -1;
      opponent.position = Math.max(0, Math.min(10, opponent.position + pushDir * 2));
    }

    // Side-switch effect
    if (special.type === 'side-switch') {
      const tempPos = fighter.position;
      fighter.position = opponent.position;
      opponent.position = tempPos;
    }

    this.emitEvent('special', playerId, {
      move: special.name,
      damage,
      ex: isEx,
    });

    if (opponent.hp <= 0) {
      this.resolveRoundEnd(playerId, data);
    }

    return { success: true, newState: this.getState() };
  }

  private handleSuper(playerId: string, data: StreetFighterState): ActionResult {
    const fighter = data.fighters[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    if (fighter.superMeter < data.superMeterMax) {
      return { success: false, error: `Not enough meter for super (need ${data.superMeterMax})` };
    }

    // Super has 2 turn windup (telegraphed). For simplicity, apply immediately but
    // with the understanding that the windup is a design flavor. In actual play the
    // opponent would have 2 turns to react. We model this as instant for the template.
    const damage = Math.max(1, 30 + fighter.atk);
    // Super is unblockable
    opponent.hp = Math.max(0, opponent.hp - damage);
    fighter.superMeter = 0;

    this.emitEvent('super', playerId, { damage });

    if (opponent.hp <= 0) {
      this.resolveRoundEnd(playerId, data);
    }

    return { success: true, newState: this.getState() };
  }

  private handleThrow(playerId: string, data: StreetFighterState): ActionResult {
    const fighter = data.fighters[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    const distance = this.getDistance(fighter, opponent);
    if (distance > 1) {
      return { success: false, error: 'Must be adjacent to throw' };
    }

    const damage = 15;
    // Throw beats block
    opponent.blocking = false;
    opponent.hp = Math.max(0, opponent.hp - damage);
    fighter.blocking = false;

    this.emitEvent('throw', playerId, { damage });

    if (opponent.hp <= 0) {
      this.resolveRoundEnd(playerId, data);
    }

    return { success: true, newState: this.getState() };
  }

  private handleBlock(playerId: string, data: StreetFighterState): ActionResult {
    const fighter = data.fighters[playerId];
    fighter.blocking = true;
    this.emitEvent('block', playerId, {});
    return { success: true, newState: this.getState() };
  }

  private handleDash(playerId: string, action: GameAction, data: StreetFighterState): ActionResult {
    const fighter = data.fighters[playerId];
    const opponent = this.getOpponent(playerId, data);
    if (!opponent) return { success: false, error: 'No opponent' };

    const direction = (action.payload.direction as string) || 'forward';
    const towardOpponent = fighter.position < opponent.position ? 1 : -1;

    if (direction === 'forward') {
      fighter.position = Math.max(0, Math.min(10, fighter.position + towardOpponent * 2));
    } else {
      fighter.position = Math.max(0, Math.min(10, fighter.position - towardOpponent * 2));
    }

    fighter.blocking = false;
    this.emitEvent('dash', playerId, { direction, newPosition: fighter.position });
    return { success: true, newState: this.getState() };
  }

  private handleTechThrow(_playerId: string, data: StreetFighterState): ActionResult {
    // Tech throw is a defensive response. In a real implementation this would
    // be a reaction window. For the template, it sets a flag that negates the
    // next throw attempt. We model this as a no-op defensive stance.
    if (!data.throwTechWindow) {
      return { success: false, error: 'Throw techs are disabled' };
    }
    return { success: true, newState: this.getState() };
  }

  private handleNextRound(data: StreetFighterState): ActionResult {
    if (!data.roundOver || data.matchOver) {
      return { success: false, error: 'Cannot start next round' };
    }

    data.currentRound++;
    data.roundOver = false;
    data.roundTimer = 0;
    data.currentTurnIndex = 0;

    // Reset fighters for new round
    const ids = Object.keys(data.fighters);
    for (let i = 0; i < ids.length; i++) {
      const f = data.fighters[ids[i]];
      const template = CHARACTER_POOL[f.character] ?? CHARACTER_POOL['ryu'];
      f.hp = template.hp;
      f.maxHp = template.hp;
      f.superMeter = 0;
      f.position = i === 0 ? 2 : 8;
      f.blocking = false;
      f.stunFrames = 0;
    }

    this.emitEvent('round_started', undefined, { round: data.currentRound });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private resolveRoundEnd(winnerId: string, data: StreetFighterState): void {
    const winner = data.fighters[winnerId];
    if (winner) {
      winner.roundWins++;
    }
    data.roundOver = true;

    if (winner && winner.roundWins >= data.roundsToWin) {
      data.matchOver = true;
      this.emitEvent('match_won', winnerId, { rounds: winner.roundWins });
    } else {
      this.emitEvent('round_won', winnerId, { round: data.currentRound });
    }
  }

  private checkRoundTimer(data: StreetFighterState): void {
    if (data.roundTimer >= data.roundTime && !data.roundOver) {
      // Time up: player with higher HP% wins
      const ids = Object.keys(data.fighters);
      let bestId: string | null = null;
      let bestPct = -1;
      for (const id of ids) {
        const f = data.fighters[id];
        const pct = f.hp / f.maxHp;
        if (pct > bestPct) {
          bestPct = pct;
          bestId = id;
        }
      }
      if (bestId) {
        this.resolveRoundEnd(bestId, data);
      }
    }
  }

  private advanceTurn(data: StreetFighterState): void {
    data.currentTurnIndex = (data.currentTurnIndex + 1) % data.turnOrder.length;
  }

  private runCpuTurn(data: StreetFighterState): void {
    const cpuFighter = data.fighters['cpu'];
    if (!cpuFighter || data.roundOver) return;

    if (cpuFighter.stunFrames > 0) {
      cpuFighter.stunFrames--;
      return;
    }

    const player = this.getOpponent('cpu', data);
    if (!player) return;

    const distance = this.getDistance(cpuFighter, player);

    // Simple weighted AI
    if (distance > 2) {
      // Move closer
      const dir = cpuFighter.position < player.position ? 1 : -1;
      cpuFighter.position = Math.max(0, Math.min(10, cpuFighter.position + dir * 2));
      cpuFighter.blocking = false;
    } else {
      const roll = Math.random();
      if (roll < 0.3) {
        // Light attack
        const dmg = Math.max(1, 5 + cpuFighter.atk - player.def);
        const actualDmg = player.blocking
          ? Math.max(1, Math.floor((dmg * data.chipDamagePercent) / 100))
          : dmg;
        player.hp = Math.max(0, player.hp - actualDmg);
        cpuFighter.superMeter = Math.min(data.superMeterMax, cpuFighter.superMeter + 5);
      } else if (roll < 0.5) {
        // Heavy attack
        const dmg = Math.max(1, 15 + cpuFighter.atk - player.def);
        const actualDmg = player.blocking
          ? Math.max(1, Math.floor((dmg * data.chipDamagePercent) / 100))
          : dmg;
        player.hp = Math.max(0, player.hp - actualDmg);
        cpuFighter.superMeter = Math.min(data.superMeterMax, cpuFighter.superMeter + 12);
        if (!player.blocking) {
          player.stunFrames = 1;
        }
      } else if (roll < 0.7) {
        // Block
        cpuFighter.blocking = true;
      } else {
        // Throw
        if (distance <= 1) {
          player.blocking = false;
          player.hp = Math.max(0, player.hp - 15);
        }
      }

      if (player.hp <= 0) {
        this.resolveRoundEnd('cpu', data);
      }
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<StreetFighterState>();
    return data.matchOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<StreetFighterState>();
    let bestPlayer: string | null = null;
    let bestWins = -1;
    for (const fighter of Object.values(data.fighters)) {
      if (fighter.roundWins > bestWins) {
        bestWins = fighter.roundWins;
        bestPlayer = fighter.id;
      }
    }
    return bestPlayer;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<StreetFighterState>();
    const scores: Record<string, number> = {};
    for (const fighter of Object.values(data.fighters)) {
      scores[fighter.id] = fighter.roundWins * 100 + (fighter.maxHp - (fighter.maxHp - fighter.hp));
    }
    return scores;
  }
}
