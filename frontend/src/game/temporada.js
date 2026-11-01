// Temporadas (eventos) del juego: la misma partida con otra ambientacion. Navidad es la
// temporada actual; Halloween queda como evento para quien quiera jugarlo.
//
// - La temporada "preferida" la elige el jugador en el menu y se guarda en este
//   navegador. Es la que se usa al crear una sala.
// - Dentro de una sala manda la temporada de la sala (la eligio quien la creo): asi todos
//   los de adentro ven lo mismo. Al salir se vuelve a la preferida.
//
// La temporada activa queda en <html data-temporada="navidad|halloween"> para el CSS.

const STORAGE_KEY = 'garavito.temporada.v1';

export const TEMPORADAS = Object.freeze({
  NAVIDAD: Object.freeze({
    id: 'NAVIDAD',
    nombre: 'Navidad sangrienta',
    etiqueta: 'Nuevo',
    descripcion: 'Nochebuena en la ECI: nieve, luces que parpadean y una horda que no trae regalos.',
    kicker: 'ECI · Nochebuena maldita',
    tagline: 'Cuatro roles, cinco Kinders y una horda que no duerme en Nochebuena. Cumplan sus misiones, cuídense… y no abran ningún regalo.',
    moneda: Object.freeze({ singular: 'regalo', plural: 'regalos', icono: 'gift' }),
  }),
  HALLOWEEN: Object.freeze({
    id: 'HALLOWEEN',
    nombre: 'Noche de Halloween',
    etiqueta: 'Evento clásico',
    descripcion: 'La versión original: calabazas, murciélagos y telarañas en cada salón.',
    kicker: 'ECI · Noche de Halloween',
    tagline: 'Cuatro roles, cinco Kinders y una horda que no duerme. Cumplan sus misiones, cuídense… y no miren atrás.',
    moneda: Object.freeze({ singular: 'dulce', plural: 'dulces', icono: 'pumpkin' }),
  }),
});

export const TEMPORADA_POR_DEFECTO = 'NAVIDAD';

export function normalizarTemporada(id) {
  const key = typeof id === 'string' ? id.trim().toUpperCase() : '';
  return TEMPORADAS[key] ? key : TEMPORADA_POR_DEFECTO;
}

function cargar() {
  try {
    return normalizarTemporada(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Sin almacenamiento se juega la temporada por defecto.
    return TEMPORADA_POR_DEFECTO;
  }
}

let preferida = cargar();
let deSala = null;
const listeners = new Set();

function aplicar() {
  const activa = getTemporada();
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.temporada = activa.toLowerCase();
  }
  listeners.forEach((callback) => callback(activa));
}

/** La temporada que se ve ahora: la de la sala si hay una, si no la preferida. */
export function getTemporada() {
  return deSala ?? preferida;
}

export function getTemporadaInfo() {
  return TEMPORADAS[getTemporada()];
}

export function getTemporadaPreferida() {
  return preferida;
}

export function setTemporadaPreferida(id) {
  preferida = normalizarTemporada(id);
  try {
    localStorage.setItem(STORAGE_KEY, preferida);
  } catch {
    // Sin almacenamiento la eleccion dura esta sesion.
  }
  aplicar();
}

/** La sala dice su temporada (null al salir de la sala). */
export function setTemporadaDeSala(id) {
  const siguiente = id ? normalizarTemporada(id) : null;
  if (siguiente === deSala) return;
  deSala = siguiente;
  aplicar();
}

export function onTemporadaChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

aplicar();
