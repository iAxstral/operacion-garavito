// Habilidad de cada rol (tecla F / boton ★ en celular). Espejo de las reglas de
// GameSession en el servidor: quien puede hacer que y con que enfriamiento.

export const ABILITIES = {
  SEGURIDAD: {
    name: 'Teléfono de cámaras',
    icon: '📱',
    hint: 'Mira por las cámaras por dónde vienen los zombis (te mueves más lento mientras lo usas)',
  },
  SALUD: {
    name: 'Revivir',
    icon: '✚',
    hint: 'Eres la única que revive: mantén E junto a un compañero caído',
  },
  ECONOMIA: {
    name: 'Tesorería',
    icon: '💰',
    hint: 'Envía Garavitos a tus compañeros. Además compras con 20% de descuento',
  },
  INFRAESTRUCTURA: {
    name: 'Barricada',
    icon: '🧱',
    hint: 'Pon una barricada enfrente (máx. 2). Los zombis la rompen: repárala con E',
  },
};

export const BARRICADE_COOLDOWN_MS = 15000;
export const MAX_BARRICADES = 2;
export const BARRICADE_REPAIR_RANGE_PX = 90;
export const TREASURER_DISCOUNT = 0.2;

export function abilityFor(role) {
  return ABILITIES[role] ?? ABILITIES.SEGURIDAD;
}

/** Precio que paga ese rol en la tienda (Economia tiene descuento). */
export function priceFor(role, price) {
  return role === 'ECONOMIA' ? Math.ceil(price * (1 - TREASURER_DISCOUNT)) : price;
}

// Teléfono de Seguridad: las camaras cubren este radio alrededor de cada una.
export const CAMERA_RANGE_PX = 330;
