// ==========================================================================
// FPS Renderer: Type definitions
// ==========================================================================

export interface FPSRendererProps {
  gameName?: string;
  gameConfig?: Record<string, unknown>;
}

// --------------------------------------------------------------------------
// Particle system types
// --------------------------------------------------------------------------

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// --------------------------------------------------------------------------
// Kill feed types
// --------------------------------------------------------------------------

export interface KillFeedEntry {
  text: string;
  time: number;
  color: string;
}

// --------------------------------------------------------------------------
// Consumable types
// --------------------------------------------------------------------------

export interface ConsumableState {
  type: string;
  count: number;
}

// --------------------------------------------------------------------------
// Multiplayer types
// --------------------------------------------------------------------------

export interface RemotePlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  health: number;
  weaponIndex: number;
  alive: boolean;
  prevX: number;
  prevY: number;
  prevAngle: number;
  lastUpdate: number;
}

// --------------------------------------------------------------------------
// Weapon definitions
// --------------------------------------------------------------------------

export interface WeaponDef {
  name: string;
  damage: number;
  fireRate: number; // ms between shots
  range: number;
  ammoType: string | null; // null = unlimited
  ammoPerShot: number;
  startAmmo: number;
  maxAmmo: number;
  spread: number; // radians, 0 = perfect accuracy
}

// --------------------------------------------------------------------------
// Enemy type definitions
// --------------------------------------------------------------------------

export interface EnemyTypeDef {
  health: number;
  damage: number;
  speed: number; // units per second
  attackRange: number;
  attackRate: number; // ms between attacks
  score: number;
  color: [number, number, number];
  width: number; // sprite scale multiplier
  height: number;
}

// --------------------------------------------------------------------------
// Level data
// --------------------------------------------------------------------------

export interface LevelDef {
  name: string;
  map: number[][];
  playerStart: [number, number];
  playerAngle: number;
  exitPos: [number, number];
  enemies: { type: string; x: number; y: number }[];
  pickups: { type: string; x: number; y: number; value: number; weaponName?: string }[];
  secrets: { x: number; y: number }[];
}

// --------------------------------------------------------------------------
// Mutable game state
// --------------------------------------------------------------------------

export interface EnemyState {
  id: number;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  type: string;
  state: 'idle' | 'alert' | 'chasing' | 'attacking' | 'dead';
  alive: boolean;
  lastAttack: number;
  alertTimer: number;
  lostSightTimer: number;
}

export interface PickupState {
  id: number;
  x: number;
  y: number;
  type: string;
  value: number;
  collected: boolean;
  weaponName?: string;
}

export interface SecretState {
  x: number;
  y: number;
  found: boolean;
}

export interface WeaponState {
  name: string;
  owned: boolean;
  ammo: number;
  maxAmmo: number;
  damage: number;
  fireRate: number;
  ammoType: string | null;
  ammoPerShot: number;
  range: number;
  spread: number;
}

export interface FPSGameState {
  playerX: number;
  playerY: number;
  playerAngle: number;
  playerHealth: number;
  playerArmor: number;
  weapons: WeaponState[];
  currentWeapon: number;
  enemies: EnemyState[];
  pickups: PickupState[];
  map: number[][];
  mapWidth: number;
  mapHeight: number;
  level: number;
  exitX: number;
  exitY: number;
  secrets: SecretState[];
  score: number;
  kills: number;
  secretsFound: number;
  totalSecrets: number;
  gameTime: number;
  message: string | null;
  messageTimer: number;
  screenFlash: string | null;
  flashTimer: number;
  weaponBob: number;
  weaponRecoil: number;
  lastShotTime: number;
  gameOver: boolean;
  victory: boolean;
  levelTransition: boolean;
  levelTransitionTimer: number;
  gloveColor: string;
  lastEnemyAIUpdate: number;
  // Particle system
  particles: Particle[];
  // Kill feed
  killFeed: KillFeedEntry[];
  // Screen shake
  shakeTimer: number;
  shakeIntensity: number;
  // Damage vignette
  damageVignetteTimer: number;
  // Pickup flash
  pickupFlashColor: string | null;
  pickupFlashTimer: number;
  // Consumables
  consumables: ConsumableState[];
  damageBoostTimer: number;
  invincibilityTimer: number;
  extraLives: number;
  // Multiplayer state
  multiplayerMode: boolean;
  matchId: string | null;
  matchStatus: 'connecting' | 'waiting' | 'countdown' | 'playing' | 'ended';
  countdownSeconds: number;
  wsRef: WebSocket | null;
  remotePlayers: Map<string, RemotePlayer>;
  localPlayerId: string;
  matchScores: Record<string, { kills: number; deaths: number; name: string }>;
  killsToWin: number;
  lastNetworkUpdate: number;
  mpWaitingPlayers: number;
  mpMaxPlayers: number;
  mpReady: boolean;
  mpWinnerId: string | null;
  mpKilledBy: string | null;
  mpRespawnTimer: number;
  mpMatchDuration: number;
  // Weapon ownership from marketplace
  ownedWeapons: string[];
  secretLevelUnlocked: boolean;
  // Max available level (3 base + optional vault)
  maxLevel: number;
  // Per-frame random values for deterministic rendering
  frameRandom: number[];
}
