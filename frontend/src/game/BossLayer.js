import Phaser from 'phaser';

/**
 * Dibuja al jefe "Ingeniero de Sistemas" que manda el servidor (Kinder 5).
 *
 * Igual que ZombieLayer, el cliente no decide nada: interpola hacia la posicion del
 * ultimo paquete y deduce hacia donde mira con atan2 entre dos posiciones seguidas,
 * redondeado a la mas cercana de las 8 direcciones del atlas.
 *
 * Atlas (public/bosses/boss_ingeniero.png): celdas de 256x256, 8 columnas.
 *   fila 0: las 8 rotaciones quieto (sur, sureste, este, noreste, norte, noroeste, oeste, suroeste)
 *   filas 1-8: "Crouched Walking" de 6 frames, una fila por direccion en ese mismo orden.
 */

export const BOSS_TEXTURE = 'boss_ingeniero';
const CELL = 256;
const COLUMNS = 8;
const WALK_FRAMES = 6;
const SCALE = 0.85;
const LERP_PER_SECOND = 10;
/** Menos que esto entre paquetes es ruido, no un cambio de direccion. */
const MIN_MOVE_PX = 2;
/** Sin moverse este tiempo, pasa a la pose quieta. */
const IDLE_AFTER_MS = 350;

const BAR_WIDTH = 120;
const BAR_OFFSET_Y = -200;

// Octante de atan2 (0 = este, en sentido horario porque y crece hacia abajo) → columna
// del atlas (0 = sur, 1 = sureste, 2 = este, ...).
const OCTANT_TO_SHEET = [2, 1, 0, 7, 6, 5, 4, 3];

export function preloadBoss(scene) {
  scene.load.spritesheet(BOSS_TEXTURE, '/bosses/boss_ingeniero.png', { frameWidth: CELL, frameHeight: CELL });
}

/** Direccion del atlas (0-7) mas cercana al vector (dx, dy) en pantalla. */
export function sheetDirection(dx, dy) {
  const octant = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
  return OCTANT_TO_SHEET[octant];
}

function walkKey(direction) {
  return `boss_walk_${direction}`;
}

export default class BossLayer {
  constructor(scene) {
    this.scene = scene;
    this.entry = null;

    for (let direction = 0; direction < COLUMNS; direction += 1) {
      const key = walkKey(direction);
      if (scene.anims.exists(key)) continue;
      const row = 1 + direction;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(BOSS_TEXTURE, {
          start: row * COLUMNS,
          end: row * COLUMNS + WALK_FRAMES - 1,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  /** Reconcilia con el jefe que llego del servidor (o null si no hay / esta en otro piso). */
  sync(boss) {
    if (!boss) {
      if (this.entry) this.despawn(this.entry);
      this.entry = null;
      return;
    }
    if (this.entry && this.entry.id !== boss.id) {
      this.despawn(this.entry);
      this.entry = null;
    }
    if (!this.entry) {
      this.entry = this.spawn(boss);
    }

    const entry = this.entry;
    const dx = boss.x - entry.targetX;
    const dy = boss.y - entry.targetY;
    if (Math.hypot(dx, dy) > MIN_MOVE_PX) {
      entry.direction = sheetDirection(dx, dy);
      entry.lastMovedAt = this.scene.time.now;
    }
    entry.targetX = boss.x;
    entry.targetY = boss.y;
    if (boss.health < entry.health) this.flash(entry);
    entry.health = boss.health;
    entry.maxHealth = boss.maxHealth;
    entry.state = boss.state;
  }

  spawn(boss) {
    const sprite = this.scene.add.sprite(boss.x, boss.y, BOSS_TEXTURE, 0);
    sprite.setOrigin(0.5, 0.95).setScale(SCALE * 0.4).setDepth(boss.y);
    this.scene.tweens.add({ targets: sprite, scale: SCALE, duration: 420, ease: 'Back.easeOut' });

    const shadow = this.scene.add.ellipse(boss.x, boss.y, 90, 26, 0x000000, 0.35).setDepth(1);
    const bar = this.scene.add.graphics().setDepth(9000);
    const label = this.scene.add
      .text(boss.x, boss.y + BAR_OFFSET_Y - 16, boss.name, {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffd6d6',
        stroke: '#2a0000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(9000);

    return {
      id: boss.id,
      sprite,
      shadow,
      bar,
      label,
      targetX: boss.x,
      targetY: boss.y,
      direction: 0,
      lastMovedAt: 0,
      health: boss.health,
      maxHealth: boss.maxHealth,
      state: boss.state,
      stunTinted: false,
    };
  }

  flash(entry) {
    entry.sprite.setTint(0xff5555).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(90, () => {
      if (entry.sprite.active) entry.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }

  despawn(entry) {
    entry.bar.destroy();
    entry.label.destroy();
    this.scene.tweens.add({
      targets: [entry.sprite, entry.shadow],
      alpha: 0,
      duration: 500,
      onComplete: () => {
        entry.sprite.destroy();
        entry.shadow.destroy();
      },
    });
  }

  update(delta) {
    const entry = this.entry;
    if (!entry) return;
    const { sprite } = entry;
    const t = Math.min(1, (delta / 1000) * LERP_PER_SECOND);
    sprite.x += (entry.targetX - sprite.x) * t;
    sprite.y += (entry.targetY - sprite.y) * t;
    sprite.setDepth(sprite.y);
    entry.shadow.setPosition(sprite.x, sprite.y - 4);

    const stunned = entry.state === 'ATURDIDO';
    const moving = !stunned && this.scene.time.now - entry.lastMovedAt < IDLE_AFTER_MS;
    if (moving) {
      sprite.anims.play(walkKey(entry.direction), true);
    } else {
      sprite.anims.stop();
      sprite.setFrame(entry.direction);
    }
    // Aturdido: tinte amarillento mientras dura (el servidor manda el estado).
    if (stunned !== entry.stunTinted) {
      entry.stunTinted = stunned;
      if (stunned) sprite.setTint(0xfff2a0);
      else sprite.clearTint();
    }

    const barX = sprite.x - BAR_WIDTH / 2;
    const barY = sprite.y + BAR_OFFSET_Y;
    const ratio = entry.maxHealth > 0 ? entry.health / entry.maxHealth : 0;
    entry.bar.clear();
    entry.bar.fillStyle(0x1a0000, 0.85).fillRect(barX - 2, barY - 2, BAR_WIDTH + 4, 12);
    entry.bar.fillStyle(0xc0392b, 1).fillRect(barX, barY, BAR_WIDTH * ratio, 8);
    entry.label.setPosition(sprite.x, barY - 12);
  }

  destroy() {
    if (!this.entry) return;
    this.entry.sprite.destroy();
    this.entry.shadow.destroy();
    this.entry.bar.destroy();
    this.entry.label.destroy();
    this.entry = null;
  }
}
