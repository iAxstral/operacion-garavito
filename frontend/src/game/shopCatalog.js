
export const CAFETERIA_MENU = [
  { itemId: 'shop-empanada', type: 'FOOD', itemName: 'Empanada', price: 10, healAmount: 20, icon: '/economia/item_empanada_72.png' },
  { itemId: 'shop-arepa', type: 'FOOD', itemName: 'Arepa', price: 8, healAmount: 15, icon: '/economia/item_arepa_72.png' },
  { itemId: 'shop-energizante', type: 'FOOD', itemName: 'Energizante', price: 12, healAmount: 10, icon: '/economia/item_energizante_48x72.png' },
  { itemId: 'shop-gaseosa', type: 'FOOD', itemName: 'Gaseosa', price: 6, healAmount: 5, icon: '/economia/item_gaseosa_48x72.png' },
];

// Espejo de ShopCatalog.WEAPON_MACHINE_MENU. `detail` es lo que muestra la tienda.
export const WEAPON_MACHINE_MENU = [
  { itemId: 'shop-hacha', type: 'WEAPON', itemName: 'Hacha', price: 20, healAmount: 0, icon: '/economia/item_hacha.svg', detail: 'Cuerpo a cuerpo · 3 daño' },
  { itemId: 'shop-pistola', type: 'WEAPON', itemName: 'Pistola', price: 35, healAmount: 0, icon: '/economia/item_pistola_72.png', detail: '8 balas · 2 daño' },
  { itemId: 'shop-rifle', type: 'WEAPON', itemName: 'Rifle', price: 80, healAmount: 0, icon: '/economia/item_rifle_72.png', detail: '5 balas · atraviesa 3' },
  { itemId: 'shop-municion', type: 'AMMO', itemName: 'Munición', price: 8, healAmount: 0, icon: '/economia/item_municion_72.png', detail: '+15 balas' },
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
