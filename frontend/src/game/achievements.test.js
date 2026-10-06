import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const { ACHIEVEMENTS, earnAchievements, unlockedAchievements } = await import('./achievements.js');

const player = (stats) => ({
  role: 'SALUD', kills: 0, missions: 0, garavitosEarned: 0, damageTaken: 50, revives: 0, downs: 1, name: null, ...stats,
});
const run = (stats, extra = {}) => ({
  victory: false, kinderReached: 1, durationSeconds: 1200, players: [player(stats)], ...extra,
});

beforeEach(() => store.clear());

test('se ganan los logros que cumple el jugador y solo la primera vez son nuevos', () => {
  const first = earnAchievements(run({ kills: 30, revives: 1, missions: 3 }), 'SALUD');
  const ids = first.map((a) => a.id).sort();
  assert.deepEqual(ids, ['angel', 'dutiful', 'exterminator', 'first_blood']);
  assert.ok(first.every((a) => a.isNew));
  assert.deepEqual(Object.keys(unlockedAchievements()).sort(), ids);

  const second = earnAchievements(run({ kills: 2 }), 'SALUD');
  assert.deepEqual(second.map((a) => [a.id, a.isNew]), [['first_blood', false]]);
});

test('los logros de la corrida miran el Kinder, la victoria y el tiempo', () => {
  const won = earnAchievements(run({ downs: 0, damageTaken: 10 }, { victory: true, kinderReached: 5, durationSeconds: 800 }), 'SALUD');
  const ids = won.map((a) => a.id);
  ['legend', 'speedrun', 'survivor', 'never_down', 'untouchable'].forEach((id) => assert.ok(ids.includes(id), id));
});

test('un rol que no esta en el resumen no gana nada y todos los logros tienen icono', () => {
  assert.deepEqual(earnAchievements(run({ kills: 99 }), 'ECONOMIA'), []);
  assert.ok(ACHIEVEMENTS.every((a) => a.icon && a.name && a.description));
});
