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

test('comprar descuenta, se pone el disfraz y no se puede sin regalos', () => {
  const cheap = COSTUMES[0];
  assert.equal(buyCostume(cheap.id), false);
  creditRun(1, cheap.price + 2);
  assert.equal(buyCostume(cheap.id), true);
  assert.equal(getBag().candies, 2);
  assert.equal(getEquippedCostume(), cheap.id);
  assert.equal(buyCostume(cheap.id), false, 'no se compra dos veces');
});

test('solo se pone lo que se tiene y se puede quitar', () => {
  assert.equal(equipCostume('ESTRELLA'), false);
  creditRun(1, 100);
  buyCostume('ESTRELLA');
  assert.equal(equipCostume(null), true);
  assert.equal(getEquippedCostume(), null);
  assert.equal(equipCostume('ESTRELLA'), true);
  assert.equal(getEquippedCostume(), 'ESTRELLA');
});

test('una bolsa guardada con basura no rompe nada', () => {
  store.set('garavito.candy.v1', JSON.stringify({ candies: -4, owned: ['HACK', 'KRAMPUS'], equipped: 'HACK' }));
  assert.deepEqual(getBag(), { candies: 0, owned: ['KRAMPUS'], equipped: null, credited: [] });
});

test('la tienda del dia es la misma todo el dia y cambia al siguiente', async () => {
  const { tiendaDelDia } = await import('./costumes.js');
  const manana = tiendaDelDia(new Date(2026, 11, 24, 0, 5));
  const noche = tiendaDelDia(new Date(2026, 11, 24, 23, 55));
  assert.deepEqual(manana, noche);
  const ids = (t) => [...t.destacados, ...t.diarios].map((c) => c.id).join();
  const dias = new Set(Array.from({ length: 7 }, (_, i) => ids(tiendaDelDia(new Date(2026, 11, 20 + i)))));
  assert.ok(dias.size > 1, 'la tienda rota entre dias');
});

test('la tienda trae 2 destacados grandes y 5 diarios con una oferta', async () => {
  const { tiendaDelDia, RAREZAS, DESCUENTO_DEL_DIA } = await import('./costumes.js');
  for (let d = 1; d <= 31; d += 1) {
    const tienda = tiendaDelDia(new Date(2026, 11, d));
    assert.equal(tienda.destacados.length, 2);
    tienda.destacados.forEach((c) => assert.ok(RAREZAS[c.rareza].orden >= 2));
    assert.equal(tienda.diarios.length, 5);
    const ofertas = tienda.diarios.filter((c) => c.oferta);
    assert.equal(ofertas.length, 1);
    assert.equal(ofertas[0].precio, Math.max(1, Math.round(ofertas[0].price * (1 - DESCUENTO_DEL_DIA))));
    const ids = [...tienda.destacados, ...tienda.diarios].map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, 'sin repetidos');
  }
});

test('se compra al precio de oferta y la tienda se renueva a medianoche', async () => {
  const { msHastaRenovar } = await import('./costumes.js');
  const cara = COSTUMES.find((c) => c.price >= 10);
  creditRun(50, cara.price - 1);
  assert.equal(buyCostume(cara.id), false, 'a precio de lista no alcanza');
  assert.equal(buyCostume(cara.id, cara.price - 3), true, 'con descuento si');
  assert.equal(getBag().candies, 2);
  assert.equal(msHastaRenovar(new Date(2026, 11, 24, 23, 0, 0)), 60 * 60 * 1000);
});
