import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { BUILDINGS, MAP_COLS, MAP_ROWS, TILE, buildFloorLayout, buildingLabel, floorCount } from './mapLayout.js';

const GRIDS = resolve(dirname(fileURLToPath(import.meta.url)), '../../../backend/src/main/resources/grids');
const SOLID = new Set(['wall', 'glass']);

function cellType(layout, col, row) {
  const cell = layout.grid[row]?.[col];
  return typeof cell === 'string' ? cell : cell?.type;
}

function walkable(layout, x, y) {
  const type = cellType(layout, Math.floor(x / TILE), Math.floor(y / TILE));
  return Boolean(type) && !SOLID.has(type);
}

const ALL_FLOORS = BUILDINGS.flatMap((building) =>
  Array.from({ length: floorCount(building) }, (_, i) => ({ building, floor: i + 1 })));

test('cada edificio tiene entre 2 y 3 pisos y un nombre para mostrar', () => {
  for (const building of BUILDINGS) {
    assert.ok(floorCount(building) >= 2 && floorCount(building) <= 3, building);
  }
  assert.equal(buildingLabel('F'), 'Edificio F');
  assert.equal(buildingLabel('BIBLIOTECA'), 'Biblioteca');
});

test('un edificio sin mapa es un error, no un mapa vacio', () => {
  assert.throws(() => buildFloorLayout({ building: 'Z' }), /sin mapa/);
});

for (const { building, floor } of ALL_FLOORS) {
  test(`${building} piso ${floor}: grilla de 40x30, salida y puertas sobre casillas caminables`, () => {
    const layout = buildFloorLayout({ building, floor });
    assert.equal(layout.grid.length, MAP_ROWS);
    layout.grid.forEach((row) => assert.equal(row.length, MAP_COLS));
    assert.ok(walkable(layout, layout.spawn.x, layout.spawn.y), 'el jugador aparece en el piso, no en una pared');

    const doors = layout.decorations.filter((d) => d.type === 'door');
    assert.ok(doors.length > 0, 'cada piso tiene puertas');
    assert.equal(new Set(doors.map((d) => d.doorId)).size, doors.length, 'ids de puerta unicos');
    doors.forEach((door) => {
      assert.ok(walkable(layout, door.x * TILE + TILE / 2, door.y * TILE + TILE / 2), door.doorId);
      assert.ok(['up', 'down'].includes(door.orientation), door.doorId);
    });
    if (floor < floorCount(building)) assert.ok(layout.upStairs, 'hay escalera para subir');
    if (floor > 1) assert.ok(layout.downStairs, 'hay escalera para bajar');
  });

  // El servidor valida movimiento, balas y puertas con su propia grilla: si no coincide
  // con lo que dibuja el cliente, el jugador choca con paredes invisibles o puertas que
  // no responden (scripts/export-floor-grid.mjs la regenera).
  test(`${building} piso ${floor}: el mapa del cliente coincide con la grilla del servidor`, () => {
    const layout = buildFloorLayout({ building, floor });
    const server = readFileSync(resolve(GRIDS, building, `floor${floor}.grid`), 'utf8').split(/\r?\n/);
    const serverRows = server.filter((line) => /^[#.]+$/.test(line));
    const serverDoors = server.filter((line) => line.startsWith('door ')).sort();

    const clientRows = Array.from({ length: MAP_ROWS }, (_, row) => Array.from({ length: MAP_COLS }, (_, col) => {
      const type = cellType(layout, col, row);
      return !type || SOLID.has(type) ? '#' : '.';
    }).join(''));
    const clientDoors = layout.decorations.filter((d) => d.type === 'door')
      .map((d) => `door ${d.doorId} ${d.x} ${d.y}`).sort();

    assert.deepEqual(clientRows, serverRows);
    assert.deepEqual(clientDoors, serverDoors);
  });
}
