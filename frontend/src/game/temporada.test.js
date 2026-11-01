import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// localStorage de mentira: en Node no existe y la eleccion debe sobrevivir igual.
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const {
  TEMPORADAS,
  getTemporada,
  getTemporadaPreferida,
  normalizarTemporada,
  onTemporadaChange,
  setTemporadaDeSala,
  setTemporadaPreferida,
} = await import('./temporada.js');

beforeEach(() => {
  setTemporadaDeSala(null);
  setTemporadaPreferida('NAVIDAD');
});

test('sin eleccion guardada la temporada es Navidad', () => {
  assert.equal(getTemporada(), 'NAVIDAD');
});

test('una temporada desconocida se vuelve Navidad', () => {
  assert.equal(normalizarTemporada('pascua'), 'NAVIDAD');
  assert.equal(normalizarTemporada(undefined), 'NAVIDAD');
  assert.equal(normalizarTemporada(' halloween '), 'HALLOWEEN');
});

test('la preferida se guarda en el navegador', () => {
  setTemporadaPreferida('HALLOWEEN');
  assert.equal(getTemporadaPreferida(), 'HALLOWEEN');
  assert.equal(store.get('garavito.temporada.v1'), 'HALLOWEEN');
});

test('dentro de una sala manda la temporada de la sala, y al salir vuelve la preferida', () => {
  setTemporadaPreferida('NAVIDAD');
  setTemporadaDeSala('HALLOWEEN');
  assert.equal(getTemporada(), 'HALLOWEEN');
  setTemporadaDeSala(null);
  assert.equal(getTemporada(), 'NAVIDAD');
});

test('avisa los cambios a quien escucha', () => {
  const vistas = [];
  const dejar = onTemporadaChange((id) => vistas.push(id));
  setTemporadaDeSala('HALLOWEEN');
  setTemporadaDeSala('HALLOWEEN');
  setTemporadaDeSala(null);
  dejar();
  assert.deepEqual(vistas, ['HALLOWEEN', 'NAVIDAD']);
});

test('cada temporada nombra su moneda', () => {
  assert.equal(TEMPORADAS.NAVIDAD.moneda.plural, 'regalos');
  assert.equal(TEMPORADAS.HALLOWEEN.moneda.plural, 'dulces');
});
