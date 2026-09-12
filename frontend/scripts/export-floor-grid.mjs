/**
 * Exporta la geometría caminable del piso a un recurso que lee el backend.
 *
 * El servidor necesita saber qué celdas son sólidas para que los zombis no
 * atraviesen las paredes, pero la geometría se define en mapLayout.js. En vez
 * de mantener dos mapas a mano —que se desincronizan al primer cambio— este
 * script genera el del backend desde el del frontend.
 *
 *   node scripts/export-floor-grid.mjs
 *
 * Hay que volver a correrlo cada vez que cambie mapLayout.js.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { buildFloorLayout, MAP_COLS, MAP_ROWS, TILE } from '../src/game/mapLayout.js';

// Debe coincidir con SOLID_GRID_TYPES en MainScene.js: puertas y baranda se
// dibujan sobre una celda de piso, no la reemplazan, así que no son sólidas.
const SOLID_TYPES = new Set(['wall', 'glass']);

const layout = buildFloorLayout({ hasUpStairs: true, hasDownStairs: false });

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

const out = [
  '# GENERADO por frontend/scripts/export-floor-grid.mjs — no editar a mano.',
  '# Fuente: frontend/src/game/mapLayout.js',
  `# ${MAP_COLS} columnas x ${MAP_ROWS} filas, tile de ${TILE}px. '#' solido, '.' caminable.`,
  ...rows,
  '',
].join('\n');

const target = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../backend/src/main/resources/floor1.grid',
);
writeFileSync(target, out);
console.log(`escrito ${target} (${rows.length} filas)`);
