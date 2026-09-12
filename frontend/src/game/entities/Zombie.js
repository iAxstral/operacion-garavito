import Phaser from 'phaser';

import { DEPTH } from '../world/campus';
import { ZOMBIE_TOUGH_HEALTH } from '../systems/waves.js';

const TEXTURE = 'zombie';
const TOUGH_TEXTURE = 'zombie-teso';

const CONTACT_DAMAGE = 10;
const CONTACT_COOLDOWN_MS = 600;
const KNOCKBACK_MS = 180;
/** How hard zombies push each other apart so they do not stack into one dot. */
const SEPARATION_FORCE = 90;
const SEPARATION_RADIUS = 26;

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
  // Arms out front: the silhouette has to read at a glance while moving.
  g.fillStyle(rot, 1);
  g.fillRect(w * 0.06, h * 0.42, w * 0.16, h * 0.12);
  g.fillRect(w * 0.78, h * 0.42, w * 0.16, h * 0.12);

  g.generateTexture(key, w, h);
  g.destroy();
}

export function bakeZombieTextures(scene) {
  bakeTexture(scene, TEXTURE, { body: 0x4a6b38, rot: 0x86a86a, w: 28, h: 40 });
  bakeTexture(scene, TOUGH_TEXTURE, { body: 0x6b3838, rot: 0xa86a6a, w: 34, h: 48 });
}

export default class Zombie {
  constructor(scene, x, y, { health, speed }, bus) {
    this.scene = scene;
    this.bus = bus;
    this.health = health;
    this.speed = speed;
    this.tough = health >= ZOMBIE_TOUGH_HEALTH;
    this.nextContactAt = 0;
    this.knockbackUntil = 0;
    this.dying = false;

    this.sprite = scene.physics.add.sprite(x, y, this.tough ? TOUGH_TEXTURE : TEXTURE);
    this.sprite.owner = this;
    this.sprite.body.setSize(18, 14).setOffset(this.tough ? 8 : 5, this.tough ? 32 : 24);
    this.sprite.body.setCollideWorldBounds(true);

    // Same rule as the player: sort by where the sprite meets the floor, not
    // by its centre, so Y-sorting agrees with the bottom-anchored props.
    this.feetOffset = this.sprite.height / 2 - 2;
    this.sprite.setDepth(y + this.feetOffset);

    this.shadow = scene.add.ellipse(x, y + this.feetOffset, this.tough ? 28 : 22, 9, 0x000000, 0.28)
      .setDepth(DEPTH.SHADOW);

    // Desynchronised wobble, otherwise a wave shambles in lockstep like a
    // marching band.
    scene.tweens.add({
      targets: this.sprite,
      angle: { from: -6, to: 6 },
      duration: 320 + Math.random() * 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Spawn "pop" so zombies do not simply blink into existence.
    this.sprite.setScale(0.5);
    scene.tweens.add({ targets: this.sprite, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  get x() { return this.sprite.x; }

  get y() { return this.sprite.y; }

  get alive() { return !this.dying && this.health > 0; }

  update(target, others) {
    if (!this.alive) return;

    if (this.scene.time.now >= this.knockbackUntil) {
      const steer = new Phaser.Math.Vector2(target.x - this.x, target.y - this.y);
      if (steer.lengthSq() > 1) steer.normalize().scale(this.speed);

      others.forEach((other) => {
        if (other === this || !other.alive) return;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > SEPARATION_RADIUS * SEPARATION_RADIUS || distSq === 0) return;
        const dist = Math.sqrt(distSq);
        steer.x += (dx / dist) * SEPARATION_FORCE;
        steer.y += (dy / dist) * SEPARATION_FORCE;
      });

      this.sprite.body.setVelocity(steer.x, steer.y);
      this.sprite.setFlipX(steer.x < 0);
    }

    this.sprite.setDepth(this.y + this.feetOffset);
    this.shadow.setPosition(this.x, this.y + this.feetOffset);
  }

  /** Returns true when the touch actually landed damage on the player. */
  touch(player) {
    if (!this.alive || this.scene.time.now < this.nextContactAt) return false;
    this.nextContactAt = this.scene.time.now + CONTACT_COOLDOWN_MS;
    return player.takeDamage(CONTACT_DAMAGE);
  }

  hit(damage, fromAngle, knockback) {
    if (!this.alive) return;

    this.health -= damage;
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.alive && this.sprite.clearTint());

    if (this.health <= 0) {
      this.die();
      return;
    }

    this.sprite.body.setVelocity(Math.cos(fromAngle) * knockback, Math.sin(fromAngle) * knockback);
    this.knockbackUntil = this.scene.time.now + KNOCKBACK_MS;
  }

  die() {
    this.dying = true;
    this.sprite.body.setVelocity(0, 0);
    this.sprite.body.enable = false;

    this.scene.add.ellipse(this.x, this.y + this.feetOffset, 26, 12, 0x5a1f1f, 0.5)
      .setDepth(DEPTH.SHADOW + 1);

    this.scene.tweens.add({
      targets: [this.sprite, this.shadow],
      alpha: 0,
      scaleY: 0.4,
      duration: 220,
      onComplete: () => this.destroy(),
    });

    this.bus.emit('zombie:killed', { tough: this.tough });
  }

  destroy() {
    this.shadow.destroy();
    this.sprite.destroy();
  }
}
