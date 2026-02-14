import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type WerewolfRole = 'werewolf' | 'villager' | 'seer' | 'doctor';

interface WerewolfPlayerState {
  role: WerewolfRole;
  alive: boolean;
  protected: boolean;
}

interface WerewolfState {
  [key: string]: unknown;
  players: Record<string, WerewolfPlayerState>;
  phase: string; // 'night_wolf' | 'night_seer' | 'night_doctor' | 'day_discussion' | 'day_vote'
  dayNumber: number;
  wolfTarget: string | null;
  seerTarget: string | null;
  doctorTarget: string | null;
  votes: Record<string, string>;
  winner: string | null;
  gameEnded: boolean;
  nightActions: Record<string, boolean>;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class WerewolfGame extends BaseGame {
  readonly name = 'Werewolf';
  readonly version = '1.0.0';
  readonly maxPlayers = 10;

  protected initializeState(playerIds: string[]): WerewolfState {
    const n = playerIds.length;
    const wolfCount = Math.max(1, Math.floor(n / 3));
    const roles: WerewolfRole[] = [];
    for (let i = 0; i < wolfCount; i++) roles.push('werewolf');
    roles.push('seer');
    if (n > 4) roles.push('doctor');
    while (roles.length < n) roles.push('villager');

    const shuffled = shuffle(roles);
    const players: Record<string, WerewolfPlayerState> = {};
    for (let i = 0; i < playerIds.length; i++) {
      players[playerIds[i]] = { role: shuffled[i], alive: true, protected: false };
    }

    return {
      players,
      phase: 'night_wolf',
      dayNumber: 1,
      wolfTarget: null,
      seerTarget: null,
      doctorTarget: null,
      votes: {},
      winner: null,
      gameEnded: false,
      nightActions: {},
    };
  }

  private getAlive(data: WerewolfState): string[] {
    return this.getPlayers().filter((p) => data.players[p].alive);
  }

  private getAliveByRole(data: WerewolfState, role: WerewolfRole): string[] {
    return this.getAlive(data).filter((p) => data.players[p].role === role);
  }

  private checkWinCondition(data: WerewolfState): void {
    const alive = this.getAlive(data);
    const wolves = alive.filter((p) => data.players[p].role === 'werewolf');
    const villagers = alive.filter((p) => data.players[p].role !== 'werewolf');

    if (wolves.length === 0) {
      data.gameEnded = true;
      data.winner = 'villagers';
    } else if (wolves.length >= villagers.length) {
      data.gameEnded = true;
      data.winner = 'werewolves';
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<WerewolfState>();
    const ps = data.players[playerId];

    if (!ps || !ps.alive) return { success: false, error: 'Player not alive' };

    if (data.phase === 'night_wolf') {
      if (ps.role !== 'werewolf') return { success: false, error: 'Only werewolves act now' };
      if (action.type !== 'kill') return { success: false, error: 'Must choose a kill target' };

      const target = action.payload.target as string;
      if (!data.players[target]?.alive || data.players[target].role === 'werewolf') {
        return { success: false, error: 'Invalid target' };
      }

      data.wolfTarget = target;
      data.nightActions[playerId] = true;

      // If all wolves acted, advance
      const wolves = this.getAliveByRole(data, 'werewolf');
      if (wolves.every((w) => data.nightActions[w])) {
        const seerAlive = this.getAliveByRole(data, 'seer').length > 0;
        data.phase = seerAlive ? 'night_seer' : 'night_doctor';
        const doctorAlive = this.getAliveByRole(data, 'doctor').length > 0;
        if (!seerAlive && !doctorAlive) this.resolveNight(data);
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'night_seer') {
      if (ps.role !== 'seer') return { success: false, error: 'Only the seer acts now' };
      if (action.type !== 'investigate') return { success: false, error: 'Must investigate' };

      const target = action.payload.target as string;
      if (!data.players[target]?.alive) return { success: false, error: 'Invalid target' };

      data.seerTarget = target;
      const isWolf = data.players[target].role === 'werewolf';
      this.emitEvent('seer_result', playerId, { target, isWerewolf: isWolf });

      const doctorAlive = this.getAliveByRole(data, 'doctor').length > 0;
      data.phase = doctorAlive ? 'night_doctor' : 'day_discussion';
      if (!doctorAlive) this.resolveNight(data);

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'night_doctor') {
      if (ps.role !== 'doctor') return { success: false, error: 'Only the doctor acts now' };
      if (action.type !== 'protect') return { success: false, error: 'Must protect someone' };

      const target = action.payload.target as string;
      if (!data.players[target]?.alive) return { success: false, error: 'Invalid target' };

      data.doctorTarget = target;
      this.resolveNight(data);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'day_discussion') {
      // Move to voting
      if (action.type === 'start_vote') {
        data.phase = 'day_vote';
        data.votes = {};
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      return { success: false, error: 'Discussion phase: start_vote to begin voting' };
    }

    if (data.phase === 'day_vote') {
      if (action.type !== 'vote') return { success: false, error: 'Must vote' };

      const target = action.payload.target as string;
      if (target !== 'skip' && !data.players[target]?.alive) {
        return { success: false, error: 'Invalid vote target' };
      }

      data.votes[playerId] = target;

      const alive = this.getAlive(data);
      if (Object.keys(data.votes).length >= alive.length) {
        // Tally votes
        const tally: Record<string, number> = {};
        for (const t of Object.values(data.votes)) {
          tally[t] = (tally[t] || 0) + 1;
        }

        let maxVotes = 0;
        let eliminated: string | null = null;
        for (const [target, count] of Object.entries(tally)) {
          if (target !== 'skip' && count > maxVotes) {
            maxVotes = count;
            eliminated = target;
          }
        }

        // Need majority
        if (eliminated && maxVotes > alive.length / 2) {
          data.players[eliminated].alive = false;
          this.emitEvent('eliminated', eliminated, { by: 'vote', day: data.dayNumber });
        }

        this.checkWinCondition(data);
        if (!data.gameEnded) {
          data.dayNumber++;
          data.phase = 'night_wolf';
          data.wolfTarget = null;
          data.seerTarget = null;
          data.doctorTarget = null;
          data.votes = {};
          data.nightActions = {};
          // Reset protection
          for (const p of this.getPlayers()) data.players[p].protected = false;
        }
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: 'Invalid action for current phase' };
  }

  private resolveNight(data: WerewolfState): void {
    // Apply doctor protection
    if (data.doctorTarget) {
      data.players[data.doctorTarget].protected = true;
    }

    // Apply wolf kill
    if (data.wolfTarget) {
      const target = data.players[data.wolfTarget];
      if (!target.protected) {
        target.alive = false;
        this.emitEvent('killed', data.wolfTarget, { by: 'werewolves', night: data.dayNumber });
      }
    }

    this.checkWinCondition(data);
    if (!data.gameEnded) {
      data.phase = 'day_discussion';
    }
  }

  override getStateForPlayer(playerId: string): import('@moltblox/protocol').GameState {
    const state = this.getState();
    const data = state.data as WerewolfState;
    const role = data.players[playerId]?.role;

    // Wolves can see each other; others see only their own role
    const maskedPlayers: Record<string, { role: string; alive: boolean }> = {};
    for (const [pid, ps] of Object.entries(data.players)) {
      if (pid === playerId) {
        maskedPlayers[pid] = { role: ps.role, alive: ps.alive };
      } else if (role === 'werewolf' && ps.role === 'werewolf') {
        maskedPlayers[pid] = { role: ps.role, alive: ps.alive };
      } else {
        maskedPlayers[pid] = { role: ps.alive ? 'unknown' : ps.role, alive: ps.alive };
      }
    }

    return { ...state, data: { ...data, players: maskedPlayers } };
  }

  protected checkGameOver(): boolean {
    return this.getData<WerewolfState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<WerewolfState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<WerewolfState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      const isWolf = data.players[p].role === 'werewolf';
      const won =
        (isWolf && data.winner === 'werewolves') || (!isWolf && data.winner === 'villagers');
      scores[p] = won ? 100 : 0;
    }
    return scores;
  }
}
