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

test('la tienda del dia es la misma todo el dia y cambia al siguiente', async () => {
  const { tiendaDelDia } = await import('./costumes.js');
  const manana = tiendaDelDia(new Date(2026, 11, 24, 0, 5), 'NAVIDAD');
  const noche = tiendaDelDia(new Date(2026, 11, 24, 23, 55), 'NAVIDAD');
  assert.deepEqual(manana, noche);
  const ids = (t) => [...t.destacados, ...t.diarios].map((c) => c.id).join();
  const dias = new Set(Array.from({ length: 7 }, (_, i) => ids(tiendaDelDia(new Date(2026, 11, 20 + i), 'NAVIDAD'))));
  assert.ok(dias.size > 1, 'la tienda rota entre dias');
});

test('la tienda trae 2 destacados grandes del evento, 4 diarios con una oferta y uno que vuelve', async () => {
  const { tiendaDelDia, RAREZAS, DESCUENTO_DEL_DIA } = await import('./costumes.js');
  for (let d = 1; d <= 31; d += 1) {
    const tienda = tiendaDelDia(new Date(2026, 11, d), 'NAVIDAD');
    assert.equal(tienda.destacados.length, 2);
    tienda.destacados.forEach((c) => {
      assert.equal(c.temporada, 'NAVIDAD');
      assert.ok(RAREZAS[c.rareza].orden >= 2);
    });
    const delEvento = tienda.diarios.filter((c) => !c.vuelve);
    assert.equal(delEvento.length, 4);
    delEvento.forEach((c) => assert.equal(c.temporada, 'NAVIDAD'));
    const ofertas = tienda.diarios.filter((c) => c.oferta);
    assert.equal(ofertas.length, 1);
    assert.equal(ofertas[0].precio, Math.max(1, Math.round(ofertas[0].price * (1 - DESCUENTO_DEL_DIA))));
    const vuelve = tienda.diarios.filter((c) => c.vuelve);
    assert.equal(vuelve.length, 1);
    assert.equal(vuelve[0].temporada, 'HALLOWEEN');
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
