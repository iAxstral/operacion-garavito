// Disfraces cosmeticos y la bolsa de dulces del jugador. Los dulces los suelta la
// horda en cada corrida (los cuenta el servidor) y se suman aqui al terminar; los
// disfraces se compran con ellos y el que esta puesto viaja al servidor al unirse.

const STORAGE_KEY = 'garavito.candy.v1';

// `temporada`: el evento al que pertenece. Todos se pueden comprar y usar en cualquier
// temporada; la tienda solo muestra primero los del evento que se esta jugando.
export const COSTUMES = [
  { id: 'GORRO_NAVIDAD', name: 'Gorro de Papá Noel', price: 6, description: 'Rasgado y con manchas que no son de chocolate', temporada: 'NAVIDAD' },
  { id: 'CORNAMENTA', name: 'Cornamenta de reno', price: 10, description: 'Con una lucecita roja que ya no ilumina', temporada: 'NAVIDAD' },
  { id: 'KRAMPUS', name: 'Máscara de Krampus', price: 18, description: 'El que se lleva a los que se portaron mal', temporada: 'NAVIDAD' },
  { id: 'CALABAZA', name: 'Cabeza de calabaza', price: 6, description: 'Una calabaza tallada con vela adentro', temporada: 'HALLOWEEN' },
  { id: 'BRUJA', name: 'Sombrero de bruja', price: 8, description: 'Alto, torcido y con hebilla', temporada: 'HALLOWEEN' },
  { id: 'DIABLO', name: 'Cuernos de diablo', price: 10, description: 'Rojos y puntiagudos', temporada: 'HALLOWEEN' },
  { id: 'VAMPIRO', name: 'Capa de vampiro', price: 14, description: 'Cuello alto y forro rojo', temporada: 'HALLOWEEN' },
  { id: 'CALAVERA', name: 'Máscara de calavera', price: 18, description: 'Hueso pintado con ojos negros', temporada: 'HALLOWEEN' },
  { id: 'FANTASMA', name: 'Sábana de fantasma', price: 25, description: 'Para pasar desapercibido... o no', temporada: 'HALLOWEEN' },
];

/** Los disfraces con los de la temporada indicada primero (el resto en su orden). */
export function costumesFor(temporada) {
  return [...COSTUMES.filter((c) => c.temporada === temporada), ...COSTUMES.filter((c) => c.temporada !== temporada)];
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

/** Suma los dulces de una corrida una sola vez (por id del resumen). Devuelve los sumados. */
export function creditRun(summaryId, candies) {
  const bag = load();
  const key = String(summaryId);
  if (!candies || bag.credited.includes(key)) return 0;
  bag.candies += candies;
  bag.credited = [...bag.credited, key].slice(-20);
  save(bag);
  return candies;
}

/** Compra un disfraz si alcanza. Devuelve true si quedo comprado. */
export function buyCostume(id) {
  const bag = load();
  const costume = COSTUMES.find((c) => c.id === id);
  if (!costume || bag.owned.includes(id) || bag.candies < costume.price) return false;
  bag.candies -= costume.price;
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
