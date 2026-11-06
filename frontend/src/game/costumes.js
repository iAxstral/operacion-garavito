// Disfraces cosmeticos y la bolsa de regalos del jugador. Los regalos los suelta la
// horda en cada corrida (los cuenta el servidor) y se suman aqui al terminar; los
// disfraces se compran con ellos y el que esta puesto viaja al servidor al unirse.

const STORAGE_KEY = 'garavito.candy.v1';

// `rareza` marca el color de la carta en la tienda (COMUN, RARO, EPICO, LEGENDARIO) y
// `nuevo` los recien llegados. Solo se compran los que estan en la tienda del dia.
export const COSTUMES = [
  { id: 'GORRO_NAVIDAD', name: 'Gorro de Papá Noel', price: 6, rareza: 'COMUN', description: 'Rasgado y con manchas que no son de chocolate' },
  { id: 'GORRO_DUENDE', name: 'Gorro de duende', price: 5, rareza: 'COMUN', description: 'Con cascabel: te van a oír llegar', nuevo: true },
  { id: 'BUFANDA', name: 'Bufanda de la abuela', price: 5, rareza: 'COMUN', description: 'Tejida a mano. Pica, pero abriga', nuevo: true },
  { id: 'CORNAMENTA', name: 'Cornamenta de reno', price: 10, rareza: 'RARO', description: 'Con una lucecita roja que ya no ilumina' },
  { id: 'CORONA_ACEBO', name: 'Corona de acebo', price: 9, rareza: 'RARO', description: 'Las bayas rojas no se comen. Las otras tampoco', nuevo: true },
  { id: 'GUIRNALDA', name: 'Guirnalda de luces', price: 12, rareza: 'RARO', description: 'Titila sola cuando hay zombis cerca', nuevo: true },
  { id: 'ESFERA_ROTA', name: 'Esfera rota', price: 16, rareza: 'EPICO', description: 'Algo te mira desde adentro', nuevo: true },
  { id: 'MUNECO_NIEVE', name: 'Muñeco de nieve', price: 18, rareza: 'EPICO', description: 'Derritiéndose, como tus ganas de estudiar', nuevo: true },
  { id: 'KRAMPUS', name: 'Máscara de Krampus', price: 18, rareza: 'EPICO', description: 'El que se lleva a los que se portaron mal' },
  { id: 'CASCANUECES', name: 'Gorro de cascanueces', price: 22, rareza: 'LEGENDARIO', description: 'Rompe nueces. Y cráneos', nuevo: true },
  { id: 'ESTRELLA', name: 'Estrella de la punta', price: 30, rareza: 'LEGENDARIO', description: 'La sacaste del árbol del bloque F. Nadie lo sabe', nuevo: true },
];

export const RAREZAS = {
  COMUN: { nombre: 'Común', orden: 0 },
  RARO: { nombre: 'Raro', orden: 1 },
  EPICO: { nombre: 'Épico', orden: 2 },
  LEGENDARIO: { nombre: 'Legendario', orden: 3 },
};

// ---------- Tienda del dia ----------
// La tienda cambia a la medianoche (hora del jugador) y es la misma para todos ese dia:
// sale de mezclar el catalogo con una semilla que es la fecha.

export const DESCUENTO_DEL_DIA = 0.3;

/** Clave del dia (AAAAMMDD) en la hora local de `date`. */
export function claveDelDia(date) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function mezclar(lista, semilla) {
  // mulberry32: rapido y siempre igual para la misma semilla.
  let t = semilla >>> 0;
  const random = () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * La tienda de `date`:
 *  - destacados: 2 epicos o legendarios,
 *  - diarios: 5 mas (uno con descuento).
 * Cada objeto trae su `precio` de hoy (con descuento si toca) y `oferta`.
 */
export function tiendaDelDia(date) {
  const semilla = claveDelDia(date) * 31 + 7;
  const mezclados = mezclar(COSTUMES, semilla);
  const destacados = mezclados.filter((c) => RAREZAS[c.rareza].orden >= 2).slice(0, 2);
  const diarios = mezclados.filter((c) => !destacados.includes(c)).slice(0, 5);
  const ofertaIdx = semilla % diarios.length;
  const conPrecio = (c, extra = {}) => ({ ...c, precio: c.price, oferta: false, ...extra });
  return {
    destacados: destacados.map((c) => conPrecio(c)),
    diarios: diarios.map((c, i) => (i === ofertaIdx
      ? conPrecio(c, { oferta: true, precio: Math.max(1, Math.round(c.price * (1 - DESCUENTO_DEL_DIA))) })
      : conPrecio(c))),
  };
}

/** Milisegundos que faltan para que cambie la tienda (la proxima medianoche local). */
export function msHastaRenovar(date) {
  const manana = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return manana.getTime() - date.getTime();
}

function empty() {
  return { candies: 0, owned: [], equipped: null, credited: [] };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return empty();
    return {
      candies: Number.isFinite(raw.candies) ? Math.max(0, Math.floor(raw.candies)) : 0,
      owned: Array.isArray(raw.owned) ? raw.owned.filter((id) => COSTUMES.some((c) => c.id === id)) : [],
      equipped: COSTUMES.some((c) => c.id === raw.equipped) ? raw.equipped : null,
      credited: Array.isArray(raw.credited) ? raw.credited.slice(-20) : [],
    };
  } catch {
    return empty();
  }
}

function save(bag) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bag));
  } catch {
    // Sin almacenamiento la bolsa dura solo esta sesion.
  }
}

export function getBag() {
  return load();
}

export function getEquippedCostume() {
  const bag = load();
  return bag.owned.includes(bag.equipped) ? bag.equipped : null;
}

/** Suma los regalos de una corrida una sola vez (por id del resumen). Devuelve los sumados. */
export function creditRun(summaryId, candies) {
  const bag = load();
  const key = String(summaryId);
  if (!candies || bag.credited.includes(key)) return 0;
  bag.candies += candies;
  bag.credited = [...bag.credited, key].slice(-20);
  save(bag);
  return candies;
}

/**
 * Compra un disfraz si alcanza, al precio indicado (el de la tienda del dia, que puede
 * tener descuento; por defecto el de lista). Devuelve true si quedo comprado.
 */
export function buyCostume(id, price) {
  const bag = load();
  const costume = COSTUMES.find((c) => c.id === id);
  const cost = Number.isFinite(price) && price > 0 ? Math.min(price, costume?.price ?? price) : costume?.price;
  if (!costume || bag.owned.includes(id) || bag.candies < cost) return false;
  bag.candies -= cost;
  bag.owned = [...bag.owned, id];
  bag.equipped = id;
  save(bag);
  return true;
}

/** Se pone un disfraz que ya tiene (o se lo quita con null). */
export function equipCostume(id) {
  const bag = load();
  if (id !== null && !bag.owned.includes(id)) return false;
  bag.equipped = id;
  save(bag);
  return true;
}
