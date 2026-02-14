/**
 * TagTeamGame: 2v2 tag team fighting with partner mechanics
 *
 * Two teams of 2 fighters each. Only active fighters can act.
 * Tagged-out partners regenerate HP. Sync meter builds from attacks,
 * enabling devastating sync specials when full.
 *
 * Actions: attack, tag_in, call_assist, block, sync_special
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface TagTeamConfig {
  tagCooldown?: number;
  recoveryRate?: number;
  assistDamage?: number;
  syncMeterRate?: number;
}

interface TTFighter {
  id: string;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  tagged: boolean; // true = active
  [key: string]: unknown;
}

interface Team {
  fighters: TTFighter[];
  activeIndex: number;
  syncMeter: number;
  tagCooldown: number;
  [key: string]: unknown;
}

interface TagTeamState {
  teams: Record<string, Team>;
  teamOrder: string[];
  turnOrder: string[];
  currentTurnIndex: number;
  tagCooldownMax: number;
  recoveryRate: number;
  assistDamage: number;
  syncMeterRate: number;
  matchOver: boolean;
  totalScore: Record<string, number>;
  blockActive: Record<string, boolean>;
  [key: string]: unknown;
}

export class TagTeamGame extends BaseGame {
  readonly name = 'Tag Team';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): TagTeamState {
    const cfg = this.config as TagTeamConfig;
    const tagCooldownMax = cfg.tagCooldown ?? 3;
    const recoveryRate = cfg.recoveryRate ?? 3;
    const assistDamage = cfg.assistDamage ?? 10;
    const syncMeterRate = cfg.syncMeterRate ?? 5;

    const ids = playerIds.length === 1 ? [...playerIds, 'cpu'] : playerIds;
    const teams: Record<string, Team> = {};
    const totalScore: Record<string, number> = {};

    for (const pid of ids) {
      teams[pid] = {
        fighters: [
          {
            id: `${pid}-A`,
            hp: 100,
            maxHp: 100,
            stamina: 100,
            maxStamina: 100,
            tagged: true,
          },
          {
            id: `${pid}-B`,
            hp: 100,
            maxHp: 100,
            stamina: 100,
            maxStamina: 100,
            tagged: false,
          },
        ],
        activeIndex: 0,
        syncMeter: 0,
        tagCooldown: 0,
      };
      totalScore[pid] = 0;
    }

    return {
      teams,
      teamOrder: ids,
      turnOrder: ids,
      currentTurnIndex: 0,
      tagCooldownMax,
      recoveryRate,
      assistDamage,
      syncMeterRate,
      matchOver: false,
      totalScore,
      blockActive: {},
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TagTeamState>();

    if (data.matchOver) {
      return { success: false, error: 'Match is already over' };
    }

    const team = data.teams[playerId];
    if (!team) {
      return { success: false, error: 'Player not in match' };
    }

    let result: ActionResult;

    switch (action.type) {
      case 'attack':
        result = this.handleAttack(playerId, action, data);
        break;
      case 'tag_in':
        result = this.handleTagIn(playerId, data);
        break;
      case 'call_assist':
        result = this.handleAssist(playerId, data);
        break;
      case 'block':
        result = this.handleBlock(playerId, data);
        break;
      case 'sync_special':
        result = this.handleSyncSpecial(playerId, data);
        break;
      default:
        result = { success: false, error: `Unknown action: ${action.type}` };
    }

    return result;
  }

  private getActiveFighter(team: Team): TTFighter {
    return team.fighters[team.activeIndex];
  }

  private getBenchedFighter(team: Team): TTFighter {
    return team.fighters[team.activeIndex === 0 ? 1 : 0];
  }

  private getOpponentId(playerId: string, data: TagTeamState): string {
    return data.teamOrder.find((id) => id !== playerId) ?? data.teamOrder[1];
  }

  private isTeamDefeated(team: Team): boolean {
    return team.fighters.every((f) => f.hp <= 0);
  }

  private applyRecovery(data: TagTeamState): void {
    for (const team of Object.values(data.teams)) {
      const benched = this.getBenchedFighter(team);
      if (benched.hp > 0) {
        benched.hp = Math.min(benched.maxHp, benched.hp + data.recoveryRate);
      }
    }
  }

  private checkMatchEnd(data: TagTeamState): void {
    for (const [pid, team] of Object.entries(data.teams)) {
      if (this.isTeamDefeated(team)) {
        data.matchOver = true;
        const winnerId = this.getOpponentId(pid, data);
        data.totalScore[winnerId] = (data.totalScore[winnerId] ?? 0) + 200;
        this.emitEvent('match_won', winnerId, {});
        return;
      }
    }
  }

  private finalizeTurn(data: TagTeamState): void {
    // Decrease tag cooldowns
    for (const team of Object.values(data.teams)) {
      if (team.tagCooldown > 0) {
        team.tagCooldown--;
      }
    }
    this.applyRecovery(data);
    this.checkMatchEnd(data);
    this.setData(data);
  }

  private handleAttack(playerId: string, action: GameAction, data: TagTeamState): ActionResult {
    const team = data.teams[playerId];
    const active = this.getActiveFighter(team);
    if (active.hp <= 0) {
      return { success: false, error: 'Active fighter is down' };
    }

    const oppId = this.getOpponentId(playerId, data);
    const oppTeam = data.teams[oppId];
    const target = this.getActiveFighter(oppTeam);

    const attackType = (action.payload?.type as string) ?? 'light';
    let damage: number;
    let staminaCost = 0;

    if (attackType === 'heavy') {
      damage = 16;
      staminaCost = 15;
    } else {
      damage = 8;
    }

    if (staminaCost > 0 && active.stamina < staminaCost) {
      return { success: false, error: 'Not enough stamina' };
    }
    active.stamina -= staminaCost;

    // Check block
    if (data.blockActive[oppId]) {
      damage = Math.floor(damage * 0.3);
      data.blockActive[oppId] = false;
      this.emitEvent('blocked', oppId, { reduced: true });
    }

    target.hp -= damage;
    if (target.hp <= 0) {
      target.hp = 0;
      // Auto-switch to bench if available
      const bench = this.getBenchedFighter(oppTeam);
      if (bench.hp > 0) {
        oppTeam.activeIndex = oppTeam.activeIndex === 0 ? 1 : 0;
        bench.tagged = true;
        this.emitEvent('forced_tag', oppId, { fighter: bench.id });
      }
    }

    data.totalScore[playerId] = (data.totalScore[playerId] ?? 0) + damage;
    team.syncMeter = Math.min(100, team.syncMeter + data.syncMeterRate);

    // Stamina regen
    active.stamina = Math.min(active.maxStamina, active.stamina + 3);

    this.emitEvent('attack', playerId, { attackType, damage, target: target.id });
    this.finalizeTurn(data);
    return { success: true, newState: this.getState() };
  }

  private handleTagIn(playerId: string, data: TagTeamState): ActionResult {
    const team = data.teams[playerId];

    if (team.tagCooldown > 0) {
      return { success: false, error: 'Tag on cooldown' };
    }

    const bench = this.getBenchedFighter(team);
    if (bench.hp <= 0) {
      return { success: false, error: 'Partner is down' };
    }

    const current = this.getActiveFighter(team);
    current.tagged = false;
    bench.tagged = true;
    team.activeIndex = team.activeIndex === 0 ? 1 : 0;
    team.tagCooldown = data.tagCooldownMax;

    this.emitEvent('tag_in', playerId, { fighter: bench.id });
    this.finalizeTurn(data);
    return { success: true, newState: this.getState() };
  }

  private handleAssist(playerId: string, data: TagTeamState): ActionResult {
    const team = data.teams[playerId];
    const bench = this.getBenchedFighter(team);

    if (bench.hp <= 0) {
      return { success: false, error: 'Partner is down' };
    }

    const oppId = this.getOpponentId(playerId, data);
    const oppTeam = data.teams[oppId];
    const target = this.getActiveFighter(oppTeam);

    let damage = data.assistDamage;

    if (data.blockActive[oppId]) {
      damage = Math.floor(damage * 0.3);
      data.blockActive[oppId] = false;
    }

    target.hp -= damage;
    if (target.hp <= 0) {
      target.hp = 0;
      const oppBench = this.getBenchedFighter(oppTeam);
      if (oppBench.hp > 0) {
        oppTeam.activeIndex = oppTeam.activeIndex === 0 ? 1 : 0;
        oppBench.tagged = true;
        this.emitEvent('forced_tag', oppId, { fighter: oppBench.id });
      }
    }

    // Assist adds 1 turn to tag cooldown
    team.tagCooldown = Math.max(team.tagCooldown, 1);

    data.totalScore[playerId] = (data.totalScore[playerId] ?? 0) + damage;

    this.emitEvent('assist', playerId, { damage, target: target.id });
    this.finalizeTurn(data);
    return { success: true, newState: this.getState() };
  }

  private handleBlock(playerId: string, data: TagTeamState): ActionResult {
    const team = data.teams[playerId];
    const active = this.getActiveFighter(team);
    if (active.hp <= 0) {
      return { success: false, error: 'Active fighter is down' };
    }

    data.blockActive[playerId] = true;
    this.emitEvent('block', playerId, {});
    this.finalizeTurn(data);
    return { success: true, newState: this.getState() };
  }

  private handleSyncSpecial(playerId: string, data: TagTeamState): ActionResult {
    const team = data.teams[playerId];

    if (team.syncMeter < 100) {
      return { success: false, error: 'Sync meter not full' };
    }

    const oppId = this.getOpponentId(playerId, data);
    const oppTeam = data.teams[oppId];
    const target = this.getActiveFighter(oppTeam);

    // Both fighters attack: 25 each, 50 total
    let damage = 50;

    if (data.blockActive[oppId]) {
      damage = Math.floor(damage * 0.3);
      data.blockActive[oppId] = false;
    }

    target.hp -= damage;
    if (target.hp <= 0) {
      target.hp = 0;
      const oppBench = this.getBenchedFighter(oppTeam);
      if (oppBench.hp > 0) {
        oppTeam.activeIndex = oppTeam.activeIndex === 0 ? 1 : 0;
        oppBench.tagged = true;
      }
    }

    team.syncMeter = 0;
    data.totalScore[playerId] = (data.totalScore[playerId] ?? 0) + damage;

    this.emitEvent('sync_special', playerId, { damage });
    this.finalizeTurn(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<TagTeamState>();
    return data.matchOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<TagTeamState>();
    for (const [pid, team] of Object.entries(data.teams)) {
      if (this.isTeamDefeated(team)) {
        return this.getOpponentId(pid, data);
      }
    }
    // If not over, highest score
    let best: string | null = null;
    let bestScore = -1;
    for (const [pid, score] of Object.entries(data.totalScore)) {
      if (score > bestScore) {
        bestScore = score;
        best = pid;
      }
    }
    return best;
  }

  private getOpponentId_local(pid: string, data: TagTeamState): string {
    return data.teamOrder.find((id) => id !== pid) ?? data.teamOrder[1];
  }

  private isTeamDefeated_local(team: Team): boolean {
    return team.fighters.every((f) => f.hp <= 0);
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<TagTeamState>();
    return { ...data.totalScore };
  }
}
