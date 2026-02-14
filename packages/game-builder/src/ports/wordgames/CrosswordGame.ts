import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface CrosswordState {
  [key: string]: unknown;
  grid: (string | null)[][];
  solution: (string | null)[][];
  clues: { direction: string; row: number; col: number; clue: string; answer: string }[];
  filled: number;
  totalCells: number;
  won: boolean;
  size: number;
}

export class CrosswordGame extends BaseGame {
  readonly name = 'Crossword';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): CrosswordState {
    const size = 7;
    const solution: (string | null)[][] = Array.from({ length: size }, () =>
      Array(size).fill(null),
    );
    const clues = [
      { direction: 'across', row: 0, col: 0, clue: 'Greeting', answer: 'HELLO' },
      { direction: 'across', row: 2, col: 1, clue: 'Planet we live on', answer: 'EARTH' },
      { direction: 'down', row: 0, col: 0, clue: 'Opposite of cold', answer: 'HOT' },
      { direction: 'down', row: 0, col: 4, clue: 'What we breathe', answer: 'O' },
    ];
    let totalCells = 0;
    for (const c of clues) {
      for (let i = 0; i < c.answer.length; i++) {
        const r = c.direction === 'across' ? c.row : c.row + i;
        const col = c.direction === 'across' ? c.col + i : c.col;
        if (r < size && col < size && solution[r][col] === null) totalCells++;
        if (r < size && col < size) solution[r][col] = c.answer[i];
      }
    }
    return {
      grid: Array.from({ length: size }, () => Array(size).fill(null)),
      solution,
      clues,
      filled: 0,
      totalCells,
      won: false,
      size,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'fill') return { success: false, error: 'Use fill action' };
    const d = this.getData<CrosswordState>();
    const row = Number(action.payload.row),
      col = Number(action.payload.col);
    const letter = ((action.payload.letter as string) || '').toUpperCase();
    if (row < 0 || row >= d.size || col < 0 || col >= d.size)
      return { success: false, error: 'Out of bounds' };
    if (d.solution[row][col] === null) return { success: false, error: 'Not a crossword cell' };
    if (letter.length !== 1) return { success: false, error: 'Single letter' };

    const wasEmpty = d.grid[row][col] === null;
    d.grid[row][col] = letter;
    if (wasEmpty && letter === d.solution[row][col]) d.filled++;

    // Check complete
    let correct = true;
    for (let r = 0; r < d.size; r++)
      for (let c = 0; c < d.size; c++) {
        if (d.solution[r][c] !== null && d.grid[r][c] !== d.solution[r][c]) correct = false;
      }
    if (correct) d.won = true;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<CrosswordState>().won;
  }
  protected determineWinner(): string | null {
    return this.getData<CrosswordState>().won ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<CrosswordState>();
    return { [this.getPlayers()[0]]: d.filled * 10 };
  }
}
