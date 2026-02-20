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
  BrawlerGame,
  WrestlerGame,
  HackAndSlashGame,
  MartialArtsGame,
  TagTeamGame,
  BossBattleGame,
  SumoGame,
  StreetFighterGame,
  BeatEmUpRPGGame,
  WeaponsDuelGame,
  FPSGame,
} from '@moltblox/game-builder';

// Ported game collections (namespace imports to avoid name collisions)
import * as OpenSpiel from '@moltblox/game-builder/ports/openspiel';
import * as Tatham from '@moltblox/game-builder/ports/tatham';
import * as BoardGameIO from '@moltblox/game-builder/ports/boardgameio';
import * as RLCard from '@moltblox/game-builder/ports/rlcard';
import * as FreeBoard from '@moltblox/game-builder/ports/freeboardgames';
import * as Solitairey from '@moltblox/game-builder/ports/solitairey';
import * as ChessVariants from '@moltblox/game-builder/ports/chessvariants';
import * as CardGames from '@moltblox/game-builder/ports/cardgames';
import * as MiniGames from '@moltblox/game-builder/ports/minigames';
import * as WordGames from '@moltblox/game-builder/ports/wordgames';
import * as IdleGames from '@moltblox/game-builder/ports/idlegames';

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

  // FPS template
  fps: FPSGame,

  // Beat-em-up templates (10)
  brawler: BrawlerGame,
  wrestler: WrestlerGame,
  'hack-and-slash': HackAndSlashGame,
  'martial-arts': MartialArtsGame,
  'tag-team': TagTeamGame,
  'boss-battle': BossBattleGame,
  sumo: SumoGame,
  'street-fighter': StreetFighterGame,
  'beat-em-up-rpg': BeatEmUpRPGGame,
  'weapons-duel': WeaponsDuelGame,

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

  // FreeBoardGames.org ports (20)
  'fbg-reversi': FreeBoard.ReversiGame,
  'fbg-coup': FreeBoard.CoupGame,
  'fbg-love-letter': FreeBoard.LoveletterGame,
  'fbg-skull': FreeBoard.SkullGame,
  'fbg-resistance': FreeBoard.ResistanceGame,
  'fbg-ludo': FreeBoard.LudoGame,
  'fbg-snakes-and-ladders': FreeBoard.SnakesAndLaddersGame,
  'fbg-parcheesi': FreeBoard.ParcheesiGame,
  'fbg-sorry': FreeBoard.SorryGame,
  'fbg-chinese-checkers': FreeBoard.ChineseCheckersGame,
  'fbg-sushi-go': FreeBoard.SushiGoGame,
  'fbg-set': FreeBoard.SetGame,
  'fbg-president': FreeBoard.PresidentGame,
  'fbg-hive': FreeBoard.HiveGame,
  'fbg-blokus': FreeBoard.BlokusGame,
  'fbg-patchwork': FreeBoard.PatchworkGame,
  'fbg-quarto': FreeBoard.QuartoGame,
  'fbg-tsu': FreeBoard.TsuGame,
  'fbg-werewolf': FreeBoard.WerewolfGame,
  'fbg-mafia': FreeBoard.MafiaGame,

  // Chess variant ports (20)
  'cv-crazyhouse': ChessVariants.CrazyhouseGame,
  'cv-atomic': ChessVariants.AtomicChessGame,
  'cv-racing-kings': ChessVariants.RacingKingsGame,
  'cv-antichess': ChessVariants.AntichessGame,
  'cv-horde': ChessVariants.HordeGame,
  'cv-king-of-the-hill': ChessVariants.KingOfTheHillGame,
  'cv-three-check': ChessVariants.ThreeCheckGame,
  'cv-chess960': ChessVariants.Chess960Game,
  'cv-fog-of-war': ChessVariants.FogOfWarChessGame,
  'cv-capablanca': ChessVariants.CapablancaChessGame,
  'cv-shogi': ChessVariants.ShogiGame,
  'cv-xiangqi': ChessVariants.XiangqiGame,
  'cv-janggi': ChessVariants.JanggiGame,
  'cv-makruk': ChessVariants.MakrukGame,
  'cv-losers': ChessVariants.LosersChessGame,
  'cv-giveaway': ChessVariants.GiveawayChessGame,
  'cv-bughouse': ChessVariants.BughouseGame,
  'cv-grid-chess': ChessVariants.GridChessGame,
  'cv-cylinder': ChessVariants.CylinderChessGame,
  'cv-alice': ChessVariants.AliceChessGame,

  // Mini-games ports (30)
  'mg-snake': MiniGames.SnakeGame,
  'mg-tetris': MiniGames.TetrisGame,
  'mg-breakout': MiniGames.BreakoutGame,
  'mg-pong': MiniGames.PongGame,
  'mg-pipe-connect': MiniGames.PipeConnectGame,
  'mg-tower-stack': MiniGames.TowerStackGame,
  'mg-color-flood': MiniGames.ColorFloodGame,
  'mg-light-out': MiniGames.LightOutGame,
  'mg-minesweeper': MiniGames.MinesweeperClassicGame,
  'mg-sokoban': MiniGames.SokobanGame,
  'mg-connect-dots': MiniGames.ConnectDotsGame,
  'mg-simon': MiniGames.SimonClassicGame,
  'mg-flappy': MiniGames.FlappyGame,
  'mg-asteroids': MiniGames.AsteroidsGame,
  'mg-pac-man': MiniGames.PacManGame,
  'mg-nonogram': MiniGames.NonogramGame,
  'mg-kakuro': MiniGames.KakuroGame,
  'mg-futoshiki': MiniGames.FutoshikiGame,
  'mg-hashi': MiniGames.HashiGame,
  'mg-nurikabe': MiniGames.NurikabeGame,
  'mg-kenken': MiniGames.KenKenGame,
  'mg-calcudoku': MiniGames.CalcudokuGame,
  'mg-math24': MiniGames.Math24Game,
  'mg-mahjong-solitaire': MiniGames.MahjongSolitaireGame,
  'mg-shanghai': MiniGames.ShanghaiGame,
  'mg-trivia': MiniGames.TriviaGame,
  'mg-dots': MiniGames.DotsGame,
  'mg-sprouts': MiniGames.SproutsGame,
  'mg-qwirkle': MiniGames.QwirkleGame,
  'mg-tsuro': MiniGames.TsuroGame,

  // Word game ports (10)
  'wg-wordle': WordGames.WordleGame,
  'wg-hangman': WordGames.HangmanGame,
  'wg-anagram': WordGames.AnagramGame,
  'wg-word-search': WordGames.WordSearchGame,
  'wg-boggle': WordGames.BoggleGame,
  'wg-scrabble': WordGames.ScrabbleGame,
  'wg-crossword': WordGames.CrosswordGame,
  'wg-codeword': WordGames.CodewordGame,
  'wg-spelling-bee': WordGames.SpellingBeeGame,
  'wg-typing-race': WordGames.TypingRaceGame,

  // Solitairey ports (13)
  'sol-klondike': Solitairey.KlondikeGame,
  'sol-spider': Solitairey.SpiderGame,
  'sol-freecell': Solitairey.FreeCellGame,
  'sol-pyramid': Solitairey.PyramidGame,
  'sol-golf': Solitairey.GolfGame,
  'sol-tri-peaks': Solitairey.TriPeaksGame,
  'sol-yukon': Solitairey.YukonGame,
  'sol-canfield': Solitairey.CanfieldGame,
  'sol-bakers-dozen': Solitairey.BakersDozenGame,
  'sol-scorpion': Solitairey.ScorpionGame,
  'sol-forty-thieves': Solitairey.FortyThievesGame,
  'sol-grandfathers-clock': Solitairey.GrandfathersClockGame,
  'sol-monte-carlo': Solitairey.MonteCarloGame,
  'sol-osmosis': Solitairey.OsmosisGame,

  // Card game ports (13)
  'cg-cribbage': CardGames.CribbageGame,
  'cg-pinochle': CardGames.PinochleGame,
  'cg-canasta': CardGames.CanastaGame,
  'cg-whist': CardGames.WhistGame,
  'cg-oh-hell': CardGames.OhHellGame,
  'cg-president': CardGames.PresidentGame,
  'cg-durak': CardGames.DurakGame,
  'cg-rummy': CardGames.RummyGame,
  'cg-euchre': CardGames.EuchreGame,
  'cg-skat': CardGames.SkatGame,
  'cg-pit': CardGames.PitGame,
  'cg-spades-classic': CardGames.SpadesClassicGame,
  'cg-canasta-classic': CardGames.CanastaClassicGame,

  // Idle/incremental game ports (19)
  'ig-cookie-clicker': IdleGames.CookieClickerGame,
  'ig-antimatter': IdleGames.AntimatterGame,
  'ig-miner': IdleGames.MinerGame,
  'ig-factory': IdleGames.FactoryIdleGame,
  'ig-reactor': IdleGames.ReactorGame,
  'ig-swarm': IdleGames.SwarmGame,
  'ig-paperclip': IdleGames.PaperclipGame,
  'ig-dark-room': IdleGames.DarkRoomGame,
  'ig-evolve': IdleGames.EvolveGame,
  'ig-kittens': IdleGames.KittensGame,
  'ig-mine-defense': IdleGames.MineDefenseGame,
  'ig-idle-miner': IdleGames.IdleMinerGame,
  'ig-evolution': IdleGames.EvolutionIdleGame,
  'ig-space': IdleGames.SpaceIdleGame,
  'ig-farm': IdleGames.FarmIdleGame,
  'ig-dungeon': IdleGames.DungeonIdleGame,
  'ig-alchemy': IdleGames.AlchemyIdleGame,
  'ig-city-builder': IdleGames.CityBuilderIdleGame,
  'ig-number': IdleGames.NumberIdleGame,
  'ig-exponential': IdleGames.ExponentialGame,
  'ig-trimps': IdleGames.TrimpsGame,
  'ig-progress-quest': IdleGames.ProgressQuestGame,
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
