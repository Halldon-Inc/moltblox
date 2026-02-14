import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

// Cards: 1=Guard(5), 2=Priest(2), 3=Baron(2), 4=Handmaid(2),
//        5=Prince(2), 6=King(1), 7=Countess(1), 8=Princess(1)
const DECK_COMPOSITION = [1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8];

interface LoveletterPlayerState {
  hand: number[];
  alive: boolean;
  protected: boolean;
  discarded: number[];
  tokens: number;
}

interface LoveletterState {
  [key: string]: unknown;
  players: Record<string, LoveletterPlayerState>;
  deck: number[];
  setAside: number;
  currentPlayer: number;
  winner: string | null;
  gameEnded: boolean;
  roundOver: boolean;
  tokensToWin: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class LoveletterGame extends BaseGame {
  readonly name = 'Love Letter';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  private startNewRound(data: LoveletterState, playerIds: string[]): void {
    data.deck = shuffle([...DECK_COMPOSITION]);
    data.setAside = data.deck.pop()!;
    for (const pid of playerIds) {
      data.players[pid].hand = [data.deck.pop()!];
      data.players[pid].alive = true;
      data.players[pid].protected = false;
      data.players[pid].discarded = [];
    }
    data.roundOver = false;
  }

  protected initializeState(playerIds: string[]): LoveletterState {
    const tokensMap: Record<number, number> = { 2: 7, 3: 5, 4: 4 };
    const tokensToWin = tokensMap[playerIds.length] || 4;

    const players: Record<string, LoveletterPlayerState> = {};
    for (const pid of playerIds) {
      players[pid] = { hand: [], alive: true, protected: false, discarded: [], tokens: 0 };
    }

    const data: LoveletterState = {
      players,
      deck: [],
      setAside: 0,
      currentPlayer: 0,
      winner: null,
      gameEnded: false,
      roundOver: false,
      tokensToWin,
    };

    this.startNewRound(data, playerIds);
    return data;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<LoveletterState>();
    const allPlayers = this.getPlayers();
    const alivePlayers = allPlayers.filter((p) => data.players[p].alive);

    if (data.roundOver) {
      // Auto start new round
      this.startNewRound(data, allPlayers);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    const currentId = alivePlayers[data.currentPlayer % alivePlayers.length];
    if (playerId !== currentId) {
      return { success: false, error: 'Not your turn' };
    }

    if (action.type !== 'play') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const ps = data.players[playerId];
    ps.protected = false;

    // Draw a card
    if (data.deck.length > 0) {
      ps.hand.push(data.deck.pop()!);
    }

    const cardValue = Number(action.payload.card);
    const cardIdx = ps.hand.indexOf(cardValue);
    if (cardIdx === -1) {
      return { success: false, error: 'Card not in hand' };
    }

    // Countess rule: must play countess if holding King or Prince
    if (cardValue !== 7 && ps.hand.includes(7)) {
      const other = ps.hand.find((c) => c !== 7);
      if (other === 6 || other === 5) {
        return { success: false, error: 'Must play Countess when holding King or Prince' };
      }
    }

    ps.hand.splice(cardIdx, 1);
    ps.discarded.push(cardValue);

    const target = action.payload.target as string | undefined;
    const guess = Number(action.payload.guess || 0);

    switch (cardValue) {
      case 1: {
        // Guard: guess opponent's card
        if (
          target &&
          data.players[target]?.alive &&
          !data.players[target].protected &&
          target !== playerId
        ) {
          if (guess >= 2 && guess <= 8 && data.players[target].hand[0] === guess) {
            data.players[target].alive = false;
            this.emitEvent('eliminated', target, { by: playerId, card: 'Guard' });
          }
        }
        break;
      }
      case 2: {
        // Priest: see opponent's hand (info event)
        if (target && data.players[target]?.alive && !data.players[target].protected) {
          this.emitEvent('priest_reveal', playerId, { target, card: data.players[target].hand[0] });
        }
        break;
      }
      case 3: {
        // Baron: compare hands
        if (
          target &&
          data.players[target]?.alive &&
          !data.players[target].protected &&
          target !== playerId
        ) {
          const myVal = ps.hand[0] || 0;
          const theirVal = data.players[target].hand[0] || 0;
          if (myVal > theirVal) {
            data.players[target].alive = false;
          } else if (theirVal > myVal) {
            ps.alive = false;
          }
        }
        break;
      }
      case 4: {
        // Handmaid: protection
        ps.protected = true;
        break;
      }
      case 5: {
        // Prince: target discards and draws
        const princeTarget = target && data.players[target]?.alive ? target : playerId;
        const tps = data.players[princeTarget];
        if (!tps.protected || princeTarget === playerId) {
          const discarded = tps.hand.pop();
          if (discarded !== undefined) {
            tps.discarded.push(discarded);
            if (discarded === 8) {
              tps.alive = false;
            } else if (data.deck.length > 0) {
              tps.hand.push(data.deck.pop()!);
            } else {
              tps.hand.push(data.setAside);
            }
          }
        }
        break;
      }
      case 6: {
        // King: swap hands
        if (
          target &&
          data.players[target]?.alive &&
          !data.players[target].protected &&
          target !== playerId
        ) {
          const temp = ps.hand;
          ps.hand = data.players[target].hand;
          data.players[target].hand = temp;
        }
        break;
      }
      case 7: {
        // Countess: no effect
        break;
      }
      case 8: {
        // Princess: eliminated if played
        ps.alive = false;
        break;
      }
    }

    // Check round over
    const stillAlive = allPlayers.filter((p) => data.players[p].alive);
    if (stillAlive.length <= 1 || data.deck.length === 0) {
      data.roundOver = true;
      // Determine round winner: highest card among alive
      let bestCard = -1;
      let roundWinner: string | null = null;
      for (const p of stillAlive) {
        const val = data.players[p].hand[0] || 0;
        if (val > bestCard) {
          bestCard = val;
          roundWinner = p;
        }
      }
      if (roundWinner) {
        data.players[roundWinner].tokens++;
        if (data.players[roundWinner].tokens >= data.tokensToWin) {
          data.gameEnded = true;
          data.winner = roundWinner;
        }
      }
    } else {
      // Advance turn among alive players
      const aliveNow = allPlayers.filter((p) => data.players[p].alive);
      const curIdx = aliveNow.indexOf(playerId);
      data.currentPlayer = (curIdx + 1) % aliveNow.length;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<LoveletterState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<LoveletterState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<LoveletterState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      scores[p] = data.players[p].tokens * 10;
    }
    return scores;
  }
}
