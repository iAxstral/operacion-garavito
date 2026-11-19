// Espejo de backend/.../Weapon.java: el servidor decide dano, alcance y balas; aqui
// solo se usa para el ritmo de los pedidos, los efectos y lo que muestra el HUD.
export const WEAPONS = {
  FISTS: {
    id: 'FISTS', itemId: null, name: 'Puños', ranged: false, range: 56, cooldownMs: 700,
    magazineSize: 0, reloadMs: 0, pierce: 1, icon: null, glyph: '✊',
  },
  AXE: {
    id: 'AXE', itemId: 'shop-hacha', name: 'Hacha', ranged: false, range: 76, cooldownMs: 520,
    magazineSize: 0, reloadMs: 0, pierce: 1, icon: '/economia/item_hacha.svg', glyph: '🪓',
  },
  PISTOL: {
    id: 'PISTOL', itemId: 'shop-pistola', name: 'Pistola', ranged: true, range: 460, cooldownMs: 340,
    magazineSize: 8, reloadMs: 1100, pierce: 1, icon: '/economia/item_pistola_72.png', glyph: '🔫',
  },
  RIFLE: {
    id: 'RIFLE', itemId: 'shop-rifle', name: 'Rifle', ranged: true, range: 680, cooldownMs: 800,
    magazineSize: 5, reloadMs: 1700, pierce: 3, icon: '/economia/item_rifle_72.png', glyph: '🎯',
  },
};

export const AMMO_PER_PACK = 15;

export function weaponById(id) {
  return WEAPONS[id] ?? WEAPONS.FISTS;
}

export function weaponForItem(itemId) {
  return Object.values(WEAPONS).find((weapon) => weapon.itemId && weapon.itemId === itemId) ?? null;
}

/** Armas disponibles para un jugador: puños + las del inventario, en orden (teclas 1..4). */
export function ownedWeapons(inventory = []) {
  const owned = [WEAPONS.FISTS];
  inventory.forEach((slot) => {
    const weapon = weaponForItem(slot.itemId);
    if (weapon && !owned.includes(weapon)) owned.push(weapon);
  });
  return owned;
}
