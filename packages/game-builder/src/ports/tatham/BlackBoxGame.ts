/**
 * BlackBoxGame: Deduce hidden atom positions by firing beams.
 * Beams reflect off atoms (90 degrees), absorb on direct hit, or pass through.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface BlackBoxConfig {
  size?: number;
  atomCount?: number;
}

type BeamResult = 'hit' | 'reflect' | number;

interface BlackBoxState {
  [key: string]: unknown;
  size: number;
  atoms: boolean[];
  guesses: boolean[];
  atomCount: number;
  beamResults: { entry: number; result: BeamResult }[];
  moves: number;
  revealed: boolean;
  score: number;
}

export class BlackBoxGame extends BaseGame {
  readonly name = 'Black Box';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): BlackBoxState {
    const cfg = this.config as BlackBoxConfig;
    const size = Math.max(5, Math.min(cfg.size ?? 8, 12));
    const total = size * size;
    const atomCount = Math.max(2, Math.min(cfg.atomCount ?? 4, Math.floor(total * 0.15)));

    const atoms = new Array(total).fill(false);
    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let i = 0; i < atomCount; i++) {
      atoms[indices[i]] = true;
    }

    return {
      size,
      atoms,
      guesses: new Array(total).fill(false),
      atomCount,
      beamResults: [],
      moves: 0,
      revealed: false,
      score: 0,
    };
  }

  private fireBeam(
    atoms: boolean[],
    size: number,
    entry: number,
  ): { result: BeamResult; exit: number } {
    const totalEdges = size * 4;
    let row: number;
    let col: number;
    let dr: number;
    let dc: number;

    if (entry < size) {
      // Top edge
      row = 0;
      col = entry;
      dr = 1;
      dc = 0;
    } else if (entry < size * 2) {
      // Right edge
      row = entry - size;
      col = size - 1;
      dr = 0;
      dc = -1;
    } else if (entry < size * 3) {
      // Bottom edge
      row = size - 1;
      col = size * 3 - 1 - entry;
      dr = -1;
      dc = 0;
    } else {
      // Left edge
      row = size * 4 - 1 - entry;
      col = 0;
      dr = 0;
      dc = 1;
    }

    // Check for immediate reflection (atom adjacent to entry point before entering)
    let deflections = 0;
    const startRow = row;
    const startCol = col;

    while (true) {
      // Check if current cell has an atom
      if (row >= 0 && row < size && col >= 0 && col < size && atoms[row * size + col]) {
        return { result: 'hit', exit: -1 };
      }

      // Move forward
      const nextR = row + dr;
      const nextC = col + dc;

      // Check if we've exited the grid
      if (nextR < 0 || nextR >= size || nextC < 0 || nextC >= size) {
        // Compute exit edge point
        let exitEntry: number;
        if (dr === -1)
          exitEntry = col; // Top
        else if (dc === 1)
          exitEntry = size + row; // Right
        else if (dr === 1)
          exitEntry = size * 3 - 1 - col; // Bottom
        else exitEntry = size * 4 - 1 - row; // Left

        if (exitEntry === entry) return { result: 'reflect', exit: entry };
        return { result: exitEntry, exit: exitEntry };
      }

      // Check for deflection by atoms adjacent to next cell
      const hasLeft = nextC > 0 && atoms[nextR * size + nextC - 1];
      const hasRight = nextC < size - 1 && atoms[nextR * size + nextC + 1];
      const hasUp = nextR > 0 && atoms[(nextR - 1) * size + nextC];
      const hasDown = nextR < size - 1 && atoms[(nextR + 1) * size + nextC];

      // Direct hit
      if (atoms[nextR * size + nextC]) {
        return { result: 'hit', exit: -1 };
      }

      let newDr = dr;
      let newDc = dc;

      if (dr === 1 || dr === -1) {
        // Moving vertically
        if (hasLeft && hasRight) {
          // Reflect back
          newDr = -dr;
          newDc = 0;
        } else if (hasLeft) {
          newDr = 0;
          newDc = 1;
        } else if (hasRight) {
          newDr = 0;
          newDc = -1;
        }
      } else {
        // Moving horizontally
        if (hasUp && hasDown) {
          newDr = 0;
          newDc = -dc;
        } else if (hasUp) {
          newDr = 1;
          newDc = 0;
        } else if (hasDown) {
          newDr = -1;
          newDc = 0;
        }
      }

      if (newDr !== dr || newDc !== dc) {
        deflections++;
        dr = newDr;
        dc = newDc;
        // Don't move to next cell on deflection, re-evaluate from current
        if (deflections > size * 4) {
          return { result: 'reflect', exit: entry };
        }
        continue;
      }

      row = nextR;
      col = nextC;
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<BlackBoxState>();

    switch (action.type) {
      case 'fire': {
        const entry = Number(action.payload.entry);
        const totalEdges = data.size * 4;
        if (entry < 0 || entry >= totalEdges) {
          return { success: false, error: 'Invalid entry point' };
        }

        const { result } = this.fireBeam(data.atoms, data.size, entry);
        data.beamResults.push({ entry, result });
        data.moves++;

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      case 'guess': {
        const index = Number(action.payload.index);
        if (index < 0 || index >= data.size * data.size) {
          return { success: false, error: 'Invalid cell index' };
        }

        data.guesses[index] = !data.guesses[index];
        data.moves++;

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      case 'submit': {
        data.revealed = true;

        let correct = 0;
        let wrong = 0;
        for (let i = 0; i < data.size * data.size; i++) {
          if (data.guesses[i] && data.atoms[i]) correct++;
          if (data.guesses[i] && !data.atoms[i]) wrong++;
          if (!data.guesses[i] && data.atoms[i]) wrong++;
        }

        const beamCost = data.beamResults.length;
        data.score = Math.max(0, 1000 - wrong * 100 - beamCost * 10);

        this.emitEvent('revealed', playerId, {
          correct,
          wrong,
          score: data.score,
        });

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<BlackBoxState>().revealed;
  }

  protected determineWinner(): string | null {
    const data = this.getData<BlackBoxState>();
    if (!data.revealed) return null;
    let allCorrect = true;
    for (let i = 0; i < data.size * data.size; i++) {
      if (data.guesses[i] !== data.atoms[i]) {
        allCorrect = false;
        break;
      }
    }
    return allCorrect ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<BlackBoxState>();
    const playerId = this.getPlayers()[0];
    return { [playerId]: data.score };
  }

  getStateForPlayer(_playerId: string): typeof this.state {
    const state = this.getState();
    const data = state.data as BlackBoxState;
    if (!data.revealed) {
      return { ...state, data: { ...data, atoms: [] } };
    }
    return state;
  }
}
