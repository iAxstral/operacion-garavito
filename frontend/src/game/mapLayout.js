import * as layoutF from './layouts/mapLayoutF.js';
import * as layoutC from './layouts/mapLayoutC.js';

// Cada edificio tiene su propio mapa: construir uno reescribiendo el del otro fue
// lo que borro el Edificio F. Todos comparten la misma grilla (40x30, tile 64) porque
// el backend (FloorGrid) y el exportador de grillas asumen esas dimensiones.
export const TILE = 64;
export const MAP_COLS = 40;
export const MAP_ROWS = 30;

export const BUILDINGS = ['F', 'C'];

const LAYOUTS = { F: layoutF, C: layoutC };

function layoutFor(building) {
  const layout = LAYOUTS[building];
  if (!layout) throw new Error(`edificio sin mapa: ${building}`);
  return layout;
}

export function floorCount(building) {
  return layoutFor(building).FLOOR_COUNT;
}

export function buildFloorLayout({ building = 'F', floor = 1 } = {}) {
  return layoutFor(building).buildFloorLayout({ floor });
}
