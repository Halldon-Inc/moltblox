import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const BOARD_SIZE = 68;
const HOME_ROW_LENGTH = 7;
const SAFE_SPACES = [0, 5, 12, 17, 22, 29, 34, 39, 46, 51, 56, 63];

interface ParcheesiToken {
  position: number; // -1=nest, 0-67=main, 100-106=home row, 107=home
  inNest: boolean;
  atHome: boolean;
}

interface ParcheesiPlayerState {
  tokens: ParcheesiToken[];
  startPos: number;
  homeEntry: number;
}

interface ParcheesiState {
  [key: string]: unknown;
  players: Record<string, ParcheesiPlayerState>;
  currentPlayer: number;
  dice: number[];
  rolled: boolean;
  movesRemaining: number[];
  winner: string | null;
  gameEnded: boolean;
  doublesCount: number;
}

export class ParcheesiGame extends BaseGame {
  readonly name = 'Parcheesi';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): ParcheesiState {
    const starts = [0, 17, 34, 51];
    const players: Record<string, ParcheesiPlayerState> = {};

    for (let i = 0; i < playerIds.length; i++) {
      const sp = starts[i];
      players[playerIds[i]] = {
        tokens: Array.from({ length: 4 }, () => ({
          position: -1,
          inNest: true,
          atHome: false,
        })),
        startPos: sp,
        homeEntry: (sp + BOARD_SIZE - 1) % BOARD_SIZE,
      };
    }

    return {
      players,
      currentPlayer: 0,
      dice: [],
      rolled: false,
      movesRemaining: [],
      winner: null,
      gameEnded: false,
      doublesCount: 0,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ParcheesiState>();
    const playerOrder = this.getPlayers();
    const currentId = playerOrder[data.currentPlayer];

    if (playerId !== currentId) return { success: false, error: 'Not your turn' };

    if (action.type === 'roll') {
      if (data.rolled && data.movesRemaining.length > 0) {
        return { success: false, error: 'Must use dice before rolling again' };
      }
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      data.dice = [d1, d2];
      data.rolled = true;
      data.movesRemaining = [d1, d2];
      if (d1 === d2) {
        data.doublesCount++;
        if (data.doublesCount >= 3) {
          // Third doubles: send furthest token back to nest
          const ps = data.players[playerId];
          let furthest: ParcheesiToken | null = null;
          let maxDist = -1;
          for (const t of ps.tokens) {
            if (!t.inNest && !t.atHome) {
              const dist = (t.position - ps.startPos + BOARD_SIZE) % BOARD_SIZE;
              if (dist > maxDist) {
                maxDist = dist;
                furthest = t;
              }
            }
          }
          if (furthest) {
            furthest.inNest = true;
            furthest.position = -1;
          }
          data.doublesCount = 0;
          data.movesRemaining = [];
          data.rolled = false;
          data.currentPlayer = (data.currentPlayer + 1) % playerOrder.length;
          this.setData(data);
          return { success: true, newState: this.getState() };
        }
      } else {
        data.doublesCount = 0;
      }

      // Check if any valid move exists
      if (!this.hasAnyValidMove(data, playerId)) {
        data.movesRemaining = [];
        data.rolled = false;
        if (data.dice[0] !== data.dice[1]) {
          data.currentPlayer = (data.currentPlayer + 1) % playerOrder.length;
        }
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'move') {
      if (!data.rolled) return { success: false, error: 'Must roll first' };
      const tokenIdx = Number(action.payload.tokenIndex);
      const diceIdx = Number(action.payload.diceIndex ?? 0);
      const ps = data.players[playerId];

      if (tokenIdx < 0 || tokenIdx >= ps.tokens.length) {
        return { success: false, error: 'Invalid token' };
      }
      if (diceIdx < 0 || diceIdx >= data.movesRemaining.length) {
        return { success: false, error: 'Invalid dice' };
      }

      const token = ps.tokens[tokenIdx];
      const diceVal = data.movesRemaining[diceIdx];

      if (token.atHome) return { success: false, error: 'Token already home' };

      if (token.inNest) {
        // Need a 5 to enter (can combine dice to make 5)
        if (diceVal !== 5 && data.dice[0] + data.dice[1] !== 5) {
          return { success: false, error: 'Need 5 to leave nest' };
        }
        token.inNest = false;
        token.position = ps.startPos;
        if (diceVal === 5) {
          data.movesRemaining.splice(diceIdx, 1);
        } else {
          data.movesRemaining = []; // Used both dice
        }
      } else {
        const relPos = (token.position - ps.startPos + BOARD_SIZE) % BOARD_SIZE;
        const newRel = relPos + diceVal;

        if (newRel >= BOARD_SIZE && newRel < BOARD_SIZE + HOME_ROW_LENGTH) {
          token.position = 100 + (newRel - BOARD_SIZE);
        } else if (newRel === BOARD_SIZE + HOME_ROW_LENGTH) {
          token.atHome = true;
          token.position = 107;
        } else if (newRel > BOARD_SIZE + HOME_ROW_LENGTH) {
          return { success: false, error: 'Move overshoots home' };
        } else if (token.position >= 100) {
          const homePos = token.position - 100;
          const newHomePos = homePos + diceVal;
          if (newHomePos === HOME_ROW_LENGTH) {
            token.atHome = true;
            token.position = 107;
          } else if (newHomePos > HOME_ROW_LENGTH) {
            return { success: false, error: 'Overshoots home' };
          } else {
            token.position = 100 + newHomePos;
          }
        } else {
          const newPos = (token.position + diceVal) % BOARD_SIZE;
          // Check for blockade (two same-color tokens on same space)
          const blocked = this.isBlockade(data, playerId, newPos);
          if (blocked) return { success: false, error: 'Blockade in the way' };
          token.position = newPos;
          // Capture
          if (!SAFE_SPACES.includes(newPos)) {
            this.captureAt(data, playerId, newPos, playerOrder);
          }
        }
        data.movesRemaining.splice(diceIdx, 1);
      }

      // Check win
      if (ps.tokens.every((t) => t.atHome)) {
        data.gameEnded = true;
        data.winner = playerId;
      }

      // End turn
      if (data.movesRemaining.length === 0) {
        data.rolled = false;
        if (data.dice[0] !== data.dice[1]) {
          data.currentPlayer = (data.currentPlayer + 1) % playerOrder.length;
        }
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  private isBlockade(data: ParcheesiState, moverId: string, pos: number): boolean {
    for (const [pid, ps] of Object.entries(data.players)) {
      const tokensAtPos = ps.tokens.filter((t) => !t.inNest && !t.atHome && t.position === pos);
      if (tokensAtPos.length >= 2) return true;
    }
    return false;
  }

  private captureAt(
    data: ParcheesiState,
    moverId: string,
    pos: number,
    playerOrder: string[],
  ): void {
    for (const pid of playerOrder) {
      if (pid === moverId) continue;
      for (const t of data.players[pid].tokens) {
        if (!t.inNest && !t.atHome && t.position === pos) {
          t.inNest = true;
          t.position = -1;
        }
      }
    }
  }

  private hasAnyValidMove(data: ParcheesiState, playerId: string): boolean {
    const ps = data.players[playerId];
    for (const token of ps.tokens) {
      if (token.atHome) continue;
      if (token.inNest) {
        if (data.movesRemaining.includes(5) || data.dice[0] + data.dice[1] === 5) return true;
      } else {
        return true; // Simplified: there's generally a valid move
      }
    }
    return false;
  }

  protected checkGameOver(): boolean {
    return this.getData<ParcheesiState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<ParcheesiState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<ParcheesiState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      scores[p] = data.players[p].tokens.filter((t) => t.atHome).length * 25;
    }
    return scores;
  }
}
