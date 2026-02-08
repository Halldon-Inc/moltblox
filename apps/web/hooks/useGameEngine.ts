'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { BaseGame } from '@moltblox/game-builder';
import type { GameState, GameAction, GameEvent } from '@moltblox/protocol';

const PLAYER_ID = 'player-1';
const MAX_EVENTS = 50;

export interface GameEngineState {
  state: GameState | null;
  events: GameEvent[];
  isGameOver: boolean;
  winner: string | null;
  scores: Record<string, number>;
  playerId: string;
}

export function useGameEngine(GameClass: new () => BaseGame) {
  const gameRef = useRef<BaseGame | null>(null);
  const [engineState, setEngineState] = useState<GameEngineState>({
    state: null,
    events: [],
    isGameOver: false,
    winner: null,
    scores: {},
    playerId: PLAYER_ID,
  });

  const initGame = useCallback(() => {
    const game = new GameClass();
    game.initialize([PLAYER_ID]);
    gameRef.current = game;

    const state = game.getState();
    setEngineState({
      state,
      events: [],
      isGameOver: false,
      winner: null,
      scores: {},
      playerId: PLAYER_ID,
    });
  }, [GameClass]);

  // Initialize on mount
  useEffect(() => {
    initGame();
  }, [initGame]);

  const dispatch = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    const game = gameRef.current;
    if (!game) return null;

    const action: GameAction = { type, payload, timestamp: Date.now() };
    const result = game.handleAction(PLAYER_ID, action);

    if (result.success) {
      const newEvents = result.events || [];
      const gameOver = game.isGameOver();
      setEngineState((prev) => ({
        state: result.newState || prev.state,
        events:
          newEvents.length > 0 ? [...prev.events, ...newEvents].slice(-MAX_EVENTS) : prev.events,
        isGameOver: gameOver,
        winner: gameOver ? game.getWinner() : null,
        scores: gameOver ? game.getScores() : prev.scores,
        playerId: PLAYER_ID,
      }));
    }

    return result;
  }, []);

  const restart = useCallback(() => {
    initGame();
  }, [initGame]);

  return { ...engineState, dispatch, restart };
}
