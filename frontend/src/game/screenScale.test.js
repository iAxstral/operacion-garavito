import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraZoomFor, uiScaleFor } from './screenScale.js';

test('la camara va a 1 en la referencia y en una ventana de laptop', () => {
  assert.equal(cameraZoomFor(1366, 768), 1);
  assert.equal(cameraZoomFor(1366, 657), 1);
});

test('en monitores grandes la camara acerca para ver lo mismo que en la referencia', () => {
  assert.equal(cameraZoomFor(1920, 1080), 1.4);
  assert.equal(cameraZoomFor(2560, 1440), 1.9);
  assert.equal(cameraZoomFor(7680, 4320), 3);
});

test('en celular la camara aleja como antes', () => {
  assert.equal(cameraZoomFor(915, 412), 0.65);
  assert.equal(cameraZoomFor(320, 200), 0.6);
});

test('la interfaz se ajusta a lo que mas limite, el alto o el ancho', () => {
  assert.equal(uiScaleFor(1366, 768), 1);
  assert.equal(uiScaleFor(1366, 657), 0.85);
  assert.equal(uiScaleFor(1920, 1080), 1.4);
  assert.equal(uiScaleFor(1920, 945), 1.25);
  assert.equal(uiScaleFor(2560, 1440), 1.85);
  assert.equal(uiScaleFor(800, 400), 0.75);
  assert.equal(uiScaleFor(5000, 3000), 2);
});

test('en pantallas tactiles la interfaz no se escala', () => {
  assert.equal(uiScaleFor(915, 412, true), 1);
});
