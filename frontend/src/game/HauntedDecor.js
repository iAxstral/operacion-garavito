import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS } from './mapLayout';

// Ambiente de Halloween dentro del edificio y efectos de golpe. Todo es solo visual:
// nada de esto tiene cuerpo fisico ni lo conoce el servidor.

export const PUMPKIN_KEY = 'hw_pumpkin';
export const WEB_KEY = 'hw_web';
export const DOT_KEY = 'hw_dot';
export const SHELL_KEY = 'hw_shell';
export const FLASH_KEY = 'hw_flash';
export const GIB_KEY = 'hw_gib';
export const SHADOW_KEY = 'hw_shadow';
export const LOCKER_KEY = 'hw_locker';
const BLOOD_KEYS = ['hw_blood_0', 'hw_blood_1', 'hw_blood_2', 'hw_blood_3'];

// Las manchas del piso se quedan, pero con tope: las mas viejas se desvanecen.
const MAX_DECALS = 90;
const LOW_PERF_DECALS = 30;
const DEPTH_DECAL = 1.5;
const DEPTH_DUST = 4995;

const WALLISH = new Set(['wall', 'glass']);

// Aleatorio con semilla: todos los jugadores ven las mismas calabazas y telaranas.
function seeded(seedText) {
  let seed = 0;
  for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
  seed = seed || 1;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

function canvasTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, w, h);
  draw(texture.context, w, h);
  texture.refresh();
}

export function bakeHauntedTextures(scene) {
  // Calabaza tallada con la cara encendida.
  canvasTexture(scene, PUMPKIN_KEY, 34, 32, (ctx) => {
    ctx.fillStyle = '#3b5a1c';
    ctx.fillRect(15, 1, 4, 7);
    const body = ctx.createRadialGradient(17, 18, 3, 17, 19, 16);
    body.addColorStop(0, '#ff9a2e');
    body.addColorStop(0.7, '#d9620f');
    body.addColorStop(1, '#7a2f05');
    ctx.fillStyle = body;
    [[9, 19, 8], [25, 19, 8], [17, 19, 10]].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.ellipse(x, y, r, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = 'rgba(90, 30, 0, 0.6)';
    ctx.lineWidth = 1;
    [12, 22].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, 9);
      ctx.quadraticCurveTo(x + (x < 17 ? -3 : 3), 19, x, 29);
      ctx.stroke();
    });
    ctx.fillStyle = '#ffe36a';
    ctx.beginPath();
    ctx.moveTo(9, 15); ctx.lineTo(14, 15); ctx.lineTo(11.5, 11); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20, 15); ctx.lineTo(25, 15); ctx.lineTo(22.5, 11); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, 21); ctx.lineTo(26, 21); ctx.lineTo(23, 26); ctx.lineTo(20, 24);
    ctx.lineTo(17, 27); ctx.lineTo(14, 24); ctx.lineTo(11, 26); ctx.closePath(); ctx.fill();
  });

  // Telarana de esquina (se ancla arriba a la izquierda; se voltea para la otra esquina).
  canvasTexture(scene, WEB_KEY, 72, 72, (ctx) => {
    ctx.strokeStyle = 'rgba(225, 225, 235, 0.75)';
    ctx.lineWidth = 1;
    const spokes = 6;
    for (let i = 0; i <= spokes; i += 1) {
      const a = (i / spokes) * (Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 72, Math.sin(a) * 72);
      ctx.stroke();
    }
    [14, 26, 39, 53, 67].forEach((r) => {
      ctx.beginPath();
      for (let i = 0; i <= spokes; i += 1) {
        const a = (i / spokes) * (Math.PI / 2);
        const sag = i === 0 || i === spokes ? 0 : r * 0.08;
        const x = Math.cos(a) * (r - sag);
        const y = Math.sin(a) * (r - sag);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  });

  canvasTexture(scene, DOT_KEY, 8, 8, (ctx) => {
    const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 8);
  });

  canvasTexture(scene, SHELL_KEY, 6, 3, (ctx) => {
    ctx.fillStyle = '#d9a53a';
    ctx.fillRect(0, 0, 6, 3);
    ctx.fillStyle = '#8a5e14';
    ctx.fillRect(4, 0, 2, 3);
  });

  // Fogonazo: estrella de cuatro puntas.
  canvasTexture(scene, FLASH_KEY, 40, 40, (ctx) => {
    const g = ctx.createRadialGradient(20, 20, 0, 20, 20, 20);
    g.addColorStop(0, 'rgba(255,255,230,1)');
    g.addColorStop(0.35, 'rgba(255,210,90,0.9)');
    g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? 20 : 7;
      ctx.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });

  canvasTexture(scene, GIB_KEY, 6, 6, (ctx) => {
    ctx.fillStyle = '#6e0b0b';
    ctx.beginPath();
    ctx.arc(3, 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b3201a';
    ctx.fillRect(2, 1, 2, 2);
  });

  // Armario metalico con rejillas y manija (escondite).
  canvasTexture(scene, LOCKER_KEY, 40, 74, (ctx) => {
    const body = ctx.createLinearGradient(0, 0, 40, 0);
    body.addColorStop(0, '#3c4248');
    body.addColorStop(0.5, '#5c646c');
    body.addColorStop(1, '#2c3136');
    ctx.fillStyle = body;
    ctx.fillRect(2, 2, 36, 70);
    ctx.strokeStyle = '#15181b';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 36, 70);
    ctx.fillStyle = '#1b1f23';
    for (let y = 10; y < 26; y += 4) ctx.fillRect(9, y, 22, 2);
    for (let y = 52; y < 64; y += 4) ctx.fillRect(9, y, 22, 2);
    ctx.fillStyle = '#b8a76a';
    ctx.fillRect(30, 34, 3, 9);
    ctx.fillStyle = 'rgba(120, 20, 15, 0.7)';
    ctx.fillRect(6, 40, 6, 3);
    ctx.fillRect(9, 43, 3, 6);
  });

  canvasTexture(scene, SHADOW_KEY, 32, 12, (ctx) => {
    // Circulo de 32x32 aplastado a 32x12 con la escala: el degradado se define antes.
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.scale(1, 12 / 32);
    ctx.fillRect(0, 0, 32, 32);
    ctx.restore();
  });

  // Manchas de sangre: gota central con salpicaduras alrededor, cada una distinta.
  BLOOD_KEYS.forEach((key, index) => {
    canvasTexture(scene, key, 56, 56, (ctx) => {
      const rand = seeded(key);
      ctx.fillStyle = index % 2 ? '#5c0707' : '#6d0a0a';
      ctx.beginPath();
      ctx.ellipse(28, 28, 11 + rand() * 6, 9 + rand() * 5, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 9; i += 1) {
        const a = rand() * Math.PI * 2;
        const d = 10 + rand() * 16;
        const r = 1.5 + rand() * 4;
        ctx.beginPath();
        ctx.arc(28 + Math.cos(a) * d, 28 + Math.sin(a) * d, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(150, 20, 15, 0.55)';
      ctx.beginPath();
      ctx.ellipse(26, 26, 5, 3.5, 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

/**
 * Calabazas junto a las paredes y telaranas en las esquinas de los salones. Se elige
 * con una semilla por edificio y piso para que todos vean lo mismo.
 */
export function decorateFloor(scene, grid, lighting, { building, floor }) {
  const rand = seeded(`${building}-${floor}`);
  const cell = (x, y) => grid[y]?.[x] ?? null;
  const isWall = (x, y) => WALLISH.has(cell(x, y)?.type);
  const isFloor = (x, y) => cell(x, y)?.type === 'floor';
  const nearStairs = (x, y) => [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => {
    const type = cell(x + dx, y + dy)?.type;
    return type === 'stair' || type === 'landing';
  }));

  const webs = [];
  const pumpkinSpots = [];
  for (let y = 1; y < MAP_ROWS - 1; y += 1) {
    for (let x = 1; x < MAP_COLS - 1; x += 1) {
      if (!isFloor(x, y)) continue;
      if (isWall(x, y - 1) && isWall(x - 1, y)) webs.push({ x, y, flip: false });
      else if (isWall(x, y - 1) && isWall(x + 1, y)) webs.push({ x, y, flip: true });
      else if (isWall(x, y - 1) && isFloor(x, y + 1) && !nearStairs(x, y)) pumpkinSpots.push({ x, y });
    }
  }

  webs.filter(() => rand() < 0.6).slice(0, 18).forEach(({ x, y, flip }) => {
    const left = x * TILE + (flip ? TILE : 0);
    const size = 0.75 + rand() * 0.5;
    scene.add.image(left, y * TILE, WEB_KEY)
      .setOrigin(0, 0)
      .setFlipX(flip)
      .setScale(size)
      .setAlpha(0.55 + rand() * 0.3)
      .setDepth(4);
  });

  // Calabazas separadas entre si (no dos en el mismo pasillo).
  const placed = [];
  pumpkinSpots
    .map((spot) => ({ ...spot, order: rand() }))
    .sort((a, b) => a.order - b.order)
    .forEach((spot) => {
      if (placed.length >= 7) return;
      if (placed.some((p) => Math.abs(p.x - spot.x) + Math.abs(p.y - spot.y) < 7)) return;
      placed.push(spot);
    });

  placed.forEach(({ x, y }) => {
    const px = x * TILE + TILE / 2 + (rand() - 0.5) * 20;
    const py = y * TILE + 22;
    scene.add.image(px, py, SHADOW_KEY).setDepth(1.6).setAlpha(0.7);
    scene.add.image(px, py - 8, PUMPKIN_KEY).setDepth(py).setScale(1.15);
    const glow = scene.add.image(px, py - 8, 'light_glow')
      .setTint(0xff7a1a)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(120, 120)
      .setAlpha(0.45)
      .setDepth(5001);
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.3, to: 0.55 },
      duration: 140 + rand() * 120,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    lighting.addLight({ x: px, y: py - 8, radius: 110, mode: 'flicker', bulb: false });
  });
}

/** Motas de polvo que flotan alrededor del jugador; solo se ven donde hay luz. */
export function startDust(scene, target) {
  const emitter = scene.add.particles(0, 0, DOT_KEY, {
    emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-520, -340, 1040, 680) },
    lifespan: { min: 4000, max: 7000 },
    speedX: { min: -8, max: 8 },
    speedY: { min: -10, max: 4 },
    scale: { min: 0.25, max: 0.7 },
    alpha: { start: 0.55, end: 0 },
    tint: 0xffe2b0,
    blendMode: Phaser.BlendModes.ADD,
    frequency: 90,
    quantity: 1,
  });
  emitter.setDepth(DEPTH_DUST);
  emitter.startFollow(target);
  return emitter;
}

/**
 * Efectos de golpe: sangre que queda en el piso, tripas al morir, numeros de dano y
 * casquillos. Una instancia por escena.
 */
export class GoreFx {
  constructor(scene, { lowPerf = false } = {}) {
    this.scene = scene;
    this.decals = [];
    this.maxDecals = lowPerf ? LOW_PERF_DECALS : MAX_DECALS;
    this.gibs = lowPerf ? 6 : 14;
  }

  blood(x, y, { big = false } = {}) {
    const key = BLOOD_KEYS[Math.floor(Math.random() * BLOOD_KEYS.length)];
    const decal = this.scene.add.image(x + (Math.random() - 0.5) * 10, y + 10, key)
      .setDepth(DEPTH_DECAL)
      .setRotation(Math.random() * Math.PI * 2)
      .setScale(0.2)
      .setAlpha(0.9);
    this.scene.tweens.add({ targets: decal, scale: (big ? 1.1 : 0.55) * (0.85 + Math.random() * 0.3), duration: 140, ease: 'Quad.easeOut' });
    this.decals.push(decal);
    if (this.decals.length > this.maxDecals) {
      const old = this.decals.shift();
      this.scene.tweens.add({ targets: old, alpha: 0, duration: 800, onComplete: () => old.destroy() });
    }
  }

  // Salpicadura al recibir un golpe: gotitas en la direccion contraria al atacante.
  splatter(x, y, fromX, fromY, count = 6) {
    const away = Math.atan2(y - fromY, x - fromX);
    for (let i = 0; i < count; i += 1) {
      const a = away + (Math.random() - 0.5) * 1.2;
      const d = 14 + Math.random() * 30;
      const drop = this.scene.add.image(x, y - 10, GIB_KEY)
        .setScale(0.5 + Math.random() * 0.6)
        .setDepth(y + 2);
      this.scene.tweens.add({
        targets: drop,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d * 0.6 + 6,
        alpha: 0,
        duration: 260 + Math.random() * 160,
        ease: 'Quad.easeOut',
        onComplete: () => drop.destroy(),
      });
    }
  }

  // Muerte: estallido de pedazos que caen y una mancha grande.
  burst(x, y, tint = 0x6e0b0b) {
    this.blood(x, y, { big: true });
    for (let i = 0; i < this.gibs; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const d = 18 + Math.random() * 42;
      const gib = this.scene.add.image(x, y - 12, GIB_KEY)
        .setScale(0.7 + Math.random() * 0.9)
        .setDepth(y + 3);
      if (i % 3 === 0) gib.setTint(tint);
      this.scene.tweens.add({
        targets: gib,
        x: x + Math.cos(a) * d,
        y: { value: y + Math.sin(a) * d * 0.5 + 8, ease: 'Bounce.easeOut' },
        angle: Math.random() * 360,
        duration: 420 + Math.random() * 200,
        onComplete: () => this.scene.tweens.add({
          targets: gib, alpha: 0, delay: 600, duration: 500, onComplete: () => gib.destroy(),
        }),
      });
    }
    const puff = this.scene.add.image(x, y - 10, DOT_KEY)
      .setTint(0x8a1010)
      .setDisplaySize(30, 30)
      .setAlpha(0.7)
      .setDepth(y + 4);
    this.scene.tweens.add({ targets: puff, displayWidth: 90, displayHeight: 70, alpha: 0, duration: 380, onComplete: () => puff.destroy() });
  }

  damageNumber(x, y, amount, { crit = false } = {}) {
    const label = this.scene.add
      .text(x + (Math.random() - 0.5) * 16, y, `${amount}`, {
        fontFamily: '"Creepster", Impact, sans-serif',
        fontSize: crit ? '26px' : '20px',
        color: crit ? '#ffd23a' : '#ffffff',
        stroke: '#3a0000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(6000)
      .setScale(0.4);
    this.scene.tweens.add({ targets: label, scale: 1, duration: 110, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: label,
      y: y - 38,
      alpha: 0,
      delay: 120,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  // Casquillo que sale hacia un lado del arma, rebota y queda un rato en el piso.
  shell(x, y, angle) {
    const side = angle + Math.PI / 2 * (Math.random() < 0.85 ? 1 : -1);
    const d = 18 + Math.random() * 14;
    const shell = this.scene.add.image(x, y, SHELL_KEY).setDepth(y + 1).setRotation(Math.random() * 6);
    this.scene.tweens.add({
      targets: shell,
      x: x + Math.cos(side) * d,
      y: { value: y + Math.sin(side) * d * 0.5 + 14, ease: 'Bounce.easeOut' },
      rotation: shell.rotation + 8,
      duration: 380,
      onComplete: () => {
        shell.setDepth(DEPTH_DECAL + 0.1);
        this.scene.tweens.add({ targets: shell, alpha: 0, delay: 2500, duration: 600, onComplete: () => shell.destroy() });
      },
    });
  }

  destroy() {
    this.decals.forEach((decal) => decal.destroy());
    this.decals = [];
  }
}
