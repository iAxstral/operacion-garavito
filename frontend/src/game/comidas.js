import { getTemporada } from './temporada.js';

// En Navidad la comida que cura es la de diciembre en Colombia: bunuelos, natilla,
// chocolate y galletas. Es solo como se ve y se llama: el servidor usa los mismos ids
// y cura lo mismo (ShopCatalog y WorldItemCatalog no cambian).

const NAVIDAD = {
  // Cafeteria (mismo precio y vida que el plato de siempre)
  'shop-empanada': { itemName: 'Natilla', icon: '/economia/navidad_natilla.png' },
  'shop-arepa': { itemName: 'Buñuelo', icon: '/economia/navidad_bunuelo.png' },
  'shop-energizante': { itemName: 'Chocolate caliente', icon: '/economia/navidad_chocolate.png' },
  'shop-gaseosa': { itemName: 'Galleta de jengibre', icon: '/economia/navidad_galleta.png' },
  // Comida tirada por el edificio
  'cafeteria-food-1': { itemName: 'Buñuelos', icon: '/economia/navidad_bunuelo.png' },
  'cafeteria-food-2': { itemName: 'Natilla', icon: '/economia/navidad_natilla.png' },
  'cafeteria-food-3': { itemName: 'Chocolate con queso', icon: '/economia/navidad_chocolate.png' },
  'cafeteria-food-4': { itemName: 'Galleta de jengibre', icon: '/economia/navidad_galleta.png' },
  'estudio-food-1': { itemName: 'Chocolate caliente', icon: '/economia/navidad_chocolate.png' },
  'biblioteca-food-1': { itemName: 'Galletas de estrella', icon: '/economia/navidad_estrella.png' },
  'auditorio-food-1': { itemName: 'Natilla', icon: '/economia/navidad_natilla.png' },
  'servidores-food-1': { itemName: 'Galleta de jengibre', icon: '/economia/navidad_galleta.png' },
};

/** Texturas de Phaser para la comida del mapa en Navidad (clave → archivo). */
export const COMIDA_TEXTURES = {
  navidad_bunuelo: '/economia/navidad_bunuelo.png',
  navidad_natilla: '/economia/navidad_natilla.png',
  navidad_chocolate: '/economia/navidad_chocolate.png',
  navidad_galleta: '/economia/navidad_galleta.png',
  navidad_estrella: '/economia/navidad_estrella.png',
};

/**
 * El objeto `item` ({ itemId, itemName, icon? }) como se ve en la temporada: en Navidad
 * con su nombre e icono de diciembre; si no, igual que llega.
 */
export function comidaDeTemporada(item, temporada = getTemporada()) {
  if (!item || temporada !== 'NAVIDAD') return item;
  const override = NAVIDAD[item.itemId];
  return override ? { ...item, ...override } : item;
}

/** Clave de textura de Phaser para una comida del mapa (o null si va el cuadrito). */
export function texturaDeComida(itemId, temporada = getTemporada()) {
  if (temporada !== 'NAVIDAD') return null;
  const icon = NAVIDAD[itemId]?.icon;
  return icon ? icon.replace('/economia/', '').replace('.png', '') : null;
}
