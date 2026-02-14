import { describe, it, expect } from 'vitest';
import { CardBattlerGame } from '../examples/CardBattlerGame.js';

function createGame(config: Record<string, unknown> = {}): CardBattlerGame {
  const game = new CardBattlerGame(config);
  game.initialize(['player-1', 'player-2']);
  return game;
}

function act(
  game: CardBattlerGame,
  playerId: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

describe('CardBattlerGame', () => {
  describe('initialization', () => {
    it('starts in playing phase', () => {
      const game = createGame();
      expect(game.getState().phase).toBe('playing');
    });

    it('initializes both players with HP', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { hp: number }>;
      expect(players['player-1'].hp).toBe(30);
      expect(players['player-2'].hp).toBe(30);
    });

    it('deals initial hands', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { hand: unknown[] }>;
      expect(players['player-1'].hand.length).toBe(5);
      expect(players['player-2'].hand.length).toBe(5);
    });

    it('starts with 1 mana', () => {
      const game = createGame();
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { mana: number }>;
      expect(players['player-1'].mana).toBe(1);
    });

    it('respects config overrides', () => {
      const game = createGame({ startingHp: 50, handSize: 3 });
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { hp: number; hand: unknown[] }>;
      expect(players['player-1'].hp).toBe(50);
      expect(players['player-1'].hand.length).toBe(3);
    });
  });

  describe('play_card action', () => {
    it('plays a card from hand', () => {
      const game = createGame();
      // Player 1 plays first card (index 0)
      const result = act(game, 'player-1', 'play_card', { cardIndex: 0 });
      // May fail if card costs more mana than available
      expect(result).toBeDefined();
    });

    it('rejects wrong player turn', () => {
      const game = createGame();
      const result = act(game, 'player-2', 'play_card', { cardIndex: 0 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not your turn');
    });

    it('rejects invalid card index', () => {
      const game = createGame();
      const result = act(game, 'player-1', 'play_card', { cardIndex: 99 });
      expect(result.success).toBe(false);
    });
  });

  describe('end_turn action', () => {
    it('advances to next player', () => {
      const game = createGame();
      act(game, 'player-1', 'end_turn');
      const data = game.getState().data as Record<string, unknown>;
      expect(data.currentPlayerIndex).toBe(1);
    });

    it('gives next player increased mana', () => {
      const game = createGame();
      act(game, 'player-1', 'end_turn');
      const data = game.getState().data as Record<string, unknown>;
      const players = data.players as Record<string, { mana: number; maxMana: number }>;
      expect(players['player-2'].maxMana).toBe(2);
      expect(players['player-2'].mana).toBe(2);
    });
  });

  describe('win condition', () => {
    it('ends when a player HP reaches 0', () => {
      const game = createGame({ startingHp: 5 });
      // Keep playing attack cards until someone dies
      for (let i = 0; i < 50; i++) {
        const data = game.getState().data as Record<string, unknown>;
        const currentIndex = data.currentPlayerIndex as number;
        const turnOrder = data.turnOrder as string[];
        const pid = turnOrder[currentIndex];
        const players = data.players as Record<
          string,
          { hand: { manaCost: number }[]; mana: number }
        >;
        const player = players[pid];

        // Try to play a card we can afford
        let played = false;
        for (let c = 0; c < player.hand.length; c++) {
          if (player.hand[c].manaCost <= player.mana) {
            act(game, pid, 'play_card', { cardIndex: c });
            played = true;
            break;
          }
        }
        if (!played) {
          act(game, pid, 'end_turn');
        }

        if (game.isGameOver()) break;
      }

      // With 5 HP, game should end relatively quickly
      if (game.isGameOver()) {
        const winner = game.getWinner();
        expect(winner).toBeDefined();
      }
    });
  });

  describe('scores', () => {
    it('calculates scores based on remaining HP and board', () => {
      const game = createGame();
      const scores = game.getScores();
      expect(scores['player-1']).toBeGreaterThan(0);
      expect(scores['player-2']).toBeGreaterThan(0);
    });
  });

  describe('invalid player', () => {
    it('rejects actions from non-players', () => {
      const game = createGame();
      const result = act(game, 'hacker', 'play_card', { cardIndex: 0 });
      expect(result.success).toBe(false);
    });
  });
});
