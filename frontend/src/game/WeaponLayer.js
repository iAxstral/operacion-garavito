import Phaser from 'phaser';
import { FLASH_KEY } from './HauntedDecor';

// Texturas de las armas en la mano, dibujadas apuntando a la derecha (+x) con el
// origen en la empuñadura: asi basta rotarlas al angulo de apuntado.
const TEXTURES = {
  AXE: {
    key: 'weapon_axe', w: 34, h: 20, originX: 0.18, originY: 0.55,
    draw: (g) => {
      g.fillStyle(0x6b3f1c, 1).fillRect(0, 9, 26, 4);
      g.fillStyle(0x4a2a12, 1).fillRect(0, 12, 26, 1);
      g.fillStyle(0xaab4bb, 1).fillRect(22, 2, 9, 16);
      g.fillStyle(0xe4ebef, 1).fillRect(30, 3, 3, 14);
      g.fillStyle(0x7d878e, 1).fillRect(22, 2, 2, 16);
    },
  },
  PISTOL: {
    key: 'weapon_pistol', w: 28, h: 14, originX: 0.25, originY: 0.55,
    draw: (g) => {
      g.fillStyle(0x2b2e33, 1).fillRect(4, 2, 24, 5);
      g.fillStyle(0x454a52, 1).fillRect(4, 2, 24, 2);
      g.fillStyle(0x16181b, 1).fillRect(26, 3, 2, 3);
      g.fillStyle(0x5a3a1e, 1).fillRect(5, 7, 6, 7);
      g.fillStyle(0x2b2e33, 1).fillRect(11, 7, 4, 1).fillRect(14, 7, 1, 4);
    },
  },
  RIFLE: {
    key: 'weapon_rifle', w: 50, h: 16, originX: 0.3, originY: 0.5,
    draw: (g) => {
      g.fillStyle(0x6b3f1c, 1).fillRect(0, 5, 14, 7);
      g.fillStyle(0x4a2a12, 1).fillRect(0, 10, 14, 2);
      g.fillStyle(0x2b2e33, 1).fillRect(14, 5, 24, 5);
      g.fillStyle(0x1b1d20, 1).fillRect(38, 6, 12, 3);
      g.fillStyle(0x2b2e33, 1).fillRect(22, 10, 5, 6);
      g.fillStyle(0x1b1d20, 1).fillRect(18, 1, 12, 4);
      g.fillStyle(0x7fb4d6, 1).fillRect(28, 2, 2, 2);
    },
  },
};

const HIP_ANGLE = Math.PI / 2;
const DRAW_MS = 300;
const HOLSTER_MS = 140;
const HAND_DISTANCE = 16;
const HAND_DROP_Y = 10;

function lerpAngle(from, to, t) {
  return from + Phaser.Math.Angle.Wrap(to - from) * t;
}

/**
 * Armas en la mano de cada jugador visible (el local y los remotos de su piso): la
 * animacion de sacarla al cambiar de arma, el retroceso y fogonazo al disparar, el
 * trazo de la bala y el casquillo, y el tajo del hacha.
 */
export default class WeaponLayer {
  constructor(scene, { onDraw } = {}) {
    this.scene = scene;
    this.holders = new Map();
    this.onDraw = onDraw;
    Object.values(TEXTURES).forEach((spec) => {
      if (scene.textures.exists(spec.key)) return;
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      spec.draw(g);
      g.generateTexture(spec.key, spec.w, spec.h);
      g.destroy();
    });
  }

  holder(id) {
    let entry = this.holders.get(id);
    if (!entry) {
      entry = { weaponId: 'FISTS', sprite: null, pose: { draw: 0, swing: 0, recoil: 0 }, aim: 0, x: 0, y: 0 };
      this.holders.set(id, entry);
    }
    return entry;
  }

  /**
   * Ubica el arma de `id` en la mano. `weaponId` es el arma equipada segun el
   * servidor: si cambio, guarda la anterior y saca la nueva con su animacion.
   */
  update(id, { x, y, aim, depth, weaponId, silent = false }) {
    const entry = this.holder(id);
    entry.x = x;
    entry.y = y;
    entry.aim = aim;
    if (weaponId !== entry.weaponId) this.change(entry, weaponId, silent);

    const { sprite, pose } = entry;
    if (!sprite) return;
    const angle = lerpAngle(HIP_ANGLE, aim, pose.draw) + pose.swing;
    const distance = 4 + (HAND_DISTANCE - pose.recoil) * pose.draw;
    sprite.setPosition(x + Math.cos(angle) * distance, y + HAND_DROP_Y + Math.sin(angle) * distance * 0.7);
    sprite.setRotation(angle);
    // Apuntando a la izquierda se voltea para que no quede al reves.
    sprite.setFlipY(Math.abs(Phaser.Math.Angle.Wrap(angle)) > Math.PI / 2);
    sprite.setAlpha(Math.min(1, pose.draw * 2.5));
    sprite.setScale(0.75 + 0.25 * pose.draw);
    // Apuntando hacia arriba el arma queda detras del cuerpo.
    sprite.setDepth(depth + (Math.sin(angle) < -0.3 ? -0.5 : 0.5));
  }

  change(entry, weaponId, silent) {
    const previous = entry.sprite;
    entry.weaponId = weaponId;
    this.scene.tweens.killTweensOf(entry.pose);
    if (previous) {
      // Guarda la anterior: baja a la cadera y se desvanece.
      this.scene.tweens.add({
        targets: previous,
        alpha: 0,
        scale: 0.6,
        duration: HOLSTER_MS,
        onComplete: () => previous.destroy(),
      });
    }
    entry.sprite = null;
    entry.pose.draw = 0;
    entry.pose.swing = 0;
    entry.pose.recoil = 0;

    const spec = TEXTURES[weaponId];
    if (!spec) return;
    entry.sprite = this.scene.add.image(entry.x, entry.y, spec.key).setOrigin(spec.originX, spec.originY).setAlpha(0);
    entry.spec = spec;
    // Saca el arma: sube desde la cadera hasta apuntar, con un rebote al final.
    this.scene.tweens.add({
      targets: entry.pose,
      draw: 1,
      delay: previous ? HOLSTER_MS * 0.6 : 0,
      duration: DRAW_MS,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: entry.pose,
      swing: { from: -0.5, to: 0 },
      delay: previous ? HOLSTER_MS * 0.6 : 0,
      duration: DRAW_MS,
      ease: 'Sine.easeOut',
    });
    if (!silent) this.onDraw?.(weaponId);
  }

  /** Punta del cañon del arma de `id`, en coordenadas del mundo. */
  muzzle(id) {
    const entry = this.holders.get(id);
    if (!entry?.sprite) return entry ? { x: entry.x, y: entry.y } : null;
    const { sprite, spec } = entry;
    const length = spec.w * (1 - spec.originX) * sprite.scaleX;
    return { x: sprite.x + Math.cos(sprite.rotation) * length, y: sprite.y + Math.sin(sprite.rotation) * length };
  }

  /** Disparo: retroceso, fogonazo, trazo hasta `to` y casquillo. */
  fire(id, to, { heavy = false } = {}) {
    const entry = this.holders.get(id);
    if (!entry) return;
    const from = this.muzzle(id);
    const depth = (entry.sprite?.depth ?? 10) + 1;

    entry.recoilTween?.stop();
    entry.pose.recoil = heavy ? 9 : 6;
    entry.recoilTween = this.scene.tweens.add({ targets: entry.pose, recoil: 0, duration: heavy ? 220 : 140, ease: 'Quad.easeOut' });

    const angle = entry.sprite?.rotation ?? Math.atan2(to.y - from.y, to.x - from.x);
    const flash = this.scene.add.image(from.x, from.y, FLASH_KEY)
      .setRotation(angle + Math.random() * 0.6)
      .setScale(heavy ? 1.3 : 0.95)
      .setDepth(depth)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: flash, scale: 0.3, alpha: 0, duration: heavy ? 90 : 70, onComplete: () => flash.destroy() });
    this.scene.lighting?.pulse(from.x, from.y, heavy ? 220 : 170, heavy ? 110 : 80);

    const tracer = this.scene.add.graphics().setDepth(depth);
    tracer.lineStyle(heavy ? 3 : 2, 0xfff4c2, 0.95);
    tracer.lineBetween(from.x, from.y, to.x, to.y);
    this.scene.tweens.add({ targets: tracer, alpha: 0, duration: heavy ? 130 : 90, onComplete: () => tracer.destroy() });

    const spark = this.scene.add.circle(to.x, to.y, 4, 0xffd27a, 0.9).setDepth(depth);
    this.scene.tweens.add({ targets: spark, scale: 2.2, alpha: 0, duration: 120, onComplete: () => spark.destroy() });
    // Chispas donde pega la bala, rebotando hacia atras.
    const back = angle + Math.PI;
    for (let i = 0; i < (heavy ? 6 : 4); i += 1) {
      const a = back + (Math.random() - 0.5) * 1.6;
      const d = 10 + Math.random() * 18;
      const bit = this.scene.add.rectangle(to.x, to.y, 3, 1.5, 0xffe08a).setRotation(a).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: bit, x: to.x + Math.cos(a) * d, y: to.y + Math.sin(a) * d, alpha: 0, duration: 160 + Math.random() * 80,
        onComplete: () => bit.destroy(),
      });
    }

    // Casquillo: sale hacia un costado, rebota y se queda un rato en el piso.
    this.scene.gore?.shell(entry.x, entry.y + HAND_DROP_Y, angle);
  }

  /** Tajo del hacha (o del arma cuerpo a cuerpo que tenga en la mano). */
  swing(id) {
    const entry = this.holders.get(id);
    if (!entry?.sprite) return;
    entry.swingTween?.stop();
    entry.swingTween = this.scene.tweens.chain({
      targets: entry.pose,
      tweens: [
        { swing: { from: -1.1, to: 0.9 }, duration: 130, ease: 'Cubic.easeOut' },
        { swing: 0, duration: 120 },
      ],
    });
  }

  /** Animacion de recarga: el arma baja y gira un poco mientras dura. */
  reload(id, durationMs) {
    const entry = this.holders.get(id);
    if (!entry?.sprite) return;
    entry.swingTween?.stop();
    entry.swingTween = this.scene.tweens.add({
      targets: entry.pose, swing: 0.9, duration: durationMs * 0.25, yoyo: true, hold: durationMs * 0.5, ease: 'Sine.easeInOut',
    });
  }

  remove(id) {
    const entry = this.holders.get(id);
    if (!entry) return;
    this.scene.tweens.killTweensOf(entry.pose);
    entry.sprite?.destroy();
    this.holders.delete(id);
  }

  destroy() {
    [...this.holders.keys()].forEach((id) => this.remove(id));
  }
}
