import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface PatchTile {
  id: number;
  buttonCost: number;
  timeCost: number;
  buttonIncome: number;
  shape: number[][]; // grid of 0/1
}

const PATCHES: PatchTile[] = [
  { id: 0, buttonCost: 2, timeCost: 1, buttonIncome: 0, shape: [[1, 1]] },
  { id: 1, buttonCost: 1, timeCost: 2, buttonIncome: 0, shape: [[1], [1]] },
  {
    id: 2,
    buttonCost: 3,
    timeCost: 2,
    buttonIncome: 1,
    shape: [
      [1, 1],
      [1, 0],
    ],
  },
  { id: 3, buttonCost: 2, timeCost: 3, buttonIncome: 0, shape: [[1, 1, 1]] },
  {
    id: 4,
    buttonCost: 4,
    timeCost: 2,
    buttonIncome: 1,
    shape: [
      [1, 1],
      [0, 1],
      [0, 1],
    ],
  },
  {
    id: 5,
    buttonCost: 5,
    timeCost: 3,
    buttonIncome: 2,
    shape: [
      [1, 1, 1],
      [0, 1, 0],
    ],
  },
  {
    id: 6,
    buttonCost: 3,
    timeCost: 4,
    buttonIncome: 1,
    shape: [
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  { id: 7, buttonCost: 1, timeCost: 3, buttonIncome: 0, shape: [[1], [1], [1]] },
  {
    id: 8,
    buttonCost: 6,
    timeCost: 5,
    buttonIncome: 2,
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
  },
  {
    id: 9,
    buttonCost: 4,
    timeCost: 3,
    buttonIncome: 1,
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
  },
  {
    id: 10,
    buttonCost: 7,
    timeCost: 4,
    buttonIncome: 2,
    shape: [
      [1, 1],
      [1, 1],
    ],
  },
  {
    id: 11,
    buttonCost: 2,
    timeCost: 2,
    buttonIncome: 0,
    shape: [
      [1, 1],
      [1, 0],
    ],
  },
  {
    id: 12,
    buttonCost: 5,
    timeCost: 4,
    buttonIncome: 2,
    shape: [
      [1, 1, 1],
      [1, 0, 0],
    ],
  },
  {
    id: 13,
    buttonCost: 3,
    timeCost: 3,
    buttonIncome: 1,
    shape: [
      [1, 1],
      [0, 1],
    ],
  },
  { id: 14, buttonCost: 1, timeCost: 2, buttonIncome: 0, shape: [[1, 1]] },
];

const QUILT_SIZE = 9;
const TIME_TRACK_LENGTH = 54;
const BUTTON_INCOME_SPACES = [5, 11, 17, 23, 29, 35, 41, 47, 53];

interface PatchworkPlayerState {
  quilt: boolean[][];
  buttons: number;
  timePosition: number;
  buttonIncome: number;
  finished: boolean;
  bonus7x7: boolean;
}

interface PatchworkState {
  [key: string]: unknown;
  players: [PatchworkPlayerState, PatchworkPlayerState];
  patches: PatchTile[];
  patchCursor: number;
  currentPlayer: number;
  winner: string | null;
  gameEnded: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class PatchworkGame extends BaseGame {
  readonly name = 'Patchwork';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): PatchworkState {
    const emptyQuilt = () =>
      Array.from({ length: QUILT_SIZE }, () => Array(QUILT_SIZE).fill(false));

    return {
      players: [
        {
          quilt: emptyQuilt(),
          buttons: 5,
          timePosition: 0,
          buttonIncome: 0,
          finished: false,
          bonus7x7: false,
        },
        {
          quilt: emptyQuilt(),
          buttons: 5,
          timePosition: 0,
          buttonIncome: 0,
          finished: false,
          bonus7x7: false,
        },
      ],
      patches: shuffle([...PATCHES]),
      patchCursor: 0,
      currentPlayer: 0,
      winner: null,
      gameEnded: false,
    };
  }

  private getActivePlayer(data: PatchworkState): number {
    // Player further behind on time track goes first
    if (data.players[0].timePosition === data.players[1].timePosition) {
      return data.currentPlayer;
    }
    return data.players[0].timePosition <= data.players[1].timePosition ? 0 : 1;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PatchworkState>();
    const players = this.getPlayers();
    const pIdx = players.indexOf(playerId);

    if (pIdx === -1) return { success: false, error: 'Invalid player' };

    const activeIdx = this.getActivePlayer(data);
    if (pIdx !== activeIdx) return { success: false, error: 'Not your turn' };

    const ps = data.players[pIdx];

    if (action.type === 'advance') {
      // Pass: advance time to one space ahead of opponent, earn buttons
      const oppPos = data.players[1 - pIdx].timePosition;
      const spacesToMove = Math.max(1, oppPos - ps.timePosition + 1);
      const oldPos = ps.timePosition;
      ps.timePosition = Math.min(oppPos + 1, TIME_TRACK_LENGTH);
      ps.buttons += spacesToMove;

      // Check button income spaces
      for (let i = oldPos + 1; i <= ps.timePosition; i++) {
        if (BUTTON_INCOME_SPACES.includes(i)) {
          ps.buttons += ps.buttonIncome;
        }
      }

      if (ps.timePosition >= TIME_TRACK_LENGTH) ps.finished = true;
      this.checkEnd(data, players);
      data.currentPlayer = 1 - pIdx;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'buy') {
      const patchOffset = Number(action.payload.patchIndex ?? 0); // 0, 1, or 2 from cursor
      if (patchOffset < 0 || patchOffset > 2)
        return { success: false, error: 'Can only pick from next 3 patches' };

      const actualIdx = (data.patchCursor + patchOffset) % data.patches.length;
      if (actualIdx >= data.patches.length) return { success: false, error: 'No more patches' };

      const patch = data.patches[actualIdx];
      if (ps.buttons < patch.buttonCost) return { success: false, error: 'Not enough buttons' };

      const row = Number(action.payload.row ?? 0);
      const col = Number(action.payload.col ?? 0);
      const rotation = Number(action.payload.rotation ?? 0);
      const flip = Boolean(action.payload.flip);

      let shape = patch.shape.map((r) => [...r]);
      if (flip) shape = shape.map((r) => [...r].reverse());
      for (let i = 0; i < rotation % 4; i++) {
        const newShape: number[][] = [];
        for (let c = 0; c < shape[0].length; c++) {
          newShape.push(shape.map((r) => r[c]).reverse());
        }
        shape = newShape;
      }

      // Validate placement
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            const qr = row + r;
            const qc = col + c;
            if (qr < 0 || qr >= QUILT_SIZE || qc < 0 || qc >= QUILT_SIZE) {
              return { success: false, error: 'Patch out of bounds' };
            }
            if (ps.quilt[qr][qc]) return { success: false, error: 'Space already filled' };
          }
        }
      }

      // Place patch
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) ps.quilt[row + r][col + c] = true;
        }
      }

      ps.buttons -= patch.buttonCost;
      ps.buttonIncome += patch.buttonIncome;

      // Advance time
      const oldPos = ps.timePosition;
      ps.timePosition = Math.min(ps.timePosition + patch.timeCost, TIME_TRACK_LENGTH);

      for (let i = oldPos + 1; i <= ps.timePosition; i++) {
        if (BUTTON_INCOME_SPACES.includes(i)) ps.buttons += ps.buttonIncome;
      }

      if (ps.timePosition >= TIME_TRACK_LENGTH) ps.finished = true;

      // Check 7x7 bonus
      if (!data.players[0].bonus7x7 && !data.players[1].bonus7x7) {
        if (this.has7x7(ps.quilt)) ps.bonus7x7 = true;
      }

      // Remove patch from circle
      data.patches.splice(actualIdx, 1);
      if (data.patches.length > 0) {
        data.patchCursor = actualIdx % data.patches.length;
      }

      this.checkEnd(data, players);
      data.currentPlayer = 1 - pIdx;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  private has7x7(quilt: boolean[][]): boolean {
    for (let r = 0; r <= QUILT_SIZE - 7; r++) {
      for (let c = 0; c <= QUILT_SIZE - 7; c++) {
        let full = true;
        for (let dr = 0; dr < 7 && full; dr++) {
          for (let dc = 0; dc < 7 && full; dc++) {
            if (!quilt[r + dr][c + dc]) full = false;
          }
        }
        if (full) return true;
      }
    }
    return false;
  }

  private checkEnd(data: PatchworkState, players: string[]): void {
    if (data.players[0].finished && data.players[1].finished) {
      data.gameEnded = true;
      const scores = [this.calcScore(data.players[0]), this.calcScore(data.players[1])];
      if (scores[0] > scores[1]) data.winner = players[0];
      else if (scores[1] > scores[0]) data.winner = players[1];
      else data.winner = null;
    }
  }

  private calcScore(ps: PatchworkPlayerState): number {
    let empty = 0;
    for (let r = 0; r < QUILT_SIZE; r++) {
      for (let c = 0; c < QUILT_SIZE; c++) {
        if (!ps.quilt[r][c]) empty++;
      }
    }
    return ps.buttons - empty * 2 + (ps.bonus7x7 ? 7 : 0);
  }

  protected checkGameOver(): boolean {
    return this.getData<PatchworkState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<PatchworkState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<PatchworkState>();
    const players = this.getPlayers();
    return {
      [players[0]]: this.calcScore(data.players[0]),
      [players[1]]: this.calcScore(data.players[1]),
    };
  }
}
