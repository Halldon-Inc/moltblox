import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const BOARD_SIZE = 52;
const HOME_STRETCH = 6; // 6 cells in home stretch per player
const SAFE_POSITIONS = [0, 8, 13, 21, 26, 34, 39, 47]; // safe squares

interface LudoToken {
  position: number; // -1 = base, 0-51 = board, 52-57 = home stretch, 58 = home
  inBase: boolean;
  atHome: boolean;
}

interface LudoPlayerState {
  tokens: LudoToken[];
  startPos: number; // entry position on board
  homeEntry: number; // position where home stretch begins
}

interface LudoState {
  [key: string]: unknown;
  players: Record<string, LudoPlayerState>;
  currentPlayer: number;
  diceValue: number | null;
  rolled: boolean;
  winner: string | null;
  gameEnded: boolean;
  extraTurn: boolean;
  sixCount: number;
}

export class LudoGame extends BaseGame {
  readonly name = 'Ludo';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): LudoState {
    const startPositions = [0, 13, 26, 39];
    const players: Record<string, LudoPlayerState> = {};

    for (let i = 0; i < playerIds.length; i++) {
      const startPos = startPositions[i];
      players[playerIds[i]] = {
        tokens: Array.from({ length: 4 }, () => ({
          position: -1,
          inBase: true,
          atHome: false,
        })),
        startPos,
        homeEntry: (startPos + BOARD_SIZE - 1) % BOARD_SIZE,
      };
    }

    return {
      players,
      currentPlayer: 0,
      diceValue: null,
      rolled: false,
      winner: null,
      gameEnded: false,
      extraTurn: false,
      sixCount: 0,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<LudoState>();
    const playerOrder = this.getPlayers();
    const currentId = playerOrder[data.currentPlayer];

    if (playerId !== currentId) return { success: false, error: 'Not your turn' };

    if (action.type === 'roll') {
      if (data.rolled) return { success: false, error: 'Already rolled' };
      data.diceValue = Math.floor(Math.random() * 6) + 1;
      data.rolled = true;

      // Check if any move is possible
      const ps = data.players[playerId];
      let canMove = false;
      for (const token of ps.tokens) {
        if (token.atHome) continue;
        if (token.inBase && data.diceValue === 6) {
          canMove = true;
          break;
        }
        if (!token.inBase && !token.atHome) {
          canMove = true;
          break;
        }
      }

      if (!canMove) {
        data.rolled = false;
        data.diceValue = null;
        data.extraTurn = false;
        data.sixCount = 0;
        data.currentPlayer = (data.currentPlayer + 1) % playerOrder.length;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'move') {
      if (!data.rolled || data.diceValue === null) {
        return { success: false, error: 'Must roll first' };
      }

      const tokenIdx = Number(action.payload.tokenIndex);
      const ps = data.players[playerId];
      if (tokenIdx < 0 || tokenIdx >= ps.tokens.length) {
        return { success: false, error: 'Invalid token' };
      }

      const token = ps.tokens[tokenIdx];
      const dice = data.diceValue;

      if (token.atHome) return { success: false, error: 'Token already home' };

      if (token.inBase) {
        if (dice !== 6) return { success: false, error: 'Need 6 to leave base' };
        token.inBase = false;
        token.position = ps.startPos;
        // Check for capture at start
        this.checkCapture(data, playerId, token.position, playerOrder);
      } else {
        // Calculate new position
        const relativePos = (token.position - ps.startPos + BOARD_SIZE) % BOARD_SIZE;
        const newRelative = relativePos + dice;

        if (newRelative >= BOARD_SIZE) {
          // Entering home stretch
          const homeIdx = newRelative - BOARD_SIZE;
          if (homeIdx > HOME_STRETCH) {
            return { success: false, error: 'Move overshoots home' };
          }
          if (homeIdx === HOME_STRETCH) {
            token.atHome = true;
            token.position = 58;
          } else {
            token.position = 100 + homeIdx; // home stretch positions 100-105
          }
        } else {
          token.position = (ps.startPos + newRelative) % BOARD_SIZE;
          this.checkCapture(data, playerId, token.position, playerOrder);
        }
      }

      // Check if player won (all tokens home)
      if (ps.tokens.every((t) => t.atHome)) {
        data.gameEnded = true;
        data.winner = playerId;
      }

      // Extra turn for rolling 6
      if (dice === 6) {
        data.sixCount++;
        if (data.sixCount >= 3) {
          // Three consecutive sixes: send last moved token back to base
          if (!token.atHome) {
            token.inBase = true;
            token.position = -1;
          }
          data.sixCount = 0;
          data.currentPlayer = (data.currentPlayer + 1) % playerOrder.length;
        }
        // Otherwise get another turn
      } else {
        data.sixCount = 0;
        data.currentPlayer = (data.currentPlayer + 1) % playerOrder.length;
      }

      data.rolled = false;
      data.diceValue = null;

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  private checkCapture(data: LudoState, moverId: string, pos: number, playerOrder: string[]): void {
    if (SAFE_POSITIONS.includes(pos)) return;
    for (const pid of playerOrder) {
      if (pid === moverId) continue;
      for (const token of data.players[pid].tokens) {
        if (!token.inBase && !token.atHome && token.position === pos) {
          token.inBase = true;
          token.position = -1;
          this.emitEvent('capture', moverId, { captured: pid, position: pos });
        }
      }
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<LudoState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<LudoState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<LudoState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      const homeCount = data.players[p].tokens.filter((t) => t.atHome).length;
      scores[p] = homeCount * 25;
    }
    return scores;
  }
}
