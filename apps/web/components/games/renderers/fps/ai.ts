// ==========================================================================
// FPS Renderer: Enemy AI logic, consumable usage, particle/timer updates
// ==========================================================================

import type { FPSGameState } from './types';
import {
  SCREEN_W,
  SCREEN_H,
  ENEMY_SIGHT_RANGE,
  ENEMY_AI_INTERVAL,
  KILL_FEED_DURATION,
  KILL_FEED_MAX,
  ENEMY_TYPES,
  dist,
  hasLineOfSight,
  spawnParticles,
} from './constants';

// --------------------------------------------------------------------------
// Enemy AI update (called every ENEMY_AI_INTERVAL ms)
// --------------------------------------------------------------------------

export function updateEnemyAI(gs: FPSGameState, now: number): void {
  if (now - gs.lastEnemyAIUpdate <= ENEMY_AI_INTERVAL) return;
  gs.lastEnemyAIUpdate = now;
  const aiDt = ENEMY_AI_INTERVAL / 1000;

  for (const enemy of gs.enemies) {
    if (!enemy.alive) continue;

    const d = dist(gs.playerX, gs.playerY, enemy.x, enemy.y);
    const los =
      d < ENEMY_SIGHT_RANGE &&
      hasLineOfSight(enemy.x, enemy.y, gs.playerX, gs.playerY, gs.map, gs.mapWidth, gs.mapHeight);
    const eDef = ENEMY_TYPES[enemy.type];
    if (!eDef) continue;

    switch (enemy.state) {
      case 'idle':
        if (los) {
          enemy.state = 'alert';
          enemy.alertTimer = 1000;
        }
        break;

      case 'alert':
        enemy.alertTimer -= ENEMY_AI_INTERVAL;
        if (los) {
          enemy.state = 'chasing';
          enemy.lostSightTimer = 0;
        } else if (enemy.alertTimer <= 0) {
          enemy.state = 'idle';
        }
        break;

      case 'chasing': {
        if (!los) {
          enemy.lostSightTimer += ENEMY_AI_INTERVAL;
          if (enemy.lostSightTimer > 3000) {
            enemy.state = 'idle';
            break;
          }
        } else {
          enemy.lostSightTimer = 0;
        }

        if (d <= eDef.attackRange) {
          enemy.state = 'attacking';
          break;
        }

        // Move toward player
        const dx = gs.playerX - enemy.x;
        const dy = gs.playerY - enemy.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.01) {
          const mx = (dx / len) * eDef.speed * aiDt;
          const my = (dy / len) * eDef.speed * aiDt;
          const nx = enemy.x + mx;
          const ny = enemy.y + my;
          const fmx = Math.floor(nx);
          const fmy = Math.floor(ny);
          if (fmx >= 0 && fmx < gs.mapWidth && fmy >= 0 && fmy < gs.mapHeight) {
            if (gs.map[fmy][fmx] === 0) {
              enemy.x = nx;
              enemy.y = ny;
            } else if (gs.map[Math.floor(enemy.y)][fmx] === 0) {
              enemy.x = nx;
            } else if (gs.map[fmy][Math.floor(enemy.x)] === 0) {
              enemy.y = ny;
            }
          }
        }
        break;
      }

      case 'attacking':
        if (d > eDef.attackRange * 1.5) {
          enemy.state = 'chasing';
          break;
        }
        if (now - enemy.lastAttack > eDef.attackRate) {
          enemy.lastAttack = now;

          // Check invincibility
          if (gs.invincibilityTimer > 0) {
            // No damage taken
            break;
          }

          // Deal damage to player
          let damage = eDef.damage;
          if (gs.playerArmor > 0) {
            const armorAbsorb = Math.min(gs.playerArmor, Math.floor(damage * 0.6));
            gs.playerArmor -= armorAbsorb;
            damage -= armorAbsorb;
          }
          gs.playerHealth -= damage;
          gs.screenFlash = 'red';
          gs.flashTimer = 150;
          gs.damageVignetteTimer = 200;
          gs.shakeTimer = 150;
          gs.shakeIntensity = 3;

          // Damage direction particles
          spawnParticles(
            gs.particles,
            Math.random() * SCREEN_W,
            Math.random() < 0.5 ? 0 : SCREEN_H,
            4,
            '#ff3333',
            4,
            300,
            3,
          );

          if (gs.playerHealth <= 0) {
            // Check extra lives
            if (gs.extraLives > 0) {
              gs.extraLives--;
              gs.playerHealth = 50;
              gs.screenFlash = 'yellow';
              gs.flashTimer = 500;
              gs.message = 'EXTRA LIFE USED!';
              gs.messageTimer = 2000;
              // Gold flash particles
              spawnParticles(gs.particles, SCREEN_W / 2, SCREEN_H / 2, 8, '#FFD700', 6, 500, 3);
            } else {
              gs.playerHealth = 0;
              gs.gameOver = true;
            }
          }
        }
        break;
    }
  }
}

// --------------------------------------------------------------------------
// Consumable usage (Q key)
// --------------------------------------------------------------------------

export function useConsumable(gs: FPSGameState): void {
  for (let i = 0; i < gs.consumables.length; i++) {
    const c = gs.consumables[i];
    if (c.count <= 0) continue;

    if (c.type === 'damage_boost' && gs.damageBoostTimer <= 0) {
      c.count--;
      gs.damageBoostTimer = 30000; // 30 seconds
      gs.message = 'DAMAGE BOOST ACTIVE!';
      gs.messageTimer = 2000;
      gs.screenFlash = 'red';
      gs.flashTimer = 200;
      return;
    }
    if (c.type === 'invincibility' && gs.invincibilityTimer <= 0) {
      c.count--;
      gs.invincibilityTimer = 10000; // 10 seconds
      gs.message = 'INVINCIBILITY ACTIVE!';
      gs.messageTimer = 2000;
      gs.screenFlash = 'yellow';
      gs.flashTimer = 300;
      return;
    }
  }
}

// --------------------------------------------------------------------------
// Update particles and timers (called every frame)
// --------------------------------------------------------------------------

export function updateParticlesAndTimers(gs: FPSGameState, dt: number): void {
  // Update particles (write-pointer compaction, avoids splice overhead)
  let writeIdx = 0;
  for (let i = 0; i < gs.particles.length; i++) {
    const p = gs.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1; // gravity
    p.life -= dt * 1000;
    if (p.life > 0) {
      gs.particles[writeIdx++] = gs.particles[i];
    }
  }
  gs.particles.length = writeIdx;

  // Timers
  gs.gameTime += dt;
  if (gs.messageTimer > 0) {
    gs.messageTimer -= dt * 1000;
    if (gs.messageTimer <= 0) {
      gs.message = null;
      gs.messageTimer = 0;
    }
  }
  if (gs.flashTimer > 0) {
    gs.flashTimer -= dt * 1000;
    if (gs.flashTimer <= 0) {
      gs.screenFlash = null;
      gs.flashTimer = 0;
    }
  }
  if (gs.weaponRecoil > 0) {
    gs.weaponRecoil = Math.max(0, gs.weaponRecoil - dt * 60);
  }
  if (gs.shakeTimer > 0) {
    gs.shakeTimer -= dt * 1000;
  }
  if (gs.damageVignetteTimer > 0) {
    gs.damageVignetteTimer -= dt * 1000;
  }
  if (gs.pickupFlashTimer > 0) {
    gs.pickupFlashTimer -= dt * 1000;
    if (gs.pickupFlashTimer <= 0) {
      gs.pickupFlashColor = null;
    }
  }
  if (gs.damageBoostTimer > 0) {
    gs.damageBoostTimer -= dt * 1000;
  }
  if (gs.invincibilityTimer > 0) {
    gs.invincibilityTimer -= dt * 1000;
  }

  // Prune old kill feed entries
  const feedNow = Date.now();
  while (gs.killFeed.length > 0 && feedNow - gs.killFeed[0].time > KILL_FEED_DURATION) {
    gs.killFeed.shift();
  }
  while (gs.killFeed.length > KILL_FEED_MAX) {
    gs.killFeed.shift();
  }
}
