import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type MafiaRole = 'mafia' | 'citizen' | 'detective' | 'medic';

interface MafiaPlayerState {
  role: MafiaRole;
  alive: boolean;
  protected: boolean;
}

interface MafiaState {
  [key: string]: unknown;
  players: Record<string, MafiaPlayerState>;
  phase: string; // 'night_mafia' | 'night_detective' | 'night_medic' | 'day_vote'
  dayNumber: number;
  mafiaTarget: string | null;
  detectiveTarget: string | null;
  medicTarget: string | null;
  votes: Record<string, string>;
  winner: string | null;
  gameEnded: boolean;
  mafiaVotes: Record<string, string>;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class MafiaGame extends BaseGame {
  readonly name = 'Mafia';
  readonly version = '1.0.0';
  readonly maxPlayers = 10;

  protected initializeState(playerIds: string[]): MafiaState {
    const n = playerIds.length;
    const mafiaCount = Math.max(1, Math.floor(n / 3));
    const roles: MafiaRole[] = [];
    for (let i = 0; i < mafiaCount; i++) roles.push('mafia');
    roles.push('detective');
    if (n > 5) roles.push('medic');
    while (roles.length < n) roles.push('citizen');

    const shuffled = shuffle(roles);
    const players: Record<string, MafiaPlayerState> = {};
    for (let i = 0; i < playerIds.length; i++) {
      players[playerIds[i]] = { role: shuffled[i], alive: true, protected: false };
    }

    return {
      players,
      phase: 'night_mafia',
      dayNumber: 1,
      mafiaTarget: null,
      detectiveTarget: null,
      medicTarget: null,
      votes: {},
      winner: null,
      gameEnded: false,
      mafiaVotes: {},
    };
  }

  private getAlive(data: MafiaState): string[] {
    return this.getPlayers().filter((p) => data.players[p].alive);
  }

  private getAliveByRole(data: MafiaState, role: MafiaRole): string[] {
    return this.getAlive(data).filter((p) => data.players[p].role === role);
  }

  private checkWin(data: MafiaState): void {
    const alive = this.getAlive(data);
    const mafia = alive.filter((p) => data.players[p].role === 'mafia');
    const town = alive.filter((p) => data.players[p].role !== 'mafia');

    if (mafia.length === 0) {
      data.gameEnded = true;
      data.winner = 'town';
    } else if (mafia.length >= town.length) {
      data.gameEnded = true;
      data.winner = 'mafia';
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MafiaState>();
    const ps = data.players[playerId];
    if (!ps?.alive) return { success: false, error: 'Player not alive' };

    if (data.phase === 'night_mafia') {
      if (ps.role !== 'mafia') return { success: false, error: 'Only mafia acts now' };
      if (action.type !== 'kill') return { success: false, error: 'Must choose target' };

      const target = action.payload.target as string;
      if (!data.players[target]?.alive || data.players[target].role === 'mafia') {
        return { success: false, error: 'Invalid target' };
      }

      data.mafiaVotes[playerId] = target;
      const mafiaAlive = this.getAliveByRole(data, 'mafia');
      if (mafiaAlive.every((m) => data.mafiaVotes[m])) {
        // Pick most voted target
        const tally: Record<string, number> = {};
        for (const t of Object.values(data.mafiaVotes)) {
          tally[t] = (tally[t] || 0) + 1;
        }
        let maxV = 0;
        let chosen: string | null = null;
        for (const [t, c] of Object.entries(tally)) {
          if (c > maxV) {
            maxV = c;
            chosen = t;
          }
        }
        data.mafiaTarget = chosen;

        const detAlive = this.getAliveByRole(data, 'detective').length > 0;
        data.phase = detAlive ? 'night_detective' : 'night_medic';
        const medAlive = this.getAliveByRole(data, 'medic').length > 0;
        if (!detAlive && !medAlive) this.resolveNight(data);
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'night_detective') {
      if (ps.role !== 'detective') return { success: false, error: 'Only detective acts now' };
      if (action.type !== 'investigate') return { success: false, error: 'Must investigate' };

      const target = action.payload.target as string;
      if (!data.players[target]?.alive) return { success: false, error: 'Invalid target' };

      const isMafia = data.players[target].role === 'mafia';
      this.emitEvent('investigation', playerId, { target, isMafia });

      const medAlive = this.getAliveByRole(data, 'medic').length > 0;
      if (medAlive) {
        data.phase = 'night_medic';
      } else {
        this.resolveNight(data);
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'night_medic') {
      if (ps.role !== 'medic') return { success: false, error: 'Only medic acts now' };
      if (action.type !== 'protect') return { success: false, error: 'Must protect' };

      const target = action.payload.target as string;
      if (!data.players[target]?.alive) return { success: false, error: 'Invalid target' };

      data.medicTarget = target;
      this.resolveNight(data);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'day_vote') {
      if (action.type !== 'vote') return { success: false, error: 'Must vote' };

      const target = action.payload.target as string;
      data.votes[playerId] = target;

      const alive = this.getAlive(data);
      if (Object.keys(data.votes).length >= alive.length) {
        const tally: Record<string, number> = {};
        for (const t of Object.values(data.votes)) {
          tally[t] = (tally[t] || 0) + 1;
        }

        let maxV = 0;
        let eliminated: string | null = null;
        for (const [t, c] of Object.entries(tally)) {
          if (t !== 'skip' && c > maxV) {
            maxV = c;
            eliminated = t;
          }
        }

        if (eliminated && maxV > alive.length / 2) {
          data.players[eliminated].alive = false;
          this.emitEvent('lynched', eliminated, { day: data.dayNumber });
        }

        this.checkWin(data);
        if (!data.gameEnded) {
          data.dayNumber++;
          data.phase = 'night_mafia';
          data.mafiaTarget = null;
          data.detectiveTarget = null;
          data.medicTarget = null;
          data.votes = {};
          data.mafiaVotes = {};
          for (const p of this.getPlayers()) data.players[p].protected = false;
        }
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: 'Invalid action for current phase' };
  }

  private resolveNight(data: MafiaState): void {
    if (data.medicTarget) {
      data.players[data.medicTarget].protected = true;
    }

    if (data.mafiaTarget) {
      const target = data.players[data.mafiaTarget];
      if (!target.protected) {
        target.alive = false;
        this.emitEvent('murdered', data.mafiaTarget, { night: data.dayNumber });
      }
    }

    this.checkWin(data);
    if (!data.gameEnded) {
      data.phase = 'day_vote';
      data.votes = {};
    }
  }

  override getStateForPlayer(playerId: string): import('@moltblox/protocol').GameState {
    const state = this.getState();
    const data = state.data as MafiaState;
    const role = data.players[playerId]?.role;

    const maskedPlayers: Record<string, { role: string; alive: boolean }> = {};
    for (const [pid, ps] of Object.entries(data.players)) {
      if (pid === playerId) {
        maskedPlayers[pid] = { role: ps.role, alive: ps.alive };
      } else if (role === 'mafia' && ps.role === 'mafia') {
        maskedPlayers[pid] = { role: ps.role, alive: ps.alive };
      } else {
        maskedPlayers[pid] = { role: ps.alive ? 'unknown' : ps.role, alive: ps.alive };
      }
    }

    return { ...state, data: { ...data, players: maskedPlayers } };
  }

  protected checkGameOver(): boolean {
    return this.getData<MafiaState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<MafiaState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MafiaState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      const isMafia = data.players[p].role === 'mafia';
      const won = (isMafia && data.winner === 'mafia') || (!isMafia && data.winner === 'town');
      scores[p] = won ? 100 : 0;
    }
    return scores;
  }
}
