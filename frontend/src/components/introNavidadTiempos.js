// Linea de tiempo y elementos de la intro de Navidad (IntroNavidad.jsx). Aparte del
// componente para que la usen tambien el sonido y la grabacion del video.

// Tiempos (segundos). La usan el CSS (variables --at) y el sonido: asi nunca
// se desincronizan.
export const T = Object.freeze({
  campus: 2.8,
  luces: 3.4,
  apagon: 7.0,
  ojos: 7.6,
  zombis: 8.2,
  linterna: 10.6,
  titulo: 13.4,
  fin: 17.2,
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

// "Jingle Bells" en La menor (1857, dominio publico): [segundo dentro de la frase, Hz].
const MELODY = [
  [0, 523.25], [0.3, 523.25], [0.6, 523.25],
  [1.2, 523.25], [1.5, 523.25], [1.8, 523.25],
  [2.4, 523.25], [2.7, 659.25], [3.0, 440], [3.3, 493.88], [3.6, 523.25],
];

export const CUES = [
  [0.2, 'wind', T.fin - 0.4],
  ...[0.4, 0.9, 1.4, 1.9, 2.4].map((at) => [at, 'tick']),
  ...MELODY.map(([at, freq]) => [T.campus + 0.4 + at, 'box', freq]),
  [T.luces + 0.9, 'bells'],
  [T.luces + 2.2, 'bells'],
  [T.apagon, 'spark'],
  [T.ojos + 0.6, 'groan'],
  [T.zombis + 1.6, 'bells'],
  [T.linterna - 0.4, 'roar'],
  [T.titulo, 'thunder'],
  [T.titulo + 0.08, 'thud'],
];

