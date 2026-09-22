
export const CAFETERIA_MENU = [
  { itemId: 'shop-empanada', type: 'FOOD', itemName: 'Empanada', price: 10, healAmount: 20, icon: '/economia/item_empanada_72.png' },
  { itemId: 'shop-arepa', type: 'FOOD', itemName: 'Arepa', price: 8, healAmount: 15, icon: '/economia/item_arepa_72.png' },
  { itemId: 'shop-energizante', type: 'FOOD', itemName: 'Energizante', price: 12, healAmount: 10, icon: '/economia/item_energizante_48x72.png' },
  { itemId: 'shop-gaseosa', type: 'FOOD', itemName: 'Gaseosa', price: 6, healAmount: 5, icon: '/economia/item_gaseosa_48x72.png' },
];

export const WEAPON_MACHINE_MENU = [
  { itemId: 'shop-pistola', type: 'WEAPON', itemName: 'Pistola', price: 10, healAmount: 0, icon: '/economia/item_pistola_72.png' },
  { itemId: 'shop-rifle', type: 'WEAPON', itemName: 'Rifle', price: 90, healAmount: 0, icon: '/economia/item_rifle_72.png' },
  { itemId: 'shop-municion', type: 'AMMO', itemName: 'Munición', price: 1, healAmount: 0, icon: '/economia/item_municion_72.png' },
];

export const VENDORS = [
  {
    vendorId: 'cafeteria',
    floor: 1,
    x: 1696,
    y: 1440,
    sprite: 'npc_vendedora',
    spriteFile: '/economia/npc_vendedora_64x96.png',
    spriteWidth: 64,
    spriteHeight: 96,
    menu: CAFETERIA_MENU,
    label: 'Vendedora',
  },
  {
    vendorId: 'weapon-machine',
    floor: 2,
    x: 1888,
    y: 1120,
    sprite: 'maquina_expendedora',
    spriteFile: '/economia/maquina_expendedora_armas_77x128.png',
    spriteWidth: 76,
    spriteHeight: 128,
    menu: WEAPON_MACHINE_MENU,
    label: 'Máquina expendedora de armas',
  },
];

export const SHOP_RANGE_PX = 90;
