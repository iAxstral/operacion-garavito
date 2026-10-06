import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AFTER_MS, BEFORE_MS, createRecorder, lerpEntity } from './replay.js';

const state = (extra = {}) => ({
  players: [{ playerId: 'SEGURIDAD', role: 'SEGURIDAD', floor: 1, x: 100, y: 100, lifeState: 'ALIVE' }],
  zombies: [{ id: 'z1', floor: 1, x: 150, y: 100, kind: 'WALKER' }],
  boss: null,
  blasts: [],
  wave: { number: 2 },
  ...extra,
});

function feed(recorder, from, to, make = () => state()) {
  for (let t = from; t <= to; t += 125) recorder.onState(make(t), t);
}

test('una racha de eliminaciones queda como mejor jugada, con segundos antes y despues', () => {
  const rec = createRecorder();
  feed(rec, 0, 10_000);
  rec.onEvent({ type: 'ATTACK_KILL', playerId: 'SEGURIDAD', itemId: '1' }, 10_000);
  rec.onEvent({ type: 'ATTACK_KILL', playerId: 'SEGURIDAD', itemId: '2' }, 10_500, () => 'Ana');
  assert.equal(rec.best(), null, 'espera el despues antes de recortar');
  feed(rec, 10_625, 13_000);
  const best = rec.best();
  assert.ok(best);
  assert.equal(best.score, 30);
  assert.equal(best.focusId, 'SEGURIDAD');
  assert.match(best.title, /Triple eliminación de Ana/);
  assert.ok(best.frames[0].t >= 10_500 - BEFORE_MS);
  assert.ok(best.frames.at(-1).t <= 10_500 + AFTER_MS);
});

test('una sola eliminacion no cuenta; una jugada peor no reemplaza a la mejor', () => {
  const rec = createRecorder();
  feed(rec, 0, 2_000);
  rec.onEvent({ type: 'ATTACK_KILL', playerId: 'SEGURIDAD', itemId: '1' }, 2_000);
  feed(rec, 2_125, 5_000);
  assert.equal(rec.best(), null);
  rec.onEvent({ type: 'ATTACK_KILL', playerId: 'SEGURIDAD', itemId: '3' }, 5_000);
  feed(rec, 5_125, 8_000);
  assert.equal(rec.best().score, 40, 'la de 1 + 3 dentro de 3 s');
  rec.onEvent({ type: 'ATTACK_KILL', playerId: 'SALUD', itemId: '2' }, 8_000);
  feed(rec, 8_125, 11_000);
  assert.equal(rec.best().score, 40);
});

test('caer el jefe vale mas que una racha', () => {
  const rec = createRecorder();
  const boss = { floor: 1, x: 120, y: 100 };
  feed(rec, 0, 3_000, () => state({ boss }));
  feed(rec, 3_125, 6_000);
  assert.equal(rec.best().score, 80);
  assert.equal(rec.best().focusId, 'SEGURIDAD');
});

test('revivir con zombis cerca', () => {
  const rec = createRecorder();
  feed(rec, 0, 1_000);
  rec.onEvent({ type: 'REVIVED', playerId: 'SEGURIDAD', itemId: 'SALUD' }, 1_000);
  feed(rec, 1_125, 4_000);
  assert.equal(rec.best().score, 35);
  assert.equal(rec.best().focusId, 'SALUD');
});

test('interpola entre cuadros del mismo piso', () => {
  assert.deepEqual(lerpEntity({ floor: 1, x: 0, y: 0 }, { floor: 1, x: 10, y: 20 }, 0.5), { floor: 1, x: 5, y: 10 });
  assert.deepEqual(lerpEntity({ floor: 1, x: 0, y: 0 }, { floor: 2, x: 10, y: 20 }, 0.5), { floor: 1, x: 0, y: 0 });
});
