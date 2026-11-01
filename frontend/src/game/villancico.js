// "We Wish You a Merry Christmas" (villancico tradicional ingles, dominio publico),
// pasado a La menor armonica para que suene a pesadilla: el Sol# (septima elevada) le
// da el tono siniestro. Cada nota: [tiempo de inicio en negras, frecuencia en Hz,
// duracion en negras]. Compas de 3/4 con una negra de anacrusa.

const E4 = 329.63;
const F4 = 349.23;
const GS4 = 415.3;
const A4 = 440;
const B4 = 493.88;
const C5 = 523.25;
const D5 = 587.33;

export const WE_WISH = Object.freeze([
  // "We | wish you a mer-ry | Christ-mas, we | wish you a mer-ry | Christ-mas, we |
  //  wish you a mer-ry | Christ-mas and a | hap-py new | year."
  [0, E4, 1],
  [1, A4, 1], [2, A4, 0.5], [2.5, B4, 0.5], [3, A4, 0.5], [3.5, GS4, 0.5],
  [4, F4, 1], [5, F4, 1], [6, F4, 1],
  [7, B4, 1], [8, B4, 0.5], [8.5, C5, 0.5], [9, B4, 0.5], [9.5, A4, 0.5],
  [10, GS4, 1], [11, E4, 1], [12, E4, 1],
  [13, C5, 1], [14, C5, 0.5], [14.5, D5, 0.5], [15, C5, 0.5], [15.5, B4, 0.5],
  [16, A4, 1], [17, F4, 1], [18, E4, 0.5], [18.5, E4, 0.5],
  [19, F4, 1], [20, B4, 1], [21, GS4, 1],
  [22, A4, 2],
]);

/** Duracion de la melodia completa, en negras. */
export const WE_WISH_BEATS = 24;
