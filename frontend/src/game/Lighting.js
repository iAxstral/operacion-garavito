import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS } from './mapLayout';
import { OUTSIDE_MARGIN_TILES } from './outsideDecor';

const DARK_KEY = 'darkness_layer';
const GLOW_KEY = 'light_glow';
const FOG_KEY = 'fog_puffs';
const BULB_KEY = 'bulb_fixture';
const DARKNESS_COLOR = 'rgba(6, 12, 20, 0.58)';
const RESOLUTION = 0.5;

const PLAYER_RADIUS = 340;
const REMOTE_RADIUS = 140;

const DEPTH_FOG = 4990;
const DEPTH_DARKNESS = 5000;
const DEPTH_GLOW = 5001;
const FOG_SIZE = 256;

// Neblina leve, solo fuera del edificio: cuatro franjas alrededor del mapa, en coordenadas del mundo.
const FOG_LAYERS = [
  { speed: 0.012, alpha: 0.09, scale: 2.2 },
  { speed: -0.007, alpha: 0.06, scale: 3.4 },
];

// Penumbra con neblina y luz alrededor del jugador (estilo Among Us), mas algunos bombillos
// que parpadean. La capa de oscuridad es un canvas a media resolucion al que se le "perforan"
// circulos de luz.
export default class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.lights = [];
    this.fog = [];
    this.makeGlowTexture();
    this.makeFogTexture();
    this.makeBulbTexture();
    this.makeFog();
    this.build();
    scene.scale.on('resize', this.build, this);
  }

  makeGlowTexture() {
    if (this.scene.textures.exists(GLOW_KEY)) return;
    const texture = this.scene.textures.createCanvas(GLOW_KEY, 64, 64);
    const ctx = texture.context;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    texture.refresh();
  }

  // Nubes de niebla que encajan al repetirse: cada mancha tambien se dibuja en los bordes opuestos.
  makeFogTexture() {
    if (this.scene.textures.exists(FOG_KEY)) return;
    const texture = this.scene.textures.createCanvas(FOG_KEY, FOG_SIZE, FOG_SIZE);
    const ctx = texture.context;
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 26; i += 1) {
      const x = rand() * FOG_SIZE;
      const y = rand() * FOG_SIZE;
      const r = 40 + rand() * 60;
      for (let ox = -FOG_SIZE; ox <= FOG_SIZE; ox += FOG_SIZE) {
        for (let oy = -FOG_SIZE; oy <= FOG_SIZE; oy += FOG_SIZE) {
          const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          g.addColorStop(0, 'rgba(255,255,255,0.35)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        }
      }
    }
    texture.refresh();
  }

  // Foco colgante: casquillo oscuro con nucleo incandescente.
  makeBulbTexture() {
    if (this.scene.textures.exists(BULB_KEY)) return;
    const texture = this.scene.textures.createCanvas(BULB_KEY, 16, 20);
    const ctx = texture.context;
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(6, 0, 4, 6);
    ctx.fillStyle = '#4a4a50';
    ctx.fillRect(5, 5, 6, 2);
    const g = ctx.createRadialGradient(8, 13, 0, 8, 13, 6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#ffe6a8');
    g.addColorStop(1, '#c8863a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(8, 13, 5, 0, Math.PI * 2);
    ctx.fill();
    texture.refresh();
  }

  makeFog() {
    const m = OUTSIDE_MARGIN_TILES * TILE;
    const w = MAP_COLS * TILE;
    const h = MAP_ROWS * TILE;
    const strips = [
      [-m, -m, w + 2 * m, m],
      [-m, h, w + 2 * m, m],
      [-m, 0, m, h],
      [w, 0, m, h],
    ];
    FOG_LAYERS.forEach((layer) => {
      strips.forEach(([x, y, sw, sh]) => {
        const sprite = this.scene.add
          .tileSprite(x, y, sw, sh, FOG_KEY)
          .setOrigin(0, 0)
          .setDepth(DEPTH_FOG)
          .setAlpha(layer.alpha)
          .setTint(0xb8c8d4)
          .setTileScale(layer.scale);
        sprite.fogLayer = layer;
        this.fog.push(sprite);
      });
    });
  }

  build() {
    const { width, height } = this.scene.scale;
    this.image?.destroy();
    if (this.scene.textures.exists(DARK_KEY)) this.scene.textures.remove(DARK_KEY);

    this.texture = this.scene.textures.createCanvas(
      DARK_KEY,
      Math.max(2, Math.ceil(width * RESOLUTION)),
      Math.max(2, Math.ceil(height * RESOLUTION)),
    );
    this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.image = this.scene.add
      .image(0, 0, DARK_KEY)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH_DARKNESS)
      .setDisplaySize(width, height);
  }

  // mode: 'steady' | 'flicker' | 'broken'. Con bulb=true dibuja el foco con su resplandor.
  addLight({ x, y, radius, mode = 'steady', bulb = true }) {
    const additive = (tint) => this.scene.add
      .image(x, y, GLOW_KEY)
      .setTint(tint)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH_GLOW);
    const glow = bulb ? additive(0xffd28a) : null;
    const halo = bulb ? additive(0xffb860) : null;
    const fixture = bulb ? this.scene.add.image(x, y - 2, BULB_KEY).setScale(1.6).setDepth(DEPTH_GLOW + 1) : null;
    this.lights.push({ x, y, radius, mode, glow, halo, fixture, phase: Math.random() * 100 });
  }

  intensity(light, time) {
    const t = time / 1000 + light.phase;
    if (light.mode === 'steady') return 1;
    if (light.mode === 'flicker') return 0.8 + 0.2 * Math.sin(t * 9) * Math.sin(t * 2.3);
    // 'broken': se apaga de golpe por instantes y vuelve con sacudidas.
    const cut = Math.sin(t * 1.3) + Math.sin(t * 3.7) * 0.6;
    if (cut > 1.05) return 0.05 + Math.abs(Math.sin(t * 41)) * 0.25;
    return 0.85 + 0.15 * Math.sin(t * 17);
  }

  punch(ctx, view, x, y, radius, strength) {
    const sx = (x - view.x) * RESOLUTION;
    const sy = (y - view.y) * RESOLUTION;
    const r = radius * RESOLUTION;
    if (sx < -r || sy < -r || sx > this.texture.width + r || sy > this.texture.height + r) return;

    const g = ctx.createRadialGradient(sx, sy, r * 0.12, sx, sy, r);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.6})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  update(time, player, remotePlayers) {
    const view = this.scene.cameras.main.worldView;
    const ctx = this.texture.context;
    const { width, height } = this.texture;

    this.fog.forEach((sprite) => {
      const { speed } = sprite.fogLayer;
      sprite.tilePositionX = time * speed;
      sprite.tilePositionY = time * speed * 0.35;
    });

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = DARKNESS_COLOR;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'destination-out';
    this.lights.forEach((light) => {
      const level = this.intensity(light, time);
      if (light.glow) {
        light.glow.setAlpha(0.5 * level).setDisplaySize(70 + 40 * level, 70 + 40 * level);
        light.halo.setAlpha(0.22 * level).setDisplaySize(light.radius * 0.9, light.radius * 0.9);
        light.fixture.setAlpha(0.55 + 0.45 * level);
      }
      this.punch(ctx, view, light.x, light.y, light.radius * (0.85 + 0.15 * level), 0.9 * level);
    });
    remotePlayers?.forEach((entry) => this.punch(ctx, view, entry.sprite.x, entry.sprite.y, REMOTE_RADIUS, 0.85));
    if (player) this.punch(ctx, view, player.x, player.y - 8, PLAYER_RADIUS, 1);

    this.texture.refresh();
  }

  destroy() {
    this.scene.scale.off('resize', this.build, this);
    this.lights.forEach((light) => [light.glow, light.halo, light.fixture].forEach((o) => o?.destroy()));
    this.fog.forEach((layer) => layer.destroy());
    this.image?.destroy();
    if (this.scene.textures.exists(DARK_KEY)) this.scene.textures.remove(DARK_KEY);
  }
}
