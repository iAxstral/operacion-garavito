// Dibujo de cada disfraz en un canvas de 64x64. Lo usan Phaser (textura sobre el
// personaje) y la tienda (vista previa). `anchor` dice donde va sobre el personaje:
// 'head' centrado en la cabeza, 'neck' a la altura del cuello.

export const COSTUME_SIZE = 64;
// Altura (px desde arriba del sprite del personaje) del centro de la cabeza y del cuello.
export const HEAD_Y = 24;
export const NECK_Y = 50;

export const COSTUME_LAYOUT = {
  GORRO_NAVIDAD: { anchor: 'head', scale: 0.85, dy: -16 },
  CORNAMENTA: { anchor: 'head', scale: 0.95, dy: -16 },
  KRAMPUS: { anchor: 'head', scale: 0.7, dy: 0 },
  GORRO_DUENDE: { anchor: 'head', scale: 0.85, dy: -16 },
  BUFANDA: { anchor: 'neck', scale: 0.8, dy: -4 },
  CORONA_ACEBO: { anchor: 'head', scale: 0.8, dy: -14 },
  MUNECO_NIEVE: { anchor: 'head', scale: 0.85, dy: -2 },
  CASCANUECES: { anchor: 'head', scale: 0.8, dy: -22 },
  ESTRELLA: { anchor: 'head', scale: 0.6, dy: -34 },
  GUIRNALDA: { anchor: 'neck', scale: 0.85, dy: -2 },
  ESFERA_ROTA: { anchor: 'head', scale: 0.85, dy: 0 },
  // No se vende: quien no lleva disfraz se pone este gorrito de lana.
  GORRITO: { anchor: 'head', scale: 0.62, dy: -21 },
};

/** Lo que lleva puesto quien no eligio disfraz. */
export const DEFAULT_COSTUME = 'GORRITO';

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

// Gorro de duende: verde, largo y doblado, con cascabel y borde de piel.
function elfHat(ctx) {
  ctx.fillStyle = '#1d6b36';
  ctx.beginPath();
  ctx.moveTo(10, 48);
  ctx.quadraticCurveTo(20, 4, 50, 6);
  ctx.quadraticCurveTo(40, 18, 54, 48);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0e3d1f';
  ctx.beginPath();
  ctx.moveTo(36, 12); ctx.quadraticCurveTo(42, 28, 52, 46); ctx.lineTo(44, 46); ctx.quadraticCurveTo(38, 26, 36, 12);
  ctx.fill();
  ctx.fillStyle = '#e8e2d4';
  ctx.fillRect(6, 44, 52, 11);
  ctx.fillStyle = '#c9c1af';
  [10, 22, 34, 46].forEach((x) => ctx.fillRect(x, 50, 6, 3));
  ctx.fillStyle = '#e2b12a';
  ctx.beginPath();
  ctx.arc(52, 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a5a10';
  ctx.fillRect(50, 9, 4, 2);
}

// Bufanda a rayas rojas y blancas, con una punta colgando.
function scarf(ctx) {
  ctx.fillStyle = '#a3121c';
  ctx.beginPath();
  ctx.ellipse(32, 30, 26, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(38, 30, 12, 30);
  ctx.fillStyle = '#e8e2d4';
  [12, 24, 36, 48].forEach((x) => ctx.fillRect(x, 21, 5, 18));
  [36, 48].forEach((y) => ctx.fillRect(38, y, 12, 5));
  ctx.fillStyle = '#e8e2d4';
  [39, 43, 47].forEach((x) => ctx.fillRect(x, 58, 2, 6));
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(8, 34, 48, 4);
}

// Corona de acebo: hojas verdes con bayas rojas alrededor de la cabeza.
function hollyCrown(ctx) {
  ctx.fillStyle = '#5a3518';
  ctx.fillRect(6, 40, 52, 6);
  for (let i = 0; i < 6; i += 1) {
    const x = 8 + i * 9.5;
    ctx.fillStyle = i % 2 ? '#1d6b36' : '#2f9a45';
    ctx.beginPath();
    ctx.ellipse(x, 38, 7, 4, i % 2 ? 0.6 : -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#d4141e';
  [[18, 34], [22, 37], [40, 34], [44, 37], [31, 32]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Cabeza de muneco de nieve derritiendose: carbones por ojos, zanahoria y sombrero.
function snowmanHead(ctx) {
  ctx.fillStyle = '#eef2f7';
  ctx.beginPath();
  ctx.arc(32, 38, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c8d2de';
  ctx.beginPath();
  ctx.arc(36, 42, 18, 0.2, Math.PI * 0.9);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(24, 34, 3, 0, Math.PI * 2);
  ctx.arc(40, 34, 3, 0, Math.PI * 2);
  ctx.fill();
  [22, 28, 34, 40].forEach((x, i) => ctx.fillRect(x, 48 + (i === 1 || i === 2 ? 2 : 0), 3, 3));
  ctx.fillStyle = '#ff7a1a';
  ctx.beginPath();
  ctx.moveTo(30, 38); ctx.lineTo(48, 42); ctx.lineTo(30, 43); ctx.closePath();
  ctx.fill();
  // Gotas que se derriten.
  ctx.fillStyle = '#dce4ee';
  ctx.fillRect(14, 50, 3, 9);
  ctx.fillRect(46, 52, 3, 7);
  ctx.fillStyle = '#16120f';
  ctx.fillRect(14, 12, 36, 6);
  ctx.fillRect(20, 0, 24, 14);
  ctx.fillStyle = '#a3121c';
  ctx.fillRect(20, 9, 24, 3);
}

// Gorro de cascanueces: alto, rojo, con banda dorada y penacho blanco.
function nutcracker(ctx) {
  ctx.fillStyle = '#a3121c';
  ctx.fillRect(14, 10, 36, 44);
  ctx.fillStyle = '#6b0a10';
  ctx.fillRect(42, 10, 8, 44);
  ctx.fillStyle = '#e2b12a';
  ctx.fillRect(12, 46, 40, 8);
  ctx.fillRect(12, 10, 40, 4);
  ctx.beginPath();
  ctx.moveTo(32, 18); ctx.lineTo(36, 26); ctx.lineTo(32, 34); ctx.lineTo(28, 26); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#16120f';
  ctx.fillRect(10, 54, 44, 4);
  ctx.fillStyle = '#f2efe6';
  ctx.beginPath();
  ctx.ellipse(32, 6, 6, 9, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Estrella de la punta del arbol flotando sobre la cabeza, con brillo.
function treeStar(ctx) {
  const glow = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  glow.addColorStop(0, 'rgba(255, 230, 120, 0.8)');
  glow.addColorStop(1, 'rgba(255, 230, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 ? 9 : 22;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff6c8';
  ctx.beginPath();
  ctx.arc(29, 28, 4, 0, Math.PI * 2);
  ctx.fill();
}

// Guirnalda de luces de colores enredada en el cuello.
function lightsGarland(ctx) {
  ctx.strokeStyle = '#1a3a1e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(32, 30, 26, 10, 0, 0, Math.PI * 2);
  ctx.stroke();
  const colors = ['#ff3b3b', '#3bff6a', '#ffd23a', '#3ba8ff'];
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.ellipse(32 + Math.cos(a) * 26, 30 + Math.sin(a) * 10 + 4, 3.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Esfera navidena rota puesta como casco: adentro asoman dos ojos.
function brokenOrnament(ctx) {
  const ball = ctx.createRadialGradient(24, 26, 4, 32, 36, 26);
  ball.addColorStop(0, '#ff6b6b');
  ball.addColorStop(0.5, '#a3121c');
  ball.addColorStop(1, '#3a0408');
  ctx.fillStyle = ball;
  ctx.beginPath();
  ctx.arc(32, 36, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e2b12a';
  ctx.fillRect(25, 6, 14, 8);
  ctx.strokeStyle = '#e2b12a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(32, 5, 4, Math.PI, 0);
  ctx.stroke();
  // El hueco roto y los ojos de adentro.
  ctx.fillStyle = '#0b0204';
  ctx.beginPath();
  ctx.moveTo(18, 34); ctx.lineTo(26, 28); ctx.lineTo(32, 33); ctx.lineTo(40, 27); ctx.lineTo(46, 36);
  ctx.lineTo(40, 46); ctx.lineTo(30, 44); ctx.lineTo(22, 47); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff2d2d';
  ctx.fillRect(25, 36, 4, 3);
  ctx.fillRect(36, 36, 4, 3);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(22, 22, 4, 7, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

// Gorrito de lana a rayas con pompon (el de todos en Navidad).
function beanie(ctx) {
  ctx.fillStyle = '#a3121c';
  ctx.beginPath();
  ctx.moveTo(10, 50);
  ctx.quadraticCurveTo(10, 14, 32, 14);
  ctx.quadraticCurveTo(54, 14, 54, 50);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1d6b36';
  ctx.fillRect(10, 30, 44, 6);
  ctx.fillStyle = '#e8e2d4';
  ctx.fillRect(12, 24, 40, 3);
  ctx.fillRect(8, 44, 48, 10);
  ctx.fillStyle = '#c9c1af';
  [12, 22, 32, 42, 50].forEach((x) => ctx.fillRect(x, 46, 3, 8));
  ctx.fillStyle = '#f2efe6';
  ctx.beginPath();
  ctx.arc(32, 12, 8, 0, Math.PI * 2);
  ctx.fill();
}

const DRAW = {
  GORRO_NAVIDAD: santaHat,
  CORNAMENTA: antlers,
  KRAMPUS: krampus,
  GORRO_DUENDE: elfHat,
  BUFANDA: scarf,
  CORONA_ACEBO: hollyCrown,
  MUNECO_NIEVE: snowmanHead,
  CASCANUECES: nutcracker,
  ESTRELLA: treeStar,
  GUIRNALDA: lightsGarland,
  ESFERA_ROTA: brokenOrnament,
  GORRITO: beanie,
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
