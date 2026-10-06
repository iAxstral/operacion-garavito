// Dibujo de cada disfraz en un canvas de 64x64. Lo usan Phaser (textura sobre el
// personaje) y la tienda (vista previa). `anchor` dice donde va sobre el personaje:
// 'head' centrado en la cabeza, 'body' cubriendo todo el cuerpo.

export const COSTUME_SIZE = 64;
// Altura (px desde arriba del sprite del personaje) del centro de la cabeza y del cuello.
export const HEAD_Y = 24;
export const NECK_Y = 50;

export const COSTUME_LAYOUT = {
  CALABAZA: { anchor: 'head', scale: 0.85, dy: 0 },
  BRUJA: { anchor: 'head', scale: 0.9, dy: -18 },
  DIABLO: { anchor: 'head', scale: 0.7, dy: -10 },
  VAMPIRO: { anchor: 'neck', scale: 1.2, dy: 10 },
  CALAVERA: { anchor: 'head', scale: 0.6, dy: 2 },
  FANTASMA: { anchor: 'body', scale: 1.75, dy: -8 },
};

function pumpkin(ctx) {
  ctx.fillStyle = '#3b5a1c';
  ctx.fillRect(29, 6, 6, 9);
  const g = ctx.createRadialGradient(32, 36, 4, 32, 38, 28);
  g.addColorStop(0, '#ff9a2e');
  g.addColorStop(1, '#a8460a');
  ctx.fillStyle = g;
  [[20, 38, 14], [44, 38, 14], [32, 38, 17]].forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.ellipse(x, y, r, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#ffe36a';
  ctx.beginPath();
  ctx.moveTo(18, 32); ctx.lineTo(28, 32); ctx.lineTo(23, 24); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(36, 32); ctx.lineTo(46, 32); ctx.lineTo(41, 24); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16, 42); ctx.lineTo(48, 42); ctx.lineTo(43, 52); ctx.lineTo(37, 47);
  ctx.lineTo(32, 53); ctx.lineTo(27, 47); ctx.lineTo(21, 52); ctx.closePath(); ctx.fill();
}

function witchHat(ctx) {
  ctx.fillStyle = '#1d1426';
  ctx.beginPath();
  ctx.ellipse(32, 50, 30, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16, 50); ctx.lineTo(48, 50); ctx.lineTo(40, 22); ctx.lineTo(52, 6); ctx.lineTo(30, 18); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a3fa0';
  ctx.fillRect(18, 42, 28, 5);
  ctx.fillStyle = '#e8b64a';
  ctx.fillRect(29, 41, 7, 7);
  ctx.fillStyle = '#1d1426';
  ctx.fillRect(31, 43, 3, 3);
}

function horns(ctx) {
  ctx.fillStyle = '#c41c12';
  ctx.strokeStyle = '#4a0505';
  ctx.lineWidth = 2;
  [[14, 1], [50, -1]].forEach(([x, dir]) => {
    ctx.beginPath();
    ctx.moveTo(x - 7 * dir, 50);
    ctx.quadraticCurveTo(x - 10 * dir, 26, x + 6 * dir, 10);
    ctx.quadraticCurveTo(x + 2 * dir, 30, x + 8 * dir, 50);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

function cape(ctx) {
  ctx.fillStyle = '#0f0a10';
  ctx.beginPath();
  ctx.moveTo(6, 6); ctx.lineTo(58, 6); ctx.lineTo(62, 62); ctx.lineTo(2, 62); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9a0f12';
  ctx.beginPath();
  ctx.moveTo(14, 10); ctx.lineTo(50, 10); ctx.lineTo(54, 60); ctx.lineTo(10, 60); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0f0a10';
  ctx.beginPath();
  ctx.moveTo(4, 2); ctx.lineTo(20, 16); ctx.lineTo(32, 8); ctx.lineTo(44, 16); ctx.lineTo(60, 2); ctx.lineTo(32, 0); ctx.closePath();
  ctx.fill();
}

function skull(ctx) {
  ctx.fillStyle = '#ece4d2';
  ctx.beginPath();
  ctx.ellipse(32, 28, 22, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(18, 40, 28, 16);
  ctx.fillStyle = '#120a0c';
  [[23, 28], [41, 28]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.ellipse(x, y, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.moveTo(32, 34); ctx.lineTo(28, 42); ctx.lineTo(36, 42); ctx.closePath();
  ctx.fill();
  for (let x = 21; x < 44; x += 5) ctx.fillRect(x, 47, 2, 8);
}

function sheet(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(240,244,255,0.92)');
  g.addColorStop(1, 'rgba(210,218,255,0.55)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(10, 60);
  ctx.lineTo(10, 24);
  ctx.quadraticCurveTo(10, 2, 32, 2);
  ctx.quadraticCurveTo(54, 2, 54, 24);
  ctx.lineTo(54, 60);
  for (let x = 54; x > 10; x -= 11) {
    ctx.quadraticCurveTo(x - 3, 54, x - 5.5, 60);
    ctx.quadraticCurveTo(x - 8, 64, x - 11, 60);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#120a14';
  [[24, 22], [40, 22]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

const DRAW = { CALABAZA: pumpkin, BRUJA: witchHat, DIABLO: horns, VAMPIRO: cape, CALAVERA: skull, FANTASMA: sheet };

/** Dibuja el disfraz `id` en un contexto 2D de COSTUME_SIZE x COSTUME_SIZE. */
export function drawCostume(ctx, id) {
  ctx.clearRect(0, 0, COSTUME_SIZE, COSTUME_SIZE);
  DRAW[id]?.(ctx);
}

export function costumeKey(id) {
  return `costume_${id}`;
}

/** Crea en Phaser las texturas de todos los disfraces (una vez). */
export function bakeCostumes(scene) {
  Object.keys(DRAW).forEach((id) => {
    const key = costumeKey(id);
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, COSTUME_SIZE, COSTUME_SIZE);
    drawCostume(texture.context, id);
    texture.refresh();
  });
}
