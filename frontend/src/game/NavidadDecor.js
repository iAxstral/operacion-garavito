import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS } from './mapLayout';
import { canvasTexture, seeded, SHADOW_KEY } from './HauntedDecor';

// Ambiente de Navidad dentro del edificio (la contraparte de HauntedDecor para
// Halloween): arbolitos marchitos con luces que fallan, regalos rotos y carambanos.
// Todo es solo visual: nada de esto tiene cuerpo fisico ni lo conoce el servidor.

export const TREE_KEY = 'xm_tree';
export const GIFT_KEY = 'xm_gift';
export const ICICLES_KEY = 'xm_icicles';
export const FLAKE_KEY = 'xm_flake';

const WALLISH = new Set(['wall', 'glass']);
const BULB_TINTS = [0xff3b30, 0x3ddc84, 0xffd34d, 0x4da3ff];
const DEPTH_SNOW = 4995;

export function bakeNavidadTextures(scene) {
  // Arbolito de Navidad marchito: ramas caidas, esferas rotas y la estrella torcida.
  canvasTexture(scene, TREE_KEY, 44, 60, (ctx) => {
    ctx.fillStyle = '#3a2412';
    ctx.fillRect(19, 48, 6, 10);
    [[22, 8, 9, 20], [22, 18, 14, 34], [22, 30, 19, 50]].forEach(([cx, top, half, bottom], i) => {
      ctx.fillStyle = ['#1f3b26', '#1a3321', '#152a1b'][i];
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.lineTo(cx + half, bottom);
      // Borde de abajo irregular, como agujas que se cayeron.
      for (let x = cx + half; x >= cx - half; x -= 4) ctx.lineTo(x, bottom - ((x * 7) % 5));
      ctx.lineTo(cx - half, bottom);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(220, 235, 245, 0.55)';
    [[16, 24, 6], [26, 36, 7], [12, 44, 6]].forEach(([x, y, w]) => ctx.fillRect(x, y, w, 2));
    [[16, 27, '#9b1010'], [28, 31, '#c9a227'], [14, 41, '#2a5fa8'], [30, 46, '#9b1010'], [22, 38, '#c9a227']]
      .forEach(([x, y, color]) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      });
    // Una esfera rota en el suelo.
    ctx.fillStyle = '#6e0c0c';
    ctx.beginPath();
    ctx.arc(34, 56, 3, Math.PI, Math.PI * 2);
    ctx.fill();
    // Estrella caida hacia un lado.
    ctx.fillStyle = '#b8962a';
    ctx.save();
    ctx.translate(25, 7);
    ctx.rotate(0.45);
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? 6 : 2.5;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // Regalo abierto a la fuerza: la tapa al lado y algo oscuro adentro.
  canvasTexture(scene, GIFT_KEY, 34, 28, (ctx) => {
    ctx.fillStyle = '#5e0b0b';
    ctx.fillRect(3, 10, 22, 16);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(12, 10, 4, 16);
    ctx.fillStyle = '#120404';
    ctx.fillRect(4, 10, 20, 4);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(9, 11, 2, 2);
    ctx.fillRect(17, 11, 2, 2);
    ctx.save();
    ctx.translate(27, 16);
    ctx.rotate(0.6);
    ctx.fillStyle = '#7d1010';
    ctx.fillRect(-6, -3, 12, 5);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(-1, -3, 3, 5);
    ctx.restore();
    ctx.strokeStyle = 'rgba(120, 10, 10, 0.8)';
    ctx.beginPath();
    ctx.moveTo(6, 26);
    ctx.lineTo(4, 28);
    ctx.stroke();
  });

  // Carambanos colgando de la esquina del techo, con escarcha.
  canvasTexture(scene, ICICLES_KEY, 72, 46, (ctx) => {
    const frost = ctx.createLinearGradient(0, 0, 0, 10);
    frost.addColorStop(0, 'rgba(235, 245, 255, 0.85)');
    frost.addColorStop(1, 'rgba(235, 245, 255, 0)');
    ctx.fillStyle = frost;
    ctx.fillRect(0, 0, 72, 10);
    [[4, 22], [11, 14], [17, 34], [25, 18], [33, 28], [41, 12], [48, 24], [56, 16], [64, 30]].forEach(([x, h]) => {
      const ice = ctx.createLinearGradient(x, 0, x, h);
      ice.addColorStop(0, 'rgba(225, 240, 255, 0.9)');
      ice.addColorStop(1, 'rgba(160, 200, 240, 0.25)');
      ctx.fillStyle = ice;
      ctx.beginPath();
      ctx.moveTo(x - 3, 0);
      ctx.lineTo(x + 3, 0);
      ctx.lineTo(x, h);
      ctx.closePath();
      ctx.fill();
    });
  });

  canvasTexture(scene, FLAKE_KEY, 6, 6, (ctx) => {
    const flake = ctx.createRadialGradient(3, 3, 0, 3, 3, 3);
    flake.addColorStop(0, 'rgba(255, 255, 255, 1)');
    flake.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = flake;
    ctx.fillRect(0, 0, 6, 6);
  });
}

/**
 * Arbolitos y regalos junto a las paredes y carambanos en las esquinas de los salones,
 * en los mismos lugares que Halloween pone calabazas y telaranas.
 */
export function decorateFloorNavidad(scene, grid, lighting, { building, floor }) {
  const rand = seeded(`${building}-${floor}`);
  const cell = (x, y) => grid[y]?.[x] ?? null;
  const isWall = (x, y) => WALLISH.has(cell(x, y)?.type);
  const isFloor = (x, y) => cell(x, y)?.type === 'floor';
  const nearStairs = (x, y) => [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => {
    const type = cell(x + dx, y + dy)?.type;
    return type === 'stair' || type === 'landing';
  }));

  const corners = [];
  const wallSpots = [];
  for (let y = 1; y < MAP_ROWS - 1; y += 1) {
    for (let x = 1; x < MAP_COLS - 1; x += 1) {
      if (!isFloor(x, y)) continue;
      if (isWall(x, y - 1) && isWall(x - 1, y)) corners.push({ x, y, flip: false });
      else if (isWall(x, y - 1) && isWall(x + 1, y)) corners.push({ x, y, flip: true });
      else if (isWall(x, y - 1) && isFloor(x, y + 1) && !nearStairs(x, y)) wallSpots.push({ x, y });
    }
  }

  corners.filter(() => rand() < 0.6).slice(0, 18).forEach(({ x, y, flip }) => {
    const left = x * TILE + (flip ? TILE : 0);
    scene.add.image(left, y * TILE, ICICLES_KEY)
      .setOrigin(flip ? 1 : 0, 0)
      .setScale(0.8 + rand() * 0.4)
      .setAlpha(0.6 + rand() * 0.3)
      .setDepth(4);
  });

  // Separados entre si (no dos en el mismo pasillo), igual que las calabazas.
  const placed = [];
  wallSpots
    .map((spot) => ({ ...spot, order: rand() }))
    .sort((a, b) => a.order - b.order)
    .forEach((spot) => {
      if (placed.length >= 7) return;
      if (placed.some((p) => Math.abs(p.x - spot.x) + Math.abs(p.y - spot.y) < 7)) return;
      placed.push(spot);
    });

  placed.forEach(({ x, y }, i) => {
    const px = x * TILE + TILE / 2 + (rand() - 0.5) * 20;
    const py = y * TILE + 22;
    const tree = i % 3 !== 2;
    scene.add.image(px, py, SHADOW_KEY).setDepth(1.6).setAlpha(0.7);
    scene.add.image(px, tree ? py - 18 : py - 6, tree ? TREE_KEY : GIFT_KEY).setDepth(py).setScale(1.1);
    // Luces de colores que titilan; una de cada arbol esta fallando.
    const glow = scene.add.image(px, py - 14, 'light_glow')
      .setTint(tree ? BULB_TINTS[i % BULB_TINTS.length] : 0xb3140c)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(tree ? 130 : 90, tree ? 130 : 90)
      .setAlpha(0.4)
      .setDepth(5001);
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.12, to: 0.5 },
      duration: tree ? 600 + rand() * 500 : 1800,
      yoyo: true,
      repeat: -1,
      ease: tree ? 'Stepped' : 'Sine.easeInOut',
      easeParams: tree ? [3] : undefined,
    });
    lighting.addLight({ x: px, y: py - 14, radius: tree ? 115 : 80, mode: 'flicker', bulb: false });
  });
}

/** Nieve que cae alrededor del jugador (en Halloween son motas de polvo). */
export function startSnow(scene, target) {
  const emitter = scene.add.particles(0, 0, FLAKE_KEY, {
    emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-560, -380, 1120, 760) },
    lifespan: { min: 5000, max: 8000 },
    speedX: { min: -14, max: 6 },
    speedY: { min: 18, max: 38 },
    scale: { min: 0.5, max: 1.2 },
    alpha: { start: 0.75, end: 0 },
    tint: 0xe6f4ff,
    frequency: 70,
    quantity: 1,
  });
  emitter.setDepth(DEPTH_SNOW);
  emitter.startFollow(target);
  return emitter;
}
