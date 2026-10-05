import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// localStorage de mentira: en Node no existe y la configuracion debe sobrevivir igual.
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const {
  DEFAULT_SETTINGS,
  channelVolume,
  getSettings,
  onSettingsChange,
  resetSettings,
  setChannelVolume,
  updateSettings,
} = await import('./settings.js');

beforeEach(() => resetSettings());

test('el volumen efectivo de un canal es general × canal', () => {
  setChannelVolume('master', 0.5);
  setChannelVolume('zombies', 0.4);
  assert.equal(channelVolume('zombies'), 0.2);
  assert.equal(channelVolume('master'), 0.5);
});

test('silenciar deja todos los canales en 0 sin perder los niveles elegidos', () => {
  setChannelVolume('ambient', 0.3);
  updateSettings({ muted: true });
  assert.equal(channelVolume('ambient'), 0);
  assert.equal(channelVolume('master'), 0);
  updateSettings({ muted: false });
  assert.equal(getSettings().volumes.ambient, 0.3);
});

test('los valores fuera de rango se recortan entre 0 y 1', () => {
  setChannelVolume('combat', 7);
  assert.equal(getSettings().volumes.combat, 1);
  setChannelVolume('combat', -2);
  assert.equal(getSettings().volumes.combat, 0);
});

test('la configuracion se guarda en localStorage', () => {
  setChannelVolume('ui', 0.25);
  const saved = JSON.parse([...store.values()].at(-1));
  assert.equal(saved.volumes.ui, 0.25);
});

test('los oyentes se enteran de cada cambio y pueden desuscribirse', () => {
  const seen = [];
  const off = onSettingsChange((settings) => seen.push(settings.volumes.master));
  setChannelVolume('master', 0.1);
  off();
  setChannelVolume('master', 0.9);
  assert.deepEqual(seen, [0.1]);
});

test('restablecer vuelve a los valores por defecto', () => {
  updateSettings({ muted: true, screenShake: false, volumes: { master: 0.05 } });
  resetSettings();
  assert.deepEqual(getSettings(), {
    ...DEFAULT_SETTINGS,
    volumes: { ...DEFAULT_SETTINGS.volumes },
  });
});
