import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const { COSTUMES, buyCostume, creditRun, equipCostume, getBag, getEquippedCostume } = await import('./costumes.js');

beforeEach(() => store.clear());

test('los dulces de una corrida se suman una sola vez', () => {
  assert.equal(creditRun(7, 5), 5);
  assert.equal(creditRun(7, 5), 0);
  assert.equal(creditRun(8, 3), 3);
  assert.equal(getBag().candies, 8);
});

test('comprar descuenta, se pone el disfraz y no se puede sin dulces', () => {
  const cheap = COSTUMES[0];
  assert.equal(buyCostume(cheap.id), false);
  creditRun(1, cheap.price + 2);
  assert.equal(buyCostume(cheap.id), true);
  assert.equal(getBag().candies, 2);
  assert.equal(getEquippedCostume(), cheap.id);
  assert.equal(buyCostume(cheap.id), false, 'no se compra dos veces');
});

test('solo se pone lo que se tiene y se puede quitar', () => {
  assert.equal(equipCostume('FANTASMA'), false);
  creditRun(1, 100);
  buyCostume('FANTASMA');
  assert.equal(equipCostume(null), true);
  assert.equal(getEquippedCostume(), null);
  assert.equal(equipCostume('FANTASMA'), true);
  assert.equal(getEquippedCostume(), 'FANTASMA');
});

test('una bolsa guardada con basura no rompe nada', () => {
  store.set('garavito.candy.v1', JSON.stringify({ candies: -4, owned: ['HACK', 'BRUJA'], equipped: 'HACK' }));
  assert.deepEqual(getBag(), { candies: 0, owned: ['BRUJA'], equipped: null, credited: [] });
});

test('la tienda muestra primero los disfraces de la temporada que se juega', async () => {
  const { costumesFor } = await import('./costumes.js');
  const navidad = costumesFor('NAVIDAD');
  const halloween = costumesFor('HALLOWEEN');
  assert.equal(navidad.length, COSTUMES.length);
  assert.ok(navidad.slice(0, 3).every((c) => c.temporada === 'NAVIDAD'));
  assert.equal(halloween[0].temporada, 'HALLOWEEN');
  assert.equal(new Set(halloween.map((c) => c.id)).size, COSTUMES.length, 'sin repetidos');
});
