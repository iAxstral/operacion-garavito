import Phaser from 'phaser';

/**
 * Dibuja los zombis que manda el servidor.
 *
 * El cliente no decide nada sobre ellos: no los mueve, no los mata, no
 * resuelve colisiones. Solo recibe posiciones a 8 Hz e **interpola** hacia la
 * ultima conocida, que es lo que hace que 8 paquetes por segundo se vean
 * fluidos a 60 fps. Sin esa interpolacion la horda avanzaria a saltos.
 */

const TEXTURE = 'zombie';
const TOUGH_TEXTURE = 'zombie-teso';
const TOUGH_HEALTH = 4;

/**
 * Que tan rapido el sprite alcanza la posicion que reporto el servidor.
 * Mas alto responde antes pero deja ver el salto entre paquetes; mas bajo
 * suaviza pero el zombi se dibuja "atrasado" respecto de donde el servidor
 * cree que esta — que es lo que decide si una mordida se siente justa.
 */
const LERP_PER_SECOND = 12;

function bakeTexture(scene, key, { body, rot, w, h }) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0x2f3a26, 1);
  g.fillRoundedRect(w * 0.18, h * 0.3, w * 0.64, h * 0.62, 5);
  g.fillStyle(body, 1);
  g.fillRoundedRect(w * 0.18, h * 0.3, w * 0.42, h * 0.62, 5);
  g.fillStyle(rot, 1);
  g.fillCircle(w / 2, h * 0.24, w * 0.26);
  g.fillStyle(0x1d2417, 1);
  g.fillCircle(w * 0.42, h * 0.22, 2.2);
  g.fillCircle(w * 0.58, h * 0.22, 2.2);
  // Brazos al frente: la silueta tiene que leerse de un vistazo en movimiento.
  g.fillStyle(rot, 1);
  g.fillRect(w * 0.06, h * 0.42, w * 0.16, h * 0.12);
  g.fillRect(w * 0.78, h * 0.42, w * 0.16, h * 0.12);

  g.generateTexture(key, w, h);
  g.destroy();
}

export default class ZombieLayer {
  constructor(scene) {
    this.scene = scene;
    this.sprites = new Map();

    bakeTexture(scene, TEXTURE, { body: 0x4a6b38, rot: 0x86a86a, w: 28, h: 40 });
    bakeTexture(scene, TOUGH_TEXTURE, { body: 0x6b3838, rot: 0xa86a6a, w: 34, h: 48 });
  }

  /** Reconcilia la lista de sprites con la que acaba de llegar del servidor. */
  sync(zombieStates) {
    const seen = new Set();

    zombieStates.forEach((state) => {
      seen.add(state.id);
      let entry = this.sprites.get(state.id);

      if (!entry) {
        entry = this.spawn(state);
        this.sprites.set(state.id, entry);
      }

      entry.targetX = state.x;
      entry.targetY = state.y;

      if (state.health < entry.health) this.flash(entry);
      entry.health = state.health;
    });

    // Un zombi que dejo de venir en el estado es uno que murio: el servidor
    // lo retira recien un tick despues de matarlo, justamente para que aca
    // alcance a verse la muerte en vez de desaparecer de golpe.
    this.sprites.forEach((entry, id) => {
      if (!seen.has(id)) {
        this.kill(entry);
        this.sprites.delete(id);
      }
    });
  }

  spawn(state) {
    const tough = state.tough || state.health >= TOUGH_HEALTH;
    const sprite = this.scene.add.sprite(state.x, state.y, tough ? TOUGH_TEXTURE : TEXTURE);
    sprite.setDepth(state.y);

    const shadow = this.scene.add.ellipse(state.x, state.y + 16, tough ? 28 : 22, 9, 0x000000, 0.28);
    shadow.setDepth(1);

    // Bamboleo desincronizado: si todos usan la misma fase, la oleada camina
    // como banda marcial.
    this.scene.tweens.add({
      targets: sprite,
      angle: { from: -6, to: 6 },
      duration: 320 + Math.random() * 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    sprite.setScale(0.5);
    this.scene.tweens.add({ targets: sprite, scale: 1, duration: 220, ease: 'Back.easeOut' });

    return { sprite, shadow, targetX: state.x, targetY: state.y, health: state.health, tough };
  }

  flash(entry) {
    entry.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(70, () => {
      if (entry.sprite.active) entry.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }

  kill(entry) {
    this.scene.add.ellipse(entry.sprite.x, entry.sprite.y + 12, 26, 12, 0x5a1f1f, 0.5).setDepth(1);
    this.scene.tweens.add({
      targets: [entry.sprite, entry.shadow],
      alpha: 0,
      scaleY: 0.4,
      duration: 220,
      onComplete: () => {
        entry.sprite.destroy();
        entry.shadow.destroy();
      },
    });
  }

  update(delta) {
    const t = Math.min(1, (delta / 1000) * LERP_PER_SECOND);

    this.sprites.forEach((entry) => {
      const { sprite } = entry;
      sprite.x += (entry.targetX - sprite.x) * t;
      sprite.y += (entry.targetY - sprite.y) * t;
      // Profundidad por Y, igual que el jugador, para que un zombi que pasa
      // por arriba quede detras y no encima.
      sprite.setDepth(sprite.y);
      sprite.setFlipX(entry.targetX < sprite.x);
      entry.shadow.setPosition(sprite.x, sprite.y + (entry.tough ? 20 : 16));
    });
  }

  destroy() {
    this.sprites.forEach((entry) => {
      entry.sprite.destroy();
      entry.shadow.destroy();
    });
    this.sprites.clear();
  }
}
