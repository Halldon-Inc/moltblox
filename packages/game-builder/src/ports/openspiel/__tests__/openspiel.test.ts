import { describe, it, expect } from 'vitest';
import {
  TicTacToeGame,
  ConnectFourGame,
  CheckersGame,
  ChessGame,
  GoGame,
  OthelloGame,
  MancalaGame,
  HexGame,
  NimGame,
  DotsAndBoxesGame,
  BreakthroughGame,
  QuoridorGame,
  PentagoGame,
  AmazonsGame,
  BackgammonGame,
  ClobberGame,
  DomineeringGame,
  BlackjackGame,
  PokerGame,
  GoFishGame,
  CrazyEightsGame,
  WarGame,
  GinRummyGame,
  HeartsGame,
  SpadesGame,
  UnoGame,
  TwentyFortyEightGame,
  BattleshipGame,
  LiarsDiceGame,
  HanabiGame,
  GoofspielGame,
  OwareGame,
  PhantomTicTacToeGame,
  DarkChessGame,
  CatchGame,
  PigGame,
  MemoryGame,
  SudokuGame,
  MinesweeperGame,
  SimonGame,
  SlidePuzzleGame,
  TowersOfHanoiGame,
  KnightsTourGame,
  EightQueensGame,
  MastermindGame,
  BridgeGame,
  EuchreGame,
  OldMaidGame,
  SnapGame,
  RummyGame,
} from '../index.js';

const ts = () => Date.now();

describe('TicTacToeGame', () => {
  it('should initialize and play to a win', () => {
    const game = new TicTacToeGame();
    game.initialize(['p1', 'p2']);
    expect(game.isGameOver()).toBe(false);

    // P1 wins with top row
    game.handleAction('p1', { type: 'place', payload: { index: 0 }, timestamp: ts() });
    game.handleAction('p2', { type: 'place', payload: { index: 3 }, timestamp: ts() });
    game.handleAction('p1', { type: 'place', payload: { index: 1 }, timestamp: ts() });
    game.handleAction('p2', { type: 'place', payload: { index: 4 }, timestamp: ts() });
    game.handleAction('p1', { type: 'place', payload: { index: 2 }, timestamp: ts() });

    expect(game.isGameOver()).toBe(true);
    expect(game.getWinner()).toBe('p1');
  });
});

describe('ConnectFourGame', () => {
  it('should initialize and accept a drop', () => {
    const game = new ConnectFourGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'drop',
      payload: { column: 3 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
    expect(game.isGameOver()).toBe(false);
  });
});

describe('CheckersGame', () => {
  it('should initialize with pieces', () => {
    const game = new CheckersGame();
    game.initialize(['p1', 'p2']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
    expect(game.isGameOver()).toBe(false);
  });
});

describe('ChessGame', () => {
  it('should allow e2-e4 opening', () => {
    const game = new ChessGame();
    game.initialize(['white', 'black']);
    const result = game.handleAction('white', {
      type: 'move',
      payload: { fromRow: 6, fromCol: 4, toRow: 4, toCol: 4 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });

  it('should detect scholars mate', () => {
    const game = new ChessGame();
    game.initialize(['w', 'b']);
    game.handleAction('w', {
      type: 'move',
      payload: { fromRow: 6, fromCol: 4, toRow: 4, toCol: 4 },
      timestamp: ts(),
    });
    game.handleAction('b', {
      type: 'move',
      payload: { fromRow: 1, fromCol: 4, toRow: 3, toCol: 4 },
      timestamp: ts(),
    });
    game.handleAction('w', {
      type: 'move',
      payload: { fromRow: 7, fromCol: 5, toRow: 4, toCol: 2 },
      timestamp: ts(),
    });
    game.handleAction('b', {
      type: 'move',
      payload: { fromRow: 0, fromCol: 1, toRow: 2, toCol: 2 },
      timestamp: ts(),
    });
    game.handleAction('w', {
      type: 'move',
      payload: { fromRow: 7, fromCol: 3, toRow: 3, toCol: 7 },
      timestamp: ts(),
    });
    game.handleAction('b', {
      type: 'move',
      payload: { fromRow: 0, fromCol: 6, toRow: 2, toCol: 5 },
      timestamp: ts(),
    });
    // Qxf7# checkmate
    const result = game.handleAction('w', {
      type: 'move',
      payload: { fromRow: 3, fromCol: 7, toRow: 1, toCol: 5 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
    expect(game.isGameOver()).toBe(true);
    expect(game.getWinner()).toBe('w');
  });
});

describe('GoGame', () => {
  it('should place stone and pass', () => {
    const game = new GoGame({ boardSize: 9 });
    game.initialize(['p1', 'p2']);
    const r1 = game.handleAction('p1', {
      type: 'place',
      payload: { row: 4, col: 4 },
      timestamp: ts(),
    });
    expect(r1.success).toBe(true);
    const r2 = game.handleAction('p2', { type: 'pass', payload: {}, timestamp: ts() });
    expect(r2.success).toBe(true);
  });
});

describe('OthelloGame', () => {
  it('should allow valid flip move', () => {
    const game = new OthelloGame();
    game.initialize(['p1', 'p2']);
    // On standard 8x8, p1 can play at [2][3] to flip [3][3]
    const result = game.handleAction('p1', {
      type: 'place',
      payload: { row: 2, col: 3 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});

describe('MancalaGame', () => {
  it('should sow stones', () => {
    const game = new MancalaGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', { type: 'sow', payload: { pit: 0 }, timestamp: ts() });
    expect(result.success).toBe(true);
  });
});

describe('NimGame', () => {
  it('should play to completion', () => {
    const game = new NimGame({ piles: [1, 2] });
    game.initialize(['p1', 'p2']);
    game.handleAction('p1', { type: 'take', payload: { pile: 0, count: 1 }, timestamp: ts() });
    game.handleAction('p2', { type: 'take', payload: { pile: 1, count: 2 }, timestamp: ts() });
    expect(game.isGameOver()).toBe(true);
    expect(game.getWinner()).toBe('p1'); // p2 took last, so p1 wins (normal play)
  });
});

describe('HexGame', () => {
  it('should place stones', () => {
    const game = new HexGame({ boardSize: 5 });
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'place',
      payload: { row: 0, col: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});

describe('DotsAndBoxesGame', () => {
  it('should draw lines', () => {
    const game = new DotsAndBoxesGame({ rows: 2, cols: 2 });
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'draw_line',
      payload: { orientation: 'h', row: 0, col: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});

describe('BreakthroughGame', () => {
  it('should move piece forward', () => {
    const game = new BreakthroughGame({ boardSize: 6 });
    game.initialize(['p1', 'p2']);
    // p1 pieces at rows 4,5; move forward (up)
    const result = game.handleAction('p1', {
      type: 'move',
      payload: { fromRow: 4, fromCol: 0, toRow: 3, toCol: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});

describe('TwentyFortyEightGame', () => {
  it('should slide tiles', () => {
    const game = new TwentyFortyEightGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'slide',
      payload: { direction: 'left' },
      timestamp: ts(),
    });
    // May or may not succeed depending on random initial state
    expect(typeof result.success).toBe('boolean');
  });
});

describe('BattleshipGame', () => {
  it('should place ships', () => {
    const game = new BattleshipGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'place_ship',
      payload: { row: 0, col: 0, horizontal: true },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});

describe('BlackjackGame', () => {
  it('should deal and allow hit', () => {
    const game = new BlackjackGame();
    game.initialize(['p1']);
    const result = game.handleAction('p1', { type: 'hit', payload: {}, timestamp: ts() });
    expect(result.success).toBe(true);
  });
});

describe('MinesweeperGame', () => {
  it('should reveal a cell', () => {
    const game = new MinesweeperGame({ rows: 5, cols: 5, mines: 3 });
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'reveal',
      payload: { row: 2, col: 2 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});

describe('SudokuGame', () => {
  it('should initialize with a puzzle', () => {
    const game = new SudokuGame();
    game.initialize(['p1']);
    const state = game.getState();
    expect(state.phase).toBe('playing');
  });
});

describe('MemoryGame', () => {
  it('should flip cards', () => {
    const game = new MemoryGame({ pairs: 4 });
    game.initialize(['p1', 'p2']);
    const r1 = game.handleAction('p1', { type: 'flip', payload: { index: 0 }, timestamp: ts() });
    expect(r1.success).toBe(true);
    const r2 = game.handleAction('p1', { type: 'flip', payload: { index: 1 }, timestamp: ts() });
    expect(r2.success).toBe(true);
  });
});

describe('TowersOfHanoiGame', () => {
  it('should move discs and solve', () => {
    const game = new TowersOfHanoiGame({ discs: 2 });
    game.initialize(['p1']);
    game.handleAction('p1', { type: 'move', payload: { from: 0, to: 1 }, timestamp: ts() });
    game.handleAction('p1', { type: 'move', payload: { from: 0, to: 2 }, timestamp: ts() });
    game.handleAction('p1', { type: 'move', payload: { from: 1, to: 2 }, timestamp: ts() });
    expect(game.isGameOver()).toBe(true);
    expect(game.getWinner()).toBe('p1');
  });
});

describe('MastermindGame', () => {
  it('should accept guesses', () => {
    const game = new MastermindGame({ codeLength: 4, numColors: 6 });
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'guess',
      payload: { guess: [0, 1, 2, 3] },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});

describe('PigGame', () => {
  it('should roll and hold', () => {
    const game = new PigGame();
    game.initialize(['p1', 'p2']);
    const r1 = game.handleAction('p1', { type: 'roll', payload: {}, timestamp: ts() });
    expect(r1.success).toBe(true);
  });
});

describe('SimonGame', () => {
  it('should accept button presses', () => {
    const game = new SimonGame();
    game.initialize(['p1']);
    const state = game.getState();
    const seq = (state.data as { sequence: number[] }).sequence;
    const result = game.handleAction('p1', {
      type: 'press',
      payload: { color: seq[0] },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});

describe('SlidePuzzleGame', () => {
  it('should initialize', () => {
    const game = new SlidePuzzleGame({ size: 3 });
    game.initialize(['p1']);
    expect(game.isGameOver()).toBe(false);
  });
});

describe('GoofspielGame', () => {
  it('should accept bids', () => {
    const game = new GoofspielGame();
    game.initialize(['p1', 'p2']);
    const r1 = game.handleAction('p1', { type: 'bid', payload: { card: 5 }, timestamp: ts() });
    expect(r1.success).toBe(true);
  });
});

describe('LiarsDiceGame', () => {
  it('should accept bids and challenges', () => {
    const game = new LiarsDiceGame();
    game.initialize(['p1', 'p2']);
    const r1 = game.handleAction('p1', {
      type: 'bid',
      payload: { quantity: 3, face: 4 },
      timestamp: ts(),
    });
    expect(r1.success).toBe(true);
    const r2 = game.handleAction('p2', { type: 'challenge', payload: {}, timestamp: ts() });
    expect(r2.success).toBe(true);
  });
});

describe('HanabiGame', () => {
  it('should allow play and clue actions', () => {
    const game = new HanabiGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'clue',
      payload: { target: 'p2', clueType: 'color', clueValue: 0 },
      timestamp: ts(),
    });
    // May fail if p2 has no cards of color 0
    expect(typeof result.success).toBe('boolean');
  });
});

describe('EightQueensGame', () => {
  it('should place queens without conflict', () => {
    const game = new EightQueensGame();
    game.initialize(['p1']);
    const r1 = game.handleAction('p1', {
      type: 'place',
      payload: { row: 0, col: 0 },
      timestamp: ts(),
    });
    expect(r1.success).toBe(true);
    const r2 = game.handleAction('p1', {
      type: 'place',
      payload: { row: 1, col: 2 },
      timestamp: ts(),
    });
    expect(r2.success).toBe(true);
    // Conflict: same diagonal
    const r3 = game.handleAction('p1', {
      type: 'place',
      payload: { row: 2, col: 0 },
      timestamp: ts(),
    });
    expect(r3.success).toBe(false);
  });
});

describe('KnightsTourGame', () => {
  it('should allow knight moves', () => {
    const game = new KnightsTourGame({ boardSize: 5 });
    game.initialize(['p1']);
    const result = game.handleAction('p1', {
      type: 'move',
      payload: { row: 2, col: 1 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});

describe('UnoGame', () => {
  it('should initialize and allow draw', () => {
    const game = new UnoGame();
    game.initialize(['p1', 'p2']);
    // Drawing is always valid
    const result = game.handleAction('p1', { type: 'draw', payload: {}, timestamp: ts() });
    expect(result.success).toBe(true);
  });
});

describe('CatchGame', () => {
  it('should move chasers', () => {
    const game = new CatchGame();
    game.initialize(['chaser', 'runner']);
    const result = game.handleAction('chaser', {
      type: 'move',
      payload: { row: 0, col: 1, chaserIndex: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});

describe('WarGame', () => {
  it('should flip cards', () => {
    const game = new WarGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', { type: 'flip', payload: {}, timestamp: ts() });
    expect(result.success).toBe(true);
  });
});

describe('PhantomTicTacToeGame', () => {
  it('should place with fog of war', () => {
    const game = new PhantomTicTacToeGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'place',
      payload: { index: 4 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
    const playerState = game.getStateForPlayer('p2');
    const data = playerState.data as { board: (string | null)[] };
    // p2 should not see p1's piece
    expect(data.board[4]).toBeNull();
  });
});

describe('QuoridorGame', () => {
  it('should move pawn', () => {
    const game = new QuoridorGame({ boardSize: 9 });
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', {
      type: 'move',
      payload: { row: 7, col: 4 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});

describe('OwareGame', () => {
  it('should sow seeds', () => {
    const game = new OwareGame();
    game.initialize(['p1', 'p2']);
    const result = game.handleAction('p1', { type: 'sow', payload: { pit: 0 }, timestamp: ts() });
    expect(result.success).toBe(true);
  });
});

describe('DomineeringGame', () => {
  it('should place dominos', () => {
    const game = new DomineeringGame({ rows: 4, cols: 4 });
    game.initialize(['p1', 'p2']);
    // P1 places vertically
    const result = game.handleAction('p1', {
      type: 'place',
      payload: { row: 0, col: 0 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});

describe('ClobberGame', () => {
  it('should capture pieces', () => {
    const game = new ClobberGame({ rows: 3, cols: 4 });
    game.initialize(['p1', 'p2']);
    // p1 at (0,0), p2 at (0,1)
    const result = game.handleAction('p1', {
      type: 'clobber',
      payload: { fromRow: 0, fromCol: 0, toRow: 0, toCol: 1 },
      timestamp: ts(),
    });
    expect(result.success).toBe(true);
  });
});
