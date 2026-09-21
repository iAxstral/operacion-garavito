

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

function buildStairsBlock(grid, decorations, labels, { hub, direction, kind }) {
  const stepsWidth = 3;
  const landingWidth = 2;
  const floorTop = hub.y + 1;
  const floorBottom = hub.y + hub.h - 2;

  let stepsX0;
  let landingX0;
  let railingX;
  let glassX = null;

  if (direction === 'right') {

    glassX = hub.x + hub.w - 1;
    landingX0 = glassX - landingWidth;
    stepsX0 = landingX0 - stepsWidth;
    railingX = stepsX0 - 1;
    for (let y = hub.y; y < hub.y + hub.h; y += 1) {
      setGlass(grid, glassX, y);
    }
  } else {

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
    kind,
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

    arrivalSpawn: {
      x: (landingX0 + Math.floor(landingWidth / 2)) * TILE + TILE / 2,
      y: (floorTop + Math.floor((floorBottom - floorTop) / 2)) * TILE + TILE / 2,
    },
  };
}

export const FLOOR_COUNT = 3;

const COL_LEFT = 9;
const COL_RIGHT = 27;

const FURNITURE_COLORS = {
  desk: 0x8a5a34,
  table: 0x6b4a2f,
  chair: 0xb8895a,
  cafeTable: 0x7a3b2e,
  rack: 0x3c3f45,
  crate: 0x5b6b3a,
  bench: 0xdfe6ea,
  shelf: 0x6a4327,
  machine: 0x4a5560,
  server: 0x22303a,
  seat: 0x7a2e3b,
  stage: 0x4b3b6b,
};

function tiles(cols, rows, w, h, color) {
  const out = [];
  cols.forEach((col) => {
    rows.forEach((row) => {
      out.push({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2, w, h, color });
    });
  });
  return out;
}

function tableWithChairs(col, row, size, chairOffsets, color) {
  const cx = col * TILE + TILE / 2;
  const cy = row * TILE + TILE / 2;
  const out = [{ x: cx, y: cy, w: size, h: size, color }];
  chairOffsets.forEach(([dx, dy]) => {
    out.push({ x: cx + dx, y: cy + dy, w: 15, h: 15, color: FURNITURE_COLORS.chair });
  });
  return out;
}

const FOUR_CHAIRS = [[-28, 0], [28, 0], [0, -28], [0, 28]];
const TWO_CHAIRS = [[-24, 0], [24, 0]];

const ROOM_TOP_LEFT = { side: 'top', x: 6, w: 8, h: 7, doorCol: COL_LEFT };
const ROOM_TOP_RIGHT = { side: 'top', x: 22, w: 10, h: 7, doorCol: COL_RIGHT };
const ROOM_BOTTOM_LEFT = { side: 'bottom', x: 6, w: 8, h: 7, doorCol: COL_LEFT };
const ROOM_BOTTOM_RIGHT = { side: 'bottom', x: 23, w: 10, h: 8, doorCol: COL_RIGHT };

const FLOORS = {
  1: {
    name: 'Piso 1',
    rooms: [
      {
        ...ROOM_TOP_LEFT,
        id: 'aula',
        label: 'Aula F-104',
        furniture: () => tiles([8, 10, 12], [3, 4, 5], 36, 24, FURNITURE_COLORS.desk),
      },
      {
        ...ROOM_TOP_RIGHT,
        id: 'profesores',
        label: 'Sala de Profesores',
        furniture: () => [
          ...tiles([24, 26, 28, 30], [3], 40, 26, FURNITURE_COLORS.desk),
          ...tiles([24, 30], [5], 40, 26, FURNITURE_COLORS.desk),
        ],
      },
      {
        ...ROOM_BOTTOM_LEFT,
        id: 'terraza',
        label: 'Terraza',
        furniture: () => [
          ...tableWithChairs(8, 18, 40, FOUR_CHAIRS, FURNITURE_COLORS.table),
          ...tableWithChairs(11, 20, 40, FOUR_CHAIRS, FURNITURE_COLORS.table),
        ],
      },
      {
        ...ROOM_BOTTOM_RIGHT,
        id: 'cafeteria',
        label: 'Cafetería',
        furniture: () => [24, 30].flatMap((col) =>
          [18, 21].flatMap((row) => tableWithChairs(col, row, 32, TWO_CHAIRS, FURNITURE_COLORS.cafeTable)),
        ),
      },
    ],
  },
  2: {
    name: 'Piso 2',
    rooms: [
      {
        ...ROOM_TOP_LEFT,
        id: 'biblioteca',
        label: 'Biblioteca',
        furniture: () => [
          ...tiles([7, 8, 9, 10, 11, 12], [2], 60, 26, FURNITURE_COLORS.shelf),
          ...tiles([7, 8, 11, 12], [4], 52, 30, FURNITURE_COLORS.table),
        ],
      },
      {
        ...ROOM_TOP_RIGHT,
        id: 'reuniones',
        label: 'Sala de Reuniones',
        furniture: () => [
          ...tiles([25, 26, 27, 28], [4], 60, 44, FURNITURE_COLORS.table),
          ...tiles([25, 26, 27, 28], [3, 5], 30, 12, FURNITURE_COLORS.chair),
        ],
      },
      {
        ...ROOM_BOTTOM_LEFT,
        id: 'estudio',
        label: 'Sala de Estudio',
        furniture: () => [
          ...tableWithChairs(8, 18, 40, FOUR_CHAIRS, FURNITURE_COLORS.table),
          ...tableWithChairs(11, 18, 40, FOUR_CHAIRS, FURNITURE_COLORS.table),
          ...tableWithChairs(11, 20, 40, FOUR_CHAIRS, FURNITURE_COLORS.table),
        ],
      },
      {
        ...ROOM_BOTTOM_RIGHT,
        id: 'armero',
        label: 'Armero',
        furniture: () => [
          ...tiles([24, 25, 26], [17], 56, 24, FURNITURE_COLORS.rack),
          ...tiles([24, 25, 26, 28, 29, 30, 31], [22], 56, 24, FURNITURE_COLORS.rack),
          ...tiles([30, 31], [20, 21], 44, 40, FURNITURE_COLORS.crate),
        ],
      },
    ],
  },
  3: {
    name: 'Piso 3',
    rooms: [
      {
        ...ROOM_TOP_LEFT,
        id: 'laboratorio',
        label: 'Laboratorio Biomédico',
        furniture: () => [
          ...tiles([7, 8], [3], 60, 30, FURNITURE_COLORS.bench),
          ...tiles([11, 12], [5], 60, 30, FURNITURE_COLORS.bench),
          ...tiles([12], [3], 40, 40, FURNITURE_COLORS.machine),
        ],
      },
      {
        ...ROOM_TOP_RIGHT,
        id: 'servidores',
        label: 'Sala de Servidores',
        furniture: () => [
          ...tiles([24, 25, 26, 28, 29, 30], [2], 44, 28, FURNITURE_COLORS.server),
          ...tiles([24, 25, 29, 30], [4], 44, 28, FURNITURE_COLORS.server),
        ],
      },
      {
        ...ROOM_BOTTOM_LEFT,
        id: 'auditorio',
        label: 'Auditorio',
        furniture: () => [
          ...tiles([8, 9, 10, 11, 12], [17], 56, 22, FURNITURE_COLORS.stage),
          ...tiles([7, 8, 11, 12], [19, 21], 40, 24, FURNITURE_COLORS.seat),
        ],
      },
      {
        ...ROOM_BOTTOM_RIGHT,
        id: 'maquinas',
        label: 'Sala de Máquinas',
        furniture: () => [
          ...tiles([24, 25, 26], [17], 56, 40, FURNITURE_COLORS.machine),
          ...tiles([29, 30, 31], [17], 56, 40, FURNITURE_COLORS.machine),
          ...tiles([28, 29, 30, 31], [22], 56, 34, FURNITURE_COLORS.machine),
          ...tiles([24], [20, 21], 40, 40, FURNITURE_COLORS.crate),
        ],
      },
    ],
  },
};

function buildRoom(grid, decorations, furniture, labels, floor, room) {
  const isTop = room.side === 'top';
  const y = isTop ? 1 : 16;
  const box = { x: room.x, y, w: room.w, h: room.h };
  fillFloorRect(grid, box.x, box.y, box.w, box.h);
  outlineWallRect(grid, box.x, box.y, box.w, box.h);

  const doorRow = isTop ? box.y + box.h - 1 : box.y;
  setFloor(grid, room.doorCol, doorRow);
  decorations.push({
    type: 'door',
    doorId: `f${floor}-${room.id}`,
    x: room.doorCol,
    y: doorRow,
    orientation: isTop ? 'down' : 'up',
  });

  const connectorRow = isTop ? 8 : 15;
  setFloor(grid, room.doorCol, connectorRow);
  setWall(grid, room.doorCol - 1, connectorRow);
  setWall(grid, room.doorCol + 1, connectorRow);

  labels.push({ x: box.x * TILE, y: (box.y - 1) * TILE + 20, text: room.label });
  furniture.push(...room.furniture());
}

export function buildFloorLayout({ floor = 1 } = {}) {
  const config = FLOORS[floor];
  const hasUpStairs = floor < FLOOR_COUNT;
  const hasDownStairs = floor > 1;

  const grid = createEmptyGrid(MAP_COLS, MAP_ROWS);
  const decorations = [];
  const furniture = [];
  const labels = [];

  config.rooms.forEach((room) => buildRoom(grid, decorations, furniture, labels, floor, room));

  const hub = { x: 0, y: 9, w: MAP_COLS, h: 6 };
  fillFloorRect(grid, hub.x, hub.y, hub.w, hub.h);
  for (let x = hub.x; x < hub.x + hub.w; x += 1) {
    setWall(grid, x, hub.y);
    setWall(grid, x, hub.y + hub.h - 1);
  }
  [COL_LEFT, COL_RIGHT].forEach((col) => {
    setFloor(grid, col, hub.y);
    setFloor(grid, col, hub.y + hub.h - 1);
  });

  labels.push({ x: (hub.x + 14) * TILE, y: (hub.y - 1) * TILE + 20, text: `Vestíbulo central — ${config.name}` });

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

  let upStairs = null;
  if (hasUpStairs) {
    upStairs = buildStairsBlock(grid, decorations, labels, { hub, direction: 'right', kind: 'up' });
  } else {
    const glassX = hub.x + hub.w - 1;
    for (let y = hub.y; y < hub.y + hub.h; y += 1) {
      setGlass(grid, glassX, y);
    }
  }

  [6, 13, 19, 25, 31].forEach((x) => {
    decorations.push({ type: 'column', x, y: hub.y });
  });

  decorations.push({ type: 'bench', x: 14, y: hub.y + hub.h - 2 });
  decorations.push({ type: 'bench', x: 21, y: hub.y + 1 });

  const spawn = {
    x: COL_LEFT * TILE + TILE / 2,
    y: (hub.y + 3) * TILE + TILE / 2,
  };

  return {
    floor,
    name: config.name,
    grid,
    decorations,
    furniture,
    labels,
    spawn,
    upStairs,
    downStairs,
  };
}
