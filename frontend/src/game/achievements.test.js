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

test('los logros de Nochebuena miran a Papa Noel, las bolas y los regalos', () => {
  const ids = (stats, extra) => earnAchievements(run(stats, extra), 'SALUD').map((a) => a.id);
  assert.ok(ids({}, { kinderReached: 4 }).includes('santa_hunter'), 'pasar el Kinder 3 es derribar a Papa Noel');
  assert.ok(!ids({}, { kinderReached: 3 }).includes('santa_hunter'), 'llegar al 3 no alcanza');
  assert.ok(ids({ snowballsDodged: 5 }).includes('reindeer_agile'));
  assert.ok(!ids({ snowballsDodged: 4 }).includes('reindeer_agile'));
  assert.ok(ids({ snowballsTaken: 6 }).includes('snowman'));
  assert.ok(ids({ candies: 10 }).includes('gifts_for_all'));
  assert.ok(!ids({ candies: 9 }).includes('gifts_for_all'));
});

test('Nochebuena impecable pide el dato del servidor y cero bolas recibidas', () => {
  const ids = (stats, extra) => earnAchievements(run(stats, extra), 'SALUD').map((a) => a.id);
  assert.ok(ids({ snowballsTaken: 0 }, { kinderReached: 3 }).includes('spotless_eve'));
  assert.ok(!ids({ snowballsTaken: 1 }, { kinderReached: 3 }).includes('spotless_eve'));
  assert.ok(!ids({}, { kinderReached: 5 }).includes('spotless_eve'), 'un resumen viejo sin el dato no lo da');
});
