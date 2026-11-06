import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLatencyMeter, fpsLevel, pingLevel, smoothRtt } from './latency.js';

test('la primera medida se toma tal cual y las siguientes se suavizan', () => {
  assert.equal(smoothRtt(null, 100), 100);
  assert.equal(smoothRtt(100, 200, 0.5), 150);
  assert.equal(smoothRtt(100, 100), 100);
});

test('una medida invalida no cambia la media', () => {
  assert.equal(smoothRtt(80, Number.NaN), 80);
  assert.equal(smoothRtt(80, -3), 80);
  assert.equal(smoothRtt(null, Infinity), null);
});

test('el ping y los FPS se clasifican en bueno, regular y malo', () => {
  assert.equal(pingLevel(null), 'unknown');
  assert.equal(pingLevel(30), 'good');
  assert.equal(pingLevel(120), 'fair');
  assert.equal(pingLevel(400), 'bad');
  assert.equal(fpsLevel(60), 'good');
  assert.equal(fpsLevel(35), 'fair');
  assert.equal(fpsLevel(12), 'bad');
  assert.equal(fpsLevel(Number.NaN), 'unknown');
});

// fetch de mentira: responde despues de avanzar el reloj `delays[i]` ms.
function fakeNetwork(delays) {
  let clock = 0;
  let call = 0;
  return {
    now: () => clock,
    fetchImpl: async () => {
      const delay = delays[call++];
      if (delay === 'error') throw new Error('sin red');
      clock += delay;
      return { ok: delay !== 'http500', json: async () => ({ serverTime: 1 }) };
    },
  };
}

test('el medidor suaviza las medidas y avisa de los cambios', async () => {
  const seen = [];
  const net = fakeNetwork([100, 200]);
  const meter = createLatencyMeter({ url: '/api/ping', onChange: (ms) => seen.push(ms), ...net });
  assert.equal(meter.rtt, null);
  await meter.measure();
  await meter.measure();
  assert.deepEqual(seen, [100, 130]);
  assert.equal(meter.rtt, 130);
});

test('si la red falla se queda con la ultima medida', async () => {
  const seen = [];
  const net = fakeNetwork([50, 'error']);
  const meter = createLatencyMeter({ url: '/api/ping', onChange: (ms) => seen.push(ms), ...net });
  await meter.measure();
  await meter.measure();
  assert.equal(meter.rtt, 50);
  assert.deepEqual(seen, [50]);
});

test('stop corta las mediciones periodicas', async () => {
  let calls = 0;
  const meter = createLatencyMeter({
    url: '/api/ping',
    everyMs: 5,
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, json: async () => ({}) };
    },
  });
  meter.start();
  await new Promise((resolve) => setTimeout(resolve, 30));
  meter.stop();
  const afterStop = calls;
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.ok(afterStop >= 2, `midio ${afterStop} veces`);
  assert.equal(calls, afterStop);
});
