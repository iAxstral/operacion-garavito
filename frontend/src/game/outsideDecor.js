import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS } from './mapLayout';

export const OUTSIDE_MARGIN_TILES = 12;

// Claves del exterior del Edificio C (MainScene tambien las usa para el patio interior).
export const SHEET_KEY = 'outside_tiles';
export const PROPS_KEY = 'outside_props';
// Exterior del Edificio F: otro tileset y otro atlas, con claves propias para que
// jugar un edificio y luego el otro en la misma pagina no reuse texturas cacheadas.
const SHEET_KEY_F = 'outside_tiles_f';
const PROPS_KEY_F = 'outside_props_f';
const SRC_TILE = 32;
const SCALE = TILE / SRC_TILE;

// Indices del tileset exterior del Edificio C (gid - 1). Ver imagenes/edificioC/EXTERIOR_C_TILES.md.
const PAVER = [0, 0, 1, 1];
const GRASS = [5, 5, 6, 6, 6, 7];
const DIRT = 8;
const EDGE_GRASS = { n: 9, s: 10, e: 11, w: 12 };
const HEDGE = 13;
const PAVER_DECALS = [27, 28, 29, 30, 32, 32];
const GRASS_DECALS = [28, 31, 32];

// Indices del tileset exterior del Edificio F (gid - 1). Ver imagenes/outside f/assetsf/EXTERIOR_TILES.md.
const F = {
  paver: [0, 0, 1, 2, 3], plaza: [4, 4, 5], grass: [6, 6, 7, 8], dirt: 9,
  edge: { n: 10, s: 11, w: 12, e: 13 }, hedge: [14, 14, 15],
  concreteWall: 16, concreteStained: 17, concreteF: 18, concreteSlit: 19, concreteBase: 20,
  louver: 23, louverCol: 24, louverBroken: 25, louverLit: 26,
  glassGreen: 28, glassCracked: 29, glassBoarded: 30, glassDark: 31, steelColumn: 32,
  shadowOverhang: 35,
  paverDecals: [39, 41, 42, 43, 43, 36, 38], grassDecals: [40, 42, 40],
};

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

export function preloadOutside(scene) {
  scene.load.spritesheet(SHEET_KEY, '/outside/exterior_c_tiles.png', {
    frameWidth: SRC_TILE,
    frameHeight: SRC_TILE,
  });
  scene.load.atlas(PROPS_KEY, '/outside/exterior_c_props.png', '/outside/exterior_c_props.json');
  scene.load.spritesheet(SHEET_KEY_F, '/outside/exterior_tiles.png', {
    frameWidth: SRC_TILE,
    frameHeight: SRC_TILE,
  });
  scene.load.atlas(PROPS_KEY_F, '/outside/exterior_props.png', '/outside/exterior_props.json');
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

// Que hay en cada celda: adoquin junto al edificio, seto y cesped. El patio real del
// Edificio C ahora vive dentro del vestibulo (ver mapLayout.js), no aqui afuera.
function kindAt(tx, ty, grid) {
  if (isInside(tx, ty)) return grid[ty][tx] ? 'building' : 'paver';
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

function addProp(scene, frame, x, y, { key = PROPS_KEY, scale = SCALE, origin = null, flip = false } = {}) {
  const prop = scene.add.image(x, y, key, frame).setScale(scale);
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
      if (kind === 'paver') frame = edgeFrame(tx, ty, grid) ?? pick(PAVER, rand);
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

      const decalChance = kind === 'paver' ? 0.04 : kind === 'grass' ? 0.1 : 0;
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

  // Sombrillas y mesas junto a la fachada sur, como el banco con mochila de la foto.
  [[19, MAP_ROWS + 1], [21, MAP_ROWS + 1]].forEach(([tx, ty]) => {
    const { x, y } = at(tx, ty);
    addProp(scene, 'sombrilla_roja', x + jitter(), y + jitter());
  });
  addProp(scene, 'mesa_redonda', at(23, MAP_ROWS + 1).x + jitter(), at(23, MAP_ROWS + 1).y + jitter());
  addProp(scene, 'silla_negra', at(23, MAP_ROWS + 1).x + 20, at(23, MAP_ROWS + 1).y + 18);
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

// --- Edificio F -----------------------------------------------------------------------
// Torre de concreto visto con placa "F", celosias metalicas sobre vidrio verde, adoquin,
// plaza de concreto al oriente, cesped con setos, sombrillas rojas, escultura amarilla y
// ajedrez gigante. Ver imagenes/outside f/assetsf/EXTERIOR_TILES.md.

// La plaza de concreto queda al oriente del edificio, como en las fotos.
function kindAtF(tx, ty, grid) {
  if (isInside(tx, ty)) return grid[ty][tx] ? 'building' : 'paver';
  const { d } = ringOf(tx, ty);
  if (tx >= MAP_COLS && d <= PAVER_RING + 2) return 'plaza';
  if (d <= PAVER_RING) return 'paver';
  return d === HEDGE_RING ? 'hedge' : 'grass';
}

function edgeFrameF(tx, ty, grid) {
  if (kindAtF(tx, ty - 1, grid) === 'grass') return F.edge.n;
  if (kindAtF(tx, ty + 1, grid) === 'grass') return F.edge.s;
  if (kindAtF(tx - 1, ty, grid) === 'grass') return F.edge.w;
  if (kindAtF(tx + 1, ty, grid) === 'grass') return F.edge.e;
  return null;
}

function renderGroundF(scene, grid, rand) {
  const m = OUTSIDE_MARGIN_TILES;
  const treeSpots = [];

  for (let ty = -m; ty < MAP_ROWS + m; ty += 1) {
    for (let tx = -m; tx < MAP_COLS + m; tx += 1) {
      const kind = kindAtF(tx, ty, grid);
      if (kind === 'building') continue;

      const { x, y } = cell(tx, ty);
      let frame;
      if (kind === 'paver') frame = edgeFrameF(tx, ty, grid) ?? pick(F.paver, rand);
      else if (kind === 'plaza') frame = pick(F.plaza, rand);
      else if (kind === 'hedge') frame = pick(F.hedge, rand);
      else frame = rand() < 0.05 ? F.dirt : pick(F.grass, rand);

      if (kind === 'hedge') scene.add.image(x, y, SHEET_KEY_F, F.grass[0]).setScale(SCALE).setDepth(DEPTH_GROUND);
      scene.add.image(x, y, SHEET_KEY_F, frame).setScale(SCALE).setDepth(kind === 'hedge' ? DEPTH_DECAL : DEPTH_GROUND);

      const decalChance = kind === 'grass' ? 0.08 : kind === 'hedge' ? 0 : 0.05;
      if (rand() < decalChance) {
        const decal = pick(kind === 'grass' ? F.grassDecals : F.paverDecals, rand);
        scene.add.image(x, y, SHEET_KEY_F, decal).setScale(SCALE).setDepth(DEPTH_DECAL).setAlpha(0.85);
      }

      if (kind === 'grass' && ty >= -m + MOUNTAIN_ROWS) {
        const { d } = ringOf(tx, ty);
        const chance = d < 7 ? 0.04 : d < 9 ? 0.12 : 0.25;
        if (rand() < chance) treeSpots.push({ x, y });
      }
    }
  }

  treeSpots.forEach(({ x, y }) => {
    const roll = rand();
    const frame = roll < 0.25 ? 'tree_dead' : roll < 0.4 ? 'palm' : 'tree';
    addProp(scene, frame, x + (rand() - 0.5) * TILE * 0.8, y + (rand() - 0.5) * TILE * 0.8, {
      key: PROPS_KEY_F,
      scale: frame === 'palm' ? 1.6 : 1.1 + rand() * 0.35,
      origin: [0.5, 0.9],
      flip: rand() < 0.5,
    });
  });
}

// Fachada del F: planta baja de acero y vidrio verde (algunos vidrios rotos, tapiados u
// oscuros), celosias en los lados y concreto visto con la placa "F" en la torre.
function renderFacadeF(scene, grid, rand) {
  const open = (x, y) => !isInside(x, y) || !grid[y][x];
  let plaquePlaced = false;

  for (let ty = 0; ty < MAP_ROWS; ty += 1) {
    for (let tx = 0; tx < MAP_COLS; tx += 1) {
      if (grid[ty][tx]?.type !== 'wall') continue;
      const south = open(tx, ty + 1);
      const north = open(tx, ty - 1);
      const sides = open(tx - 1, ty) || open(tx + 1, ty);
      if (!south && !north && !sides) continue;

      let frame;
      if (south && !plaquePlaced && tx >= 2 && tx <= 4) {
        frame = F.concreteF;
        plaquePlaced = true;
      } else if (south || north) {
        const roll = rand();
        if (tx % 3 === 0) frame = F.steelColumn;
        else if (roll < 0.06) frame = F.glassCracked;
        else if (roll < 0.1) frame = F.glassBoarded;
        else if (roll < 0.18) frame = F.glassDark;
        else if (roll < 0.62) frame = F.glassGreen;
        else if (roll < 0.9) frame = F.louver;
        else frame = rand() < 0.5 ? F.louverBroken : F.louverLit;
      } else {
        const roll = rand();
        frame = roll < 0.15 ? F.concreteStained : roll < 0.25 ? F.concreteSlit : F.concreteWall;
      }

      const { x, y } = cell(tx, ty);
      scene.add.image(x, y, SHEET_KEY_F, frame).setScale(SCALE).setDepth(0.5);
      if (south && !isInside(tx, ty + 1)) {
        // Alero: sombra rayada en el anden justo debajo de la fachada.
        scene.add.image(x, y + TILE, SHEET_KEY_F, F.shadowOverhang).setScale(SCALE).setDepth(DEPTH_DECAL);
      }
    }
  }
}

function renderFurnishingsF(scene, rand, lighting) {
  const at = (tx, ty) => cell(tx, ty);
  const prop = (frame, tx, ty, options = {}) => addProp(scene, frame, at(tx, ty).x, at(tx, ty).y, { key: PROPS_KEY_F, ...options });

  // Farolas a lo largo de los cuatro lados; pocas siguen encendidas.
  const lamp = (tx, ty) => {
    const { x, y } = at(tx, ty);
    addProp(scene, 'lamp', x, y, { key: PROPS_KEY_F, origin: [0.5, 0.95] });
    lampCount += 1;
    if (lampCount % 3 !== 1) return;
    const roll = rand();
    lighting?.addLight({ x, y: y - 100, radius: 230, mode: roll < 0.4 ? 'broken' : roll < 0.7 ? 'flicker' : 'steady' });
  };
  for (let tx = 4; tx < MAP_COLS; tx += 8) lamp(tx, -2);
  for (let ty = 5; ty < MAP_ROWS; ty += 9) [-2, MAP_COLS + 1].forEach((tx) => lamp(tx, ty));

  // Canecas y bancas frente a los setos.
  for (let tx = 8; tx < MAP_COLS; tx += 11) {
    prop('bench', tx, -2);
    if (rand() < 0.6) prop('bins', tx + 2, -2);
  }
  for (let ty = 8; ty < MAP_ROWS; ty += 10) prop('bench', -2, ty);

  // Plaza de concreto al oriente: sombrillas rojas con sillas, escultura amarilla y ajedrez.
  [[MAP_COLS + 1, 6], [MAP_COLS + 2, 12], [MAP_COLS + 1, 18]].forEach(([tx, ty], i) => {
    prop(i === 1 ? 'umbrella_torn' : 'umbrella_table', tx, ty);
    prop(rand() < 0.3 ? 'chair_fallen' : 'chair_red', tx, ty, { flip: rand() < 0.5 });
  });
  prop('sculpture_yellow', MAP_COLS + 2, 23, { origin: [0.5, 0.9] });
  prop('chess_king', MAP_COLS + 1, 26);
  prop('chess_pawn', MAP_COLS + 2, 26);
  prop('chess_pawn', MAP_COLS + 1, 27);

  // Barricadas improvisadas frente a la fachada sur.
  [12, 26].forEach((tx) => prop('barricade', tx, MAP_ROWS + 1));
}

// Rellena todo lo que no es edificio con el entorno del edificio que se juega: adoquin
// junto a los muros, seto y cesped alrededor, montanas de fondo y la fachada. En el C el
// patio con farolas vive dentro del vestibulo (ver layouts/mapLayoutC.js), no aqui afuera.
export function renderOutside(scene, grid, lighting, building = 'C') {
  lampCount = 0;
  const rand = seeded(20240921);
  if (building === 'F') {
    renderGroundF(scene, grid, rand);
    drawMountains(scene, rand);
    renderFacadeF(scene, grid, rand);
    renderFurnishingsF(scene, rand, lighting);
    return;
  }
  renderGround(scene, grid, rand);
  drawMountains(scene, rand);
  renderFacade(scene, grid, rand);
  renderFurnishings(scene, rand, lighting);
}
