// Linea de tiempo y elementos de la intro de Navidad (IntroNavidad.jsx). Aparte del
// componente para que la usen tambien el sonido y la grabacion del video.
import { WE_WISH } from '../game/villancico';

// Tiempos (segundos). Los usan el CSS (variables --at) y el sonido: asi nunca se
// desincronizan.
export const T = Object.freeze({
  campus: 2.8,
  luces: 3.0,
  cartel: 3.4,
  entrada: 4.0,
  agarran: 5.2,
  pelea: 5.9,
  gana: 8.6,
  apagon: 10.4,
  ojos: 11.0,
  zombis: 11.6,
  linterna: 14.0,
  titulo: 16.8,
  fin: 20.6,
});

export const BULBS = 18;
export const BULB_COLORS = ['#ff3b30', '#ffd34d', '#3ddc84', '#4da3ff'];
// Pares de ojos en la oscuridad: posicion (% de pantalla), tamano y cuando se abren.
export const EYES = [
  [12, 58, 1], [27, 44, 0.8], [41, 66, 1.2], [58, 50, 0.9], [72, 62, 1.1],
  [86, 46, 0.85], [19, 74, 1.3], [64, 76, 1.25], [50, 38, 0.7], [93, 70, 1],
];
// Zombis que cruzan: retraso, duracion del cruce, escala y altura.
export const ZOMBIES = [[0, 7.5, 1, 0], [1.1, 8.5, 0.82, 4], [2.0, 7, 1.12, -2], [2.9, 9, 0.9, 6]];

// Onomatopeyas de la pelea: texto, posicion (% de la nube), giro y cuando aparecen.
export const GOLPES = [
  ['¡ZAS!', 8, 18, -12, 0.15],
  ['¡PUM!', 62, 6, 10, 0.6],
  ['¡CRAC!', 30, 58, -6, 1.1],
  ['¡AY!', 70, 52, 14, 1.5],
  ['¡PAF!', 4, 48, 8, 1.95],
  ['¡TOMA!', 46, 2, -9, 2.3],
];

// La entrada de los candidatos con "We wish you a merry Christmas, we wish you a merry
// Christmas" (dominio publico), a 0,3 s la negra: las primeras 10 negras.
const ENTRADA_NEGRA_S = 0.3;
const MELODIA_ENTRADA = WE_WISH.filter(([beat]) => beat < 10);

export const CUES = [
  [0.2, 'wind', T.fin - 0.4],
  ...[0.4, 0.9, 1.4, 1.9, 2.4].map((at) => [at, 'tick']),
  ...MELODIA_ENTRADA.map(([beat, freq]) => [T.campus + 0.3 + beat * ENTRADA_NEGRA_S, 'box', freq]),
  [T.luces + 0.6, 'bells'],
  [T.cartel + 0.35, 'thud'],
  ...GOLPES.map(([, , , , at]) => [T.pelea + at, 'punch']),
  [T.gana, 'whoosh'],
  [T.gana + 0.5, 'bells'],
  [T.gana + 0.8, 'bells'],
  [T.apagon, 'spark'],
  [T.ojos + 0.6, 'groan'],
  [T.zombis + 1.6, 'bells'],
  [T.linterna - 0.4, 'roar'],
  [T.titulo, 'thunder'],
  [T.titulo + 0.08, 'thud'],
];
