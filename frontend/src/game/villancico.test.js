import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WE_WISH, WE_WISH_BEATS } from './villancico.js';

test('la melodia va en orden, sin notas encimadas, y dura lo que dice', () => {
  for (let i = 1; i < WE_WISH.length; i += 1) {
    const [prevStart, , prevBeats] = WE_WISH[i - 1];
    assert.equal(WE_WISH[i][0], prevStart + prevBeats, `nota ${i} empieza donde termina la anterior`);
  }
  const [lastStart, , lastBeats] = WE_WISH.at(-1);
  assert.equal(lastStart + lastBeats, WE_WISH_BEATS);
});

test('en 3/4 con anacrusa: cada compas empieza en 1, 4, 7, ... con una nota', () => {
  const starts = new Set(WE_WISH.map(([beat]) => beat));
  for (let bar = 1; bar < WE_WISH_BEATS; bar += 3) assert.ok(starts.has(bar), `compas en ${bar}`);
});
