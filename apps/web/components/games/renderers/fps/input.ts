// ==========================================================================
// FPS Renderer: Shooting logic (weapon firing, hit detection)
// ==========================================================================

import type { FPSGameState, EnemyState, RemotePlayer } from './types';
import { SCREEN_W, SCREEN_H, ENEMY_TYPES, hasLineOfSight, spawnParticles } from './constants';

// --------------------------------------------------------------------------
// Shoot current weapon (single-player and multiplayer hit detection)
// --------------------------------------------------------------------------

export function shootWeapon(gs: FPSGameState, now: number): void {
  const w = gs.weapons[gs.currentWeapon];
  if (!w.owned) return;

  // Check fire rate
  if (now - gs.lastShotTime < w.fireRate) return;

  // Check ammo
  if (w.ammoType !== null) {
    if (w.ammo < w.ammoPerShot) return;
    w.ammo -= w.ammoPerShot;
  }

  gs.lastShotTime = now;
  gs.weaponRecoil = 10;

  // Muzzle flash
  gs.screenFlash = 'yellow';
  gs.flashTimer = 50;

  // Muzzle flash particles
  const muzzleX = SCREEN_W / 2;
  const muzzleY = SCREEN_H - 180;
  spawnParticles(gs.particles, muzzleX, muzzleY, 3, '#ffff88', 4, 80, 2);

  // Apply damage boost
  const dmgMult = gs.damageBoostTimer > 0 ? 2 : 1;

  // Ray from player in look direction (with spread)
  const spreadOffset = (Math.random() - 0.5) * w.spread * 2;
  const rayAngle = gs.playerAngle + spreadOffset;
  const rayDirX = Math.cos(rayAngle);
  const rayDirY = Math.sin(rayAngle);

  // Multiplayer hit detection
  if (gs.multiplayerMode && gs.matchStatus === 'playing') {
    let closestMpDist = w.range;
    let closestMpTarget: RemotePlayer | null = null;

    gs.remotePlayers.forEach((remote) => {
      if (!remote.alive) return;
      const dx = remote.x - gs.playerX;
      const dy = remote.y - gs.playerY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > w.range || d > closestMpDist) return;

      const dot = dx * rayDirX + dy * rayDirY;
      if (dot <= 0) return;

      const perpX = dx - dot * rayDirX;
      const perpY = dy - dot * rayDirY;
      const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);

      if (perpDist < 0.4) {
        if (
          hasLineOfSight(
            gs.playerX,
            gs.playerY,
            remote.x,
            remote.y,
            gs.map,
            gs.mapWidth,
            gs.mapHeight,
          )
        ) {
          closestMpDist = dot;
          closestMpTarget = remote;
        }
      }
    });

    if (closestMpTarget) {
      const falloff = 1 - (closestMpDist / w.range) * 0.5;
      const damage = Math.floor(w.damage * falloff * dmgMult);
      gs.wsRef?.send(
        JSON.stringify({
          type: 'fps_hit',
          payload: { targetId: (closestMpTarget as RemotePlayer).id, damage },
        }),
      );
    }

    // Also send shoot event
    gs.wsRef?.send(
      JSON.stringify({
        type: 'fps_shoot',
        payload: { angle: gs.playerAngle, weaponIndex: gs.currentWeapon },
      }),
    );
  }

  // Single-player hit detection (always active for PvE enemies)
  let closestDist = w.range;
  let closestEnemy: EnemyState | null = null;

  for (const enemy of gs.enemies) {
    if (!enemy.alive) continue;

    const dx = enemy.x - gs.playerX;
    const dy = enemy.y - gs.playerY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > w.range || d > closestDist) continue;

    // Project enemy onto ray
    const dot = dx * rayDirX + dy * rayDirY;
    if (dot <= 0) continue; // behind player

    // Perpendicular distance from ray to enemy center
    const perpX = dx - dot * rayDirX;
    const perpY = dy - dot * rayDirY;
    const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);

    const hitRadius = 0.4 * (ENEMY_TYPES[enemy.type]?.width || 1);
    if (perpDist < hitRadius) {
      // Check line of sight
      if (
        hasLineOfSight(gs.playerX, gs.playerY, enemy.x, enemy.y, gs.map, gs.mapWidth, gs.mapHeight)
      ) {
        closestDist = dot;
        closestEnemy = enemy;
      }
    }
  }

  if (closestEnemy) {
    // Distance falloff: full damage at close range, 50% at max range
    const falloff = 1 - (closestDist / w.range) * 0.5;
    const damage = Math.floor(w.damage * falloff * dmgMult);
    closestEnemy.health -= damage;

    if (closestEnemy.state === 'idle') {
      closestEnemy.state = 'alert';
      closestEnemy.alertTimer = 1000;
    }

    if (closestEnemy.health <= 0) {
      closestEnemy.health = 0;
      closestEnemy.alive = false;
      closestEnemy.state = 'dead';
      gs.kills++;
      const scoreDef = ENEMY_TYPES[closestEnemy.type];
      gs.score += scoreDef ? scoreDef.score : 50;

      // Death particles (at approximate screen position)
      spawnParticles(gs.particles, SCREEN_W / 2, SCREEN_H / 2, 10, '#aa2222', 5, 400, 3);
      spawnParticles(gs.particles, SCREEN_W / 2, SCREEN_H / 2, 4, '#661111', 3, 300, 2);

      // Kill feed
      gs.killFeed.push({
        text: `You killed ${closestEnemy.type} with ${w.name}`,
        time: Date.now(),
        color: '#22cc22',
      });
    }
  }
}
