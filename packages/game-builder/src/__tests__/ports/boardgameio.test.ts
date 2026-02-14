import { describe, it, expect } from 'vitest';
import { NineMensMorrisGame } from '../../ports/boardgameio/NineMensMorrisGame.js';
import { TablutGame } from '../../ports/boardgameio/TablutGame.js';
import { TakGame } from '../../ports/boardgameio/TakGame.js';
import { AzulGame } from '../../ports/boardgameio/AzulGame.js';
import { SplendorGame } from '../../ports/boardgameio/SplendorGame.js';
import { CarcassonneGame } from '../../ports/boardgameio/CarcassonneGame.js';
import { SeabattleGame } from '../../ports/boardgameio/SeabattleGame.js';
import { GomokuGame } from '../../ports/boardgameio/GomokuGame.js';
import { OnitamaGame } from '../../ports/boardgameio/OnitamaGame.js';
import { PandemicGame } from '../../ports/boardgameio/PandemicGame.js';

function act(game: any, playerId: string, type: string, payload: Record<string, unknown> = {}) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

// ====== Nine Men's Morris ======

describe('NineMensMorrisGame', () => {
  it('initializes with empty board', () => {
    const game = new NineMensMorrisGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    expect(data.board.length).toBe(24);
    expect(data.board.every((c: any) => c === null)).toBe(true);
    expect(game.getState().phase).toBe('playing');
  });

  it('allows placing pieces', () => {
    const game = new NineMensMorrisGame();
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p1', 'place', { position: 0 });
    expect(r.success).toBe(true);
    const data = game.getState().data as any;
    expect(data.board[0]).toBe('p1');
  });

  it('rejects placing on occupied position', () => {
    const game = new NineMensMorrisGame();
    game.initialize(['p1', 'p2']);
    act(game, 'p1', 'place', { position: 0 });
    act(game, 'p2', 'place', { position: 1 });
    const r = act(game, 'p1', 'place', { position: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects wrong turn', () => {
    const game = new NineMensMorrisGame();
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p2', 'place', { position: 0 });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Not your turn');
  });
});

// ====== Tablut ======

describe('TablutGame', () => {
  it('initializes with correct piece placement', () => {
    const game = new TablutGame();
    game.initialize(['defender', 'attacker']);
    const data = game.getState().data as any;
    expect(data.board[4][4]).toBe('K');
    expect(data.board[0][4]).toBe('A');
    expect(data.board[2][4]).toBe('D');
    expect(data.winner).toBe(null);
  });

  it('allows defender to move', () => {
    const game = new TablutGame();
    game.initialize(['defender', 'attacker']);
    // Move defender from (2,4) to (2,3)
    const r = act(game, 'defender', 'move', { fromRow: 2, fromCol: 4, toRow: 2, toCol: 3 });
    expect(r.success).toBe(true);
  });

  it('rejects moving opponent pieces', () => {
    const game = new TablutGame();
    game.initialize(['defender', 'attacker']);
    // Defender tries to move attacker piece
    const r = act(game, 'defender', 'move', { fromRow: 0, fromCol: 3, toRow: 1, toCol: 3 });
    expect(r.success).toBe(false);
  });
});

// ====== Tak ======

describe('TakGame', () => {
  it('initializes with empty board', () => {
    const game = new TakGame({ boardSize: 5 });
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    expect(data.size).toBe(5);
    expect(data.board.length).toBe(5);
    expect(game.isGameOver()).toBe(false);
  });

  it('allows placing a flat stone', () => {
    const game = new TakGame({ boardSize: 5 });
    game.initialize(['p1', 'p2']);
    // First turn: place opponent's flat
    const r = act(game, 'p1', 'place', { row: 0, col: 0, pieceType: 'flat' });
    expect(r.success).toBe(true);
  });

  it('rejects non-flat on first turn', () => {
    const game = new TakGame({ boardSize: 5 });
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p1', 'place', { row: 0, col: 0, pieceType: 'wall' });
    expect(r.success).toBe(false);
  });
});

// ====== Azul ======

describe('AzulGame', () => {
  it('initializes with factories and player boards', () => {
    const game = new AzulGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    expect(data.factories.length).toBe(5); // 2 players * 2 + 1
    expect(data.playerBoards.p1).toBeDefined();
    expect(data.playerBoards.p2).toBeDefined();
    expect(data.round).toBe(1);
  });

  it('allows drafting from factory', () => {
    const game = new AzulGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    // Find first non-empty factory and pick a color that exists
    const factoryIdx = data.factories.findIndex((f: number[]) => f.length > 0);
    const color = data.factories[factoryIdx][0];
    const r = act(game, 'p1', 'draft', {
      source: 'factory',
      factoryIndex: factoryIdx,
      color,
      line: 0,
    });
    expect(r.success).toBe(true);
  });

  it('rejects drafting empty factory', () => {
    const game = new AzulGame();
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p1', 'draft', { source: 'factory', factoryIndex: 99, color: 0, line: 0 });
    expect(r.success).toBe(false);
  });
});

// ====== Splendor ======

describe('SplendorGame', () => {
  it('initializes with gems and displayed cards', () => {
    const game = new SplendorGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    expect(data.displayed.length).toBe(3);
    expect(data.gems.diamond).toBe(4); // 2 players
    expect(data.nobles.length).toBe(3); // players + 1
  });

  it('allows taking 3 different gems', () => {
    const game = new SplendorGame();
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p1', 'take_gems', {
      gems: { diamond: 1, sapphire: 1, emerald: 1 },
    });
    expect(r.success).toBe(true);
    const data = game.getState().data as any;
    expect(data.players.p1.gems.diamond).toBe(1);
  });

  it('rejects taking 3 of the same gem', () => {
    const game = new SplendorGame();
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p1', 'take_gems', {
      gems: { diamond: 3 },
    });
    expect(r.success).toBe(false);
  });
});

// ====== Carcassonne ======

describe('CarcassonneGame', () => {
  it('initializes with start tile at 0,0', () => {
    const game = new CarcassonneGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    expect(data.board['0,0']).toBeDefined();
    expect(data.currentTile).not.toBeNull();
  });

  it('rejects placing on occupied position', () => {
    const game = new CarcassonneGame();
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p1', 'place_tile', { row: 0, col: 0, rotation: 0 });
    expect(r.success).toBe(false);
    expect(r.error).toContain('occupied');
  });
});

// ====== Seabattle ======

describe('SeabattleGame', () => {
  it('initializes in setup phase', () => {
    const game = new SeabattleGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    expect(data.phase).toBe('setup');
    expect(data.gridSize).toBe(10);
  });

  it('allows placing ships', () => {
    const game = new SeabattleGame();
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p1', 'place_ship', { ship: 'Carrier', row: 0, col: 0, horizontal: true });
    expect(r.success).toBe(true);
    const data = game.getState().data as any;
    expect(data.grids.p1.ships.length).toBe(1);
  });

  it('rejects duplicate ship placement', () => {
    const game = new SeabattleGame();
    game.initialize(['p1', 'p2']);
    act(game, 'p1', 'place_ship', { ship: 'Carrier', row: 0, col: 0, horizontal: true });
    const r = act(game, 'p1', 'place_ship', { ship: 'Carrier', row: 2, col: 0, horizontal: true });
    expect(r.success).toBe(false);
  });

  it('rejects ship going off grid', () => {
    const game = new SeabattleGame();
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p1', 'place_ship', { ship: 'Carrier', row: 0, col: 8, horizontal: true });
    expect(r.success).toBe(false);
    expect(r.error).toContain('off grid');
  });
});

// ====== Gomoku ======

describe('GomokuGame', () => {
  it('initializes empty 15x15 board', () => {
    const game = new GomokuGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    expect(data.size).toBe(15);
    expect(data.board.length).toBe(15);
    expect(game.isGameOver()).toBe(false);
  });

  it('allows placing stones', () => {
    const game = new GomokuGame();
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p1', 'place', { row: 7, col: 7 });
    expect(r.success).toBe(true);
    const data = game.getState().data as any;
    expect(data.board[7][7]).toBe('p1');
  });

  it('detects five in a row', () => {
    const game = new GomokuGame();
    game.initialize(['p1', 'p2']);
    // p1 places 5 in a row horizontally
    for (let i = 0; i < 5; i++) {
      act(game, 'p1', 'place', { row: 0, col: i });
      if (i < 4) act(game, 'p2', 'place', { row: 1, col: i });
    }
    expect(game.isGameOver()).toBe(true);
    expect(game.getWinner()).toBe('p1');
  });

  it('rejects placing on occupied cell', () => {
    const game = new GomokuGame();
    game.initialize(['p1', 'p2']);
    act(game, 'p1', 'place', { row: 7, col: 7 });
    const r = act(game, 'p2', 'place', { row: 7, col: 7 });
    expect(r.success).toBe(false);
    expect(r.error).toContain('occupied');
  });
});

// ====== Onitama ======

describe('OnitamaGame', () => {
  it('initializes with pieces and cards', () => {
    const game = new OnitamaGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    expect(data.board[4][2].isMaster).toBe(true);
    expect(data.board[4][2].owner).toBe(0);
    expect(data.board[0][2].isMaster).toBe(true);
    expect(data.board[0][2].owner).toBe(1);
    expect(data.playerCards[0].length).toBe(2);
    expect(data.playerCards[1].length).toBe(2);
    expect(data.spareCard).toBeDefined();
  });

  it('rejects invalid card name', () => {
    const game = new OnitamaGame();
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p1', 'move', {
      fromRow: 4,
      fromCol: 0,
      toRow: 3,
      toCol: 0,
      card: 'FakeCard',
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Card not in your hand');
  });
});

// ====== Pandemic ======

describe('PandemicGame', () => {
  it('initializes with roles and cities', () => {
    const game = new PandemicGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    expect(data.playerPositions.p1).toBe(0); // Atlanta
    expect(data.playerPositions.p2).toBe(0);
    expect(data.playerRoles.p1).toBeDefined();
    expect(data.actionsLeft).toBe(4);
    expect(data.outbreaks).toBe(0);
  });

  it('allows moving to adjacent city', () => {
    const game = new PandemicGame();
    game.initialize(['p1', 'p2']);
    // Atlanta connects to Chicago (1) and Miami (3)
    const r = act(game, 'p1', 'move', { city: 1 });
    expect(r.success).toBe(true);
    const data = game.getState().data as any;
    expect(data.playerPositions.p1).toBe(1);
  });

  it('rejects non-adjacent move without card', () => {
    const game = new PandemicGame();
    game.initialize(['p1', 'p2']);
    // Atlanta does not connect to Cairo (10)
    const data = game.getState().data as any;
    const hasCairoCard = data.playerHands.p1.includes(10);
    if (!hasCairoCard) {
      const r = act(game, 'p1', 'move', { city: 10 });
      expect(r.success).toBe(false);
    }
  });

  it('allows treating disease', () => {
    const game = new PandemicGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    // Find a city with cubes that player is at
    // Player starts at Atlanta (0, blue)
    const blueIdx = 0; // blue
    if (data.cubes[0][blueIdx] > 0) {
      const r = act(game, 'p1', 'treat', { color: 'blue' });
      expect(r.success).toBe(true);
    }
  });
});
