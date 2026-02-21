'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';

// ==========================================================================
// FPSRenderer: DOOM-style first-person raycaster (main component)
// Game logic modules live in ./fps/ subdirectory:
//   types.ts      : All TypeScript interfaces
//   constants.ts  : Screen/gameplay constants, sprites, levels, utilities
//   renderer.ts   : Canvas drawing (raycasting, sprites, HUD, overlays)
//   ai.ts         : Enemy AI, consumable usage, particle/timer updates
//   input.ts      : Weapon firing and hit detection
//   networking.ts : WebSocket multiplayer setup and message handling
// ==========================================================================

import type { FPSRendererProps, FPSGameState } from './fps/types';

import {
  SCREEN_W,
  SCREEN_H,
  MOVE_SPEED,
  RUN_MULTIPLIER,
  TURN_SPEED,
  MOUSE_SENSITIVITY,
  PLAYER_RADIUS,
  PICKUP_RADIUS,
  EXIT_RADIUS,
  LEVELS,
  dist,
  spawnParticles,
  buildLevelState,
} from './fps/constants';

import { renderFrame } from './fps/renderer';
import { updateEnemyAI, useConsumable, updateParticlesAndTimers } from './fps/ai';
import { shootWeapon } from './fps/input';
import { connectMultiplayer, sendPositionUpdate } from './fps/networking';

// ==========================================================================
// Component
// ==========================================================================

export default function FPSRenderer({ gameConfig: config }: FPSRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<FPSGameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const zBufferRef = useRef<Float64Array>(new Float64Array(SCREEN_W));
  const pointerLockedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  const [started, setStarted] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Read visual theme config from _config (passed via gameConfig)
  const themeCfg = ((config as Record<string, unknown>)?._config ?? {}) as Record<string, unknown>;
  const fpsTheme = (themeCfg.theme ?? {}) as Record<string, unknown>;
  const themeOverrides = {
    wallColors: fpsTheme.wallColors as Record<number, [number, number, number]> | undefined,
    floorColor: fpsTheme.floorColor as string[] | undefined,
    ceilingColor: fpsTheme.ceilingColor as string[] | undefined,
  };

  // Initialize game
  const initGame = useCallback(
    (levelIndex = 0, carryOver?: FPSGameState) => {
      const glove = (config?.equippedGlove as string) || 'default';
      const carry = carryOver
        ? {
            health: carryOver.playerHealth,
            armor: carryOver.playerArmor,
            weapons: carryOver.weapons,
            score: carryOver.score,
            kills: carryOver.kills,
            secretsFound: carryOver.secretsFound,
            gameTime: carryOver.gameTime,
          }
        : undefined;

      const configOptions = {
        ownedWeapons: (config?.ownedWeapons as string[]) || [],
        secretLevelUnlocked: (config?.secretLevelUnlocked as boolean) || false,
        consumables: (config?.consumables as { type: string; count: number }[]) || [],
        multiplayer: (config?.multiplayer as boolean) || false,
        matchId: (config?.matchId as string) || undefined,
        difficulty: (config?.difficulty as string) || 'normal',
        killsToWin: 10,
      };

      stateRef.current = buildLevelState(levelIndex, carry, glove, configOptions);
      // Attach theme overrides for the renderer
      if (
        stateRef.current &&
        (themeOverrides.wallColors ?? themeOverrides.floorColor ?? themeOverrides.ceilingColor)
      ) {
        stateRef.current.themeOverrides = themeOverrides;
      }
      lastTimeRef.current = 0;

      // Apply marketplace weapon ownership: only allow owned weapons beyond pistol/fist
      if (configOptions.ownedWeapons.length > 0 && stateRef.current) {
        const gs = stateRef.current;
        const weaponSlugMap: Record<string, number> = {
          shotgun: 2,
          chaingun: 3,
          rocket_launcher: 4,
          bfg: 5,
        };
        for (let i = 2; i < gs.weapons.length; i++) {
          // Only mark as owned if in ownedWeapons or found as pickup
          // On init, just mark marketplace-owned weapons
          const slug = Object.keys(weaponSlugMap).find((k) => weaponSlugMap[k] === i);
          if (slug && configOptions.ownedWeapons.includes(slug)) {
            // Weapon is purchasable, mark ownership is available (will be picked up or already owned)
            // Don't auto-own, but allow switching to it if found
          }
        }
      }
    },
    [config],
  );

  // -----------------------------------------------------------------------
  // Multiplayer WebSocket setup
  // -----------------------------------------------------------------------

  const setupMultiplayer = useCallback((gs: FPSGameState) => {
    connectMultiplayer(gs, wsRef, () => {
      const currentGs = stateRef.current;
      if (currentGs) setupMultiplayer(currentGs);
    });
  }, []);

  // -----------------------------------------------------------------------
  // Game loop
  // -----------------------------------------------------------------------

  const gameLoop = useCallback(
    (timestamp: number) => {
      rafRef.current = requestAnimationFrame(gameLoop);

      const gs = stateRef.current;
      if (!gs || !started) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Delta time
      if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      // Pre-generate per-frame random values for deterministic rendering
      // (avoids Math.random() calls inside draw functions)
      const fr = gs.frameRandom;
      fr.length = 20;
      for (let ri = 0; ri < 20; ri++) {
        fr[ri] = Math.random();
      }

      if (gs.gameOver || gs.victory) {
        renderFrame(gs, ctx, zBufferRef.current);
        return;
      }

      // Multiplayer: waiting / countdown / ended states
      if (gs.multiplayerMode && gs.matchStatus !== 'playing') {
        // Still render the scene but don't process movement
        if (gs.matchStatus === 'ended') {
          renderFrame(gs, ctx, zBufferRef.current);
          return;
        }
        renderFrame(gs, ctx, zBufferRef.current);
        return;
      }

      // Level transition
      if (gs.levelTransition) {
        gs.levelTransitionTimer -= dt * 1000;
        if (gs.levelTransitionTimer <= 0) {
          const nextLevel = gs.level + 1;
          // Check if next level is the vault (level 3) and requires unlock
          if (nextLevel === 3 && !gs.secretLevelUnlocked) {
            gs.victory = true;
            gs.levelTransition = false;
          } else if (nextLevel >= LEVELS.length) {
            gs.victory = true;
            gs.levelTransition = false;
          } else {
            initGame(nextLevel, gs);
          }
        }
        renderFrame(gs, ctx, zBufferRef.current);
        return;
      }

      const now = timestamp;
      const keys = keysRef.current;

      // ---- Player movement ----
      // Skip movement if dead in multiplayer (respawn timer)
      if (gs.multiplayerMode && gs.mpRespawnTimer > 0) {
        gs.mpRespawnTimer -= dt * 1000;
        if (gs.mpRespawnTimer <= 0) {
          gs.wsRef?.send(JSON.stringify({ type: 'fps_respawn' }));
        }
        // Update particles and timers, then render
        updateParticlesAndTimers(gs, dt);
        renderFrame(gs, ctx, zBufferRef.current);
        return;
      }

      const running = keys.has('shift') || keys.has('shiftleft') || keys.has('shiftright');
      const speed = MOVE_SPEED * (running ? RUN_MULTIPLIER : 1) * dt;

      const dirX = Math.cos(gs.playerAngle);
      const dirY = Math.sin(gs.playerAngle);
      const perpX = -dirY;
      const perpY = dirX;

      let moveX = 0;
      let moveY = 0;

      if (keys.has('w') || keys.has('arrowup')) {
        moveX += dirX * speed;
        moveY += dirY * speed;
      }
      if (keys.has('s') || keys.has('arrowdown')) {
        moveX -= dirX * speed;
        moveY -= dirY * speed;
      }
      if (keys.has('a')) {
        moveX += perpX * speed;
        moveY += perpY * speed;
      }
      if (keys.has('d')) {
        moveX -= perpX * speed;
        moveY -= perpY * speed;
      }

      // Keyboard turning
      if (keys.has('arrowleft')) {
        gs.playerAngle -= TURN_SPEED * dt;
      }
      if (keys.has('arrowright')) {
        gs.playerAngle += TURN_SPEED * dt;
      }

      // Collision detection with wall sliding
      if (moveX !== 0 || moveY !== 0) {
        const newX = gs.playerX + moveX;
        const newY = gs.playerY + moveY;
        const r = PLAYER_RADIUS;

        const canMoveX =
          gs.map[Math.floor(gs.playerY)][Math.floor(newX + r)] === 0 &&
          gs.map[Math.floor(gs.playerY)][Math.floor(newX - r)] === 0;
        const canMoveY =
          gs.map[Math.floor(newY + r)][Math.floor(gs.playerX)] === 0 &&
          gs.map[Math.floor(newY - r)][Math.floor(gs.playerX)] === 0;
        const canMoveBoth =
          gs.map[Math.floor(newY + r)][Math.floor(newX + r)] === 0 &&
          gs.map[Math.floor(newY - r)][Math.floor(newX - r)] === 0 &&
          gs.map[Math.floor(newY + r)][Math.floor(newX - r)] === 0 &&
          gs.map[Math.floor(newY - r)][Math.floor(newX + r)] === 0;

        if (canMoveX && canMoveY && canMoveBoth) {
          gs.playerX = newX;
          gs.playerY = newY;
        } else if (canMoveX) {
          gs.playerX = newX;
        } else if (canMoveY) {
          gs.playerY = newY;
        }

        // Weapon bob when moving
        gs.weaponBob += dt * 8;
      }

      // Shooting (space or mouse tracked via pointerdown flag)
      if (keys.has(' ') || keys.has('shooting')) {
        shootWeapon(gs, now);
      }

      // Weapon switching (check ownership)
      for (let i = 1; i <= 6; i++) {
        if (keys.has(String(i))) {
          const weaponIdx = i - 1;
          if (gs.weapons[weaponIdx] && gs.weapons[weaponIdx].owned) {
            gs.currentWeapon = weaponIdx;
          }
        }
      }

      // Consumable usage (Q key)
      if (keys.has('q')) {
        keys.delete('q'); // One-shot
        useConsumable(gs);
      }

      // Door interaction (E or F key)
      if (keys.has('e') || keys.has('f')) {
        keys.delete('e');
        keys.delete('f');
        // Check the cell the player is facing, 1 unit ahead
        const checkDist = 1.2;
        const checkX = Math.floor(gs.playerX + dirX * checkDist);
        const checkY = Math.floor(gs.playerY + dirY * checkDist);
        if (
          checkX >= 0 &&
          checkX < gs.mapWidth &&
          checkY >= 0 &&
          checkY < gs.mapHeight &&
          gs.map[checkY][checkX] === 5
        ) {
          // Open the door (remove wall)
          gs.map[checkY][checkX] = 0;
          gs.screenFlash = 'yellow';
          gs.flashTimer = 80;
        }
      }

      // ---- Pickup collection ----
      for (const pickup of gs.pickups) {
        if (pickup.collected) continue;
        if (dist(gs.playerX, gs.playerY, pickup.x, pickup.y) < PICKUP_RADIUS) {
          pickup.collected = true;
          gs.screenFlash = 'yellow';
          gs.flashTimer = 100;

          // Pickup particles
          let pickupColor = '#888888';

          if (pickup.type === 'health') {
            gs.playerHealth = Math.min(gs.playerHealth + pickup.value, 100);
            gs.message = 'PICKED UP HEALTH';
            gs.messageTimer = 2000;
            pickupColor = '#22cc22';
            gs.pickupFlashColor = '#22cc22';
            gs.pickupFlashTimer = 200;
          } else if (pickup.type === 'armor') {
            gs.playerArmor = Math.min(gs.playerArmor + pickup.value, 100);
            gs.message = 'PICKED UP ARMOR';
            gs.messageTimer = 2000;
            pickupColor = '#4488ff';
            gs.pickupFlashColor = '#4488ff';
            gs.pickupFlashTimer = 200;
          } else if (pickup.type.startsWith('ammo_')) {
            const ammoType = pickup.type.replace('ammo_', '');
            for (const w of gs.weapons) {
              if (w.ammoType === ammoType) {
                w.ammo = Math.min(w.ammo + pickup.value, w.maxAmmo);
              }
            }
            gs.message = `PICKED UP ${ammoType.toUpperCase()}`;
            gs.messageTimer = 2000;
            pickupColor = '#ddcc22';
            gs.pickupFlashColor = '#ddcc22';
            gs.pickupFlashTimer = 200;
          } else if (pickup.type.startsWith('weapon_')) {
            const wName = pickup.weaponName || '';
            const idx = gs.weapons.findIndex((w) => w.name === wName);
            if (idx >= 0) {
              gs.weapons[idx].owned = true;
              gs.currentWeapon = idx;
            }
            gs.message = `PICKED UP ${wName.toUpperCase()}`;
            gs.messageTimer = 2000;
            pickupColor = '#00cccc';
            gs.pickupFlashColor = '#00cccc';
            gs.pickupFlashTimer = 200;
          }

          // Spawn pickup particles
          spawnParticles(gs.particles, SCREEN_W / 2, SCREEN_H * 0.6, 6, pickupColor, 4, 400, 2);

          gs.score += 10;
        }
      }

      // ---- Secret areas ----
      for (const secret of gs.secrets) {
        if (secret.found) continue;
        if (dist(gs.playerX, gs.playerY, secret.x, secret.y) < PICKUP_RADIUS) {
          secret.found = true;
          gs.secretsFound++;
          gs.message = 'SECRET AREA FOUND!';
          gs.messageTimer = 3000;
          gs.score += 200;
        }
      }

      // ---- Level exit (single-player only) ----
      if (!gs.multiplayerMode) {
        if (dist(gs.playerX, gs.playerY, gs.exitX, gs.exitY) < EXIT_RADIUS) {
          gs.levelTransition = true;
          gs.levelTransitionTimer = 2000;
          gs.message = 'LEVEL COMPLETE!';
          gs.messageTimer = 2000;
        }
      }

      // ---- Enemy AI (single-player and multiplayer PvE) ----
      updateEnemyAI(gs, now);

      // ---- Multiplayer: Send position updates at 20Hz ----
      sendPositionUpdate(gs, now);

      // ---- Update particles and timers ----
      updateParticlesAndTimers(gs, dt);

      // ---- Render ----
      renderFrame(gs, ctx, zBufferRef.current);
    },
    [started, initGame],
  );

  // -----------------------------------------------------------------------
  // Input event handlers
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!started) return;

    const keys = keysRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (
        [
          'w',
          'a',
          's',
          'd',
          ' ',
          'q',
          'r',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
          'shift',
          'e',
          '1',
          '2',
          '3',
          '4',
          '5',
          '6',
        ].includes(k)
      ) {
        e.preventDefault();
        keys.add(k);
      }

      // Multiplayer: R for ready
      if (
        k === 'r' &&
        stateRef.current?.multiplayerMode &&
        stateRef.current?.matchStatus === 'waiting'
      ) {
        stateRef.current.mpReady = true;
        stateRef.current.wsRef?.send(JSON.stringify({ type: 'fps_ready' }));
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.delete(k);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!pointerLockedRef.current) return;
      const gs = stateRef.current;
      if (!gs) return;
      gs.playerAngle += e.movementX * MOUSE_SENSITIVITY;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        const gs = stateRef.current;
        if (!gs) return;

        // Handle restart on game over / victory
        if (gs.gameOver || gs.victory) {
          initGame(0);
          return;
        }

        keys.add('shooting');
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        keys.delete('shooting');
      }
    };

    const onPointerLockChange = () => {
      pointerLockedRef.current = document.pointerLockElement === canvasRef.current;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }, [started, initGame]);

  // -----------------------------------------------------------------------
  // Start animation loop
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!started) return;
    initGame(0);
    rafRef.current = requestAnimationFrame(gameLoop);

    // Setup multiplayer if needed
    const gs = stateRef.current;
    if (gs && gs.multiplayerMode) {
      setupMultiplayer(gs);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      // Clean up WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [started, gameLoop, initGame, setupMultiplayer]);

  // -----------------------------------------------------------------------
  // Canvas click handler (pointer lock + start)
  // -----------------------------------------------------------------------

  const handleCanvasClick = useCallback(() => {
    if (!started) {
      setStarted(true);
      setShowControls(false);
    }
    const canvas = canvasRef.current;
    if (canvas && !pointerLockedRef.current) {
      canvas.requestPointerLock();
    }
  }, [started]);

  // -----------------------------------------------------------------------
  // JSX
  // -----------------------------------------------------------------------

  const isMultiplayer = (config?.multiplayer as boolean) || false;

  return (
    <div className="flex flex-col items-center gap-4">
      <div style={{ width: '100%', maxWidth: SCREEN_W, margin: '0 auto', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={SCREEN_W}
          height={SCREEN_H}
          onClick={handleCanvasClick}
          className="rounded-lg border border-white/10 bg-black cursor-crosshair"
          style={{ width: '100%', height: 'auto', imageRendering: 'pixelated' }}
          tabIndex={0}
          aria-label="FPS game canvas"
        />

        {/* Click to Start overlay */}
        {!started && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.85)',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
            onClick={handleCanvasClick}
          >
            <div
              style={{
                color: '#FF4444',
                fontSize: '48px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                marginBottom: '16px',
              }}
            >
              MOLTBLOX FPS
            </div>
            <div
              style={{
                color: '#FFD700',
                fontSize: '20px',
                fontFamily: 'monospace',
                marginBottom: '8px',
              }}
            >
              {isMultiplayer ? 'DEATHMATCH MODE' : 'Click to Start'}
            </div>
            {isMultiplayer && (
              <div
                style={{
                  color: '#ff8844',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  marginBottom: '24px',
                }}
              >
                Match ID: {(config?.matchId as string) || 'pending'}
              </div>
            )}
            {showControls && (
              <div
                style={{
                  color: '#aaa',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  lineHeight: '1.8',
                }}
              >
                <div>WASD: Move | Mouse: Look | Click: Shoot</div>
                <div>1-6: Switch Weapon | Shift: Run | Space: Shoot</div>
                <div>E: Open Door | Q: Use Consumable | Arrow Keys: Turn</div>
                {isMultiplayer && <div>R: Ready Up</div>}
              </div>
            )}

            {/* Secret level lock indicator */}
            {!isMultiplayer && config?.secretLevelUnlocked === false && (
              <div
                style={{
                  color: '#666',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  marginTop: '16px',
                }}
              >
                Level 4 (The Vault) requires The Vault Access Key
              </div>
            )}
          </div>
        )}
      </div>

      {started && (
        <div className="flex gap-6 text-xs text-white/50">
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 font-mono text-[10px]">
              WASD
            </kbd>{' '}
            Move
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 font-mono text-[10px]">
              Mouse
            </kbd>{' '}
            Look
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 font-mono text-[10px]">
              Click
            </kbd>{' '}
            Shoot
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 font-mono text-[10px]">
              1-6
            </kbd>{' '}
            Weapons
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 font-mono text-[10px]">
              Shift
            </kbd>{' '}
            Run
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 font-mono text-[10px]">
              E
            </kbd>{' '}
            Door
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 font-mono text-[10px]">
              Q
            </kbd>{' '}
            Item
          </span>
        </div>
      )}
    </div>
  );
}
