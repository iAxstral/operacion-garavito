import { test } from 'node:test';
import assert from 'node:assert/strict';
import { circleTouches, darknessView, lightVisible, stampTransform, toTexture } from './lightMath.js';

test('la vista de oscuridad empieza un margen antes de la camara y escala con zoom y resolucion', () => {
  const view = darknessView({ x: 1000, y: 500 }, 2, 0.5, 64);
  assert.deepEqual(view, { x: 968, y: 468, scale: 1 });
});

test('un punto del mundo se pasa a pixeles de la textura', () => {
  const view = { x: 100, y: 50, scale: 0.5 };
  assert.deepEqual(toTexture(view, 100, 50), { sx: 0, sy: 0 });
  assert.deepEqual(toTexture(view, 300, 250), { sx: 100, sy: 100 });
});

test('un circulo cuenta como visible si cualquier parte toca la textura', () => {
  assert.equal(circleTouches(50, 50, 10, 100, 100), true, 'adentro');
  assert.equal(circleTouches(-5, 50, 10, 100, 100), true, 'asomado por la izquierda');
  assert.equal(circleTouches(-11, 50, 10, 100, 100), false, 'del todo afuera por la izquierda');
  assert.equal(circleTouches(50, 111, 10, 100, 100), false, 'del todo afuera por abajo');
  assert.equal(circleTouches(110, 110, 10, 100, 100), true, 'rozando la esquina de la caja');
});

test('una luz lejana del jugador se descarta y una cercana no', () => {
  const view = darknessView({ x: 0, y: 0 }, 1, 0.5, 64);
  const width = 700;
  const height = 400;
  assert.equal(lightVisible(view, 600, 400, 120, width, height), true);
  assert.equal(lightVisible(view, 5000, 400, 120, width, height), false);
  // El radio cuenta: una luz grande justo fuera del borde todavia alumbra adentro.
  assert.equal(lightVisible(view, 1500, 400, 200, width, height), true);
});

test('la matriz del sello traslada, escala y gira', () => {
  const [a, b, c, d, e, f] = stampTransform(10, 20, 0, 64, 128);
  assert.deepEqual([a, b, c, d, e, f], [0.5, 0, -0, 0.5, 10, 20]);
  const girada = stampTransform(0, 0, Math.PI / 2, 128, 128);
  assert.ok(Math.abs(girada[0]) < 1e-12 && Math.abs(girada[1] - 1) < 1e-12);
  assert.ok(Math.abs(girada[2] + 1) < 1e-12 && Math.abs(girada[3]) < 1e-12);
});
