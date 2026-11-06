import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPerfMonitor } from './perfMonitor.js';

// Alimenta el monitor con `fps` cada 250 ms entre `from` y `to` y devuelve los instantes
// en que pidio bajar la calidad.
function feed(monitor, fps, from, to) {
  const asks = [];
  for (let t = from; t <= to; t += 250) {
    if (monitor.sample(typeof fps === 'function' ? fps(t) : fps, t) === 'lower') asks.push(t);
  }
  return asks;
}

test('con buenos FPS nunca pide bajar la calidad', () => {
  const monitor = createPerfMonitor();
  assert.deepEqual(feed(monitor, 60, 0, 60000), []);
  assert.equal(monitor.average(), 60);
});

test('con FPS bajos sostenidos pide bajar una vez pasado el calentamiento y la espera', () => {
  const monitor = createPerfMonitor();
  const asks = feed(monitor, 25, 0, 12000);
  // 3 s de calentamiento + 5 s sostenidos.
  assert.deepEqual(asks, [8000]);
});

test('despues de pedir se queda quieto durante la espera', () => {
  const monitor = createPerfMonitor({ cooldownMs: 20000 });
  const asks = feed(monitor, 20, 0, 40000);
  assert.equal(asks[0], 8000);
  assert.ok(asks.every((t, i) => i === 0 || t - asks[i - 1] >= 20000), `pidio demasiado seguido: ${asks}`);
});

test('una caida corta (cambio de piso) no cuenta', () => {
  const monitor = createPerfMonitor();
  // 60 FPS salvo dos segundos a 15.
  const asks = feed(monitor, (t) => (t >= 10000 && t < 12000 ? 15 : 60), 0, 30000);
  assert.deepEqual(asks, []);
});

test('la ventana olvida las muestras viejas', () => {
  const monitor = createPerfMonitor({ windowMs: 1000 });
  feed(monitor, 10, 0, 5000);
  feed(monitor, 60, 5250, 7000);
  assert.equal(monitor.average(), 60);
});

test('ignora muestras invalidas y se puede reiniciar', () => {
  const monitor = createPerfMonitor();
  assert.equal(monitor.sample(Number.NaN, 0), null);
  assert.equal(monitor.sample(-5, 0), null);
  assert.equal(monitor.average(), null);
  feed(monitor, 20, 0, 9000);
  monitor.reset();
  assert.equal(monitor.average(), null);
  assert.deepEqual(feed(monitor, 20, 10000, 17000), [], 'tras reiniciar vuelve a calentar');
});
