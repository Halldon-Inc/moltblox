import { describe, it, expect } from 'vitest';
import { LeducHoldemGame } from '../../ports/rlcard/LeducHoldemGame.js';
import { TexasHoldemGame } from '../../ports/rlcard/TexasHoldemGame.js';
import { UnoGame } from '../../ports/rlcard/UnoGame.js';
import { DouDizhuGame } from '../../ports/rlcard/DouDizhuGame.js';
import { MahjongGame } from '../../ports/rlcard/MahjongGame.js';

function act(game: any, playerId: string, type: string, payload: Record<string, unknown> = {}) {
  return game.handleAction(playerId, { type, payload, timestamp: Date.now() });
}

// ====== Leduc Hold'em ======

describe('LeducHoldemGame', () => {
  it('initializes with hole cards and pot', () => {
    const game = new LeducHoldemGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    expect(data.holeCards.p1).toBeDefined();
    expect(data.holeCards.p2).toBeDefined();
    expect(data.pot).toBe(2); // antes
    expect(data.round).toBe(1);
  });

  it('allows check action', () => {
    const game = new LeducHoldemGame();
    game.initialize(['p1', 'p2']);
    // p1 (current player 0) can check since bets are equal (both ante 1)
    const r = act(game, 'p1', 'check');
    expect(r.success).toBe(true);
  });

  it('allows fold', () => {
    const game = new LeducHoldemGame();
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p1', 'fold');
    expect(r.success).toBe(true);
    expect(game.isGameOver()).toBe(true);
    expect(game.getWinner()).toBe('p2');
  });

  it('allows raise and call sequence', () => {
    const game = new LeducHoldemGame();
    game.initialize(['p1', 'p2']);
    const r1 = act(game, 'p1', 'raise');
    expect(r1.success).toBe(true);
    const r2 = act(game, 'p2', 'call');
    expect(r2.success).toBe(true);
    // Should advance to round 2 with community card
    const data = game.getState().data as any;
    expect(data.round).toBe(2);
    expect(data.communityCard).not.toBeNull();
  });

  it('hides opponent cards in getStateForPlayer', () => {
    const game = new LeducHoldemGame();
    game.initialize(['p1', 'p2']);
    const state = game.getStateForPlayer('p1');
    const data = state.data as any;
    expect(data.holeCards.p1.rank).not.toBe('?');
    expect(data.holeCards.p2.rank).toBe('?');
  });
});

// ====== Texas Hold'em ======

describe('TexasHoldemGame', () => {
  it('initializes with hole cards and blinds', () => {
    const game = new TexasHoldemGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    expect(data.holeCards.p1.length).toBe(2);
    expect(data.holeCards.p2.length).toBe(2);
    expect(data.pot).toBe(3); // sb(1) + bb(2)
    expect(data.community.length).toBe(0);
  });

  it('allows fold', () => {
    const game = new TexasHoldemGame();
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p1', 'fold');
    expect(r.success).toBe(true);
    expect(game.isGameOver()).toBe(true);
    expect(game.getWinner()).toBe('p2');
  });

  it('allows call to advance through rounds', () => {
    const game = new TexasHoldemGame();
    game.initialize(['p1', 'p2']);
    // Preflop: p1 calls, p2 checks
    act(game, 'p1', 'call');
    act(game, 'p2', 'check');
    const data = game.getState().data as any;
    // Should be in flop (round 1) with 3 community cards
    expect(data.community.length).toBe(3);
  });
});

// ====== UNO ======

describe('UnoGame', () => {
  it('initializes with hands and discard pile', () => {
    const game = new UnoGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    expect(data.hands.p1.length).toBe(7);
    expect(data.hands.p2.length).toBe(7);
    expect(data.discardPile.length).toBe(1);
    expect(data.currentColor).toBeDefined();
  });

  it('allows drawing a card', () => {
    const game = new UnoGame();
    game.initialize(['p1', 'p2']);
    const r = act(game, 'p1', 'draw');
    expect(r.success).toBe(true);
    // After draw, it should be p2's turn
    const data = game.getState().data as any;
    expect(data.currentPlayer).toBe(1);
  });

  it('rejects playing non-matching card', () => {
    const game = new UnoGame();
    game.initialize(['p1', 'p2']);
    const data = game.getState().data as any;
    // Find a card that does not match current color or value
    const topCard = data.discardPile[data.discardPile.length - 1];
    const hand = data.hands.p1;
    const nonMatching = hand.find(
      (c: any) => c.color !== 'wild' && c.color !== data.currentColor && c.value !== topCard.value,
    );
    if (nonMatching) {
      const r = act(game, 'p1', 'play', { cardId: nonMatching.id });
      expect(r.success).toBe(false);
    }
  });

  it('hides opponent hand in getStateForPlayer', () => {
    const game = new UnoGame();
    game.initialize(['p1', 'p2']);
    const state = game.getStateForPlayer('p1');
    const data = state.data as any;
    expect(data.hands.p1[0].value).not.toBe('?');
    expect(data.hands.p2[0].value).toBe('?');
  });
});

// ====== Dou Dizhu ======

describe('DouDizhuGame', () => {
  it('initializes with correct hand sizes', () => {
    const game = new DouDizhuGame();
    game.initialize(['p1', 'p2', 'p3']);
    const data = game.getState().data as any;
    // Landlord (p1) gets 20 cards (17 + 3 kitty)
    expect(data.hands.p1.length).toBe(20);
    expect(data.hands.p2.length).toBe(17);
    expect(data.hands.p3.length).toBe(17);
    expect(data.kitty.length).toBe(3);
  });

  it('requires exactly 3 players', () => {
    const game = new DouDizhuGame();
    expect(() => game.initialize(['p1', 'p2'])).toThrow('3 players');
  });

  it('allows playing a solo card', () => {
    const game = new DouDizhuGame();
    game.initialize(['p1', 'p2', 'p3']);
    // p1 (landlord) plays first. Play the first card as solo.
    const r = act(game, 'p1', 'play', { cards: [0] });
    expect(r.success).toBe(true);
  });

  it('rejects pass when leading', () => {
    const game = new DouDizhuGame();
    game.initialize(['p1', 'p2', 'p3']);
    const r = act(game, 'p1', 'pass');
    expect(r.success).toBe(false);
    expect(r.error).toContain('leading');
  });
});

// ====== Mahjong ======

describe('MahjongGame', () => {
  it('initializes with 13 tiles per player', () => {
    const game = new MahjongGame();
    game.initialize(['p1', 'p2', 'p3', 'p4']);
    const data = game.getState().data as any;
    expect(data.hands.p1.length).toBe(13);
    expect(data.hands.p2.length).toBe(13);
    expect(data.hands.p3.length).toBe(13);
    expect(data.hands.p4.length).toBe(13);
    expect(data.wall.length).toBe(136 - 52); // 136 total - 13*4 dealt
    expect(data.phase).toBe('draw');
  });

  it('requires exactly 4 players', () => {
    const game = new MahjongGame();
    expect(() => game.initialize(['p1', 'p2'])).toThrow('4 players');
  });

  it('allows drawing a tile', () => {
    const game = new MahjongGame();
    game.initialize(['p1', 'p2', 'p3', 'p4']);
    const r = act(game, 'p1', 'draw');
    expect(r.success).toBe(true);
    const data = game.getState().data as any;
    expect(data.hands.p1.length).toBe(14);
    expect(data.phase).toBe('discard');
  });

  it('allows discarding after drawing', () => {
    const game = new MahjongGame();
    game.initialize(['p1', 'p2', 'p3', 'p4']);
    act(game, 'p1', 'draw');
    const r = act(game, 'p1', 'discard', { tileIndex: 0 });
    expect(r.success).toBe(true);
    const data = game.getState().data as any;
    expect(data.hands.p1.length).toBe(13);
    expect(data.phase).toBe('claim');
    expect(data.lastDiscard).not.toBeNull();
  });

  it('hides opponent hands in getStateForPlayer', () => {
    const game = new MahjongGame();
    game.initialize(['p1', 'p2', 'p3', 'p4']);
    const state = game.getStateForPlayer('p1');
    const data = state.data as any;
    expect(data.hands.p1[0].suit).not.toBe('?');
    expect(data.hands.p2[0].suit).toBe('?');
  });
});
