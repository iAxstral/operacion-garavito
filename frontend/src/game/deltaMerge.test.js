import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeDelta } from './deltaMerge.js';

const before = {
  doors: [{ doorId: 'd1', open: true }],
  lobby: { started: true },
  players: [{ playerId: 'SALUD', x: 1, inventory: ['a'], missions: ['m'], name: 'Ana', costume: 'BRUJA', perks: ['ENERGIA'], perkOffer: [] }],
};

test('lo que el servidor marca sin cambios se conserva', () => {
  const merged = mergeDelta({ unchanged: ['doors', 'lobby'], doors: null, lobby: null, players: [] }, before);
  assert.deepEqual(merged.doors, before.doors);
  assert.deepEqual(merged.lobby, before.lobby);
});

test('el jugador con staticOmitted recupera inventario, misiones, apodo y disfraz', () => {
  const merged = mergeDelta({
    players: [{ playerId: 'SALUD', x: 9, staticOmitted: true, inventory: null, missions: null, name: null, costume: null }],
  }, before);
  assert.deepEqual(merged.players[0], {
    playerId: 'SALUD', x: 9, staticOmitted: true, inventory: ['a'], missions: ['m'], name: 'Ana', costume: 'BRUJA', perks: ['ENERGIA'], perkOffer: [],
  });
});

test('un mensaje completo reemplaza todo', () => {
  const full = { full: true, doors: [], players: [{ playerId: 'SALUD', x: 2, inventory: [], missions: [], name: null }] };
  assert.deepEqual(mergeDelta(full, before), full);
});
