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
  GORRO_NAVIDAD: { anchor: 'head', scale: 0.85, dy: -16 },
  CORNAMENTA: { anchor: 'head', scale: 0.95, dy: -16 },
  KRAMPUS: { anchor: 'head', scale: 0.7, dy: 0 },
};

// Gorro de Papa Noel caido hacia un lado, rasgado y manchado.
function santaHat(ctx) {
  ctx.fillStyle = '#a31212';
  ctx.beginPath();
  ctx.moveTo(10, 48);
  ctx.quadraticCurveTo(22, 6, 46, 10);
  ctx.lineTo(56, 22);
  ctx.quadraticCurveTo(44, 22, 52, 48);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5c0808';
  ctx.fillRect(24, 26, 6, 4);
  ctx.fillRect(38, 34, 4, 6);
  // Rasgon: se ve oscuro por dentro.
  ctx.fillStyle = '#1a0505';
  ctx.beginPath();
  ctx.moveTo(30, 36); ctx.lineTo(35, 31); ctx.lineTo(33, 40); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8e2d4';
  ctx.fillRect(6, 44, 50, 12);
  ctx.fillStyle = 'rgba(110, 20, 10, 0.75)';
  ctx.fillRect(14, 50, 8, 6);
  ctx.fillRect(40, 47, 5, 4);
  ctx.beginPath();
  ctx.fillStyle = '#f0ebe0';
  ctx.arc(55, 23, 7, 0, Math.PI * 2);
  ctx.fill();
}

// Cornamenta de reno de rama seca, con una lucecita roja apagada.
function antlers(ctx) {
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  [[1, 20], [-1, 44]].forEach(([dir, x]) => {
    ctx.beginPath();
    ctx.moveTo(x, 56);
    ctx.lineTo(x - dir * 4, 32);
    ctx.lineTo(x - dir * 14, 10);
    ctx.moveTo(x - dir * 5, 36);
    ctx.lineTo(x - dir * 16, 30);
    ctx.moveTo(x - dir * 9, 22);
    ctx.lineTo(x + dir * 2, 12);
    ctx.stroke();
  });
  ctx.fillStyle = '#3d2a14';
  ctx.fillRect(8, 54, 48, 6);
  ctx.fillStyle = '#5e0a0a';
  ctx.beginPath();
  ctx.arc(32, 52, 5, 0, Math.PI * 2);
  ctx.fill();
}

// Mascara de Krampus: cara roja oscura, cuernos de cabra y la lengua afuera.
function krampus(ctx) {
  ctx.fillStyle = '#1c1210';
  [[1, 14], [-1, 50]].forEach(([dir, x]) => {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.quadraticCurveTo(x - dir * 14, 6, x - dir * 4, -2);
    ctx.quadraticCurveTo(x - dir * 2, 10, x + dir * 8, 20);
    ctx.closePath();
    ctx.fill();
  });
  const face = ctx.createRadialGradient(32, 34, 4, 32, 36, 26);
  face.addColorStop(0, '#7a1a12');
  face.addColorStop(1, '#2a0806');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(32, 36, 22, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.moveTo(18, 30); ctx.lineTo(28, 33); ctx.lineTo(19, 35); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(46, 30); ctx.lineTo(36, 33); ctx.lineTo(45, 35); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0d0505';
  ctx.fillRect(20, 44, 24, 6);
  ctx.fillStyle = '#efe6d2';
  [21, 27, 33, 39].forEach((x) => ctx.fillRect(x, 44, 3, 3));
  ctx.fillStyle = '#c2304a';
  ctx.beginPath();
  ctx.ellipse(34, 56, 5, 8, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

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

const DRAW = {
  CALABAZA: pumpkin,
  BRUJA: witchHat,
  DIABLO: horns,
  VAMPIRO: cape,
  CALAVERA: skull,
  FANTASMA: sheet,
  GORRO_NAVIDAD: santaHat,
  CORNAMENTA: antlers,
  KRAMPUS: krampus,
};

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
