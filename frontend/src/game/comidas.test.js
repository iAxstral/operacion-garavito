import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMIDA_TEXTURES, comidaNavidena, texturaDeComida } from './comidas.js';
import { CAFETERIA_MENU } from './shopCatalog.js';
import { FOOD_ITEMS } from './itemCatalog.js';

test('la cafeteria vende bunuelos, natilla, chocolate y galletas con el mismo precio y vida', () => {
  const names = CAFETERIA_MENU.map((item) => comidaNavidena(item));
  assert.deepEqual(names.map((item) => item.itemName).sort(), ['Buñuelo', 'Chocolate caliente', 'Galleta de jengibre', 'Natilla']);
  names.forEach((item, i) => {
    assert.equal(item.price, CAFETERIA_MENU[i].price);
    assert.equal(item.healAmount, CAFETERIA_MENU[i].healAmount);
    assert.equal(item.itemId, CAFETERIA_MENU[i].itemId);
  });
});

test('toda la comida del mapa tiene su dibujo de Navidad', () => {
  FOOD_ITEMS.forEach((item) => {
    const key = texturaDeComida(item.itemId);
    assert.ok(key && COMIDA_TEXTURES[key], `falta el dibujo de ${item.itemId}`);
  });
});
