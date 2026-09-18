/**
 * Piso del Edificio F: un unico tilemap continuo estilo "Among Us" — varias
 * salas conectadas a un vestibulo central, sin escenas ni pantallas de carga
 * entre ellas. Este modulo solo describe la geometria (que celda es piso/
 * pared/vidrio/etc, donde van las decoraciones); MainScene.js es quien la
 * convierte en objetos de Phaser (imagenes + cuerpos fisicos).
 *
 * Todo esta en unidades de tile (TILE px cada una). (0,0) = esquina
 * superior izquierda del mapa.
 *
 * `buildFloorLayout({ hasUpStairs, hasDownStairs })` genera el mismo layout
 * de salas para cualquier piso — Piso 1/2/3 son placeholders identicos en
 * arquitectura, solo cambia que extremos del vestibulo tienen escalera
 * (ver ARCHITECTURE.md, seccion "Sistema de pisos").
 */

export const TILE = 64;
export const MAP_COLS = 40;
export const MAP_ROWS = 30;

const FLOOR_VARIANTS = [
  'v2_floor_terrazo',
  'v2_floor_terrazo_var1',
  'v2_floor_terrazo_var2',
  'v2_floor_terrazo_var3',
  'v2_floor_terrazo_var4',
];

// Variante deterministica (no aleatoria) para que el patron de piso no
// cambie entre recargas, pero rompa la repeticion visual de un tile unico.
function floorVariant(x, y) {
  const idx = (x * 31 + y * 17) % FLOOR_VARIANTS.length;
  return FLOOR_VARIANTS[idx];
}

function createEmptyGrid(cols, rows) {
  return Array.from({ length: rows }, () => new Array(cols).fill(null));
}

function setFloor(grid, x, y) {
  grid[y][x] = { type: 'floor', texture: floorVariant(x, y) };
}

function setWall(grid, x, y) {
  grid[y][x] = { type: 'wall', texture: 'v2_wall_concreto' };
}

function setGlass(grid, x, y) {
  grid[y][x] = { type: 'glass', texture: 'v2_vidrio_lamas' };
}

function setStair(grid, x, y) {
  grid[y][x] = { type: 'stair', texture: 'v2_escalera' };
}

// El "rellano" reutiliza el piso normal pero con un tinte distinto (ver
// MainScene.renderGridTiles) — no hace falta un asset nuevo para que se
// note como una plataforma aparte del piso comun.
function setLanding(grid, x, y) {
  grid[y][x] = { type: 'landing', texture: floorVariant(x, y) };
}

function fillFloorRect(grid, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      setFloor(grid, x, y);
    }
  }
}

// Pinta solo el perimetro de un rectangulo como pared (se espera que el
// interior ya este lleno de piso via fillFloorRect).
function outlineWallRect(grid, x0, y0, w, h) {
  const x1 = x0 + w - 1;
  const y1 = y0 + h - 1;
  for (let x = x0; x <= x1; x += 1) {
    setWall(grid, x, y0);
    setWall(grid, x, y1);
  }
  for (let y = y0; y <= y1; y += 1) {
    setWall(grid, x0, y);
    setWall(grid, x1, y);
  }
}

/**
 * Bloque de escalera "grande": franja de escalones (2..3 tiles) + rellano
 * (2 tiles) antes de la transicion, ocupando toda la altura de piso del
 * vestibulo. `direction` es 'right' (escalera pegada al vidrio derecho,
 * subida) o 'left' (escalera pegada al remate izquierdo, bajada) — solo
 * cambia el orden visual (rellano-escalones vs escalones-rellano) y de que
 * lado se dibuja el indicador.
 */
function buildStairsBlock(grid, decorations, labels, { hub, direction, kind }) {
  const stepsWidth = 3;
  const landingWidth = 2;
  const floorTop = hub.y + 1;
  const floorBottom = hub.y + hub.h - 2; // ultima fila de piso (inclusive)

  let stepsX0;
  let landingX0;
  let railingX;
  let glassX = null;

  if (direction === 'right') {
    // [...corredor] [escalones x3] [rellano x2] [vidrio] — se sube primero,
    // se llega al rellano, y de ahi al umbral de vidrio (transicion).
    glassX = hub.x + hub.w - 1;
    landingX0 = glassX - landingWidth;
    stepsX0 = landingX0 - stepsWidth;
    railingX = stepsX0 - 1;
    for (let y = hub.y; y < hub.y + hub.h; y += 1) {
      setGlass(grid, glassX, y);
    }
  } else {
    // [remate] [escalones x3] [rellano x2] [...corredor]
    stepsX0 = hub.x + 1;
    landingX0 = stepsX0 + stepsWidth;
    railingX = landingX0 + landingWidth;
    for (let y = hub.y; y < hub.y + hub.h; y += 1) {
      setWall(grid, hub.x, y);
    }
  }

  for (let dx = 0; dx < stepsWidth; dx += 1) {
    for (let y = floorTop; y <= floorBottom; y += 1) {
      setStair(grid, stepsX0 + dx, y);
    }
  }
  for (let dx = 0; dx < landingWidth; dx += 1) {
    for (let y = floorTop; y <= floorBottom; y += 1) {
      setLanding(grid, landingX0 + dx, y);
    }
  }

  decorations.push({ type: 'railing', x: railingX, y: floorTop });
  decorations.push({
    type: 'stairs-arrow',
    x: stepsX0 + Math.floor(stepsWidth / 2),
    y: floorTop + Math.floor((floorBottom - floorTop) / 2),
    kind, // 'up' | 'down' — decide el glifo (▲ / ▼)
  });

  const labelX = direction === 'right' ? stepsX0 - 1 : stepsX0;
  labels.push({ x: labelX * TILE, y: (hub.y - 1) * TILE + 20, text: kind === 'up' ? 'Escaleras (subir)' : 'Escaleras (bajar)' });

  return {
    zone: {
      x: stepsX0 * TILE,
      y: floorTop * TILE,
      w: stepsWidth * TILE,
      h: (floorBottom - floorTop + 1) * TILE,
    },
    // Punto de llegada al usar esta escalera desde el otro piso: un tile
    // sobre el rellano, ya fuera de la zona de overlap de los escalones
    // (para no re-disparar la transicion apenas se llega).
    arrivalSpawn: {
      x: (landingX0 + Math.floor(landingWidth / 2)) * TILE + TILE / 2,
      y: (floorTop + Math.floor((floorBottom - floorTop) / 2)) * TILE + TILE / 2,
    },
  };
}

const DOOR_COL_AULA = 9; // aula (arriba) <-> vestibulo <-> terraza (abajo)
const DOOR_COL_CAFETERIA = 27; // vestibulo <-> cafeteria (abajo)

export function buildFloorLayout({ hasUpStairs = true, hasDownStairs = false } = {}) {
  const grid = createEmptyGrid(MAP_COLS, MAP_ROWS);
  const decorations = [];
  const furniture = [];
  const labels = [];

  // --- AULA F-104 (arriba del vestibulo) ---------------------------------
  const aula = { x: 6, y: 1, w: 8, h: 7 };
  fillFloorRect(grid, aula.x, aula.y, aula.w, aula.h);
  outlineWallRect(grid, aula.x, aula.y, aula.w, aula.h);
  const aulaDoorRow = aula.y + aula.h - 1;
  setFloor(grid, DOOR_COL_AULA, aulaDoorRow);
  decorations.push({ type: 'door', doorId: 'door-aula', x: DOOR_COL_AULA, y: aulaDoorRow, orientation: 'down' });
  labels.push({ x: aula.x * TILE, y: (aula.y - 1) * TILE + 20, text: 'Aula F-104' });

  const topConnectorRow = aula.y + aula.h;
  setFloor(grid, DOOR_COL_AULA, topConnectorRow);
  setWall(grid, DOOR_COL_AULA - 1, topConnectorRow);
  setWall(grid, DOOR_COL_AULA + 1, topConnectorRow);

  // --- VESTIBULO CENTRAL (hub) — ensanchado a 4 filas de piso -------------
  const hub = { x: 0, y: topConnectorRow + 1, w: MAP_COLS, h: 6 };
  fillFloorRect(grid, hub.x, hub.y, hub.w, hub.h);
  for (let x = hub.x; x < hub.x + hub.w; x += 1) {
    setWall(grid, x, hub.y);
    setWall(grid, x, hub.y + hub.h - 1);
  }
  setFloor(grid, DOOR_COL_AULA, hub.y);
  setFloor(grid, DOOR_COL_AULA, hub.y + hub.h - 1);
  setFloor(grid, DOOR_COL_CAFETERIA, hub.y + hub.h - 1);

  labels.push({ x: (hub.x + 14) * TILE, y: (hub.y - 1) * TILE + 20, text: 'Vestíbulo central' });

  // Extremo izquierdo: "zona de banos" (piso 1, sin escalera de bajada) o
  // escalera de bajada (pisos 2/3).
  let downStairs = null;
  if (hasDownStairs) {
    downStairs = buildStairsBlock(grid, decorations, labels, { hub, direction: 'left', kind: 'down' });
  } else {
    for (let y = hub.y; y < hub.y + hub.h; y += 1) {
      setWall(grid, hub.x, y);
    }
    labels.push({ x: (hub.x + 0.3) * TILE, y: (hub.y + 2) * TILE + 6, text: 'Baños' });
    decorations.push({ type: 'bench', x: hub.x + 3, y: hub.y + 2 });
  }

  // Extremo derecho: escalera de subida (piso 1/2) o remate de vidrio liso
  // sin escalera (piso 3, no hay a donde subir).
  let upStairs = null;
  if (hasUpStairs) {
    upStairs = buildStairsBlock(grid, decorations, labels, { hub, direction: 'right', kind: 'up' });
  } else {
    const glassX = hub.x + hub.w - 1;
    for (let y = hub.y; y < hub.y + hub.h; y += 1) {
      setGlass(grid, glassX, y);
    }
  }

  // Columnas a lo largo de la pared superior, separadas cada 6-7 tiles,
  // evitando ambas puertas y los extremos de escalera.
  [6, 13, 19, 25, 31].forEach((x) => {
    decorations.push({ type: 'column', x, y: hub.y });
  });

  decorations.push({ type: 'bench', x: 14, y: hub.y + hub.h - 2 });
  decorations.push({ type: 'bench', x: 21, y: hub.y + 1 });

  // --- TERRAZA (abajo del vestibulo, bajo la puerta de aula) --------------
  const bottomConnectorRow = hub.y + hub.h;
  setFloor(grid, DOOR_COL_AULA, bottomConnectorRow);
  setWall(grid, DOOR_COL_AULA - 1, bottomConnectorRow);
  setWall(grid, DOOR_COL_AULA + 1, bottomConnectorRow);

  const terraza = { x: 6, y: bottomConnectorRow + 1, w: 8, h: 7 };
  fillFloorRect(grid, terraza.x, terraza.y, terraza.w, terraza.h);
  outlineWallRect(grid, terraza.x, terraza.y, terraza.w, terraza.h);
  setFloor(grid, DOOR_COL_AULA, terraza.y);
  decorations.push({ type: 'door', doorId: 'door-terraza', x: DOOR_COL_AULA, y: terraza.y, orientation: 'up' });
  labels.push({ x: terraza.x * TILE, y: (terraza.y - 1) * TILE + 20, text: 'Terraza' });

  // --- CAFETERIA (abajo del vestibulo, sala nueva para 4 jugadores) -------
  setFloor(grid, DOOR_COL_CAFETERIA, bottomConnectorRow);
  setWall(grid, DOOR_COL_CAFETERIA - 1, bottomConnectorRow);
  setWall(grid, DOOR_COL_CAFETERIA + 1, bottomConnectorRow);

  const cafeteria = { x: 23, y: bottomConnectorRow + 1, w: 10, h: 8 };
  fillFloorRect(grid, cafeteria.x, cafeteria.y, cafeteria.w, cafeteria.h);
  outlineWallRect(grid, cafeteria.x, cafeteria.y, cafeteria.w, cafeteria.h);
  setFloor(grid, DOOR_COL_CAFETERIA, cafeteria.y);
  decorations.push({ type: 'door', doorId: 'door-cafeteria', x: DOOR_COL_CAFETERIA, y: cafeteria.y, orientation: 'up' });
  labels.push({ x: cafeteria.x * TILE, y: (cafeteria.y - 1) * TILE + 20, text: 'Cafetería' });

  // --- Mobiliario placeholder (rectangulos de color; se reemplaza despues) ---
  // Pupitres del aula: grilla 3x3, evitando la columna de la puerta.
  [8, 10, 12].forEach((x) => {
    [3, 4, 5].forEach((y) => {
      furniture.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, w: 36, h: 24, color: 0x8a5a34 });
    });
  });

  // Mesas + sillas de la terraza (2 mesas), evitando la columna de la puerta.
  [
    { x: 8, y: 16 },
    { x: 11, y: 18 },
  ].forEach(({ x, y }) => {
    const cx = x * TILE + TILE / 2;
    const cy = y * TILE + TILE / 2;
    furniture.push({ x: cx, y: cy, w: 40, h: 40, color: 0x6b4a2f });
    [
      [-28, 0],
      [28, 0],
      [0, -28],
      [0, 28],
    ].forEach(([dx, dy]) => {
      furniture.push({ x: cx + dx, y: cy + dy, w: 16, h: 16, color: 0xb8895a });
    });
  });

  // Mesas de la cafeteria: grilla 3x2, evitando la columna de la puerta y
  // manteniendo margen con las paredes.
  [24, 27, 30].forEach((x) => {
    if (x === DOOR_COL_CAFETERIA) return;
    [18, 21].forEach((y) => {
      const cx = x * TILE + TILE / 2;
      const cy = y * TILE + TILE / 2;
      furniture.push({ x: cx, y: cy, w: 32, h: 32, color: 0x7a3b2e });
      [
        [-24, 0],
        [24, 0],
      ].forEach(([dx, dy]) => {
        furniture.push({ x: cx + dx, y: cy + dy, w: 14, h: 14, color: 0xb8895a });
      });
    });
  });

  const spawn = {
    x: DOOR_COL_AULA * TILE + TILE / 2,
    y: (hub.y + 3) * TILE + TILE / 2,
  };

  return {
    grid,
    decorations,
    furniture,
    labels,
    spawn,
    upStairs, // null en el piso mas alto (sin subida)
    downStairs, // null en el piso 1 (sin bajada)
  };
}
