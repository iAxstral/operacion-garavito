import Phaser from 'phaser';
import { SHADOW_KEY } from './HauntedDecor';
import { bakeZombieSheets, ZOMBIE_FRAMES } from './zombieArt';
import { getSettings, onSettingsChange } from './settings';

const TEXTURE = 'zombie';
const TOUGH_TEXTURE = 'zombie-teso';
const RUNNER_TEXTURE = 'zombie-corredor';
const SPITTER_TEXTURE = 'zombie-escupidor';
const KIND_TEXTURES = { EXPLODER: 'zombie-explosivo', SCREAMER: 'zombie-griton', BLIND: 'zombie-ciego' };
const SCREAM_WINDUP_MS = 900;
const SCREAM_TINT = 0xe05aff;
const ENRAGED_TINT = 0xff8080;
const TOUGH_HEALTH = 4;

const LERP_PER_SECOND = 12;

// Deben coincidir con Zombie.WINDUP_MS / TOUGH_WINDUP_MS del servidor: el anillo de
// aviso se llena justo cuando llega la mordida.
const WINDUP_MS = 420;
const TOUGH_WINDUP_MS = 520;
const RUNNER_WINDUP_MS = 300;
const SPIT_WINDUP_MS = 700;

const WINDUP_TINT = 0xff5a5a;
const SPIT_TINT = 0xb6ff5a;
const STAGGER_TINT = 0xb9c4ff;
const LUNGE_PX = 16;

// Contorno de color para reconocer el tipo de un vistazo (el caminante normal no lleva).
const OUTLINE_COLORS = {
  RUNNER: 0x3fd8ff, SPITTER: 0x9dff3a, TOUGH: 0xff3a2a, EXPLODER: 0xff8a1a, SCREAMER: 0xd94aff, BLIND: 0xdedede,
};
const OUTLINE_SCALE = 1.14;
const RISE_MS = 520;
// Opcion para daltonismo: una forma blanca sobre la cabeza ademas del color.
const SHAPE_KEY = 'zombie-type-shapes';
const SHAPES = { TOUGH: 0, RUNNER: 1, SPITTER: 2, EXPLODER: 3, SCREAMER: 4, BLIND: 5 };

function bakeTypeShapes(scene) {
  if (scene.textures.exists(SHAPE_KEY)) return;
  const size = 18;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.lineStyle(3, 0x0d0608, 1);
  g.fillStyle(0xffffff, 1);
  // Cuadrado (resistente)
  g.fillRect(3, 3, 12, 12).strokeRect(3, 3, 12, 12);
  // Triangulo (corredor)
  g.fillTriangle(size + 9, 2, size + 16, 16, size + 2, 16).strokeTriangle(size + 9, 2, size + 16, 16, size + 2, 16);
  // Gota (escupidor)
  g.fillCircle(2 * size + 9, 11, 6).strokeCircle(2 * size + 9, 11, 6);
  g.fillTriangle(2 * size + 4, 9, 2 * size + 14, 9, 2 * size + 9, 1);
  // Rombo (explosivo)
  g.fillPoints([{ x: 3 * size + 9, y: 1 }, { x: 3 * size + 17, y: 9 }, { x: 3 * size + 9, y: 17 }, { x: 3 * size + 1, y: 9 }], true);
  g.strokePoints([{ x: 3 * size + 9, y: 1 }, { x: 3 * size + 17, y: 9 }, { x: 3 * size + 9, y: 17 }, { x: 3 * size + 1, y: 9 }], true);
  // Anillo (griton)
  g.lineStyle(5, 0x0d0608, 1).strokeCircle(4 * size + 9, 9, 6);
  g.lineStyle(3, 0xffffff, 1).strokeCircle(4 * size + 9, 9, 6);
  // Equis (ciego)
  g.lineStyle(6, 0x0d0608, 1).lineBetween(5 * size + 3, 3, 5 * size + 15, 15).lineBetween(5 * size + 15, 3, 5 * size + 3, 15);
  g.lineStyle(3, 0xffffff, 1).lineBetween(5 * size + 3, 3, 5 * size + 15, 15).lineBetween(5 * size + 15, 3, 5 * size + 3, 15);
  g.generateTexture(SHAPE_KEY, size * 6, size);
  g.destroy();
  const texture = scene.textures.get(SHAPE_KEY);
  [0, 1, 2, 3, 4, 5].forEach((i) => texture.add(i, 0, i * size, 0, size, size));
}
// Lo que el cuerpo de un zombi que cayo entero se queda en el piso.
const CORPSE_MS = 6000;

function textureFor(state, tough) {
  if (state.kind === 'RUNNER') return RUNNER_TEXTURE;
  if (state.kind === 'SPITTER') return SPITTER_TEXTURE;
  if (KIND_TEXTURES[state.kind]) return KIND_TEXTURES[state.kind];
  return tough ? TOUGH_TEXTURE : TEXTURE;
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

    bakeZombieSheets(scene);
    bakeTypeShapes(scene);
    this.showShapes = getSettings().typeShapes;
    this.offSettings = onSettingsChange((settings) => {
      this.showShapes = settings.typeShapes;
    });
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
        this.hooks.onHit?.(entry, entry.health - state.health);
      }
      entry.health = state.health;

      const phase = state.phase ?? 'CHASE';
      if (phase === 'WINDUP' && entry.phase !== 'WINDUP') {
        entry.spitting = Boolean(state.spitting);
        entry.screaming = Boolean(state.screaming);
      }
      if (Boolean(state.enraged) !== Boolean(entry.enraged)) {
        entry.enraged = Boolean(state.enraged);
        this.applyPhaseTint(entry);
      }
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
    const kind = state.kind ?? 'WALKER';
    const tough = kind === 'WALKER' && (state.tough || state.health >= TOUGH_HEALTH);
    const sprite = this.scene.add.sprite(state.x, state.y, textureFor(state, tough), 0);
    // Los pies quedan sobre la sombra: el punto del zombi esta a FOOT px de sus pies.
    const foot = tough ? 22 : 18;
    sprite.setOrigin(0.5, (sprite.height - 2 - foot) / sprite.height);
    sprite.setDepth(state.y);

    const shadow = this.scene.add.image(state.x, state.y + 16, SHADOW_KEY)
      .setDisplaySize(tough ? 54 : 42, tough ? 18 : 14)
      .setDepth(1.6);

    const outlineColor = OUTLINE_COLORS[tough ? 'TOUGH' : kind];
    const outline = outlineColor
      ? this.scene.add.sprite(state.x, state.y, sprite.texture.key, 0).setOrigin(sprite.originX, sprite.originY)
        .setTint(outlineColor)
        .setTintMode(Phaser.TintModes.FILL)
        .setAlpha(0.85)
      : null;

    const sway = this.scene.tweens.add({
      targets: sprite,
      angle: { from: -3, to: 3 },
      duration: 320 + Math.random() * 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const entry = {
      sprite,
      shadow,
      outline,
      sway,
      x: state.x,
      y: state.y,
      targetX: state.x,
      targetY: state.y,
      offset: { x: 0, y: 0 },
      health: state.health,
      tough,
      kind,
      spitting: false,
      phase: 'CHASE',
      warning: null,
      ring: null,
      rise: 1,
      walkMs: Math.random() * 1000,
      shape: null,
    };
    const shapeFrame = SHAPES[tough ? 'TOUGH' : kind];
    if (shapeFrame !== undefined) {
      entry.shape = this.scene.add.image(state.x, state.y, SHAPE_KEY, shapeFrame).setVisible(false);
    }
    this.riseFromFloor(entry);
    return entry;
  }

  // Sale del piso: un hoyo oscuro se abre, el zombi sube estirandose y salta tierra.
  riseFromFloor(entry) {
    const { x, y } = entry;
    const footY = y + (entry.tough ? 20 : 16);
    const hole = this.scene.add.ellipse(x, footY, 6, 3, 0x0d0705, 0.9).setDepth(1.7);
    this.scene.tweens.add({
      targets: hole,
      width: 40,
      height: 14,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => this.scene.tweens.add({ targets: hole, alpha: 0, delay: RISE_MS, duration: 400, onComplete: () => hole.destroy() }),
    });
    entry.rise = 0;
    this.scene.tweens.add({ targets: entry, rise: 1, duration: RISE_MS, delay: 120, ease: 'Back.easeOut' });
    for (let i = 0; i < 8; i += 1) {
      const a = Math.PI + Math.random() * Math.PI;
      const d = 12 + Math.random() * 22;
      const clod = this.scene.add.rectangle(x, footY, 3 + Math.random() * 3, 3, i % 2 ? 0x4a3020 : 0x2c1d12).setDepth(footY + 1);
      this.scene.tweens.add({
        targets: clod,
        x: x + Math.cos(a) * d,
        y: { value: footY + Math.sin(a) * d * 0.4 + 6, ease: 'Bounce.easeOut' },
        alpha: 0,
        delay: 120,
        duration: 520,
        onComplete: () => clod.destroy(),
      });
    }
  }

  changePhase(entry, phase) {
    const previous = entry.phase;
    entry.phase = phase;
    this.clearWarning(entry);

    if (phase === 'WINDUP') {
      this.showWarning(entry);
      this.hooks.onWindup?.(entry);
    } else if (phase === 'STRIKE' && previous === 'WINDUP') {
      if (!entry.spitting) this.lunge(entry);
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
    if (entry.phase === 'WINDUP') sprite.setTint(entry.screaming ? SCREAM_TINT : entry.spitting ? SPIT_TINT : WINDUP_TINT);
    else if (entry.phase === 'STAGGER') sprite.setTint(STAGGER_TINT);
    else if (entry.enraged) sprite.setTint(ENRAGED_TINT);
    else sprite.clearTint();
  }

  showWarning(entry) {
    const duration = entry.screaming ? SCREAM_WINDUP_MS
      : entry.spitting ? SPIT_WINDUP_MS
        : entry.tough ? TOUGH_WINDUP_MS
          : entry.kind === 'RUNNER' ? RUNNER_WINDUP_MS : WINDUP_MS;
    const radius = entry.tough || entry.kind === 'SPITTER' ? 30 : 24;
    const color = entry.screaming ? '#e05aff' : entry.spitting ? '#b6ff5a' : '#ff4040';
    entry.ringColor = entry.screaming ? 0xd94aff : entry.spitting ? 0x9dff3a : 0xff4040;

    entry.ring = this.scene.add.graphics().setDepth(2);
    entry.ring.progress = 0;
    this.scene.tweens.add({ targets: entry.ring, progress: 1, duration });

    entry.warning = this.scene.add
      .text(entry.sprite.x, entry.sprite.y, '!', {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color,
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
        angle: { from: -3, to: 3 },
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

  // Muertes variadas: el escupidor siempre revienta (y deja su charco, que pone el
  // servidor); los demas a veces revientan y a veces caen enteros y el cuerpo queda un
  // rato en el piso.
  kill(entry) {
    this.clearWarning(entry);
    entry.shape?.destroy();
    entry.shape = null;
    entry.deathStyle = entry.kind === 'SPITTER' || Math.random() < 0.45 ? 'burst' : 'corpse';
    this.hooks.onDeath?.(entry);
    this.scene.tweens.killTweensOf(entry.offset);
    entry.outline?.destroy();
    entry.outline = null;
    this.scene.tweens.add({ targets: entry.shadow, alpha: 0, duration: 260, onComplete: () => entry.shadow.destroy() });

    if (entry.deathStyle === 'corpse') {
      const side = entry.sprite.flipX ? -1 : 1;
      entry.sprite.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0x8a7a7a);
      this.scene.tweens.add({
        targets: entry.sprite,
        angle: 90 * side,
        y: entry.sprite.y + 10,
        duration: 320,
        ease: 'Bounce.easeOut',
        onComplete: () => {
          entry.sprite.setDepth(1.58);
          this.scene.tweens.add({
            targets: entry.sprite,
            alpha: 0,
            delay: CORPSE_MS,
            duration: 900,
            onComplete: () => entry.sprite.destroy(),
          });
        },
      });
      return;
    }

    this.scene.tweens.add({
      targets: entry.sprite,
      alpha: 0,
      scaleY: 0.4,
      angle: entry.sprite.flipX ? -80 : 80,
      duration: 200,
      onComplete: () => entry.sprite.destroy(),
    });
  }

  update(delta) {
    const t = Math.min(1, (delta / 1000) * LERP_PER_SECOND);

    this.sprites.forEach((entry) => {
      const { sprite } = entry;
      const previousX = entry.x;
      entry.x += (entry.targetX - entry.x) * t;
      entry.y += (entry.targetY - entry.y) * t;
      // Mientras sale del piso: hundido, aplastado y transparente.
      const sink = (1 - entry.rise) * 22;
      sprite.setPosition(entry.x + entry.offset.x, entry.y + entry.offset.y + sink);
      if (entry.rise < 1) {
        sprite.setAlpha(Math.min(1, 0.2 + entry.rise)).setScale(1, Math.max(0.05, entry.rise));
      } else if (!entry.risen) {
        entry.risen = true;
        sprite.setAlpha(1).setScale(1);
      }

      sprite.setDepth(sprite.y);
      // Cuadro: brazos arriba al preparar la mordida, zarpazo al morder; si no, camina
      // (los corredores mas rapido).
      entry.walkMs += delta * (entry.kind === 'RUNNER' ? 1.7 : 1);
      const frame = entry.phase === 'WINDUP' ? ZOMBIE_FRAMES.windup
        : entry.phase === 'STRIKE' ? ZOMBIE_FRAMES.strike
          : ZOMBIE_FRAMES.walk[Math.floor(entry.walkMs / 150) % ZOMBIE_FRAMES.walk.length];
      if (sprite.frame.name !== frame) sprite.setFrame(frame);
      if (entry.outline) {
        if (entry.outline.frame.name !== frame) entry.outline.setFrame(frame);
        entry.outline
          .setPosition(sprite.x, sprite.y)
          .setAngle(sprite.angle)
          .setFlipX(sprite.flipX)
          .setScale(sprite.scaleX * OUTLINE_SCALE, sprite.scaleY * OUTLINE_SCALE)
          .setAlpha(0.85 * sprite.alpha)
          .setDepth(sprite.depth - 0.5);
      }
      if (Math.abs(entry.targetX - previousX) > 0.5) sprite.setFlipX(entry.targetX < previousX);
      entry.shadow.setPosition(entry.x, entry.y + (entry.tough ? 20 : 16));

      if (entry.shape) {
        entry.shape
          .setVisible(this.showShapes && sprite.alpha > 0.5)
          .setPosition(sprite.x, sprite.getTopCenter().y + 4)
          .setDepth(sprite.depth + 0.6);
      }
      if (entry.warning) {
        entry.warning.setPosition(sprite.x, sprite.getTopCenter().y + 14).setDepth(sprite.depth + 1);
      }
      if (entry.ring) {
        const ring = entry.ring;
        const footY = entry.y + (entry.tough ? 20 : 16);
        ring.clear();
        ring.fillStyle(entry.ringColor, 0.12 + 0.2 * ring.progress);
        ring.fillEllipse(entry.x, footY, ring.radius * 2 * ring.progress, ring.radius * ring.progress);
        ring.lineStyle(2, entry.ringColor, 0.85);
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
      entry.outline?.destroy();
      entry.shape?.destroy();
    });
    this.sprites.clear();
    this.offSettings?.();
  }
}
