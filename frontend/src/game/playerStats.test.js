import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const { favoriteRole, getProfileStats, recordRun } = await import('./playerStats.js');

const summary = (id, extra = {}) => ({
  id,
  building: 'F',
  victory: false,
  kinderReached: 3,
  durationSeconds: 600,
  players: [
    { role: 'SALUD', kills: 12, missions: 4, revives: 2, garavitosEarned: 80, damageTaken: 40, downs: 1, candies: 3 },
    { role: 'SEGURIDAD', kills: 30, missions: 2, revives: 0, garavitosEarned: 50, damageTaken: 90, downs: 2, candies: 0 },
  ],
  ...extra,
});

beforeEach(() => store.clear());

test('suma solo la fila de mi rol', () => {
  assert.equal(recordRun(summary(1), 'SALUD'), true);
  const stats = getProfileStats();
  assert.equal(stats.runs, 1);
  assert.equal(stats.kills, 12);
  assert.equal(stats.revives, 2);
  assert.equal(stats.bestKinder, 3);
  assert.equal(stats.secondsPlayed, 600);
  assert.equal(stats.history[0].role, 'SALUD');
});

test('la misma corrida no se cuenta dos veces', () => {
  recordRun(summary(1), 'SALUD');
  assert.equal(recordRun(summary(1), 'SALUD'), false);
  assert.equal(getProfileStats().runs, 1);
});

test('ganar cuenta como Kinder 5 y suma victorias', () => {
  recordRun(summary(1), 'SALUD');
  recordRun(summary(2, { victory: true, kinderReached: 5, building: 'G' }), 'SEGURIDAD');
  const stats = getProfileStats();
  assert.equal(stats.victories, 1);
  assert.equal(stats.bestKinder, 5);
  assert.deepEqual(stats.bestByBuilding, { F: 3, G: 5 });
  assert.equal(stats.history[0].building, 'G', 'la mas reciente primero');
});

test('rol favorito: el mas jugado', () => {
  assert.equal(favoriteRole(getProfileStats()), null);
  recordRun(summary(1), 'SALUD');
  recordRun(summary(2), 'SEGURIDAD');
  recordRun(summary(3), 'SEGURIDAD');
  assert.equal(favoriteRole(getProfileStats()), 'SEGURIDAD');
});

test('sin mi fila no se cuenta nada', () => {
  assert.equal(recordRun(summary(1), 'ECONOMIA'), false);
  assert.equal(getProfileStats().runs, 0);
});
