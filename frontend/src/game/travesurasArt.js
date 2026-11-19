// Pixel art de las travesuras de Navidad: el duende que tira bolas de nieve y el reno
// zombi que escupe barro con carbon. Cada dibujo es un mapa de caracteres (un caracter
// = un pixel) con su paleta; se hornea en una textura y se escala sin suavizar.

export const PALETTE = {
  k: '#12090a', // contorno
  r: '#a3121c', // gorro rojo
  R: '#5e0a10', // rojo en sombra
  w: '#e6e0d2', // piel del gorro / nieve
  W: '#b8b2a6', // blanco en sombra
  s: '#aeb98f', // piel enfermiza
  S: '#7d8a62', // piel en sombra
  e: '#ff2d2d', // ojos
  m: '#3a0006', // boca
  t: '#f2efe6', // dientes
  g: '#1d6b36', // traje verde
  G: '#0e3d1f', // verde en sombra
  y: '#e2b12a', // cascabel y hebilla
  b: '#3a2414', // cinturon y botas
  c: '#6b4426', // pelo del reno
  C: '#3f2715', // pelo en sombra
  a: '#d8c7a0', // cuernos
  A: '#9c8a66', // cuernos en sombra
  n: '#ff3b2f', // nariz
  o: '#c8d9b4', // hueso a la vista
  d: '#6a1010', // sangre seca
};

// Duende, 16 x 22. Mira hacia la camara con la bola de nieve en la mano derecha.
export const DUENDE = [
  '..........kwwk..',
  '.........krkwwk.',
  '........krrRkk..',
  '.......krrrRk...',
  '......krrrrRk...',
  '.....krrrrrrRk..',
  '....kwwwwwwwwwk.',
  'kk..ksssssssssk.',
  'ksk.ksesssssesk.',
  '.ksksssssssssks.',
  '..kksmtmtmtmsk..',
  '....kssmmmmssk..',
  '....kkgggggkk...',
  '...kgggyggggGk..',
  '..kgggggggggGkww',
  '.ksskbbbybbbkkww',
  '.kssggggggggGk..',
  '...kgggggggGGk..',
  '...kGgk...kgGk..',
  '...kbbk...kbbk..',
  '..kbbbk...kbbbk.',
  '..kkkk.....kkkk.',
];

// Reno zombi, 26 x 22, de perfil mirando a la izquierda: cuernos rotos, nariz roja que
// brilla, costillas a la vista.
export const RENO = [
  '...ka.ka..................',
  '...kakak.ka...............',
  '....kaakak................',
  '.....kAaak................',
  '......kAk.kk..............',
  '...kkkkcckk...............',
  '..knccecCck...............',
  '.knnccccCck...............',
  '..kkmtmcCck...............',
  '...kmmkcCckkkkkkkkkkkk....',
  '....kkcCcccccccccccCCckk..',
  '......kcccoooococcccCCCck.',
  '......kcccokokokcccccCCCk.',
  '......kccccooocccdcccCCk..',
  '.......kcccccccccdccCCk...',
  '.......kcCCcccccccCCCck...',
  '.......kcCk.kck.kcCkkCk...',
  '.......kcCk.kck.kcCk.kk...',
  '.......kcCk.kck.kcCk......',
  '.......kbbk.kbk.kbbk......',
  '......kbbbk.kbbkkbbbk.....',
  '......kkkk..kkkk.kkkk.....',
];

// Bola de nieve 7 x 7 y bola de barro con carbon 8 x 8.
export const BOLA_NIEVE = [
  '..kkk..',
  '.kwwwk.',
  'kwwwwWk',
  'kwwwwWk',
  'kwwwWWk',
  '.kWWWk.',
  '..kkk..',
];

export const BOLA_BARRO = [
  '..kkkk..',
  '.kccCCk.',
  'kcckcCCk',
  'kcCCCkCk',
  'kCkcCCCk',
  'kCCCkCCk',
  '.kCCCCk.',
  '..kkkk..',
];

/** Hornea un mapa en una textura de Phaser (si no existe ya). */
export function bakePixelArt(scene, key, rows, palette = PALETTE) {
  if (scene.textures.exists(key)) return;
  const height = rows.length;
  const width = rows[0].length;
  const texture = scene.textures.createCanvas(key, width, height);
  const ctx = texture.context;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  texture.refresh();
  texture.setFilter(1); // Phaser.Textures.FilterMode.NEAREST: pixeles nitidos al escalar
}
