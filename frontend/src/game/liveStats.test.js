import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLiveStats, onLiveStats, publishFps, resetLiveStats } from './liveStats.js';

test('los FPS se publican redondeados y solo avisan si cambian', () => {
  const seen = [];
  const off = onLiveStats((stats) => seen.push(stats.fps));
  publishFps(59.6);
  publishFps(60.2);
  publishFps(44.4);
  off();
  publishFps(30);
  assert.deepEqual(seen, [60, 44]);
  assert.equal(getLiveStats().fps, 30);
});

test('un valor invalido o el reinicio dejan los FPS en null', () => {
  publishFps(50);
  publishFps(Number.NaN);
  assert.equal(getLiveStats().fps, null);
  publishFps(50);
  resetLiveStats();
  assert.equal(getLiveStats().fps, null);
});
