// ==========================================================================
// FPS Renderer: All canvas drawing functions
// Raycasting/DDA, wall rendering, sprite rendering, HUD, minimap,
// particles, post-processing (vignette), weapon sprites
// ==========================================================================

import type { FPSGameState, EnemyState, PickupState, RemotePlayer } from './types';
import {
  SCREEN_W,
  SCREEN_H,
  FOV,
  HALF_FOV,
  KILL_FEED_DURATION,
  MP_PLAYER_COLORS,
  GLOVE_COLORS,
  WALL_COLORS,
  TEX_SIZE,
  getWallTextures,
  WEAPON_PALETTE,
  WEAPON_SPRITES,
  ENEMY_PALETTES,
  ENEMY_SPRITES,
  ENEMY_TYPES,
  LEVELS,
  getStarField,
  clamp,
  drawPixelSprite,
} from './constants';

// --------------------------------------------------------------------------
// Main render function
// --------------------------------------------------------------------------

export function renderFrame(
  gs: FPSGameState,
  ctx: CanvasRenderingContext2D,
  zBuffer: Float64Array,
): void {
  // Screen shake offset
  let shakeX = 0;
  let shakeY = 0;
  if (gs.shakeTimer > 0) {
    shakeX = (gs.frameRandom[0] - 0.5) * gs.shakeIntensity * 2;
    shakeY = (gs.frameRandom[1] - 0.5) * gs.shakeIntensity * 2;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // --- Clear ---
  ctx.fillStyle = '#000';
  ctx.fillRect(-5, -5, SCREEN_W + 10, SCREEN_H + 10);

  // --- Ceiling (dark atmospheric) ---
  const ceilColors = gs.themeOverrides?.ceilingColor ?? [
    '#020208',
    '#060612',
    '#0c0c18',
    '#151520',
  ];
  const ceilGrad = ctx.createLinearGradient(0, 0, 0, SCREEN_H / 2);
  ceilGrad.addColorStop(0, ceilColors[0] ?? '#020208');
  ceilGrad.addColorStop(0.4, ceilColors[1] ?? '#060612');
  ceilGrad.addColorStop(0.8, ceilColors[2] ?? '#0c0c18');
  ceilGrad.addColorStop(1, ceilColors[3] ?? '#151520');
  ctx.fillStyle = ceilGrad;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H / 2);

  // Star field (pre-computed positions, varying sizes and alpha)
  const starField = getStarField();
  for (let si = 0; si < starField.length; si++) {
    const star = starField[si];
    ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }

  // --- Floor (depth illusion: lighter near horizon, dark at bottom) ---
  const floorColors = gs.themeOverrides?.floorColor ?? ['#3a3530', '#2a2520', '#1a1612', '#0a0908'];
  const floorGrad = ctx.createLinearGradient(0, SCREEN_H / 2, 0, SCREEN_H);
  floorGrad.addColorStop(0, floorColors[0] ?? '#3a3530');
  floorGrad.addColorStop(0.2, floorColors[1] ?? '#2a2520');
  floorGrad.addColorStop(0.5, floorColors[2] ?? '#1a1612');
  floorGrad.addColorStop(1, floorColors[3] ?? '#0a0908');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, SCREEN_H / 2, SCREEN_W, SCREEN_H / 2);

  // Floor scan lines (subtle CRT feel)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
  for (let scanY = SCREEN_H / 2; scanY < SCREEN_H; scanY += 3) {
    ctx.fillRect(0, scanY, SCREEN_W, 1);
  }

  // --- Raycasting ---
  const playerDirX = Math.cos(gs.playerAngle);
  const playerDirY = Math.sin(gs.playerAngle);
  const planeX = -playerDirY * Math.tan(HALF_FOV);
  const planeY = playerDirX * Math.tan(HALF_FOV);

  castWalls(ctx, gs, zBuffer, playerDirX, playerDirY, planeX, planeY);

  // --- Sprites (enemies, pickups, and remote players) ---
  drawSprites(ctx, gs, zBuffer, playerDirX, playerDirY, planeX, planeY);

  // --- Particles ---
  drawParticles(ctx, gs);

  // --- Weapon / Hand view ---
  drawWeaponView(ctx, gs);

  // --- Vignette post-processing (frames the view) ---
  const vigGrad = ctx.createRadialGradient(
    SCREEN_W / 2,
    SCREEN_H / 2,
    SCREEN_H * 0.35,
    SCREEN_W / 2,
    SCREEN_H / 2,
    SCREEN_H * 0.85,
  );
  vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vigGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.1)');
  vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // --- HUD ---
  drawHUD(ctx, gs);

  // --- Kill feed ---
  drawKillFeed(ctx, gs);

  // --- Messages ---
  if (gs.message) {
    const alpha = gs.messageTimer > 500 ? 1 : gs.messageTimer / 500;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gs.message, SCREEN_W / 2, SCREEN_H / 3);
    ctx.restore();
  }

  // --- Damage vignette (red edges) ---
  if (gs.damageVignetteTimer > 0) {
    drawDamageVignette(ctx, gs);
  }

  // --- Low health warning (pulsing red edges) ---
  if (gs.playerHealth > 0 && gs.playerHealth < 25 && gs.damageVignetteTimer <= 0) {
    const pulse = (Math.sin(Date.now() / 300) * 0.5 + 0.5) * 0.25;
    const lowGrad = ctx.createRadialGradient(
      SCREEN_W / 2,
      SCREEN_H / 2,
      SCREEN_H * 0.3,
      SCREEN_W / 2,
      SCREEN_H / 2,
      SCREEN_H * 0.8,
    );
    lowGrad.addColorStop(0, 'rgba(255, 0, 0, 0)');
    lowGrad.addColorStop(1, `rgba(255, 0, 0, ${pulse})`);
    ctx.fillStyle = lowGrad;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  // --- Pickup flash (bottom of screen) ---
  if (gs.pickupFlashColor && gs.pickupFlashTimer > 0) {
    const pfAlpha = (gs.pickupFlashTimer / 200) * 0.3;
    ctx.save();
    ctx.globalAlpha = pfAlpha;
    const pfGrad = ctx.createLinearGradient(0, SCREEN_H - 100, 0, SCREEN_H);
    pfGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    pfGrad.addColorStop(1, gs.pickupFlashColor);
    ctx.fillStyle = pfGrad;
    ctx.fillRect(0, SCREEN_H - 100, SCREEN_W, 100);
    ctx.restore();
  }

  // --- Screen flash ---
  if (gs.screenFlash) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = gs.screenFlash === 'red' ? '#FF0000' : '#FFFF00';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.restore();
  }

  // --- Invincibility pulse effect ---
  if (gs.invincibilityTimer > 0) {
    const invPulse = (Math.sin(Date.now() / 100) * 0.5 + 0.5) * 0.15;
    ctx.save();
    ctx.globalAlpha = invPulse;
    ctx.fillStyle = '#ffff88';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.restore();
  }

  // --- Consumable timers on HUD ---
  drawConsumableTimers(ctx, gs);

  // --- Multiplayer overlays ---
  if (gs.multiplayerMode) {
    drawMultiplayerOverlay(ctx, gs);
  }

  // --- Game over ---
  if (gs.gameOver) {
    drawGameOverScreen(ctx, gs);
  }

  // --- Victory ---
  if (gs.victory) {
    drawVictoryScreen(ctx, gs);
  }

  // --- Level transition ---
  if (gs.levelTransition) {
    const alpha = clamp(1 - gs.levelTransitionTimer / 2000, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.restore();
  }

  ctx.restore(); // End shake transform
}

// --------------------------------------------------------------------------
// Raycasting: DDA wall casting
// --------------------------------------------------------------------------

function castWalls(
  ctx: CanvasRenderingContext2D,
  gs: FPSGameState,
  zBuffer: Float64Array,
  playerDirX: number,
  playerDirY: number,
  planeX: number,
  planeY: number,
): void {
  for (let x = 0; x < SCREEN_W; x++) {
    const cameraX = (2 * x) / SCREEN_W - 1;
    const rayDirX = playerDirX + planeX * cameraX;
    const rayDirY = playerDirY + planeY * cameraX;

    let mapX = Math.floor(gs.playerX);
    let mapY = Math.floor(gs.playerY);

    const deltaDistX = Math.abs(rayDirX) < 1e-10 ? 1e10 : Math.abs(1 / rayDirX);
    const deltaDistY = Math.abs(rayDirY) < 1e-10 ? 1e10 : Math.abs(1 / rayDirY);

    let stepX: number;
    let sideDistX: number;
    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (gs.playerX - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1 - gs.playerX) * deltaDistX;
    }

    let stepY: number;
    let sideDistY: number;
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (gs.playerY - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1 - gs.playerY) * deltaDistY;
    }

    let side = 0;
    let hit = false;

    // DDA loop
    for (let step = 0; step < 64; step++) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }

      if (mapX < 0 || mapX >= gs.mapWidth || mapY < 0 || mapY >= gs.mapHeight) break;
      if (gs.map[mapY][mapX] > 0) {
        hit = true;
        break;
      }
    }

    if (!hit) {
      zBuffer[x] = 1e10;
      continue;
    }

    // Perpendicular distance (prevents fisheye)
    let perpDist: number;
    if (side === 0) {
      perpDist = (mapX - gs.playerX + (1 - stepX) / 2) / rayDirX;
    } else {
      perpDist = (mapY - gs.playerY + (1 - stepY) / 2) / rayDirY;
    }

    if (perpDist <= 0) perpDist = 0.01;
    zBuffer[x] = perpDist;

    // Wall strip
    const lineHeight = SCREEN_H / perpDist;
    const drawStart = Math.max(0, Math.floor(SCREEN_H / 2 - lineHeight / 2));
    const drawEnd = Math.min(SCREEN_H, Math.floor(SCREEN_H / 2 + lineHeight / 2));

    // Texture-mapped wall rendering
    const wallType = gs.map[mapY][mapX];
    const wallTextures = getWallTextures();
    const texIndex = clamp(wallType - 1, 0, wallTextures.length - 1);
    const texture = wallTextures[texIndex];

    // Compute texture X coordinate from wall hit position
    let wallHitX: number;
    if (side === 0) {
      wallHitX = gs.playerY + perpDist * rayDirY;
    } else {
      wallHitX = gs.playerX + perpDist * rayDirX;
    }
    wallHitX -= Math.floor(wallHitX);
    // Flip texture for certain sides to avoid mirroring
    if (side === 0 && rayDirX > 0) wallHitX = 1 - wallHitX;
    if (side === 1 && rayDirY < 0) wallHitX = 1 - wallHitX;

    const texX = Math.floor(wallHitX * TEX_SIZE) & (TEX_SIZE - 1);

    // Side shading factor (N/S vs E/W)
    const sideFactor = side === 1 ? 0.7 : 1.0;

    // Distance fog
    const fogFactor = clamp(1 - perpDist / 16, 0.15, 1);
    const combinedFactor = fogFactor * sideFactor;

    const stripHeight = drawEnd - drawStart;

    // For distant walls (small strips), draw base color only
    if (stripHeight < 12 || perpDist > 10) {
      const baseColor = gs.themeOverrides?.wallColors?.[wallType] ??
        WALL_COLORS[wallType] ?? [100, 95, 90];
      const br = Math.floor(baseColor[0] * combinedFactor);
      const bg = Math.floor(baseColor[1] * combinedFactor);
      const bb = Math.floor(baseColor[2] * combinedFactor);
      ctx.fillStyle = `rgb(${br},${bg},${bb})`;
      ctx.fillRect(x, drawStart, 1, stripHeight);
    } else {
      // Sample texture for nearby walls (visible detail)
      // Use step-based sampling: step through texture Y in chunks for performance
      const fullLineHeight = SCREEN_H / perpDist;
      const texStepY = TEX_SIZE / fullLineHeight;
      let texYStart = (drawStart - (SCREEN_H / 2 - fullLineHeight / 2)) * texStepY;

      // Draw in chunks of 2 pixels for performance
      const chunkSize = 2;
      for (let py = drawStart; py < drawEnd; py += chunkSize) {
        const texY = Math.floor(texYStart) & (TEX_SIZE - 1);
        const texIdx = (texY * TEX_SIZE + texX) * 3;
        const tr = texture[texIdx];
        const tg = texture[texIdx + 1];
        const tb = texture[texIdx + 2];
        const fr = Math.floor(tr * combinedFactor);
        const fg = Math.floor(tg * combinedFactor);
        const fb = Math.floor(tb * combinedFactor);
        ctx.fillStyle = `rgb(${fr},${fg},${fb})`;
        const h = Math.min(chunkSize, drawEnd - py);
        ctx.fillRect(x, py, 1, h);
        texYStart += texStepY * chunkSize;
      }
    }

    // Edge definition: thin dark line at top and bottom
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(x, drawStart, 1, 1);
    ctx.fillRect(x, drawEnd - 1, 1, 1);
  }
}

// --------------------------------------------------------------------------
// Draw sprites (enemies, pickups, remote players)
// --------------------------------------------------------------------------

function drawSprites(
  ctx: CanvasRenderingContext2D,
  gs: FPSGameState,
  zBuffer: Float64Array,
  dirX: number,
  dirY: number,
  planeX: number,
  planeY: number,
): void {
  // Collect all sprites
  type SpriteItem = {
    x: number;
    y: number;
    type: 'enemy' | 'pickup' | 'remote_player';
    data: EnemyState | PickupState | RemotePlayer;
  };
  const sprites: SpriteItem[] = [];

  for (const enemy of gs.enemies) {
    if (!enemy.alive) continue;
    sprites.push({ x: enemy.x, y: enemy.y, type: 'enemy', data: enemy });
  }
  for (const pickup of gs.pickups) {
    if (pickup.collected) continue;
    sprites.push({ x: pickup.x, y: pickup.y, type: 'pickup', data: pickup });
  }

  // Remote players in multiplayer
  if (gs.multiplayerMode) {
    const now = Date.now();
    gs.remotePlayers.forEach((remote) => {
      if (!remote.alive) return;
      // Interpolate position
      const t = clamp((now - remote.lastUpdate) / 50, 0, 1);
      const renderX = remote.prevX + (remote.x - remote.prevX) * t;
      const renderY = remote.prevY + (remote.y - remote.prevY) * t;
      sprites.push({ x: renderX, y: renderY, type: 'remote_player', data: remote });
    });
  }

  // Sort back to front
  sprites.sort((a, b) => {
    const da = (a.x - gs.playerX) * (a.x - gs.playerX) + (a.y - gs.playerY) * (a.y - gs.playerY);
    const db = (b.x - gs.playerX) * (b.x - gs.playerX) + (b.y - gs.playerY) * (b.y - gs.playerY);
    return db - da;
  });

  const det = planeX * dirY - dirX * planeY;
  if (Math.abs(det) < 1e-10) return;
  const invDet = 1 / det;

  for (const sprite of sprites) {
    const sx = sprite.x - gs.playerX;
    const sy = sprite.y - gs.playerY;

    const transformX = invDet * (dirY * sx - dirX * sy);
    const transformY = invDet * (-planeY * sx + planeX * sy);

    if (transformY <= 0.1) continue; // behind camera

    const spriteScreenX = Math.floor((SCREEN_W / 2) * (1 + transformX / transformY));

    let spriteScaleW = 1;
    let spriteScaleH = 1;

    if (sprite.type === 'enemy') {
      const eDef = ENEMY_TYPES[(sprite.data as EnemyState).type];
      if (eDef) {
        spriteScaleW = eDef.width;
        spriteScaleH = eDef.height;
      }
    } else if (sprite.type === 'pickup') {
      spriteScaleW = 0.5;
      spriteScaleH = 0.5;
    } else {
      // remote_player
      spriteScaleW = 1;
      spriteScaleH = 1;
    }

    const spriteHeight = Math.abs(Math.floor(SCREEN_H / transformY)) * spriteScaleH;
    const spriteWidth = Math.abs(Math.floor(SCREEN_H / transformY)) * spriteScaleW;

    const drawStartY = Math.floor(SCREEN_H / 2 - spriteHeight / 2);
    const drawEndY = Math.floor(SCREEN_H / 2 + spriteHeight / 2);
    const drawStartX = Math.floor(spriteScreenX - spriteWidth / 2);
    const drawEndX = Math.floor(spriteScreenX + spriteWidth / 2);

    // Clip and draw
    const startX = Math.max(drawStartX, 0);
    const endX = Math.min(drawEndX, SCREEN_W);

    // Check if any column is visible
    let visible = false;
    for (let stripe = startX; stripe < endX; stripe++) {
      if (transformY < zBuffer[stripe]) {
        visible = true;
        break;
      }
    }
    if (!visible) continue;

    // Distance fog
    const fogFactor = clamp(1 - transformY / 16, 0.2, 1);

    if (sprite.type === 'enemy') {
      drawEnemySprite(
        ctx,
        sprite.data as EnemyState,
        fogFactor,
        zBuffer,
        transformY,
        spriteScreenX,
        drawStartX,
        drawStartY,
        startX,
        endX,
        spriteWidth,
        spriteHeight,
      );
    } else if (sprite.type === 'remote_player') {
      drawRemotePlayerSprite(
        ctx,
        gs,
        sprite.data as RemotePlayer,
        fogFactor,
        zBuffer,
        transformY,
        spriteScreenX,
        drawStartX,
        drawStartY,
        drawEndY,
        startX,
        endX,
        spriteWidth,
        spriteHeight,
      );
    } else {
      // Pickup sprite
      const pickup = sprite.data as PickupState;

      // Floating bob
      const bob = Math.sin(Date.now() / 300 + pickup.id) * spriteHeight * 0.05;
      const cy = SCREEN_H / 2 + bob;
      const csy = Math.floor(cy - spriteHeight / 2);
      const cey = Math.floor(cy + spriteHeight / 2);

      for (let stripe = startX; stripe < endX; stripe++) {
        if (transformY >= zBuffer[stripe]) continue;

        let color = '#888';
        if (pickup.type === 'health') color = '#22cc22';
        else if (pickup.type === 'armor') color = '#4488ff';
        else if (pickup.type.startsWith('ammo_')) color = '#ddcc22';
        else if (pickup.type.startsWith('weapon_')) color = '#00cccc';

        ctx.fillStyle = color;
        ctx.globalAlpha = fogFactor;
        ctx.fillRect(stripe, csy, 1, cey - csy);
        ctx.globalAlpha = 1;
      }
    }
  }
}

// --------------------------------------------------------------------------
// Draw detailed enemy sprite
// --------------------------------------------------------------------------

function drawEnemySprite(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyState,
  fogFactor: number,
  zBuffer: Float64Array,
  transformY: number,
  spriteScreenX: number,
  drawStartX: number,
  drawStartY: number,
  startX: number,
  endX: number,
  spriteWidth: number,
  spriteHeight: number,
): void {
  if (!ENEMY_TYPES[enemy.type]) return;

  // Get pixel art sprite and palette for this enemy type
  const spriteData = ENEMY_SPRITES[enemy.type];
  const palette = ENEMY_PALETTES[enemy.type];
  if (!spriteData || !palette) return;

  // Compute pixel size: scale sprite to fill the sprite bounds
  const spritePixelRows = spriteData.length;
  const spritePixelCols = spriteData[0].length;
  const pixelSizeX = spriteWidth / spritePixelCols;
  const pixelSizeY = spriteHeight / spritePixelRows;
  const pixelSize = Math.max(1, Math.floor(Math.min(pixelSizeX, pixelSizeY)));

  // Center the sprite in the draw area
  const totalDrawW = spritePixelCols * pixelSize;
  const totalDrawH = spritePixelRows * pixelSize;
  const offsetX = drawStartX + Math.floor((spriteWidth - totalDrawW) / 2);
  const offsetY = drawStartY + Math.floor((spriteHeight - totalDrawH) / 2);

  // Draw each pixel of the sprite, checking zBuffer per column
  for (let row = 0; row < spritePixelRows; row++) {
    const rowData = spriteData[row];
    const py = Math.floor(offsetY + row * pixelSize);
    if (py + pixelSize < 0 || py >= SCREEN_H) continue;
    for (let col = 0; col < spritePixelCols; col++) {
      const palIdx = rowData[col];
      if (palIdx === 0) continue; // transparent
      const px = Math.floor(offsetX + col * pixelSize);
      if (px + pixelSize < startX || px >= endX) continue;
      // Check zBuffer for the center of this pixel
      const centerX = Math.floor(px + pixelSize / 2);
      if (centerX >= 0 && centerX < SCREEN_W && transformY >= zBuffer[centerX]) continue;

      const color = palette[palIdx];
      if (!color) continue;
      const cr = Math.floor(color[0] * fogFactor);
      const cg = Math.floor(color[1] * fogFactor);
      const cb = Math.floor(color[2] * fogFactor);
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      const drawW = Math.min(pixelSize, SCREEN_W - px);
      const drawH = Math.min(pixelSize, SCREEN_H - py);
      if (drawW > 0 && drawH > 0) {
        ctx.fillRect(px, Math.max(0, py), drawW, drawH);
      }
    }
  }

  // Boss: add glowing eyes effect on top of the sprite
  if (enemy.type === 'boss' && spriteHeight > 20) {
    const eyeRow = 5; // row in sprite where eyes are
    const eyeCol1 = 5; // left eye column
    const eyeCol2 = 13; // right eye column
    const eyeX1 = Math.floor(offsetX + eyeCol1 * pixelSize);
    const eyeY1 = Math.floor(offsetY + eyeRow * pixelSize);
    const eyeX2 = Math.floor(offsetX + eyeCol2 * pixelSize);
    const eyeSize = Math.max(2, pixelSize);
    ctx.fillStyle = '#ff2222';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = Math.min(8, pixelSize * 2);
    ctx.fillRect(eyeX1, eyeY1, eyeSize, eyeSize);
    ctx.fillRect(eyeX2, eyeY1, eyeSize, eyeSize);
    ctx.shadowBlur = 0;
  }

  // Health bar for damaged enemies
  if (enemy.health < enemy.maxHealth && enemy.health > 0) {
    const barW = Math.min(endX - startX, 40);
    const barX = spriteScreenX - barW / 2;
    const headTop = Math.max(drawStartY, 0);
    const barY = Math.max(headTop - 8, 0);
    const hpPct = enemy.health / enemy.maxHealth;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, 4);
    ctx.fillStyle = hpPct > 0.5 ? '#0f0' : hpPct > 0.25 ? '#ff0' : '#f00';
    ctx.fillRect(barX, barY, barW * hpPct, 4);
  }
}

// --------------------------------------------------------------------------
// Draw remote player sprite (multiplayer)
// --------------------------------------------------------------------------

function drawRemotePlayerSprite(
  ctx: CanvasRenderingContext2D,
  gs: FPSGameState,
  remote: RemotePlayer,
  fogFactor: number,
  zBuffer: Float64Array,
  transformY: number,
  spriteScreenX: number,
  drawStartX: number,
  drawStartY: number,
  drawEndY: number,
  startX: number,
  endX: number,
  spriteWidth: number,
  spriteHeight: number,
): void {
  // Determine player color based on their index
  const playerIds = Array.from(gs.remotePlayers.keys());
  const colorIndex = playerIds.indexOf(remote.id) % MP_PLAYER_COLORS.length;
  const playerColor = MP_PLAYER_COLORS[colorIndex];

  // Parse hex color to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 128, g: 128, b: 128 };
  };

  const pc = hexToRgb(playerColor);
  const r = Math.floor(pc.r * fogFactor);
  const g = Math.floor(pc.g * fogFactor);
  const b = Math.floor(pc.b * fogFactor);

  const headTop = Math.max(drawStartY, 0);
  const headBottom = Math.max(drawStartY + Math.floor(spriteHeight * 0.2), 0);
  const bodyTop = headBottom;
  const bodyBottom = Math.min(drawEndY, SCREEN_H);
  const headLeft = drawStartX + Math.floor(spriteWidth * 0.3);
  const headRight = drawStartX + Math.floor(spriteWidth * 0.7);
  const bodyLeft = drawStartX + Math.floor(spriteWidth * 0.15);
  const bodyRight = drawStartX + Math.floor(spriteWidth * 0.85);

  for (let stripe = startX; stripe < endX; stripe++) {
    if (transformY >= zBuffer[stripe]) continue;
    // Head
    if (stripe >= headLeft && stripe < headRight && headTop < headBottom) {
      ctx.fillStyle = `rgb(${Math.min(255, Math.floor(r * 1.3))},${Math.min(255, Math.floor(g * 1.3))},${Math.min(255, Math.floor(b * 1.3))})`;
      ctx.fillRect(stripe, headTop, 1, headBottom - headTop);
    }
    // Body
    if (stripe >= bodyLeft && stripe < bodyRight) {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(stripe, bodyTop, 1, bodyBottom - bodyTop);
    }
  }

  // Player name above head
  ctx.save();
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = playerColor;
  ctx.globalAlpha = fogFactor;
  ctx.fillText(remote.name, spriteScreenX, Math.max(headTop - 18, 8));

  // Health bar
  if (remote.health < 100 && remote.health > 0) {
    const barW = Math.min(endX - startX, 40);
    const barX = spriteScreenX - barW / 2;
    const barY = Math.max(headTop - 12, 0);
    const hpPct = remote.health / 100;
    ctx.globalAlpha = fogFactor;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, 3);
    ctx.fillStyle = hpPct > 0.5 ? '#0f0' : hpPct > 0.25 ? '#ff0' : '#f00';
    ctx.fillRect(barX, barY, barW * hpPct, 3);
  }
  ctx.restore();
}

// --------------------------------------------------------------------------
// Draw particles
// --------------------------------------------------------------------------

function drawParticles(ctx: CanvasRenderingContext2D, gs: FPSGameState): void {
  for (const p of gs.particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    ctx.restore();
  }
}

// --------------------------------------------------------------------------
// Draw weapon / hand view (enhanced detail)
// --------------------------------------------------------------------------

function drawWeaponView(ctx: CanvasRenderingContext2D, gs: FPSGameState): void {
  // Figure-8 weapon bob for walking, with recoil kick
  const bobX = Math.sin(gs.weaponBob) * 6;
  const bobY = Math.sin(gs.weaponBob * 2) * 3 + Math.abs(Math.sin(gs.weaponBob)) * 2;
  const recoilY = -gs.weaponRecoil * 1.5;
  const recoilTilt = gs.weaponRecoil * 0.3;

  const spriteData = WEAPON_SPRITES[gs.currentWeapon];
  if (!spriteData) return;

  const pixelSize = 4;
  const spriteW = spriteData[0].length * pixelSize;
  const spriteH = spriteData.length * pixelSize;

  const baseX = SCREEN_W / 2 - spriteW / 2 + bobX;
  const baseY = SCREEN_H - spriteH - 10 + bobY + recoilY + recoilTilt;

  // Build glove color override map for skin palette indices (7-10)
  let gloveOverride: Record<number, [number, number, number]> | undefined;
  if (gs.gloveColor !== 'default') {
    const gloveHex = GLOVE_COLORS[gs.gloveColor] || GLOVE_COLORS.default;
    // Parse hex to RGB
    const hr = parseInt(gloveHex.slice(1, 3), 16);
    const hg = parseInt(gloveHex.slice(3, 5), 16);
    const hb = parseInt(gloveHex.slice(5, 7), 16);
    gloveOverride = {
      7: [Math.floor(hr * 0.5), Math.floor(hg * 0.5), Math.floor(hb * 0.5)],
      8: [Math.floor(hr * 0.7), Math.floor(hg * 0.7), Math.floor(hb * 0.7)],
      9: [hr, hg, hb],
      10: [
        Math.min(255, Math.floor(hr * 1.2)),
        Math.min(255, Math.floor(hg * 1.2)),
        Math.min(255, Math.floor(hb * 1.2)),
      ],
    };
  }

  // Damage boost glow on weapon
  if (gs.damageBoostTimer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.15 + Math.sin(Date.now() / 200) * 0.1;
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.ellipse(
      baseX + spriteW / 2,
      baseY + spriteH * 0.6,
      spriteW * 0.6,
      spriteH * 0.4,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  // Glove special effects (drawn behind the sprite)
  if (gs.gloveColor === 'cyber') {
    ctx.save();
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#00FFFF';
    ctx.shadowBlur = 8;
    ctx.strokeRect(baseX + spriteW * 0.15, baseY + spriteH * 0.55, spriteW * 0.7, spriteH * 0.35);
    ctx.shadowBlur = 0;
    ctx.restore();
  } else if (gs.gloveColor === 'flame') {
    ctx.save();
    const flicker = gs.frameRandom[2] * 0.3 + 0.7;
    ctx.globalAlpha = flicker * 0.35;
    ctx.fillStyle = '#FF4500';
    ctx.beginPath();
    ctx.ellipse(
      baseX + spriteW / 2,
      baseY + spriteH * 0.7,
      spriteW * 0.5,
      spriteH * 0.3,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  // Draw the pixel art weapon sprite
  drawPixelSprite(ctx, spriteData, WEAPON_PALETTE, baseX, baseY, pixelSize, 1, gloveOverride);

  // BFG: add glowing green orb on top of sprite
  if (gs.currentWeapon === 5) {
    const orbX = baseX + spriteW / 2;
    const orbY = baseY + spriteH * 0.1;
    const orbR = pixelSize * 4;
    const glowGrad = ctx.createRadialGradient(orbX, orbY, 2, orbX, orbY, orbR);
    glowGrad.addColorStop(0, '#00ff00');
    glowGrad.addColorStop(0.4, '#00cc00');
    glowGrad.addColorStop(0.8, '#00aa00');
    glowGrad.addColorStop(1, 'rgba(0, 170, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(orbX, orbY, orbR, 0, Math.PI * 2);
    ctx.fill();
    // Energy arcs
    ctx.strokeStyle = '#88ff88';
    ctx.lineWidth = 1;
    for (let ai = 0; ai < 4; ai++) {
      const aAngle = gs.frameRandom[3 + ai * 2] * Math.PI * 2;
      const aLen = orbR * 0.6 + gs.frameRandom[4 + ai * 2] * orbR * 0.8;
      ctx.beginPath();
      ctx.moveTo(orbX + Math.cos(aAngle) * orbR * 0.5, orbY + Math.sin(aAngle) * orbR * 0.5);
      ctx.lineTo(orbX + Math.cos(aAngle) * aLen, orbY + Math.sin(aAngle) * aLen);
      ctx.stroke();
    }
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(orbX, orbY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Skeleton glove overlay (draw bone structure on top)
  if (gs.gloveColor === 'skeleton') {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(
      baseX + spriteW / 2,
      baseY + spriteH * 0.75,
      spriteW * 0.35,
      spriteH * 0.15,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = '#FFF';
    for (let i = 0; i < 4; i++) {
      const fx = baseX + spriteW * 0.2 + i * (spriteW * 0.16);
      ctx.fillRect(fx, baseY + spriteH * 0.6, pixelSize * 1.5, spriteH * 0.2);
    }
  }

  // Enhanced muzzle flash
  if (gs.screenFlash === 'yellow' && gs.flashTimer > 0) {
    const flashX = baseX + spriteW / 2;
    const flashY = baseY - pixelSize * 2;

    // Screen brightness boost during flash
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#FFFFCC';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.restore();

    // White-hot center
    const whiteGrad = ctx.createRadialGradient(flashX, flashY, 1, flashX, flashY, 15);
    whiteGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    whiteGrad.addColorStop(0.5, 'rgba(255, 255, 200, 0.6)');
    whiteGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = whiteGrad;
    ctx.beginPath();
    ctx.arc(flashX, flashY, 15, 0, Math.PI * 2);
    ctx.fill();

    // Orange-yellow middle ring
    const midGrad = ctx.createRadialGradient(flashX, flashY, 8, flashX, flashY, 30);
    midGrad.addColorStop(0, 'rgba(255, 200, 50, 0.7)');
    midGrad.addColorStop(0.6, 'rgba(255, 150, 0, 0.3)');
    midGrad.addColorStop(1, 'rgba(255, 200, 0, 0)');
    ctx.fillStyle = midGrad;
    ctx.beginPath();
    ctx.arc(flashX, flashY, 30, 0, Math.PI * 2);
    ctx.fill();

    // Red-orange outer glow
    const outerGrad = ctx.createRadialGradient(flashX, flashY, 20, flashX, flashY, 45);
    outerGrad.addColorStop(0, 'rgba(255, 100, 30, 0.25)');
    outerGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.arc(flashX, flashY, 45, 0, Math.PI * 2);
    ctx.fill();

    // Random spokes/rays for variety (2-3 rays)
    ctx.strokeStyle = 'rgba(255, 230, 120, 0.6)';
    ctx.lineWidth = 2;
    const spokeCount = 2 + Math.floor(gs.frameRandom[11] * 2);
    for (let si = 0; si < spokeCount; si++) {
      const sAngle = gs.frameRandom[12 + si * 2] * Math.PI * 2;
      const sLen = 15 + gs.frameRandom[13 + si * 2] * 25;
      ctx.beginPath();
      ctx.moveTo(flashX + Math.cos(sAngle) * 5, flashY + Math.sin(sAngle) * 5);
      ctx.lineTo(flashX + Math.cos(sAngle) * sLen, flashY + Math.sin(sAngle) * sLen);
      ctx.stroke();
    }
  }
}

// --------------------------------------------------------------------------
// Draw damage vignette (red edges on all four sides)
// --------------------------------------------------------------------------

function drawDamageVignette(ctx: CanvasRenderingContext2D, gs: FPSGameState): void {
  const vigAlpha = (gs.damageVignetteTimer / 200) * 0.5;
  // Top edge
  const topGrad = ctx.createLinearGradient(0, 0, 0, 80);
  topGrad.addColorStop(0, `rgba(255, 0, 0, ${vigAlpha})`);
  topGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, SCREEN_W, 80);
  // Bottom edge
  const bottomGrad = ctx.createLinearGradient(0, SCREEN_H - 80, 0, SCREEN_H);
  bottomGrad.addColorStop(0, 'rgba(255, 0, 0, 0)');
  bottomGrad.addColorStop(1, `rgba(255, 0, 0, ${vigAlpha})`);
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, SCREEN_H - 80, SCREEN_W, 80);
  // Left edge
  const leftGrad = ctx.createLinearGradient(0, 0, 60, 0);
  leftGrad.addColorStop(0, `rgba(255, 0, 0, ${vigAlpha})`);
  leftGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, 60, SCREEN_H);
  // Right edge
  const rightGrad = ctx.createLinearGradient(SCREEN_W - 60, 0, SCREEN_W, 0);
  rightGrad.addColorStop(0, 'rgba(255, 0, 0, 0)');
  rightGrad.addColorStop(1, `rgba(255, 0, 0, ${vigAlpha})`);
  ctx.fillStyle = rightGrad;
  ctx.fillRect(SCREEN_W - 60, 0, 60, SCREEN_H);
}

// --------------------------------------------------------------------------
// Draw HUD (health, armor, weapon, score, minimap, weapon slots)
// --------------------------------------------------------------------------

function drawHUD(ctx: CanvasRenderingContext2D, gs: FPSGameState): void {
  // Bottom bar
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, SCREEN_H - 60, SCREEN_W, 60);

  ctx.font = 'bold 14px monospace';
  ctx.textBaseline = 'middle';

  // Health (left)
  const healthColor =
    gs.playerHealth > 50 ? '#22cc22' : gs.playerHealth > 25 ? '#cccc22' : '#cc2222';
  ctx.fillStyle = '#cc2222';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('+', 20, SCREEN_H - 38);
  ctx.fillStyle = healthColor;
  ctx.font = 'bold 28px monospace';
  ctx.fillText(`${gs.playerHealth}`, 40, SCREEN_H - 35);

  // Armor (next to health)
  if (gs.playerArmor > 0) {
    ctx.fillStyle = '#4488ff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`[${gs.playerArmor}]`, 110, SCREEN_H - 35);
  }

  // Weapon and ammo (center)
  const weapon = gs.weapons[gs.currentWeapon];
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ddd';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(weapon.name, SCREEN_W / 2, SCREEN_H - 42);

  if (weapon.ammoType !== null) {
    const ammoColor = weapon.ammo > 10 ? '#ddd' : weapon.ammo > 0 ? '#cccc22' : '#cc2222';
    ctx.fillStyle = ammoColor;
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`${weapon.ammo}`, SCREEN_W / 2, SCREEN_H - 20);
  } else {
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('INF', SCREEN_W / 2, SCREEN_H - 20);
  }

  // Score and kills (top left) | In multiplayer, show "Deathmatch" label
  ctx.textAlign = 'left';
  ctx.fillStyle = '#aaa';
  ctx.font = '14px monospace';
  if (gs.multiplayerMode) {
    ctx.fillStyle = '#ff6644';
    ctx.fillText('DEATHMATCH', 10, 20);
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Kills to win: ${gs.killsToWin}`, 10, 38);
  } else {
    ctx.fillText(`Score: ${gs.score}`, 10, 20);
    ctx.fillText(`Kills: ${gs.kills}`, 10, 38);
  }

  // Level name (top right)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#aaa';
  ctx.font = '14px monospace';
  if (!gs.multiplayerMode) {
    const levelDef = LEVELS[gs.level];
    ctx.fillText(levelDef ? levelDef.name : '', SCREEN_W - 130, 20);
  }

  // --- Minimap (top right corner) ---
  drawMinimap(ctx, gs);

  // Weapon slots (bottom right) with lock icons for unowned
  ctx.textAlign = 'right';
  ctx.font = '12px monospace';
  const slotY = SCREEN_H - 50;
  for (let i = 0; i < gs.weapons.length; i++) {
    const w = gs.weapons[i];
    const isActive = i === gs.currentWeapon;
    if (w.owned) {
      ctx.fillStyle = isActive ? '#FFD700' : '#666';
      ctx.fillText(`${i + 1}:${w.name.substring(0, 4)}`, SCREEN_W - 20, slotY + i * 14);
    } else {
      // Show grayed out with lock icon
      ctx.fillStyle = '#333';
      ctx.fillText(`${i + 1}:${w.name.substring(0, 4)} [X]`, SCREEN_W - 20, slotY + i * 14);
    }
  }

  // Multiplayer scoreboard (compact, top center)
  if (gs.multiplayerMode && gs.matchStatus === 'playing') {
    drawMultiplayerScoreboard(ctx, gs);
  }

  ctx.restore();
}

// --------------------------------------------------------------------------
// Draw minimap
// --------------------------------------------------------------------------

function drawMinimap(ctx: CanvasRenderingContext2D, gs: FPSGameState): void {
  const mmSize = 120;
  const mmX = SCREEN_W - mmSize - 10;
  const mmY = 30;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(mmX, mmY, mmSize, mmSize);

  const cellW = mmSize / gs.mapWidth;
  const cellH = mmSize / gs.mapHeight;

  for (let my = 0; my < gs.mapHeight; my++) {
    for (let mx = 0; mx < gs.mapWidth; mx++) {
      if (gs.map[my][mx] > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(mmX + mx * cellW, mmY + my * cellH, cellW, cellH);
      }
    }
  }

  // Player on minimap
  const pmx = mmX + (gs.playerX / gs.mapWidth) * mmSize;
  const pmy = mmY + (gs.playerY / gs.mapHeight) * mmSize;
  ctx.fillStyle = '#22cc22';
  ctx.beginPath();
  ctx.arc(pmx, pmy, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Direction line
  ctx.strokeStyle = '#22cc22';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pmx, pmy);
  ctx.lineTo(pmx + Math.cos(gs.playerAngle) * 6, pmy + Math.sin(gs.playerAngle) * 6);
  ctx.stroke();

  // Enemies on minimap
  for (const enemy of gs.enemies) {
    if (!enemy.alive) continue;
    const emx = mmX + (enemy.x / gs.mapWidth) * mmSize;
    const emy = mmY + (enemy.y / gs.mapHeight) * mmSize;
    ctx.fillStyle = '#cc2222';
    ctx.beginPath();
    ctx.arc(emx, emy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Remote players on minimap (multiplayer)
  if (gs.multiplayerMode) {
    const playerIds = Array.from(gs.remotePlayers.keys());
    gs.remotePlayers.forEach((remote) => {
      if (!remote.alive) return;
      const rmx = mmX + (remote.x / gs.mapWidth) * mmSize;
      const rmy = mmY + (remote.y / gs.mapHeight) * mmSize;
      const colorIdx = playerIds.indexOf(remote.id) % MP_PLAYER_COLORS.length;
      ctx.fillStyle = MP_PLAYER_COLORS[colorIdx];
      ctx.beginPath();
      ctx.arc(rmx, rmy, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Exit on minimap (single-player only)
  if (!gs.multiplayerMode) {
    const exMx = mmX + (gs.exitX / gs.mapWidth) * mmSize;
    const exMy = mmY + (gs.exitY / gs.mapHeight) * mmSize;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(exMx, exMy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --------------------------------------------------------------------------
// Draw kill feed
// --------------------------------------------------------------------------

function drawKillFeed(ctx: CanvasRenderingContext2D, gs: FPSGameState): void {
  if (gs.killFeed.length === 0) return;
  const feedX = SCREEN_W - 140;
  const feedStartY = 160; // Below minimap
  const now = Date.now();

  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = '11px monospace';

  for (let i = 0; i < gs.killFeed.length; i++) {
    const entry = gs.killFeed[i];
    const age = now - entry.time;
    const alpha = age > KILL_FEED_DURATION - 1000 ? (KILL_FEED_DURATION - age) / 1000 : 1;
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = entry.color;
    ctx.fillText(entry.text, feedX, feedStartY + i * 14);
  }

  ctx.restore();
}

// --------------------------------------------------------------------------
// Draw consumable timers
// --------------------------------------------------------------------------

function drawConsumableTimers(ctx: CanvasRenderingContext2D, gs: FPSGameState): void {
  let timerY = SCREEN_H - 80;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px monospace';

  if (gs.damageBoostTimer > 0) {
    const secs = Math.ceil(gs.damageBoostTimer / 1000);
    ctx.fillStyle = '#ff4444';
    ctx.fillText(`DMG BOOST: ${secs}s`, 10, timerY);
    timerY -= 16;
  }

  if (gs.invincibilityTimer > 0) {
    const secs = Math.ceil(gs.invincibilityTimer / 1000);
    ctx.fillStyle = '#ffff44';
    ctx.fillText(`INVINCIBLE: ${secs}s`, 10, timerY);
    timerY -= 16;
  }

  // Show consumable inventory (bottom left)
  if (gs.consumables.length > 0 || gs.extraLives > 0) {
    ctx.font = '11px monospace';
    let invY = SCREEN_H - 15;
    ctx.fillStyle = '#aaa';
    ctx.fillText('[Q] Use Consumable', 180, invY);
    invY -= 14;
    if (gs.extraLives > 0) {
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`Extra Lives: ${gs.extraLives}`, 180, invY);
      invY -= 14;
    }
    for (const c of gs.consumables) {
      if (c.count <= 0) continue;
      const label =
        c.type === 'damage_boost'
          ? 'Dmg Boost'
          : c.type === 'invincibility'
            ? 'Invincible'
            : c.type;
      ctx.fillStyle = c.type === 'damage_boost' ? '#ff6666' : '#ffff66';
      ctx.fillText(`${label}: ${c.count}`, 180, invY);
      invY -= 14;
    }
  }

  ctx.restore();
}

// --------------------------------------------------------------------------
// Multiplayer scoreboard (compact, top center)
// --------------------------------------------------------------------------

function drawMultiplayerScoreboard(ctx: CanvasRenderingContext2D, gs: FPSGameState): void {
  const entries = Object.entries(gs.matchScores).sort((a, b) => b[1].kills - a[1].kills);
  if (entries.length === 0) return;

  const sbX = SCREEN_W / 2;
  const sbY = 8;
  const lineH = 14;
  const sbWidth = 200;
  const sbHeight = entries.length * lineH + 8;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(sbX - sbWidth / 2, sbY, sbWidth, sbHeight);

  ctx.font = '11px monospace';
  ctx.textBaseline = 'top';

  for (let i = 0; i < entries.length; i++) {
    const [id, score] = entries[i];
    const isLocal = id === gs.localPlayerId;
    ctx.textAlign = 'left';
    ctx.fillStyle = isLocal ? '#22cc22' : '#bbbbbb';
    ctx.fillText(score.name, sbX - sbWidth / 2 + 6, sbY + 4 + i * lineH);
    ctx.textAlign = 'right';
    ctx.fillText(`K:${score.kills} D:${score.deaths}`, sbX + sbWidth / 2 - 6, sbY + 4 + i * lineH);
  }

  ctx.restore();
}

// --------------------------------------------------------------------------
// Multiplayer overlay (waiting, countdown, death, match end)
// --------------------------------------------------------------------------

function drawMultiplayerOverlay(ctx: CanvasRenderingContext2D, gs: FPSGameState): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (gs.matchStatus === 'connecting') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('CONNECTING...', SCREEN_W / 2, SCREEN_H / 2);
  }

  if (gs.matchStatus === 'waiting') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(
      `WAITING FOR PLAYERS... ${gs.mpWaitingPlayers}/${gs.mpMaxPlayers}`,
      SCREEN_W / 2,
      SCREEN_H / 2 - 30,
    );

    if (!gs.mpReady) {
      ctx.fillStyle = '#4488ff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('Press R when ready', SCREEN_W / 2, SCREEN_H / 2 + 20);
    } else {
      ctx.fillStyle = '#22cc22';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('READY!', SCREEN_W / 2, SCREEN_H / 2 + 20);
    }
  }

  if (gs.matchStatus === 'countdown') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    const countText = gs.countdownSeconds > 0 ? `${gs.countdownSeconds}` : 'FIGHT!';
    const fontSize = gs.countdownSeconds > 0 ? 96 : 72;
    ctx.fillStyle = gs.countdownSeconds > 0 ? '#FFD700' : '#FF4444';
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillText(countText, SCREEN_W / 2, SCREEN_H / 2);
  }

  // Death screen
  if (gs.matchStatus === 'playing' && gs.playerHealth <= 0 && gs.mpKilledBy) {
    ctx.fillStyle = 'rgba(100, 0, 0, 0.5)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 32px monospace';
    ctx.fillText(`Killed by ${gs.mpKilledBy}`, SCREEN_W / 2, SCREEN_H / 2 - 20);
    ctx.fillStyle = '#ddd';
    ctx.font = '20px monospace';
    const respawnSec = Math.ceil(Math.max(0, gs.mpRespawnTimer) / 1000);
    ctx.fillText(`Respawning in ${respawnSec}...`, SCREEN_W / 2, SCREEN_H / 2 + 20);
  }

  // Match end screen
  if (gs.matchStatus === 'ended') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    const isWinner = gs.mpWinnerId === gs.localPlayerId;
    ctx.fillStyle = isWinner ? '#22CC22' : '#FF4444';
    ctx.font = 'bold 56px monospace';
    ctx.fillText(isWinner ? 'VICTORY!' : 'DEFEAT', SCREEN_W / 2, SCREEN_H / 2 - 80);

    // Final scoreboard
    const entries = Object.entries(gs.matchScores).sort((a, b) => b[1].kills - a[1].kills);
    ctx.font = '18px monospace';
    for (let i = 0; i < entries.length; i++) {
      const [id, score] = entries[i];
      const isLocal = id === gs.localPlayerId;
      ctx.fillStyle = isLocal ? '#22cc22' : '#bbbbbb';
      ctx.fillText(
        `${score.name}: ${score.kills} kills / ${score.deaths} deaths`,
        SCREEN_W / 2,
        SCREEN_H / 2 - 20 + i * 28,
      );
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '16px monospace';
    ctx.fillText('Click to exit', SCREEN_W / 2, SCREEN_H / 2 + 100);
  }

  ctx.restore();
}

// --------------------------------------------------------------------------
// Game over screen
// --------------------------------------------------------------------------

function drawGameOverScreen(ctx: CanvasRenderingContext2D, gs: FPSGameState): void {
  ctx.save();
  ctx.fillStyle = 'rgba(100, 0, 0, 0.6)';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#FF0000';
  ctx.font = 'bold 64px monospace';
  ctx.fillText('YOU DIED', SCREEN_W / 2, SCREEN_H / 2 - 60);

  ctx.fillStyle = '#ddd';
  ctx.font = '20px monospace';
  ctx.fillText(`Score: ${gs.score}`, SCREEN_W / 2, SCREEN_H / 2);
  ctx.fillText(`Kills: ${gs.kills}`, SCREEN_W / 2, SCREEN_H / 2 + 30);
  ctx.fillText(`Level: ${gs.level + 1}`, SCREEN_W / 2, SCREEN_H / 2 + 60);

  ctx.fillStyle = '#aaa';
  ctx.font = '16px monospace';
  ctx.fillText('Click to restart', SCREEN_W / 2, SCREEN_H / 2 + 110);

  ctx.restore();
}

// --------------------------------------------------------------------------
// Victory screen
// --------------------------------------------------------------------------

function drawVictoryScreen(ctx: CanvasRenderingContext2D, gs: FPSGameState): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#22CC22';
  ctx.font = 'bold 64px monospace';
  ctx.fillText('VICTORY', SCREEN_W / 2, SCREEN_H / 2 - 80);

  ctx.fillStyle = '#ddd';
  ctx.font = '20px monospace';
  ctx.fillText(`Total Score: ${gs.score}`, SCREEN_W / 2, SCREEN_H / 2 - 20);
  ctx.fillText(`Total Kills: ${gs.kills}`, SCREEN_W / 2, SCREEN_H / 2 + 10);
  ctx.fillText(
    `Secrets Found: ${gs.secretsFound} / ${gs.totalSecrets}`,
    SCREEN_W / 2,
    SCREEN_H / 2 + 40,
  );
  ctx.fillText(
    `Time: ${Math.floor(gs.gameTime / 60)}m ${Math.floor(gs.gameTime % 60)}s`,
    SCREEN_W / 2,
    SCREEN_H / 2 + 70,
  );

  // Show vault unlock hint if applicable
  if (!gs.secretLevelUnlocked && gs.level >= 2) {
    ctx.fillStyle = '#FFD700';
    ctx.font = '14px monospace';
    ctx.fillText(
      'Purchase The Vault Access Key to unlock Level 4!',
      SCREEN_W / 2,
      SCREEN_H / 2 + 100,
    );
  }

  ctx.fillStyle = '#aaa';
  ctx.font = '16px monospace';
  ctx.fillText('Click to play again', SCREEN_W / 2, SCREEN_H / 2 + 130);

  ctx.restore();
}
