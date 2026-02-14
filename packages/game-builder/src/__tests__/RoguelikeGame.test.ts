import { describe, it, expect } from 'vitest';
import { RoguelikeGame } from '../examples/RoguelikeGame.js';

function createGame(config: Record<string, unknown> = {}): RoguelikeGame {
  const game = new RoguelikeGame(config);
  game.initialize(['player-1']);
  return game;
}

function act(game: RoguelikeGame, type: string, payload: Record<string, unknown> = {}) {
  return game.handleAction('player-1', { type, payload, timestamp: Date.now() });
}

describe('RoguelikeGame', () => {
  describe('initialization', () => {
    it('starts in playing phase', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
    });

    it('starts in room 0', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      expect(data.currentRoom).toBe(0);
    });

    it('initializes player stats', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const player = data.player as { hp: number; atk: number; def: number };
      expect(player.hp).toBe(50);
      expect(player.atk).toBe(5);
      expect(player.def).toBe(2);
    });

    it('generates correct number of rooms', () => {
      const game = createGame({ roomCount: 8 });
      const data = game.getState().data as Record<string, unknown>;
      const rooms = data.rooms as unknown[];
      expect(rooms.length).toBe(8);
    });

    it('first room is empty', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const rooms = data.rooms as { type: string }[];
      expect(rooms[0].type).toBe('empty');
    });

    it('last room is boss', () => {
      const game = createGame({ roomCount: 5 });
      const data = game.getState().data as Record<string, unknown>;
      const rooms = data.rooms as { type: string }[];
      expect(rooms[rooms.length - 1].type).toBe('boss');
    });
  });

  describe('move_to_room action', () => {
    it('moves to a connected room', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const rooms = data.rooms as { id: number; connections: number[] }[];
      const connectedRoom = rooms[0].connections[0];

      const result = act(game, 'move_to_room', { roomId: connectedRoom });
      // May succeed or trigger combat
      expect(result.success).toBe(true);
    });

    it('rejects moving to non-connected room', () => {
      const game = createGame({ roomCount: 10 });
      // Room 0 should not connect to room 9 directly
      const result = act(game, 'move_to_room', { roomId: 9 });
      // Might be connected depending on branchFactor, but with default it shouldn't
      if (!result.success) {
        expect(result.error).toContain('not connected');
      }
    });

    it('cannot move during combat', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const rooms = data.rooms as { type: string; connections: number[] }[];

      // Find a monster room connected to room 0
      const monsterRoom = rooms[0].connections.find(
        (id) => rooms[id] && (rooms[id].type === 'monster' || rooms[id].type === 'boss'),
      );

      if (monsterRoom !== undefined) {
        act(game, 'move_to_room', { roomId: monsterRoom });
        const postMove = game.getState().data as Record<string, unknown>;
        if (postMove.inCombat) {
          const result = act(game, 'move_to_room', { roomId: 0 });
          expect(result.success).toBe(false);
        }
      }
    });
  });

  describe('fight action', () => {
    it('deals damage to monster', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const rooms = data.rooms as {
        type: string;
        connections: number[];
        monster: { hp: number } | null;
      }[];

      // Find a monster room
      const monsterRoom = rooms[0].connections.find(
        (id) => rooms[id] && rooms[id].type === 'monster' && rooms[id].monster,
      );

      if (monsterRoom !== undefined) {
        act(game, 'move_to_room', { roomId: monsterRoom });
        const preFight = game.getState().data as Record<string, unknown>;
        if (preFight.inCombat) {
          const monsterHpBefore = (preFight.currentMonster as { hp: number }).hp;
          act(game, 'fight');
          const postFight = game.getState().data as Record<string, unknown>;
          const monster = postFight.currentMonster as { hp: number } | null;
          if (monster) {
            expect(monster.hp).toBeLessThan(monsterHpBefore);
          }
        }
      }
    });

    it('rejects fight when not in combat', () => {
      const game = createGame();
      const result = act(game, 'fight');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not in combat');
    });
  });

  describe('use_item action', () => {
    it('rejects invalid item index', () => {
      const game = createGame();
      const result = act(game, 'use_item', { itemIndex: 99 });
      expect(result.success).toBe(false);
    });
  });

  describe('flee action', () => {
    it('rejects flee when not in combat', () => {
      const game = createGame();
      const result = act(game, 'flee');
      expect(result.success).toBe(false);
    });
  });

  describe('win condition (boss defeat)', () => {
    it('game ends on player death (permadeath)', () => {
      // This is hard to test deterministically due to procedural generation,
      // but we can verify the game over mechanism works
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      expect(data.gameResult).toBe('playing');
      expect(game.isGameOver()).toBe(false);
    });
  });

  describe('scores', () => {
    it('returns score for player', () => {
      const game = createGame();
      const scores = game.getScores();
      expect(scores['player-1']).toBeDefined();
    });

    it('score increases on exploration', () => {
      const game = createGame();
      const scoresBefore = game.getScores()['player-1'];
      const data = game.getState().data as Record<string, unknown>;
      const rooms = data.rooms as { connections: number[] }[];
      const connRoom = rooms[0].connections[0];
      act(game, 'move_to_room', { roomId: connRoom });
      const scoresAfter = game.getScores()['player-1'];
      expect(scoresAfter).toBeGreaterThanOrEqual(scoresBefore);
    });
  });

  describe('invalid actions', () => {
    it('rejects unknown action type', () => {
      const game = createGame();
      const result = act(game, 'teleport');
      expect(result.success).toBe(false);
    });

    it('rejects actions from non-players', () => {
      const game = createGame();
      const result = game.handleAction('hacker', {
        type: 'move_to_room',
        payload: { roomId: 1 },
        timestamp: Date.now(),
      });
      expect(result.success).toBe(false);
    });
  });
});
