import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ABILITIES, abilityFor, priceFor, TREASURER_DISCOUNT } from './abilityCatalog.js';
import { WEAPONS, weaponById, weaponForItem, ownedWeapons } from './weaponCatalog.js';
import { CAFETERIA_MENU, WEAPON_MACHINE_MENU, VENDORS } from './shopCatalog.js';
import { MISSION_TYPES, missionType, missionTypesForRole, missionSitesFor } from './missionCatalog.js';
import { ROLE_CATALOG, roleInfo, missionSummary } from './roleCatalog.js';
import { PERKS, hasPerk } from './perks.js';
import { FOOD_ITEMS } from './itemCatalog.js';
import { NAVIDAD } from './navidad.js';
import { BUILDINGS } from './mapLayout.js';

const ROLES = ['SEGURIDAD', 'SALUD', 'ECONOMIA', 'INFRAESTRUCTURA'];

test('cada rol tiene habilidad y un rol desconocido cae en Seguridad', () => {
  ROLES.forEach((role) => assert.ok(ABILITIES[role].name));
  assert.equal(abilityFor('NADIE'), ABILITIES.SEGURIDAD);
});

test('Economia paga con descuento (redondeado hacia arriba) y los demas el precio lleno', () => {
  assert.equal(priceFor('ECONOMIA', 35), Math.ceil(35 * (1 - TREASURER_DISCOUNT)));
  assert.equal(priceFor('ECONOMIA', 35), 28);
  assert.equal(priceFor('SALUD', 35), 35);
});

test('armas: por id, por objeto de la tienda y las que tiene un jugador en orden', () => {
  assert.equal(weaponById('RIFLE').name, 'Rifle');
  assert.equal(weaponById('LASER'), WEAPONS.FISTS);
  assert.equal(weaponForItem('shop-pistola'), WEAPONS.PISTOL);
  assert.equal(weaponForItem('shop-empanada'), null);
  assert.deepEqual(ownedWeapons(), [WEAPONS.FISTS]);
  const owned = ownedWeapons([{ itemId: 'shop-rifle' }, { itemId: 'shop-empanada' }, { itemId: 'shop-rifle' }, { itemId: 'shop-hacha' }]);
  assert.deepEqual(owned.map((w) => w.id), ['FISTS', 'RIFLE', 'AXE'], 'sin repetidas y en el orden del inventario');
});

test('la tienda vende cada arma del catalogo y los ids no se repiten', () => {
  const ids = [...CAFETERIA_MENU, ...WEAPON_MACHINE_MENU].map((item) => item.itemId);
  assert.equal(new Set(ids).size, ids.length);
  Object.values(WEAPONS).filter((w) => w.itemId).forEach((weapon) => {
    assert.ok(WEAPON_MACHINE_MENU.some((item) => item.itemId === weapon.itemId), weapon.id);
  });
  CAFETERIA_MENU.forEach((item) => assert.ok(item.price > 0 && item.healAmount > 0, item.itemId));
  assert.deepEqual(VENDORS.map((v) => v.menu), [CAFETERIA_MENU, WEAPON_MACHINE_MENU]);
});

test('cuatro minijuegos por rol y uno desconocido se muestra como mision generica', () => {
  ROLES.forEach((role) => assert.equal(missionTypesForRole(role).length, 4, role));
  assert.equal(Object.keys(MISSION_TYPES).length, 16);
  assert.equal(missionType('NO_EXISTE').role, null);
  assert.equal(missionType('CAJA').role, 'ECONOMIA');
});

test('cada edificio tiene salas de mision con ids unicos; uno desconocido usa el F', () => {
  BUILDINGS.forEach((building) => {
    const sites = missionSitesFor(building);
    assert.ok(sites.length >= 8, building);
    assert.equal(new Set(sites.map((s) => s.siteId)).size, sites.length, building);
  });
  assert.equal(missionSitesFor('Z'), missionSitesFor('F'));
});

test('roles: datos de cada uno, resumen de sus misiones y rol desconocido', () => {
  assert.deepEqual(ROLE_CATALOG.map((r) => r.role), ROLES);
  assert.equal(roleInfo('SALUD').name, 'Biomédica');
  assert.equal(roleInfo('X'), ROLE_CATALOG[0]);
  assert.equal(missionSummary('ECONOMIA').split(' · ').length, 4);
});

test('mejoras: se detectan en el estado del jugador aunque falte', () => {
  assert.ok(Object.keys(PERKS).length >= 8);
  assert.equal(hasPerk({ perks: ['ENERGIA'] }, 'ENERGIA'), true);
  assert.equal(hasPerk({ perks: [] }, 'ENERGIA'), false);
  assert.equal(hasPerk(null, 'ENERGIA'), false);
});

test('la comida del mapa tiene ids unicos y la ambientacion no se puede cambiar', () => {
  assert.equal(new Set(FOOD_ITEMS.map((f) => f.itemId)).size, FOOD_ITEMS.length);
  assert.ok(Object.isFrozen(NAVIDAD) && Object.isFrozen(NAVIDAD.moneda));
});
