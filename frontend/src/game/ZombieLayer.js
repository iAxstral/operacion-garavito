import Phaser from 'phaser';

const TEXTURE = 'zombie';
const TOUGH_TEXTURE = 'zombie-teso';
const TOUGH_HEALTH = 4;

const LERP_PER_SECOND = 12;

// Deben coincidir con Zombie.WINDUP_MS / TOUGH_WINDUP_MS del servidor: el anillo de
// aviso se llena justo cuando llega la mordida.
const WINDUP_MS = 420;
const TOUGH_WINDUP_MS = 520;

const WINDUP_TINT = 0xff5a5a;
const STAGGER_TINT = 0xb9c4ff;
const LUNGE_PX = 16;

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

  g.fillStyle(rot, 1);
  g.fillRect(w * 0.06, h * 0.42, w * 0.16, h * 0.12);
  g.fillRect(w * 0.78, h * 0.42, w * 0.16, h * 0.12);

  g.generateTexture(key, w, h);
  g.destroy();
}

/**
 * Dibuja los zombis del piso y su ataque: en WINDUP se ponen rojos, aparece un "!" y
 * un anillo en el suelo que se llena hasta la mordida; en STRIKE embisten hacia su
 * objetivo; en STAGGER (golpe que corto la mordida) quedan azulados y tambaleando.
 *
 * `hooks` permite a la escena reaccionar con sonido: onWindup, onStrike, onStagger,
 * onHit y onDeath reciben la entrada del zombi. `findTarget(x, y)` devuelve el
 * jugador mas cercano ({ x, y }) para orientar la embestida.
 */
export default class ZombieLayer {
  constructor(scene, { hooks = {}, findTarget = () => null } = {}) {
    this.scene = scene;
    this.sprites = new Map();
    this.hooks = hooks;
    this.findTarget = findTarget;

    bakeTexture(scene, TEXTURE, { body: 0x4a6b38, rot: 0x86a86a, w: 28, h: 40 });
    bakeTexture(scene, TOUGH_TEXTURE, { body: 0x6b3838, rot: 0xa86a6a, w: 34, h: 48 });
  }

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

      if (state.health < entry.health) {
        this.flash(entry);
        this.hooks.onHit?.(entry);
      }
      entry.health = state.health;

      const phase = state.phase ?? 'CHASE';
      if (phase !== entry.phase) this.changePhase(entry, phase);
    });

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

    const sway = this.scene.tweens.add({
      targets: sprite,
      angle: { from: -6, to: 6 },
      duration: 320 + Math.random() * 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    sprite.setScale(0.5);
    this.scene.tweens.add({ targets: sprite, scale: 1, duration: 220, ease: 'Back.easeOut' });

    return {
      sprite,
      shadow,
      sway,
      x: state.x,
      y: state.y,
      targetX: state.x,
      targetY: state.y,
      offset: { x: 0, y: 0 },
      health: state.health,
      tough,
      phase: 'CHASE',
      warning: null,
      ring: null,
    };
  }

  changePhase(entry, phase) {
    const previous = entry.phase;
    entry.phase = phase;
    this.clearWarning(entry);

    if (phase === 'WINDUP') {
      this.showWarning(entry);
      this.hooks.onWindup?.(entry);
    } else if (phase === 'STRIKE' && previous === 'WINDUP') {
      this.lunge(entry);
      this.hooks.onStrike?.(entry);
    } else if (phase === 'STAGGER') {
      this.scene.tweens.add({ targets: entry.offset, x: { from: -4, to: 4 }, duration: 70, yoyo: true, repeat: 3 });
      this.hooks.onStagger?.(entry);
    }
    this.applyPhaseTint(entry);
  }

  applyPhaseTint(entry) {
    const { sprite } = entry;
    if (!sprite.active) return;
    sprite.setTintMode(Phaser.TintModes.MULTIPLY);
    if (entry.phase === 'WINDUP') sprite.setTint(WINDUP_TINT);
    else if (entry.phase === 'STAGGER') sprite.setTint(STAGGER_TINT);
    else sprite.clearTint();
  }

  showWarning(entry) {
    const duration = entry.tough ? TOUGH_WINDUP_MS : WINDUP_MS;
    const radius = entry.tough ? 30 : 24;

    entry.ring = this.scene.add.graphics().setDepth(2);
    entry.ring.progress = 0;
    this.scene.tweens.add({ targets: entry.ring, progress: 1, duration });

    entry.warning = this.scene.add
      .text(entry.sprite.x, entry.sprite.y, '!', {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ff4040',
        stroke: '#1a0000',
        strokeThickness: 5,
      })
      .setOrigin(0.5, 1)
      .setDepth(entry.sprite.depth + 1);
    entry.warning.setScale(0.4);
    this.scene.tweens.add({ targets: entry.warning, scale: 1, duration: 140, ease: 'Back.easeOut' });

    entry.ring.radius = radius;
    // El zombi "toma aire": se agacha y se estira antes de morder.
    this.scene.tweens.add({ targets: entry.sprite, scaleY: 0.86, scaleX: 1.12, duration: duration * 0.8, ease: 'Quad.easeIn' });
  }

  clearWarning(entry) {
    entry.warning?.destroy();
    entry.ring?.destroy();
    entry.warning = null;
    entry.ring = null;
    if (entry.sprite.active) {
      this.scene.tweens.killTweensOf(entry.sprite);
      entry.sprite.setScale(1);
      entry.sway = this.scene.tweens.add({
        targets: entry.sprite,
        angle: { from: -6, to: 6 },
        duration: 320 + Math.random() * 180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  lunge(entry) {
    const target = this.findTarget(entry.x, entry.y);
    let dx = target ? target.x - entry.x : (entry.sprite.flipX ? -1 : 1);
    let dy = target ? target.y - entry.y : 0;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    this.scene.tweens.add({
      targets: entry.offset,
      x: dx * LUNGE_PX,
      y: dy * LUNGE_PX,
      duration: 70,
      yoyo: true,
      hold: 40,
      ease: 'Quad.easeOut',
    });
  }

  flash(entry) {
    entry.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(70, () => this.applyPhaseTint(entry));
  }

  kill(entry) {
    this.clearWarning(entry);
    this.hooks.onDeath?.(entry);
    this.scene.tweens.killTweensOf(entry.offset);
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
      const previousX = entry.x;
      entry.x += (entry.targetX - entry.x) * t;
      entry.y += (entry.targetY - entry.y) * t;
      sprite.setPosition(entry.x + entry.offset.x, entry.y + entry.offset.y);

      sprite.setDepth(sprite.y);
      if (Math.abs(entry.targetX - previousX) > 0.5) sprite.setFlipX(entry.targetX < previousX);
      entry.shadow.setPosition(entry.x, entry.y + (entry.tough ? 20 : 16));

      if (entry.warning) {
        entry.warning.setPosition(sprite.x, sprite.y - sprite.height / 2 - 2).setDepth(sprite.depth + 1);
      }
      if (entry.ring) {
        const ring = entry.ring;
        const footY = entry.y + (entry.tough ? 20 : 16);
        ring.clear();
        ring.fillStyle(0xff2a2a, 0.12 + 0.2 * ring.progress);
        ring.fillEllipse(entry.x, footY, ring.radius * 2 * ring.progress, ring.radius * ring.progress);
        ring.lineStyle(2, 0xff4040, 0.85);
        ring.strokeEllipse(entry.x, footY, ring.radius * 2, ring.radius);
      }
    });
  }

  destroy() {
    this.sprites.forEach((entry) => {
      entry.warning?.destroy();
      entry.ring?.destroy();
      entry.sprite.destroy();
      entry.shadow.destroy();
    });
    this.sprites.clear();
  }
}
