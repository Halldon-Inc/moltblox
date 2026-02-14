import { describe, it, expect } from 'vitest';
import { PlatformerGame } from '../examples/PlatformerGame.js';

function createGame(playerCount = 1): PlatformerGame {
  const game = new PlatformerGame();
  const players = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  game.initialize(players);
  return game;
}

function act(
  game: PlatformerGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

interface PlatformerState {
  players: Record<
    string,
    {
      physics: {
        position: { x: number; y: number };
        velocity: { x: number; y: number };
        onGround: boolean;
        facingRight: boolean;
        coyoteTimer: number;
        jumpBufferTimer: number;
      };
      lives: number;
      score: number;
      coinsCollected: number;
      checkpoint: { x: number; y: number };
      finished: boolean;
    }
  >;
  platforms: { x: number; y: number; width: number; height: number }[];
  collectibles: {
    id: number;
    x: number;
    y: number;
    type: string;
    value: number;
    collected: boolean;
  }[];
  hazards: { id: number; x: number; y: number; width: number; height: number; type: string }[];
  checkpoints: { x: number; y: number; activated: boolean }[];
  levelWidth: number;
  levelHeight: number;
  exitX: number;
  exitY: number;
  tick: number;
  [key: string]: unknown;
}

function getData(game: PlatformerGame): PlatformerState {
  return game.getState().data as PlatformerState;
}

describe('PlatformerGame', () => {
  describe('initialization', () => {
    it('starts in playing phase', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
    });

    it('initializes player at spawn point', () => {
      const game = createGame();
      const data = getData(game);
      const player = data.players['player-1'];
      expect(player.physics.position.x).toBe(2);
      expect(player.physics.position.y).toBe(15);
    });

    it('gives player 3 starting lives', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.players['player-1'].lives).toBe(3);
    });

    it('starts with 0 score and coins', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.players['player-1'].score).toBe(0);
      expect(data.players['player-1'].coinsCollected).toBe(0);
    });

    it('generates platforms', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.platforms.length).toBeGreaterThan(0);
    });

    it('generates collectibles', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.collectibles.length).toBeGreaterThan(0);
    });

    it('generates hazards', () => {
      const game = createGame();
      const data = getData(game);
      expect(data.hazards.length).toBeGreaterThan(0);
    });

    it('supports up to 2 players', () => {
      expect(new PlatformerGame().maxPlayers).toBe(2);
    });
  });

  describe('move action', () => {
    it('sets velocity for right movement', () => {
      const game = createGame();
      act(game, 'player-1', 'move', { direction: 'right' });
      const data = getData(game);
      expect(data.players['player-1'].physics.velocity.x).toBeGreaterThan(0);
      expect(data.players['player-1'].physics.facingRight).toBe(true);
    });

    it('sets velocity for left movement', () => {
      const game = createGame();
      act(game, 'player-1', 'move', { direction: 'left' });
      const data = getData(game);
      expect(data.players['player-1'].physics.velocity.x).toBeLessThan(0);
      expect(data.players['player-1'].physics.facingRight).toBe(false);
    });

    it('stops horizontal movement', () => {
      const game = createGame();
      act(game, 'player-1', 'move', { direction: 'right' });
      act(game, 'player-1', 'move', { direction: 'stop' });
      const data = getData(game);
      expect(data.players['player-1'].physics.velocity.x).toBe(0);
    });

    it('rejects invalid direction', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'move', { direction: 'up' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Direction must be');
    });
  });

  describe('jump action', () => {
    it('applies jump force when on ground', () => {
      const game = createGame();
      const data = getData(game);
      data.players['player-1'].physics.onGround = true;
      act(game, 'player-1', 'jump');
      const after = getData(game);
      expect(after.players['player-1'].physics.velocity.y).toBeLessThan(0);
    });

    it('buffers jump when not on ground', () => {
      const game = createGame();
      const data = getData(game);
      data.players['player-1'].physics.onGround = false;
      data.players['player-1'].physics.coyoteTimer = 100; // Past coyote time
      act(game, 'player-1', 'jump');
      const after = getData(game);
      expect(after.players['player-1'].physics.jumpBufferTimer).toBeGreaterThan(0);
    });
  });

  describe('tick action', () => {
    it('increments tick counter', () => {
      const game = createGame();
      act(game, 'player-1', 'tick');
      const data = getData(game);
      expect(data.tick).toBe(1);
    });

    it('applies gravity to velocity', () => {
      const game = createGame();
      const before = getData(game);
      const vyBefore = before.players['player-1'].physics.velocity.y;
      act(game, 'player-1', 'tick');
      const after = getData(game);
      expect(after.players['player-1'].physics.velocity.y).toBeGreaterThanOrEqual(vyBefore);
    });
  });

  describe('game over', () => {
    it('is not over at start', () => {
      const game = createGame();
      expect(game.isGameOver()).toBe(false);
    });
  });

  describe('scores', () => {
    it('returns a score for the player', () => {
      const game = createGame();
      const scores = game.getScores();
      expect(typeof scores['player-1']).toBe('number');
      expect(scores['player-1']).toBeGreaterThanOrEqual(0);
    });
  });

  describe('invalid player', () => {
    it('rejects actions from non-players', () => {
      const game = createGame();
      const result = act(game, 'hacker', 'move', { direction: 'right' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not a valid player');
    });
  });

  describe('player with no lives or finished', () => {
    it('rejects actions from finished player', () => {
      const game = createGame();
      const data = getData(game);
      data.players['player-1'].finished = true;
      const result = act(game, 'player-1', 'move', { direction: 'right' });
      expect(result.success).toBe(false);
    });

    it('rejects actions from player with no lives', () => {
      const game = createGame();
      const data = getData(game);
      data.players['player-1'].lives = 0;
      const result = act(game, 'player-1', 'move', { direction: 'right' });
      expect(result.success).toBe(false);
    });
  });

  describe('config: playerMoveSpeed', () => {
    it('higher moveSpeed produces faster horizontal velocity', () => {
      const slowGame = new PlatformerGame({ playerMoveSpeed: 2 });
      slowGame.initialize(['player-1']);
      act(slowGame, 'player-1', 'move', { direction: 'right' });
      const slowData = getData(slowGame);
      const slowVx = slowData.players['player-1'].physics.velocity.x;

      const fastGame = new PlatformerGame({ playerMoveSpeed: 8 });
      fastGame.initialize(['player-1']);
      act(fastGame, 'player-1', 'move', { direction: 'right' });
      const fastData = getData(fastGame);
      const fastVx = fastData.players['player-1'].physics.velocity.x;

      expect(fastVx).toBeGreaterThan(slowVx);
    });
  });

  describe('config: airControl', () => {
    it('lower airControl reduces airborne speed', () => {
      const game = new PlatformerGame({ airControl: 0.3 });
      game.initialize(['player-1']);
      const data = getData(game);
      // Set player to airborne
      data.players['player-1'].physics.onGround = false;
      data.players['player-1'].physics.coyoteTimer = 100;
      act(game, 'player-1', 'move', { direction: 'right' });
      const after = getData(game);
      // With 0.3 air control and default moveSpeed 4, velocity should be 4 * 0.3 = 1.2
      expect(after.players['player-1'].physics.velocity.x).toBeCloseTo(1.2, 1);
    });
  });

  describe('config: maxFallSpeed', () => {
    it('lower maxFallSpeed caps falling velocity', () => {
      const game = new PlatformerGame({ maxFallSpeed: 5 });
      game.initialize(['player-1']);
      // Run many ticks to build up falling speed
      for (let i = 0; i < 30; i++) {
        act(game, 'player-1', 'tick');
      }
      const data = getData(game);
      const vy = data.players['player-1'].physics.velocity.y;
      expect(vy).toBeLessThanOrEqual(5);
    });
  });

  describe('config: hazardDensity', () => {
    it('high density spawns more hazards than low', () => {
      const lowGame = new PlatformerGame({ hazardDensity: 'low' });
      lowGame.initialize(['player-1']);
      const lowData = getData(lowGame);

      const highGame = new PlatformerGame({ hazardDensity: 'high' });
      highGame.initialize(['player-1']);
      const highData = getData(highGame);

      expect(highData.hazards.length).toBeGreaterThan(lowData.hazards.length);
    });
  });
});
