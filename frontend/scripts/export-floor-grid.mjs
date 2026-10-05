import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { BUILDINGS, buildFloorLayout, floorCount, MAP_COLS, MAP_ROWS, TILE } from '../src/game/mapLayout.js';

const SOLID_TYPES = new Set(['wall', 'glass']);
const resources = resolve(dirname(fileURLToPath(import.meta.url)), '../../backend/src/main/resources/grids');

for (const building of BUILDINGS) {
  const dir = resolve(resources, building);
  mkdirSync(dir, { recursive: true });

  for (let floor = 1; floor <= floorCount(building); floor += 1) {
    const layout = buildFloorLayout({ building, floor });

    const rows = [];
    for (let row = 0; row < MAP_ROWS; row += 1) {
      let line = '';
      for (let col = 0; col < MAP_COLS; col += 1) {
        const cell = layout.grid[row]?.[col];
        const type = typeof cell === 'string' ? cell : cell?.type;
        line += !type || SOLID_TYPES.has(type) ? '#' : '.';
      }
      rows.push(line);
    }

    const doors = layout.decorations
      .filter((deco) => deco.type === 'door')
      .map((deco) => `door ${deco.doorId} ${deco.x} ${deco.y}`);

    const out = [
      '# GENERADO por frontend/scripts/export-floor-grid.mjs — no editar a mano.',
      `# Fuente: frontend/src/game/mapLayout.js (edificio ${building}, piso ${floor})`,
      `# ${MAP_COLS} columnas x ${MAP_ROWS} filas, tile de ${TILE}px. '#' solido, '.' caminable.`,
      ...rows,
      ...doors,
      '',
    ].join('\n');

    const target = resolve(dir, `floor${floor}.grid`);
    writeFileSync(target, out);
    console.log(`escrito ${target} (${rows.length} filas, ${doors.length} puertas)`);
  }
}
