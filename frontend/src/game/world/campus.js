import Phaser from 'phaser';

/**
 * Builds the playable zone.
 *
 * What makes a top-down scene read as a place instead of a board is layering,
 * not art: a world larger than the viewport, sprites sorted by their Y, fake
 * height on anything vertical, and shadows anchoring everything to the floor.
 * All of it is generated here in code — no new assets (see GAMEPLAY.md §2).
 */

export const WORLD = { width: 1600, height: 1200 };

const WALL = 24;

/** Inset so the painted walls actually block movement instead of being decor. */
export const PLAY_AREA = new Phaser.Geom.Rectangle(
  WALL,
  WALL,
  WORLD.width - WALL * 2,
  WORLD.height - WALL * 2,
);

/**
 * Entities set their depth to their Y, so anything meant to sit permanently
 * under or over them lives outside the [0, WORLD.height] range.
 */
export const DEPTH = {
  GROUND: -1000,
  SHADOW: -500,
  OVERLAY: 10000,
};

const COLORS = {
  floor: [0xb9b4a2, 0xb3ae9c, 0xbdb8a6, 0xaea895],
  grout: 0x9a9583,
  scuff: 0x8f8a79,
  wallTop: 0x6b5744,
  wallFace: 0x43362a,
  propTop: 0x7d8a93,
  propFace: 0x4d5760,
};

const TILE = 64;

/** Deterministic value noise: the floor looks identical on every run. */
function noise(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function bakeGround(scene) {
  const key = 'campus-ground';
  if (scene.textures.exists(key)) return key;

  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  for (let y = 0; y < WORLD.height; y += TILE) {
    for (let x = 0; x < WORLD.width; x += TILE) {
      const shade = COLORS.floor[Math.floor(noise(x / TILE, y / TILE) * COLORS.floor.length)];
      g.fillStyle(shade, 1);
      g.fillRect(x, y, TILE, TILE);
    }
  }

  g.lineStyle(1, COLORS.grout, 0.45);
  for (let x = 0; x <= WORLD.width; x += TILE) g.lineBetween(x, 0, x, WORLD.height);
  for (let y = 0; y <= WORLD.height; y += TILE) g.lineBetween(0, y, WORLD.width, y);

  // Scuffs break up the grid so the eye stops reading it as graph paper.
  g.fillStyle(COLORS.scuff, 0.3);
  for (let i = 0; i < 90; i += 1) {
    const x = noise(i, 1) * WORLD.width;
    const y = noise(i, 2) * WORLD.height;
    g.fillEllipse(x, y, 30 + noise(i, 3) * 70, 18 + noise(i, 4) * 34);
  }

  drawPerimeterWalls(g);

  g.generateTexture(key, WORLD.width, WORLD.height);
  g.destroy();
  return key;
}

function drawPerimeterWalls(g) {
  const { width, height } = WORLD;

  // Ambient occlusion first: a dark band bleeding from the wall onto the floor
  // is most of what sells the wall as having height.
  g.fillStyle(0x000000, 0.16);
  g.fillRect(0, WALL, width, 26);
  g.fillRect(0, height - WALL - 12, width, 12);
  g.fillRect(WALL, 0, 14, height);
  g.fillRect(width - WALL - 14, 0, 14, height);

  g.fillStyle(COLORS.wallTop, 1);
  g.fillRect(0, 0, width, WALL);
  g.fillRect(0, height - WALL, width, WALL);
  g.fillRect(0, 0, WALL, height);
  g.fillRect(width - WALL, 0, WALL, height);

  // The face of the top wall is the only one the camera can see head-on.
  g.fillStyle(COLORS.wallFace, 1);
  g.fillRect(0, WALL, width, 14);

  // Side walls get a slim inner face; the bottom wall gets a lit cap instead,
  // since we are looking at its top surface.
  g.fillRect(WALL, 0, 8, height);
  g.fillRect(width - WALL - 8, 0, 8, height);
  g.fillStyle(0x8a7358, 1);
  g.fillRect(0, height - WALL, width, 5);
}

/**
 * Props are drawn bottom-anchored (origin 0.5, 1) so their Y is where they
 * touch the floor — which is exactly the value Y-sorting needs.
 */
const PROPS = {
  columna: {
    w: 44,
    h: 92,
    base: 20,
    draw(g, w, h) {
      g.fillStyle(COLORS.propFace, 1);
      g.fillRect(w * 0.16, h * 0.12, w * 0.68, h * 0.88);
      g.fillStyle(COLORS.propTop, 1);
      g.fillRect(w * 0.16, h * 0.12, w * 0.44, h * 0.88);
      g.fillStyle(0x9aa5ad, 1);
      g.fillEllipse(w / 2, h * 0.12, w, w * 0.42);
      g.fillStyle(0x3c454d, 1);
      g.fillEllipse(w / 2, h, w * 1.05, w * 0.34);
    },
  },
  banca: {
    w: 88,
    h: 46,
    base: 18,
    draw(g, w, h) {
      g.fillStyle(0x5a4632, 1);
      g.fillRect(w * 0.06, h * 0.44, w * 0.88, h * 0.3);
      g.fillStyle(0x7a5f42, 1);
      g.fillRect(w * 0.06, h * 0.3, w * 0.88, h * 0.18);
      g.fillStyle(0x3e3226, 1);
      g.fillRect(w * 0.14, h * 0.72, w * 0.1, h * 0.26);
      g.fillRect(w * 0.76, h * 0.72, w * 0.1, h * 0.26);
    },
  },
  matera: {
    w: 46,
    h: 58,
    base: 22,
    draw(g, w, h) {
      g.fillStyle(0x3f6b3a, 1);
      g.fillEllipse(w / 2, h * 0.34, w * 0.96, h * 0.52);
      g.fillStyle(0x4f8146, 1);
      g.fillEllipse(w * 0.42, h * 0.28, w * 0.6, h * 0.34);
      g.fillStyle(0x8a5a3b, 1);
      g.fillRect(w * 0.2, h * 0.56, w * 0.6, h * 0.36);
      g.fillStyle(0x6b4329, 1);
      g.fillRect(w * 0.2, h * 0.84, w * 0.6, h * 0.1);
    },
  },
  escritorio: {
    w: 76,
    h: 52,
    base: 20,
    draw(g, w, h) {
      // Overturned: the underside faces us, legs in the air.
      g.fillStyle(0x4a4038, 1);
      g.fillRect(w * 0.08, h * 0.38, w * 0.84, h * 0.44);
      g.fillStyle(0x635548, 1);
      g.fillRect(w * 0.08, h * 0.3, w * 0.84, h * 0.12);
      g.fillStyle(0x2f2a25, 1);
      g.fillRect(w * 0.18, h * 0.06, w * 0.07, h * 0.28);
      g.fillRect(w * 0.74, h * 0.06, w * 0.07, h * 0.28);
    },
  },
};

function bakeProps(scene) {
  Object.entries(PROPS).forEach(([name, spec]) => {
    const key = `prop-${name}`;
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    spec.draw(g, spec.w, spec.h);
    g.generateTexture(key, spec.w, spec.h);
    g.destroy();
  });
}

/**
 * Hand-placed rather than random: open lanes and sight-line breaks are level
 * design, and a fixed layout keeps the zone learnable between runs.
 */
const LAYOUT = [
  ['columna', 300, 300], ['columna', 300, 900], ['columna', 1300, 300], ['columna', 1300, 900],
  ['columna', 800, 480], ['columna', 800, 840],
  ['banca', 520, 380], ['banca', 1080, 380], ['banca', 520, 880], ['banca', 1080, 880],
  ['matera', 430, 620], ['matera', 1170, 620], ['matera', 640, 200], ['matera', 960, 1080],
  ['escritorio', 650, 700], ['escritorio', 950, 700], ['escritorio', 420, 1060],
  ['escritorio', 1200, 1060], ['escritorio', 200, 620], ['escritorio', 1400, 620],
];

/** Where the axe is claimed (GAMEPLAY.md §5). */
export const SECURITY_POST = { x: 800, y: 250, radius: 64 };

export function addShadow(scene, target, width, height) {
  const shadow = scene.add.ellipse(target.x, target.y, width, height, 0x000000, 0.28);
  shadow.setDepth(DEPTH.SHADOW);
  return shadow;
}

export function buildCampus(scene) {
  scene.add.image(0, 0, bakeGround(scene)).setOrigin(0, 0).setDepth(DEPTH.GROUND);
  bakeProps(scene);

  const obstacles = scene.physics.add.staticGroup();

  LAYOUT.forEach(([name, x, y]) => {
    const spec = PROPS[name];
    scene.add.ellipse(x, y - spec.base * 0.3, spec.w * 1.05, spec.base * 0.9, 0x000000, 0.26)
      .setDepth(DEPTH.SHADOW);
    scene.add.image(x, y, `prop-${name}`).setOrigin(0.5, 1).setDepth(y);

    // Collision is an invisible rectangle over the prop's base only. Keeping it
    // separate from the image means the hitbox never has to follow the art.
    const blocker = scene.add.rectangle(x, y - spec.base / 2, spec.w * 0.8, spec.base);
    blocker.setVisible(false);
    scene.physics.add.existing(blocker, true);
    obstacles.add(blocker);
  });

  buildSecurityPost(scene);

  return { obstacles };
}

function buildSecurityPost(scene) {
  const { x, y } = SECURITY_POST;

  const marker = scene.add.circle(x, y, SECURITY_POST.radius, 0xffd166, 0.12);
  marker.setDepth(DEPTH.SHADOW + 1);
  scene.tweens.add({
    targets: marker,
    scale: { from: 0.88, to: 1.06 },
    alpha: { from: 0.1, to: 0.22 },
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  scene.add.ellipse(x, y - 6, 76, 24, 0x000000, 0.3).setDepth(DEPTH.SHADOW);

  const booth = scene.add.graphics();
  booth.fillStyle(0x3d4a55, 1);
  booth.fillRect(x - 34, y - 74, 68, 74);
  booth.fillStyle(0x55646f, 1);
  booth.fillRect(x - 34, y - 74, 40, 74);
  booth.fillStyle(0x9fd3e8, 1);
  booth.fillRect(x - 26, y - 62, 30, 26);
  booth.fillStyle(0xffd166, 1);
  booth.fillRect(x - 38, y - 86, 76, 14);
  booth.setDepth(y);

  scene.add.text(x, y - 104, 'PUESTO DE SEGURIDAD', {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#ffd166',
  }).setOrigin(0.5, 1).setDepth(y);

  return { x, y };
}

/** True while the player is standing close enough to interact with the post. */
export function isAtSecurityPost(x, y) {
  return Phaser.Math.Distance.Between(x, y, SECURITY_POST.x, SECURITY_POST.y)
    <= SECURITY_POST.radius;
}

/**
 * Darkens the edges of the viewport. Fixed to the camera, so it frames the
 * action instead of scrolling with the world.
 */
export function addVignette(scene) {
  const { width, height } = scene.scale;
  const band = 130;
  const g = scene.add.graphics();
  g.setScrollFactor(0).setDepth(DEPTH.OVERLAY);

  const dark = 0x05070d;
  g.fillGradientStyle(dark, dark, dark, dark, 0.55, 0.55, 0, 0);
  g.fillRect(0, 0, width, band);
  g.fillGradientStyle(dark, dark, dark, dark, 0, 0, 0.6, 0.6);
  g.fillRect(0, height - band, width, band);
  g.fillGradientStyle(dark, dark, dark, dark, 0.45, 0, 0.45, 0);
  g.fillRect(0, 0, band, height);
  g.fillGradientStyle(dark, dark, dark, dark, 0, 0.45, 0, 0.45);
  g.fillRect(width - band, 0, band, height);

  return g;
}
