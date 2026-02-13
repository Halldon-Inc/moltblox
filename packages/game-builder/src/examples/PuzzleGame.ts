/**
 * PuzzleGame - A number matching puzzle
 *
 * Find matching pairs in a grid!
 * Demonstrates:
 * - Single player game
 * - State management
 * - Score tracking
 * - Multiple win conditions
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface PuzzleConfig {
  gridSize?: number;
}

interface PuzzleState {
  [key: string]: unknown;
  grid: number[]; // Flattened grid of values (pairs of 1-8)
  revealed: boolean[]; // Which cells are revealed
  matched: boolean[]; // Which cells are matched
  selected: number | null; // Currently selected cell
  moves: number; // Total moves made
  matches: number; // Pairs found
  gridSize: number; // Width/height of grid
}

export class PuzzleGame extends BaseGame {
  readonly name = 'Match Pairs';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): PuzzleState {
    const cfg = this.config as PuzzleConfig;
    // Grid size must be even so we can form pairs; default 4
    let gridSize = cfg.gridSize ?? 4;
    if (gridSize % 2 !== 0) gridSize++;
    gridSize = Math.max(2, Math.min(gridSize, 8));

    const totalCells = gridSize * gridSize;
    const numPairs = totalCells / 2;

    // Create pairs
    const pairs: number[] = [];
    for (let i = 1; i <= numPairs; i++) {
      pairs.push(i, i);
    }

    // Shuffle
    const grid = this.shuffle(pairs);

    return {
      grid,
      revealed: new Array(totalCells).fill(false),
      matched: new Array(totalCells).fill(false),
      selected: null,
      moves: 0,
      matches: 0,
      gridSize,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PuzzleState>();

    switch (action.type) {
      case 'select': {
        const index = Number(action.payload.index);

        // Validate index
        if (index < 0 || index >= data.grid.length) {
          return { success: false, error: 'Invalid cell index' };
        }

        // Can't select already matched cells
        if (data.matched[index]) {
          return { success: false, error: 'Cell already matched' };
        }

        // Can't select already revealed cells
        if (data.revealed[index]) {
          return { success: false, error: 'Cell already revealed' };
        }

        // Reveal the cell
        data.revealed[index] = true;

        // If no cell was selected, this is the first of a pair
        if (data.selected === null) {
          data.selected = index;
        } else {
          // This is the second cell - check for match
          const firstIndex = data.selected;
          const firstValue = data.grid[firstIndex];
          const secondValue = data.grid[index];

          data.moves++;

          if (firstValue === secondValue) {
            // Match found!
            data.matched[firstIndex] = true;
            data.matched[index] = true;
            data.matches++;

            this.emitEvent('match_found', playerId, {
              value: firstValue,
              indices: [firstIndex, index],
            });
          } else {
            // No match - hide both after a delay (handled by frontend)
            // For now, just mark them to be hidden
            data.revealed[firstIndex] = false;
            data.revealed[index] = false;

            this.emitEvent('match_failed', playerId, {
              indices: [firstIndex, index],
            });
          }

          data.selected = null;
        }

        this.setData(data);

        return {
          success: true,
          newState: this.getState(),
        };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<PuzzleState>();
    // Game over when all pairs are matched
    const numPairs = (data.gridSize * data.gridSize) / 2;
    return data.matches >= numPairs;
  }

  protected determineWinner(): string | null {
    // Single player always wins if they complete
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<PuzzleState>();
    const playerId = this.getPlayers()[0];

    // Score based on efficiency (fewer moves = higher score)
    // Perfect game = numPairs moves (one for each pair)
    const numPairs = (data.gridSize * data.gridSize) / 2;
    const score = Math.max(0, 1000 - (data.moves - numPairs) * 50);

    return { [playerId]: score };
  }

  // Helper to shuffle array
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // Override to show only revealed cells to player
  getStateForPlayer(playerId: string): typeof this.state {
    const state = this.getState();
    const data = state.data as PuzzleState;

    // Only show values for revealed or matched cells
    const visibleGrid = data.grid.map((value, i) =>
      data.revealed[i] || data.matched[i] ? value : 0,
    );

    return {
      ...state,
      data: {
        ...data,
        grid: visibleGrid,
      },
    };
  }
}
