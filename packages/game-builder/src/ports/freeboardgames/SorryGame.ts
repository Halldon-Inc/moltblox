import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const BOARD_SIZE = 60;
const SAFE_ZONES = [0, 15, 30, 45]; // Entry points are safe

interface SorryToken {
  position: number; // -1=start, 0-59=board, 100-103=safety, 104=home
  inStart: boolean;
  atHome: boolean;
}

interface SorryPlayerState {
  tokens: SorryToken[];
  entryPos: number;
  safetyEntry: number;
}

interface SorryState {
  [key: string]: unknown;
  players: Record<string, SorryPlayerState>;
  currentPlayer: number;
  currentCard: number | null;
  drawn: boolean;
  winner: string | null;
  gameEnded: boolean;
  deck: number[];
}

function createDeck(): number[] {
  // Sorry deck: 1(x5), 2(x4), 3(x4), 4(x4), 5(x4), 7(x4), 8(x4), 10(x4), 11(x4), 12(x4), Sorry(x4)=0
  const deck: number[] = [];
  for (let i = 0; i < 5; i++) deck.push(1);
  for (const val of [2, 3, 4, 5, 7, 8, 10, 11, 12]) {
    for (let i = 0; i < 4; i++) deck.push(val);
  }
  for (let i = 0; i < 4; i++) deck.push(0); // Sorry cards
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class SorryGame extends BaseGame {
  readonly name = 'Sorry';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): SorryState {
    const entries = [0, 15, 30, 45];
    const players: Record<string, SorryPlayerState> = {};

    for (let i = 0; i < playerIds.length; i++) {
      players[playerIds[i]] = {
        tokens: Array.from({ length: 4 }, () => ({
          position: -1,
          inStart: true,
          atHome: false,
        })),
        entryPos: entries[i],
        safetyEntry: (entries[i] + BOARD_SIZE - 3) % BOARD_SIZE,
      };
    }

    return {
      players,
      currentPlayer: 0,
      currentCard: null,
      drawn: false,
      winner: null,
      gameEnded: false,
      deck: createDeck(),
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SorryState>();
    const playerOrder = this.getPlayers();
    const currentId = playerOrder[data.currentPlayer];

    if (playerId !== currentId) return { success: false, error: 'Not your turn' };

    if (action.type === 'draw') {
      if (data.drawn) return { success: false, error: 'Already drew a card' };
      if (data.deck.length === 0) data.deck = createDeck();
      data.currentCard = data.deck.pop()!;
      data.drawn = true;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'move') {
      if (!data.drawn || data.currentCard === null) {
        return { success: false, error: 'Must draw a card first' };
      }

      const tokenIdx = Number(action.payload.tokenIndex);
      const ps = data.players[playerId];
      if (tokenIdx < 0 || tokenIdx >= ps.tokens.length) {
        return { success: false, error: 'Invalid token' };
      }

      const token = ps.tokens[tokenIdx];
      const card = data.currentCard;

      if (token.atHome) return { success: false, error: 'Token already home' };

      // Card 0 = Sorry: take token from start, bump opponent
      if (card === 0) {
        if (!token.inStart) return { success: false, error: 'Sorry card only works from start' };
        const target = action.payload.target as string;
        const targetToken = Number(action.payload.targetToken ?? 0);
        if (!target || !data.players[target] || target === playerId) {
          return { success: false, error: 'Must target opponent' };
        }
        const tt = data.players[target].tokens[targetToken];
        if (!tt || tt.inStart || tt.atHome || tt.position >= 100) {
          return { success: false, error: 'Invalid target token' };
        }
        token.inStart = false;
        token.position = tt.position;
        tt.inStart = true;
        tt.position = -1;
        this.emitEvent('sorry', playerId, { bumped: target });
      } else if (card === 1 || card === 2) {
        // 1 or 2: can leave start OR move forward
        if (token.inStart) {
          token.inStart = false;
          token.position = ps.entryPos;
          this.bumpOpponent(data, playerId, token.position, playerOrder);
        } else {
          this.moveForward(token, card, ps, data);
        }
      } else if (card === 4) {
        // Move backward 4
        if (token.inStart) return { success: false, error: 'Cannot move backward from start' };
        if (token.position >= 100)
          return { success: false, error: 'Cannot move backward in safety' };
        token.position = (token.position - 4 + BOARD_SIZE) % BOARD_SIZE;
        this.bumpOpponent(data, playerId, token.position, playerOrder);
      } else if (card === 10) {
        // Move forward 10 or backward 1
        if (token.inStart) return { success: false, error: 'Cannot use 10 from start' };
        const direction = action.payload.direction as string;
        if (direction === 'back') {
          if (token.position >= 100) return { success: false, error: 'Cannot go back in safety' };
          token.position = (token.position - 1 + BOARD_SIZE) % BOARD_SIZE;
        } else {
          this.moveForward(token, 10, ps, data);
        }
        this.bumpOpponent(data, playerId, token.position, playerOrder);
      } else if (card === 11) {
        // Move 11 or swap with opponent
        if (action.payload.swap) {
          const target = action.payload.target as string;
          const targetToken = Number(action.payload.targetToken ?? 0);
          if (!target || !data.players[target] || target === playerId) {
            return { success: false, error: 'Must swap with opponent' };
          }
          const tt = data.players[target].tokens[targetToken];
          if (!tt || tt.inStart || tt.atHome || tt.position >= 100) {
            return { success: false, error: 'Cannot swap with that token' };
          }
          if (token.inStart || token.position >= 100) {
            return { success: false, error: 'Cannot swap from start or safety' };
          }
          const temp = token.position;
          token.position = tt.position;
          tt.position = temp;
        } else {
          if (token.inStart) return { success: false, error: 'Cannot use from start' };
          this.moveForward(token, 11, ps, data);
        }
      } else {
        // Cards 3, 5, 7, 8, 12: move forward
        if (token.inStart) return { success: false, error: 'Need 1 or 2 to leave start' };
        this.moveForward(token, card, ps, data);
        this.bumpOpponent(data, playerId, token.position, playerOrder);
      }

      // Check win
      if (ps.tokens.every((t) => t.atHome)) {
        data.gameEnded = true;
        data.winner = playerId;
      }

      // End turn (card 2 gets extra turn)
      data.drawn = false;
      data.currentCard = null;
      if (card !== 2) {
        data.currentPlayer = (data.currentPlayer + 1) % playerOrder.length;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'skip') {
      // Skip if no valid move
      data.drawn = false;
      data.currentCard = null;
      data.currentPlayer = (data.currentPlayer + 1) % playerOrder.length;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  private moveForward(
    token: SorryToken,
    steps: number,
    ps: SorryPlayerState,
    data: SorryState,
  ): void {
    if (token.position >= 100) {
      const safetyPos = token.position - 100 + steps;
      if (safetyPos >= 4) {
        token.atHome = true;
        token.position = 104;
      } else {
        token.position = 100 + safetyPos;
      }
      return;
    }

    const newPos = (token.position + steps) % BOARD_SIZE;
    // Check if passing safety entry
    const rel = (token.position - ps.safetyEntry + BOARD_SIZE) % BOARD_SIZE;
    const newRel = rel + steps;
    if (rel <= 0 || rel > BOARD_SIZE - steps) {
      // Might enter safety zone
      const distToEntry = (ps.safetyEntry - token.position + BOARD_SIZE) % BOARD_SIZE;
      if (distToEntry > 0 && distToEntry <= steps) {
        const remaining = steps - distToEntry;
        if (remaining <= 4) {
          if (remaining === 4) {
            token.atHome = true;
            token.position = 104;
          } else {
            token.position = 100 + remaining;
          }
          return;
        }
      }
    }
    token.position = newPos;
  }

  private bumpOpponent(
    data: SorryState,
    moverId: string,
    pos: number,
    playerOrder: string[],
  ): void {
    if (pos >= 100) return; // Safety zone
    for (const pid of playerOrder) {
      if (pid === moverId) continue;
      for (const t of data.players[pid].tokens) {
        if (!t.inStart && !t.atHome && t.position === pos && t.position < 100) {
          t.inStart = true;
          t.position = -1;
          this.emitEvent('bump', moverId, { bumped: pid });
        }
      }
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<SorryState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<SorryState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SorryState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      scores[p] = data.players[p].tokens.filter((t) => t.atHome).length * 25;
    }
    return scores;
  }
}
