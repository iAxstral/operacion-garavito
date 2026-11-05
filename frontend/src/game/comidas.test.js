import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMIDA_TEXTURES, comidaDeTemporada, texturaDeComida } from './comidas.js';
import { CAFETERIA_MENU } from './shopCatalog.js';
import { FOOD_ITEMS } from './itemCatalog.js';

test('en Navidad la cafeteria vende bunuelos, natilla, chocolate y galletas con el mismo precio y vida', () => {
  const names = CAFETERIA_MENU.map((item) => comidaDeTemporada(item, 'NAVIDAD'));
  assert.deepEqual(names.map((item) => item.itemName).sort(), ['Buñuelo', 'Chocolate caliente', 'Galleta de jengibre', 'Natilla']);
  names.forEach((item, i) => {
    assert.equal(item.price, CAFETERIA_MENU[i].price);
    assert.equal(item.healAmount, CAFETERIA_MENU[i].healAmount);
    assert.equal(item.itemId, CAFETERIA_MENU[i].itemId);
  });
});

test('en Halloween la comida queda como llega', () => {
  CAFETERIA_MENU.forEach((item) => assert.equal(comidaDeTemporada(item, 'HALLOWEEN'), item));
  FOOD_ITEMS.forEach((item) => assert.equal(texturaDeComida(item.itemId, 'HALLOWEEN'), null));
});

test('toda la comida del mapa tiene su dibujo de Navidad', () => {
  FOOD_ITEMS.forEach((item) => {
    const key = texturaDeComida(item.itemId, 'NAVIDAD');
    assert.ok(key && COMIDA_TEXTURES[key], `falta el dibujo de ${item.itemId}`);
  });
});
