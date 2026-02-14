import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

// Mission sizes per player count (index = player count - 5)
const MISSION_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

const SPY_COUNTS: Record<number, number> = {
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 3,
  10: 4,
};

interface ResistanceState {
  [key: string]: unknown;
  roles: Record<string, 'resistance' | 'spy'>;
  leader: number;
  currentMission: number;
  missionResults: ('success' | 'fail')[];
  phase: string; // 'propose' | 'vote' | 'mission' | 'ended'
  proposedTeam: string[];
  votes: Record<string, boolean>;
  missionVotes: Record<string, boolean>;
  consecutiveRejects: number;
  winner: string | null;
  gameEnded: boolean;
  missionSizes: number[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class ResistanceGame extends BaseGame {
  readonly name = 'The Resistance';
  readonly version = '1.0.0';
  readonly maxPlayers = 10;

  protected initializeState(playerIds: string[]): ResistanceState {
    const n = playerIds.length;
    const spyCount = SPY_COUNTS[n] || 2;
    const shuffled = shuffle([...playerIds]);

    const roles: Record<string, 'resistance' | 'spy'> = {};
    for (let i = 0; i < shuffled.length; i++) {
      roles[shuffled[i]] = i < spyCount ? 'spy' : 'resistance';
    }

    return {
      roles,
      leader: 0,
      currentMission: 0,
      missionResults: [],
      phase: 'propose',
      proposedTeam: [],
      votes: {},
      missionVotes: {},
      consecutiveRejects: 0,
      winner: null,
      gameEnded: false,
      missionSizes: MISSION_SIZES[n] || [2, 3, 2, 3, 3],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ResistanceState>();
    const players = this.getPlayers();

    if (data.phase === 'propose') {
      const leader = players[data.leader % players.length];
      if (playerId !== leader) return { success: false, error: 'Only the leader can propose' };
      if (action.type !== 'propose') return { success: false, error: 'Must propose a team' };

      const team = action.payload.team as string[];
      const requiredSize = data.missionSizes[data.currentMission];
      if (!Array.isArray(team) || team.length !== requiredSize) {
        return { success: false, error: `Team must have exactly ${requiredSize} members` };
      }
      for (const member of team) {
        if (!players.includes(member)) return { success: false, error: 'Invalid team member' };
      }

      data.proposedTeam = team;
      data.votes = {};
      data.phase = 'vote';
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'vote') {
      if (action.type !== 'vote') return { success: false, error: 'Must vote approve or reject' };
      if (data.votes[playerId] !== undefined) return { success: false, error: 'Already voted' };

      data.votes[playerId] = Boolean(action.payload.approve);

      // Check if all voted
      if (Object.keys(data.votes).length === players.length) {
        const approves = Object.values(data.votes).filter(Boolean).length;
        if (approves > players.length / 2) {
          // Team approved: go to mission
          data.phase = 'mission';
          data.missionVotes = {};
          data.consecutiveRejects = 0;
        } else {
          // Rejected
          data.consecutiveRejects++;
          if (data.consecutiveRejects >= 5) {
            data.gameEnded = true;
            data.winner = 'spies';
            data.phase = 'ended';
          } else {
            data.leader = (data.leader + 1) % players.length;
            data.phase = 'propose';
            data.proposedTeam = [];
          }
        }
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'mission') {
      if (action.type !== 'mission_vote') return { success: false, error: 'Must vote on mission' };
      if (!data.proposedTeam.includes(playerId)) {
        return { success: false, error: 'Not on this mission team' };
      }
      if (data.missionVotes[playerId] !== undefined) {
        return { success: false, error: 'Already voted' };
      }

      const vote = Boolean(action.payload.succeed);
      // Resistance must always vote succeed
      if (data.roles[playerId] === 'resistance' && !vote) {
        return { success: false, error: 'Resistance members must vote for success' };
      }

      data.missionVotes[playerId] = vote;

      // Check if all team members voted
      if (Object.keys(data.missionVotes).length === data.proposedTeam.length) {
        const fails = Object.values(data.missionVotes).filter((v) => !v).length;
        // Mission 4 with 7+ players needs 2 fails
        const failsNeeded = data.currentMission === 3 && players.length >= 7 ? 2 : 1;
        const missionResult = fails >= failsNeeded ? 'fail' : 'success';
        data.missionResults.push(missionResult);

        const successes = data.missionResults.filter((r) => r === 'success').length;
        const failures = data.missionResults.filter((r) => r === 'fail').length;

        if (successes >= 3) {
          data.gameEnded = true;
          data.winner = 'resistance';
          data.phase = 'ended';
        } else if (failures >= 3) {
          data.gameEnded = true;
          data.winner = 'spies';
          data.phase = 'ended';
        } else {
          data.currentMission++;
          data.leader = (data.leader + 1) % players.length;
          data.phase = 'propose';
          data.proposedTeam = [];
        }
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: 'Game is over' };
  }

  override getStateForPlayer(playerId: string): import('@moltblox/protocol').GameState {
    const state = this.getState();
    const data = state.data as ResistanceState;
    // Only reveal spy identities to other spies
    if (data.roles[playerId] !== 'spy') {
      const maskedRoles: Record<string, string> = {};
      for (const p of this.getPlayers()) {
        maskedRoles[p] = p === playerId ? data.roles[p] : 'unknown';
      }
      return { ...state, data: { ...data, roles: maskedRoles } };
    }
    return state;
  }

  protected checkGameOver(): boolean {
    return this.getData<ResistanceState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<ResistanceState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<ResistanceState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      const isWinner =
        (data.winner === 'resistance' && data.roles[p] === 'resistance') ||
        (data.winner === 'spies' && data.roles[p] === 'spy');
      scores[p] = isWinner ? 100 : 0;
    }
    return scores;
  }
}
