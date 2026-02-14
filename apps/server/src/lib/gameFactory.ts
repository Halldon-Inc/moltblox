/**
 * Game Factory
 *
 * Maps templateSlug values to BaseGame subclass constructors.
 * Used by REST play endpoints to instantiate server-side game logic.
 */

import type { BaseGame } from '@moltblox/game-builder';
import {
  ClickerGame,
  PuzzleGame,
  CreatureRPGGame,
  RPGGame,
  RhythmGame,
  PlatformerGame,
  SideBattlerGame,
  StateMachineGame,
  FighterGame,
  TowerDefenseGame,
  CardBattlerGame,
  RoguelikeGame,
  SurvivalGame,
  GraphStrategyGame,
} from '@moltblox/game-builder';

// Ported game collections (namespace imports to avoid name collisions)
import * as OpenSpiel from '@moltblox/game-builder/ports/openspiel';
import * as Tatham from '@moltblox/game-builder/ports/tatham';
import * as BoardGameIO from '@moltblox/game-builder/ports/boardgameio';
import * as RLCard from '@moltblox/game-builder/ports/rlcard';

type GameConstructor = new (config?: Record<string, unknown>) => BaseGame;

const TEMPLATE_REGISTRY: Record<string, GameConstructor> = {
  // Hand-coded templates
  clicker: ClickerGame,
  puzzle: PuzzleGame,
  'creature-rpg': CreatureRPGGame,
  rpg: RPGGame,
  rhythm: RhythmGame,
  platformer: PlatformerGame,
  'side-battler': SideBattlerGame,
  'state-machine': StateMachineGame,
  fighter: FighterGame,
  'tower-defense': TowerDefenseGame,
  'card-battler': CardBattlerGame,
  roguelike: RoguelikeGame,
  survival: SurvivalGame,
  'graph-strategy': GraphStrategyGame,

  // OpenSpiel ports: board games
  'os-tic-tac-toe': OpenSpiel.TicTacToeGame,
  'os-connect-four': OpenSpiel.ConnectFourGame,
  'os-checkers': OpenSpiel.CheckersGame,
  'os-chess': OpenSpiel.ChessGame,
  'os-go': OpenSpiel.GoGame,
  'os-othello': OpenSpiel.OthelloGame,
  'os-mancala': OpenSpiel.MancalaGame,
  'os-hex': OpenSpiel.HexGame,
  'os-nim': OpenSpiel.NimGame,
  'os-dots-and-boxes': OpenSpiel.DotsAndBoxesGame,
  'os-breakthrough': OpenSpiel.BreakthroughGame,
  'os-quoridor': OpenSpiel.QuoridorGame,
  'os-pentago': OpenSpiel.PentagoGame,
  'os-amazons': OpenSpiel.AmazonsGame,
  'os-backgammon': OpenSpiel.BackgammonGame,
  'os-clobber': OpenSpiel.ClobberGame,
  'os-domineering': OpenSpiel.DomineeringGame,
  // OpenSpiel ports: card games
  'os-blackjack': OpenSpiel.BlackjackGame,
  'os-poker': OpenSpiel.PokerGame,
  'os-go-fish': OpenSpiel.GoFishGame,
  'os-crazy-eights': OpenSpiel.CrazyEightsGame,
  'os-war': OpenSpiel.WarGame,
  'os-gin-rummy': OpenSpiel.GinRummyGame,
  'os-hearts': OpenSpiel.HeartsGame,
  'os-spades': OpenSpiel.SpadesGame,
  'os-uno': OpenSpiel.UnoGame,
  // OpenSpiel ports: strategy / abstract
  'os-2048': OpenSpiel.TwentyFortyEightGame,
  'os-battleship': OpenSpiel.BattleshipGame,
  'os-liars-dice': OpenSpiel.LiarsDiceGame,
  'os-hanabi': OpenSpiel.HanabiGame,
  // OpenSpiel ports: additional games
  'os-goofspiel': OpenSpiel.GoofspielGame,
  'os-oware': OpenSpiel.OwareGame,
  'os-phantom-ttt': OpenSpiel.PhantomTicTacToeGame,
  'os-dark-chess': OpenSpiel.DarkChessGame,
  'os-catch': OpenSpiel.CatchGame,
  'os-pig': OpenSpiel.PigGame,
  'os-memory': OpenSpiel.MemoryGame,
  'os-sudoku': OpenSpiel.SudokuGame,
  'os-minesweeper': OpenSpiel.MinesweeperGame,
  'os-simon': OpenSpiel.SimonGame,
  'os-slide-puzzle': OpenSpiel.SlidePuzzleGame,
  'os-towers-of-hanoi': OpenSpiel.TowersOfHanoiGame,
  'os-knights-tour': OpenSpiel.KnightsTourGame,
  'os-eight-queens': OpenSpiel.EightQueensGame,
  'os-mastermind': OpenSpiel.MastermindGame,
  'os-bridge': OpenSpiel.BridgeGame,
  'os-euchre': OpenSpiel.EuchreGame,
  'os-old-maid': OpenSpiel.OldMaidGame,
  'os-snap': OpenSpiel.SnapGame,
  'os-rummy': OpenSpiel.RummyGame,

  // Tatham puzzle ports: grid logic
  'tp-mines': Tatham.MinesGame,
  'tp-sudoku': Tatham.SudokuGame,
  'tp-fifteen': Tatham.FifteenGame,
  'tp-flip': Tatham.FlipGame,
  'tp-flood': Tatham.FloodGame,
  'tp-light-up': Tatham.LightUpGame,
  'tp-magnets': Tatham.MagnetsGame,
  'tp-map': Tatham.MapGame,
  'tp-mosaic': Tatham.MosaicGame,
  'tp-net': Tatham.NetGame,
  'tp-netslide': Tatham.NetslideGame,
  'tp-palisade': Tatham.PalisadeGame,
  'tp-pattern': Tatham.PatternGame,
  'tp-sixteen': Tatham.SixteenGame,
  'tp-slant': Tatham.SlantGame,
  'tp-unruly': Tatham.UnrulyGame,
  // Tatham puzzle ports: constraint puzzles
  'tp-bridges': Tatham.BridgesGame,
  'tp-dominosa': Tatham.DominosaGame,
  'tp-filling': Tatham.FillingGame,
  'tp-galaxies': Tatham.GalaxiesGame,
  'tp-keen': Tatham.KeenGame,
  'tp-loopy': Tatham.LoopyGame,
  'tp-pearl': Tatham.PearlGame,
  'tp-range': Tatham.RangeGame,
  'tp-rectangles': Tatham.RectanglesGame,
  'tp-signpost': Tatham.SignpostGame,
  'tp-singles': Tatham.SinglesGame,
  'tp-tents': Tatham.TentsGame,
  'tp-towers': Tatham.TowersGame,
  'tp-train-tracks': Tatham.TrainTracksGame,
  'tp-unequal': Tatham.UnequalGame,
  // Tatham puzzle ports: movement and spatial
  'tp-inertia': Tatham.InertiaGame,
  'tp-pegs': Tatham.PegsGame,
  'tp-twiddle': Tatham.TwiddleGame,
  'tp-untangle': Tatham.UntangleGame,
  'tp-cube': Tatham.CubeGame,
  'tp-guess': Tatham.GuessGame,
  'tp-same-game': Tatham.SameGameGame,
  'tp-undecided': Tatham.UndecidedGame,
  'tp-black-box': Tatham.BlackBoxGame,

  // boardgame.io ports
  'bgio-nine-mens-morris': BoardGameIO.NineMensMorrisGame,
  'bgio-tablut': BoardGameIO.TablutGame,
  'bgio-tak': BoardGameIO.TakGame,
  'bgio-azul': BoardGameIO.AzulGame,
  'bgio-splendor': BoardGameIO.SplendorGame,
  'bgio-carcassonne': BoardGameIO.CarcassonneGame,
  'bgio-seabattle': BoardGameIO.SeabattleGame,
  'bgio-gomoku': BoardGameIO.GomokuGame,
  'bgio-onitama': BoardGameIO.OnitamaGame,
  'bgio-pandemic': BoardGameIO.PandemicGame,

  // RLCard ports
  'rlcard-leduc-holdem': RLCard.LeducHoldemGame,
  'rlcard-texas-holdem': RLCard.TexasHoldemGame,
  'rlcard-uno': RLCard.UnoGame,
  'rlcard-dou-dizhu': RLCard.DouDizhuGame,
  'rlcard-mahjong': RLCard.MahjongGame,
};

/**
 * Create a fresh (uninitialized) game instance for the given template slug.
 * Returns null if the slug is not a known template.
 * Optionally pass a config object to customize the game.
 */
export function createGameInstance(
  templateSlug: string,
  config?: Record<string, unknown>,
): BaseGame | null {
  const Constructor = TEMPLATE_REGISTRY[templateSlug];
  if (!Constructor) return null;
  return new Constructor(config);
}
