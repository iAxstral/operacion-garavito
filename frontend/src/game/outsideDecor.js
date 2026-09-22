import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS } from './mapLayout';

export const OUTSIDE_MARGIN_TILES = 12;

const SHEET_KEY = 'outside_tiles';
const PROPS_KEY = 'outside_props';
const SRC_TILE = 32;
const SCALE = TILE / SRC_TILE;

// Indices del tileset exterior del Edificio C (gid - 1). Ver imagenes/edificioC/EXTERIOR_C_TILES.md.
const PAVER = [0, 0, 1, 1];
const PLAZA = [2];
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
const PATH_MAX_D = 9;
const PATH_SPACING = 24;
const HEDGE_RED_TINTS = [0x2c0d09, 0x3a120c, 0x1f0a08];

const MOUNTAIN_ROWS = 4;

const DEPTH_GROUND = -20;
const DEPTH_DECAL = -19;
const DEPTH_SKY = -17;
const DEPTH_MOUNTAIN = -16;
const DEPTH_PROP = -5;

// Plaza de concreto (patio central) con el busto y las maquinas expendedoras, como en la foto.
const PLAZA_BOX = { x0: MAP_COLS, x1: MAP_COLS + 8, y0: 17, y1: 27 };

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
  return { d: Math.max(dx, dy), alongX: dy >= dx };
}

// Sendero de adoquin que cruza el seto y se curva hacia afuera, como en la foto del edificio.
export function pathCenter(j, d) {
  return 5 + PATH_SPACING * j + Math.round(1.6 * Math.sin(d * 0.55 + j * 2));
}

function onPath(along, d) {
  if (d < PAVER_RING + 1 || d > PATH_MAX_D) return false;
  const c = pathCenter(Math.round((along - 5) / PATH_SPACING), d);
  return along === c || along === c + 1;
}

function inPlaza(tx, ty) {
  return tx >= PLAZA_BOX.x0 && tx <= PLAZA_BOX.x1 && ty >= PLAZA_BOX.y0 && ty <= PLAZA_BOX.y1;
}

// Que hay en cada celda: patios de adoquin junto al edificio, seto, cesped y plaza.
function kindAt(tx, ty, grid) {
  if (isInside(tx, ty)) return grid[ty][tx] ? 'building' : 'paver';
  if (inPlaza(tx, ty)) return 'plaza';
  const { d, alongX } = ringOf(tx, ty);
  if (d <= PAVER_RING) return 'paver';
  if (onPath(alongX ? tx : ty, d)) return 'paver';
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
      if (kind === 'plaza') frame = pick(PLAZA, rand);
      else if (kind === 'paver') frame = edgeFrame(tx, ty, grid) ?? pick(PAVER, rand);
      else if (kind === 'hedge') frame = HEDGE;
      else frame = rand() < 0.05 ? DIRT : pick(GRASS, rand);

      // Un seto se apoya sobre cesped, no sobre el vacio.
      if (kind === 'hedge') scene.add.image(x, y, SHEET_KEY, GRASS[0]).setScale(SCALE).setDepth(DEPTH_GROUND);
      const tile = scene.add.image(x, y, SHEET_KEY, frame).setScale(SCALE);
      tile.setDepth(kind === 'hedge' ? DEPTH_DECAL : DEPTH_GROUND);
      // Setos de hojas rojizas como los del edificio real.
      if (kind === 'hedge' && rand() < 0.7) tile.setTint(pick(HEDGE_RED_TINTS, rand)).setTintMode(Phaser.TintModes.ADD);

      const decalChance = kind === 'paver' ? 0.04 : kind === 'grass' ? 0.1 : 0;
      if (rand() < decalChance) {
        const decal = pick(kind === 'paver' ? PAVER_DECALS : GRASS_DECALS, rand);
        scene.add.image(x, y, SHEET_KEY, decal).setScale(SCALE).setDepth(DEPTH_DECAL).setAlpha(0.8);
      }

      if (kind === 'grass' && !inMountains) {
        const { d } = ringOf(tx, ty);
        // Pocos arboles cerca del edificio y mas espesos hacia el fondo.
        const chance = d < 7 ? 0.05 : d < 9 ? 0.14 : 0.3;
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

// Mobiliario de la plaza: repartido por los cuatro lados del edificio.
let lampCount = 0;

function addLamp(scene, lighting, x, y, rand) {
  addProp(scene, 'farola', x, y, { origin: [0.5, 0.95] });
  // Solo algunas farolas siguen con corriente; el resto quedan apagadas.
  lampCount += 1;
  if (lampCount % 3 !== 1) return;
  const roll = rand();
  lighting?.addLight({ x, y: y - 58, radius: 230, mode: roll < 0.4 ? 'broken' : roll < 0.7 ? 'flicker' : 'steady' });
}

function renderFurnishings(scene, rand, lighting) {
  const lastRow = MAP_ROWS + 1;
  const lastCol = MAP_COLS + 1;
  const at = (tx, ty) => cell(tx, ty);
  const jitter = () => (rand() - 0.5) * 16;

  // Farolas y canecas a lo largo de los cuatro lados.
  for (let tx = 4; tx < MAP_COLS; tx += 8) {
    [-2, lastRow].forEach((ty) => {
      const { x, y } = at(tx, ty);
      addLamp(scene, lighting, x, y, rand);
      if (rand() < 0.5) addProp(scene, 'caneca', x + 40, y);
    });
  }
  for (let ty = 5; ty < MAP_ROWS; ty += 9) {
    [-2, lastCol].forEach((tx) => {
      const { x, y } = at(tx, ty);
      addLamp(scene, lighting, x, y, rand);
    });
  }

  // Bancas rojas frente a los setos.
  for (let tx = 8; tx < MAP_COLS; tx += 11) {
    addProp(scene, 'banca_roja', at(tx, -2).x, at(tx, -2).y);
    addProp(scene, 'banca_roja', at(tx + 3, lastRow).x, at(tx + 3, lastRow).y);
  }
  for (let ty = 8; ty < MAP_ROWS; ty += 10) {
    addProp(scene, 'banca_roja', at(-2, ty).x, at(-2, ty).y);
  }

  // Terraza de sombrillas rojas y mesas altas con banquitos, como bajo la escalera del patio.
  [6, 9, 14, 28, 31].forEach((tx) => {
    const { x, y } = at(tx, lastRow);
    addProp(scene, 'sombrilla_roja', x + jitter(), y + jitter());
  });
  [7, 12, 30].forEach((tx) => {
    const { x, y } = at(tx, lastRow);
    addProp(scene, 'mesa_redonda', x + jitter(), y + jitter());
    addProp(scene, 'silla_negra', x + 20 + jitter(), y + 18 + jitter());
  });
  addProp(scene, 'busto', at(20, lastRow).x, at(20, lastRow).y, { origin: [0.5, 0.85] });
  addProp(scene, 'maquina_expendedora', at(22, lastRow).x, at(22, lastRow).y, { origin: [0.5, 0.9] });

  // Arboles de sombra en los rincones de cesped, junto a los setos.
  [[-5, -5], [MAP_COLS + 5, -5], [-5, MAP_ROWS + 5], [MAP_COLS + 5, MAP_ROWS + 4], [19, MAP_ROWS + 5]].forEach(([tx, ty]) => {
    addProp(scene, 'arbol', at(tx, ty).x, at(tx, ty).y, { scale: 1.3, origin: [0.5, 0.85] });
  });

  // Ajedrez gigante en la plaza de concreto -> aqui van mesas altas del punto de encuentro.
  for (let i = 0; i < 6; i += 1) {
    const tx = PLAZA_BOX.x0 + 1 + Math.floor(rand() * (PLAZA_BOX.x1 - PLAZA_BOX.x0 - 1));
    const ty = PLAZA_BOX.y0 + 1 + Math.floor(rand() * (PLAZA_BOX.y1 - PLAZA_BOX.y0 - 1));
    const { x, y } = at(tx, ty);
    addProp(scene, i % 2 === 0 ? 'mesa_redonda' : 'silla_negra', x, y);
  }
  addProp(scene, 'busto', at(PLAZA_BOX.x0 + 4, PLAZA_BOX.y0 + 1).x, at(PLAZA_BOX.x0 + 4, PLAZA_BOX.y0 + 1).y, {
    origin: [0.5, 0.85],
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

// Rellena todo lo que no es edificio con el entorno del Edificio C: patios de adoquin, setos,
// cesped, plaza y las montanas del fondo, mas la fachada de ladrillo, en tono post-apocaliptico.
export function renderOutside(scene, grid, lighting) {
  lampCount = 0;
  const rand = seeded(20240921);
  renderGround(scene, grid, rand);
  drawMountains(scene, rand);
  renderFacade(scene, grid, rand);
  renderFurnishings(scene, rand, lighting);
}
