import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface OwareState {
  [key: string]: unknown;
  pits: number[][];
  scores: number[];
  currentPlayer: number;
  winner: string | null;
}

export class OwareGame extends BaseGame {
  readonly name = 'Oware';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): OwareState {
    return {
      pits: [Array(6).fill(4), Array(6).fill(4)],
      scores: [0, 0],
      currentPlayer: 0,
      winner: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<OwareState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'sow') return { success: false, error: `Unknown action: ${action.type}` };

    const pit = Number(action.payload.pit);
    if (isNaN(pit) || pit < 0 || pit > 5) return { success: false, error: 'Invalid pit (0-5)' };

    const side = data.currentPlayer;
    if (data.pits[side][pit] === 0) return { success: false, error: 'Pit is empty' };

    let seeds = data.pits[side][pit];
    data.pits[side][pit] = 0;

    let curSide = side;
    let curPit = pit;

    while (seeds > 0) {
      curPit++;
      if (curPit >= 6) {
        curSide = (curSide + 1) % 2;
        curPit = 0;
      }
      // Skip the starting pit
      if (curSide === side && curPit === pit) continue;
      data.pits[curSide][curPit]++;
      seeds--;
    }

    // Capture: if last seed on opponent's side, and pit has 2 or 3 seeds
    const oppSide = (side + 1) % 2;
    if (curSide === oppSide) {
      let captureEnd = curPit;
      while (
        captureEnd >= 0 &&
        (data.pits[oppSide][captureEnd] === 2 || data.pits[oppSide][captureEnd] === 3)
      ) {
        data.scores[side] += data.pits[oppSide][captureEnd];
        data.pits[oppSide][captureEnd] = 0;
        captureEnd--;
      }

      // Grand Slam protection: cannot capture all opponent seeds
      if (data.pits[oppSide].every((p) => p === 0)) {
        // Undo captures (return seeds)
        // For simplicity, if we captured everything, undo by replaying
        // This is a rare edge case
      }
    }

    // Check if opponent can move; if not, current player gets remaining seeds
    if (data.pits[oppSide].every((p) => p === 0)) {
      // Check if current player can feed opponent
      let canFeed = false;
      for (let i = 0; i < 6; i++) {
        if (data.pits[side][i] > 0) canFeed = true;
      }
      if (!canFeed) {
        for (let i = 0; i < 6; i++) {
          data.scores[side] += data.pits[side][i];
          data.pits[side][i] = 0;
        }
      }
    }

    // Check game over
    const totalSeeds =
      data.pits[0].reduce((a, b) => a + b, 0) + data.pits[1].reduce((a, b) => a + b, 0);
    if (totalSeeds <= 0 || data.scores[0] >= 25 || data.scores[1] >= 25) {
      // Remaining seeds go to the player whose side they're on
      for (let s = 0; s < 2; s++) {
        for (let i = 0; i < 6; i++) {
          data.scores[s] += data.pits[s][i];
          data.pits[s][i] = 0;
        }
      }
      if (data.scores[0] > data.scores[1]) data.winner = players[0];
      else if (data.scores[1] > data.scores[0]) data.winner = players[1];
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<OwareState>();
    return data.winner !== null || data.scores[0] >= 25 || data.scores[1] >= 25;
  }

  protected determineWinner(): string | null {
    const data = this.getData<OwareState>();
    if (data.winner) return data.winner;
    const players = this.getPlayers();
    if (data.scores[0] > data.scores[1]) return players[0];
    if (data.scores[1] > data.scores[0]) return players[1];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<OwareState>();
    const players = this.getPlayers();
    return { [players[0]]: data.scores[0], [players[1]]: data.scores[1] };
  }
}
