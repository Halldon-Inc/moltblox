import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface PhantomTicTacToeState {
  [key: string]: unknown;
  board: (string | null)[];
  currentPlayer: number;
  winner: string | null;
  rejectedMoves: Record<string, number[]>;
}

export class PhantomTicTacToeGame extends BaseGame {
  readonly name = 'Phantom Tic Tac Toe';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): PhantomTicTacToeState {
    const rejectedMoves: Record<string, number[]> = {};
    for (const p of playerIds) rejectedMoves[p] = [];
    return { board: Array(9).fill(null), currentPlayer: 0, winner: null, rejectedMoves };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PhantomTicTacToeState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'place') return { success: false, error: `Unknown action: ${action.type}` };

    const index = Number(action.payload.index ?? action.payload.position);
    if (isNaN(index) || index < 0 || index >= 9)
      return { success: false, error: 'Invalid position' };

    if (data.board[index] !== null) {
      // Cell occupied but player doesn't know; record rejected move
      data.rejectedMoves[playerId].push(index);
      this.emitEvent('rejected', playerId, { index });
      // Player gets to try again (don't switch turns)
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    data.board[index] = playerId;
    data.rejectedMoves[playerId] = [];

    // Check win
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
      if (data.board[a] === playerId && data.board[b] === playerId && data.board[c] === playerId) {
        data.winner = playerId;
      }
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<PhantomTicTacToeState>();
    return data.winner !== null || data.board.every((c) => c !== null);
  }

  protected determineWinner(): string | null {
    return this.getData<PhantomTicTacToeState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }

  getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as PhantomTicTacToeState;
    const maskedBoard = data.board.map((cell) => (cell === playerId ? cell : null));
    return {
      ...state,
      data: {
        ...data,
        board: maskedBoard,
        rejectedMoves: { [playerId]: data.rejectedMoves[playerId] },
      },
    };
  }
}
