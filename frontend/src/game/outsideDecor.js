import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS } from './mapLayout';

export const OUTSIDE_MARGIN_TILES = 18;

export const SHEET_KEY = 'outside_tiles';
export const PROPS_KEY = 'outside_props';
const SRC_TILE = 32;
const SCALE = TILE / SRC_TILE;

// Indices del tileset exterior del Edificio C (gid - 1). Ver imagenes/edificioC/EXTERIOR_C_TILES.md.
const PAVER = [0, 0, 1, 1];
const PAVER_VAR = 1;
const PLAZA = 2;
const GRASS = [5, 5, 6, 6, 6, 7];
const DIRT = 8;
const EDGE_GRASS = { n: 9, s: 10, e: 11, w: 12 };
const HEDGE = 13;
const PAVER_DECALS = [27, 28, 29, 30, 32, 32];
const GRASS_DECALS = [28, 31, 32];

// Fachada de ladrillo calido del Edificio C: columnas crema en el portico, ventanas variadas
// (mayoria sanas, rotas cerca de combate, tapiadas cerca de refugios, oscuras cerca del jefe).
const C = {
  brick: 14, brickBase: 15, windowOk: 16, windowBroken: 17, windowBoarded: 18, windowDark: 19,
  column: 20, door: 21, louver: 22, herringA: 23, herringB: 24,
};

const PAVER_RING = 2;
const HEDGE_RING = 4;
const HEDGE_RED_TINTS = [0x2c0d09, 0x3a120c, 0x1f0a08];
const BOUGAINVILLEA_TINT = 0x7a1450;

const MOUNTAIN_ROWS = 4;

const DEPTH_GROUND = -20;
const DEPTH_DECAL = -19;
const DEPTH_SKY = -17;
const DEPTH_MOUNTAIN = -16;
const DEPTH_PROP = -5;

// Patio circular al sur del edificio, como el de las fotos del Edificio C: adoquin en
// abanico, tres farolas en triangulo, un arbol central y bancas rojas alrededor.
const PLAZA_CX = MAP_COLS / 2;
const PLAZA_CY = MAP_ROWS + 9;
const PLAZA_RADIUS = 6.5;
const PLAZA_BORDER = 1;

export function preloadOutside(scene) {
  scene.load.spritesheet(SHEET_KEY, '/outside/exterior_c_tiles.png', {
    frameWidth: SRC_TILE,
    frameHeight: SRC_TILE,
  });
  scene.load.atlas(PROPS_KEY, '/outside/exterior_c_props.png', '/outside/exterior_c_props.json');
}

// PRNG determinista para que el exterior sea igual en cada piso y en cada cliente.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, rand) {
  return list[Math.floor(rand() * list.length)];
}

function isInside(tx, ty) {
  return tx >= 0 && ty >= 0 && tx < MAP_COLS && ty < MAP_ROWS;
}

// Distancia en tiles al borde del mapa (0 dentro).
function ringOf(tx, ty) {
  const dx = Math.max(-tx, tx - (MAP_COLS - 1), 0);
  const dy = Math.max(-ty, ty - (MAP_ROWS - 1), 0);
  return { d: Math.max(dx, dy) };
}

// Info del patio circular en esta celda, o null si esta fuera de el.
function plazaAt(tx, ty) {
  const dx = tx - PLAZA_CX;
  const dy = ty - PLAZA_CY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > PLAZA_RADIUS) return null;
  const angle = Math.atan2(dy, dx);
  const sector = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 12) % 12;
  return { border: dist > PLAZA_RADIUS - PLAZA_BORDER, sector };
}

function plazaPoint(radius, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return {
    x: (PLAZA_CX + Math.cos(a) * radius) * TILE + TILE / 2,
    y: (PLAZA_CY + Math.sin(a) * radius) * TILE + TILE / 2,
  };
}

// Que hay en cada celda: patio circular al sur, adoquin junto al edificio, seto y cesped.
function kindAt(tx, ty, grid) {
  if (isInside(tx, ty)) return grid[ty][tx] ? 'building' : 'paver';
  const plaza = plazaAt(tx, ty);
  if (plaza) return plaza.border ? 'plaza-border' : 'plaza';
  const { d } = ringOf(tx, ty);
  if (d <= PAVER_RING) return 'paver';
  return d === HEDGE_RING ? 'hedge' : 'grass';
}

function edgeFrame(tx, ty, grid) {
  if (kindAt(tx, ty - 1, grid) === 'grass') return EDGE_GRASS.n;
  if (kindAt(tx, ty + 1, grid) === 'grass') return EDGE_GRASS.s;
  if (kindAt(tx - 1, ty, grid) === 'grass') return EDGE_GRASS.w;
  if (kindAt(tx + 1, ty, grid) === 'grass') return EDGE_GRASS.e;
  return null;
}

function cell(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function addProp(scene, frame, x, y, { scale = SCALE, origin = null, flip = false } = {}) {
  const prop = scene.add.image(x, y, PROPS_KEY, frame).setScale(scale);
  if (origin) prop.setOrigin(origin[0], origin[1]);
  if (flip) prop.setFlipX(true);
  prop.setDepth(DEPTH_PROP + prop.y / 10000);
  return prop;
}

function drawMountains(scene, rand) {
  const left = -OUTSIDE_MARGIN_TILES * TILE;
  const width = (MAP_COLS + 2 * OUTSIDE_MARGIN_TILES) * TILE;
  const top = -OUTSIDE_MARGIN_TILES * TILE;
  const base = top + MOUNTAIN_ROWS * TILE;

  scene.add.rectangle(left, top, width, MOUNTAIN_ROWS * TILE, 0x2b3a3d).setOrigin(0, 0).setDepth(DEPTH_SKY);

  [
    { color: 0x33474a, amp: 150, lift: 90, step: 160 },
    { color: 0x1d2e2a, amp: 110, lift: 20, step: 110 },
  ].forEach(({ color, amp, lift, step }, layer) => {
    const g = scene.add.graphics().setDepth(DEPTH_MOUNTAIN + layer * 0.1);
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(left, base);
    let phase = rand() * 10;
    for (let x = left; x <= left + width + step; x += step) {
      phase += 0.9 + rand() * 0.8;
      const ridge = base - lift - (0.55 + 0.45 * Math.sin(phase)) * amp - rand() * 30;
      g.lineTo(x, ridge);
    }
    g.lineTo(left + width, base);
    g.closePath();
    g.fillPath();
  });
}

function renderGround(scene, grid, rand) {
  const m = OUTSIDE_MARGIN_TILES;
  const treeSpots = [];

  for (let ty = -m; ty < MAP_ROWS + m; ty += 1) {
    for (let tx = -m; tx < MAP_COLS + m; tx += 1) {
      const kind = kindAt(tx, ty, grid);
      if (kind === 'building') continue;

      const { x, y } = cell(tx, ty);
      const inMountains = ty < -m + MOUNTAIN_ROWS;
      let frame;
      if (kind === 'plaza-border') frame = PAVER[0];
      else if (kind === 'plaza') frame = plazaAt(tx, ty).sector % 2 === 0 ? PLAZA : PAVER_VAR;
      else if (kind === 'paver') frame = edgeFrame(tx, ty, grid) ?? pick(PAVER, rand);
      else if (kind === 'hedge') frame = HEDGE;
      else frame = rand() < 0.05 ? DIRT : pick(GRASS, rand);

      // Un seto se apoya sobre cesped, no sobre el vacio.
      if (kind === 'hedge') scene.add.image(x, y, SHEET_KEY, GRASS[0]).setScale(SCALE).setDepth(DEPTH_GROUND);
      const tile = scene.add.image(x, y, SHEET_KEY, frame).setScale(SCALE);
      tile.setDepth(kind === 'hedge' ? DEPTH_DECAL : DEPTH_GROUND);
      if (kind === 'hedge') {
        // Setos con hojas rojizas y, de vez en cuando, buganvilia magenta como en las fotos.
        const tint = rand() < 0.15 ? BOUGAINVILLEA_TINT : pick(HEDGE_RED_TINTS, rand);
        if (rand() < 0.75) tile.setTint(tint).setTintMode(Phaser.TintModes.ADD);
      }

      const decalChance = kind === 'paver' || kind === 'plaza' ? 0.04 : kind === 'grass' ? 0.1 : 0;
      if (rand() < decalChance) {
        const decal = pick(kind === 'grass' ? GRASS_DECALS : PAVER_DECALS, rand);
        scene.add.image(x, y, SHEET_KEY, decal).setScale(SCALE).setDepth(DEPTH_DECAL).setAlpha(0.8);
      }

      if (kind === 'grass' && !inMountains) {
        const { d } = ringOf(tx, ty);
        // Pocos arboles cerca del edificio y mas espesos hacia el fondo.
        const chance = d < 7 ? 0.05 : d < 9 ? 0.14 : 0.28;
        if (rand() < chance) treeSpots.push({ x, y });
      }
    }
  }

  treeSpots.forEach(({ x, y }) => {
    const jitterX = (rand() - 0.5) * TILE * 0.8;
    const jitterY = (rand() - 0.5) * TILE * 0.8;
    addProp(scene, 'arbol', x + jitterX, y + jitterY, {
      scale: 1.05 + rand() * 0.45,
      origin: [0.5, 0.9],
      flip: rand() < 0.5,
    });
  });
}

let lampCount = 0;

// Farola de calle: algunas siguen con corriente, la mayoria quedaron apagadas.
function addStreetLamp(scene, lighting, x, y, rand) {
  addProp(scene, 'farola', x, y, { origin: [0.5, 0.95] });
  lampCount += 1;
  if (lampCount % 3 !== 1) return;
  const roll = rand();
  lighting?.addLight({ x, y: y - 58, radius: 230, mode: roll < 0.4 ? 'broken' : roll < 0.7 ? 'flicker' : 'steady' });
}

// Farola del patio: siempre encendida, es el unico rincon realmente seguro afuera.
function addPlazaLamp(scene, lighting, x, y) {
  addProp(scene, 'farola', x, y, { origin: [0.5, 0.95] });
  lighting?.addLight({ x, y: y - 58, radius: 210, mode: 'steady' });
}

function renderFurnishings(scene, rand, lighting) {
  const at = (tx, ty) => cell(tx, ty);
  const jitter = () => (rand() - 0.5) * 16;

  // Farolas de calle y canecas a lo largo de los cuatro lados.
  for (let tx = 4; tx < MAP_COLS; tx += 8) {
    addStreetLamp(scene, lighting, at(tx, -2).x, at(tx, -2).y, rand);
    if (rand() < 0.5) addProp(scene, 'caneca', at(tx, -2).x + 40, at(tx, -2).y);
  }
  for (let ty = 5; ty < MAP_ROWS; ty += 9) {
    [-2, MAP_COLS + 1].forEach((tx) => addStreetLamp(scene, lighting, at(tx, ty).x, at(tx, ty).y, rand));
  }

  // Bancas rojas frente a los setos, en los lados que no dan al patio.
  for (let tx = 8; tx < MAP_COLS; tx += 11) {
    addProp(scene, 'banca_roja', at(tx, -2).x, at(tx, -2).y);
  }
  for (let ty = 8; ty < MAP_ROWS; ty += 10) {
    addProp(scene, 'banca_roja', at(-2, ty).x, at(-2, ty).y);
    addProp(scene, 'banca_roja', at(MAP_COLS + 1, ty).x, at(MAP_COLS + 1, ty).y);
  }

  // Busto y maquina expendedora junto a la fachada, como en el corredor de la foto.
  addProp(scene, 'busto', at(14, MAP_ROWS + 1).x, at(14, MAP_ROWS + 1).y, { origin: [0.5, 0.85] });
  addProp(scene, 'maquina_expendedora', at(16, MAP_ROWS + 1).x, at(16, MAP_ROWS + 1).y, { origin: [0.5, 0.9] });

  // El patio circular: arbol central, tres farolas en triangulo y bancas alrededor.
  const center = plazaPoint(0, 0);
  addProp(scene, 'arbol', center.x, center.y, { scale: 1.6, origin: [0.5, 0.9] });
  [90, 210, 330].forEach((deg) => {
    const { x, y } = plazaPoint(3.4, deg);
    addPlazaLamp(scene, lighting, x, y);
  });
  for (let i = 0; i < 8; i += 1) {
    const deg = (360 / 8) * i + 15;
    const { x, y } = plazaPoint(PLAZA_RADIUS - 0.4, deg);
    addProp(scene, 'banca_roja', x, y);
  }

  // Punto de encuentro con sombrillas y mesas altas, al borde del patio (como el banco con
  // mochila y sombrillas de la foto).
  [[6.5, 200], [6.5, 250]].forEach(([radius, deg]) => {
    const { x, y } = plazaPoint(radius, deg);
    addProp(scene, 'sombrilla_roja', x + jitter(), y + jitter());
  });
  [[5.5, 225]].forEach(([radius, deg]) => {
    const { x, y } = plazaPoint(radius, deg);
    addProp(scene, 'mesa_redonda', x + jitter(), y + jitter());
    addProp(scene, 'silla_negra', x + 20, y + 18);
  });
}

// Viste las paredes que dan al exterior con la fachada de ladrillo calido del Edificio C:
// columnas crema en el portico, celosias en los remates y ventanas variadas (rotas cerca de
// combate, tapiadas cerca de refugios, oscuras cerca del jefe), zocalo claro en la base.
function renderFacade(scene, grid, rand) {
  const open = (x, y) => !isInside(x, y) || !grid[y][x];

  for (let ty = 0; ty < MAP_ROWS; ty += 1) {
    for (let tx = 0; tx < MAP_COLS; tx += 1) {
      if (grid[ty][tx]?.type !== 'wall') continue;
      const south = open(tx, ty + 1);
      const north = open(tx, ty - 1);
      const sides = open(tx - 1, ty) || open(tx + 1, ty);
      if (!south && !north && !sides) continue;
      const facing = south || north;

      let frame;
      if (facing) {
        const roll = rand();
        if (tx % 6 === 0) frame = C.column;
        else if (roll < 0.05) frame = C.windowBroken;
        else if (roll < 0.09) frame = C.windowBoarded;
        else if (roll < 0.12) frame = C.windowDark;
        else if (roll < 0.6) frame = C.windowOk;
        else frame = C.brick;
      } else {
        frame = rand() < 0.15 ? C.louver : C.brick;
      }

      const { x, y } = cell(tx, ty);
      scene.add.image(x, y, SHEET_KEY, frame).setScale(SCALE).setDepth(0.5);
      // Zocalo claro en la base del muro, donde el ladrillo toca el piso.
      if (facing && open(tx, ty + 1) && !isInside(tx, ty + 1)) {
        scene.add.image(x, y + TILE * 0.35, SHEET_KEY, C.brickBase).setScale(SCALE * 0.3).setDepth(0.6).setAlpha(0.9);
      }
    }
  }
}

// Rellena todo lo que no es edificio con el entorno del Edificio C: adoquin junto a los
// muros, seto y cesped alrededor, el patio circular con sus tres farolas al sur y las
// montanas del fondo, mas la fachada de ladrillo, en tono post-apocaliptico.
export function renderOutside(scene, grid, lighting) {
  lampCount = 0;
  const rand = seeded(20240921);
  renderGround(scene, grid, rand);
  drawMountains(scene, rand);
  renderFacade(scene, grid, rand);
  renderFurnishings(scene, rand, lighting);
}
