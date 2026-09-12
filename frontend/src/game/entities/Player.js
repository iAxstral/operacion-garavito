import Phaser from 'phaser';

import { SEGURIDAD_SPRITE } from '../spriteConfig';
import { DEPTH } from '../world/campus';

/**
 * Movement tuning. Parameterised so the other three roles can reuse this
 * controller with their own numbers when they exist (GAMEPLAY.md §1).
 */
export const PLAYER = {
  maxSpeed: 180,
  acceleration: 1400,
  drag: 1600,
  dashSpeed: 420,
  dashMs: 180,
  dashCooldownMs: 1200,
  maxHealth: 100,
  hurtInvulnerableMs: 700,
};

export const AXE = {
  damage: 2,
  range: 46,
  halfArcRad: Phaser.Math.DegToRad(45),
  cooldownMs: 400,
  knockback: 280,
};

const FACING_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

/**
 * Distance from the sprite's centre to where it touches the floor. Props are
 * drawn bottom-anchored, so comparing their Y against the player's *centre*
 * would sort the player behind things they are actually standing below.
 */
const FEET_OFFSET = SEGURIDAD_SPRITE.frameHeight / 2 - 2;

export default class Player {
  constructor(scene, x, y, bus) {
    this.scene = scene;
    this.bus = bus;
    this.facing = 'down';
    this.health = PLAYER.maxHealth;
    this.dashUntil = 0;
    this.dashReadyAt = 0;
    this.attackReadyAt = 0;
    this.invulnerableUntil = 0;
    this.hasAxe = false;

    this.sprite = scene.physics.add.sprite(x, y, SEGURIDAD_SPRITE.key, 0);
    this.sprite.setCollideWorldBounds(true);

    // The collision box is the character's feet, not the whole 32x48 frame.
    // Without this the player bumps into walls "with their head", which is the
    // classic top-down feel bug.
    this.sprite.body.setSize(20, 16).setOffset(6, 30);
    this.sprite.body.setDrag(PLAYER.drag, PLAYER.drag);
    // Velocity is clamped by magnitude below; the per-axis cap would let
    // diagonals run ~41% faster.
    this.sprite.body.setMaxVelocity(PLAYER.dashSpeed * 2);

    this.shadow = scene.add.ellipse(x, y, 26, 10, 0x000000, 0.3).setDepth(DEPTH.SHADOW);

    this.keys = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      dash: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      dashAlt: Phaser.Input.Keyboard.KeyCodes.SPACE,
      attack: Phaser.Input.Keyboard.KeyCodes.J,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
    });
    this.cursors = scene.input.keyboard.createCursorKeys();
  }

  get x() { return this.sprite.x; }

  get y() { return this.sprite.y; }

  get isDashing() { return this.scene.time.now < this.dashUntil; }

  get isInvulnerable() { return this.scene.time.now < this.invulnerableUntil; }

  get dashCooldownRatio() {
    const remaining = this.dashReadyAt - this.scene.time.now;
    return remaining <= 0 ? 1 : 1 - remaining / PLAYER.dashCooldownMs;
  }

  equipAxe() {
    this.hasAxe = true;
  }

  wantsToInteract() {
    return Phaser.Input.Keyboard.JustDown(this.keys.interact);
  }

  /** Held rather than tapped: the attack cooldown already paces the swings. */
  wantsToAttack() {
    return this.keys.attack.isDown || this.scene.input.activePointer.leftButtonDown();
  }

  /** Soft restart, so the scene never has to be torn down and rebuilt. */
  reset(x, y) {
    this.health = PLAYER.maxHealth;
    this.hasAxe = false;
    this.facing = 'down';
    this.dashUntil = 0;
    this.dashReadyAt = 0;
    this.attackReadyAt = 0;
    // A moment of grace so the player is not hit by a leftover zombie the
    // instant they respawn.
    this.invulnerableUntil = this.scene.time.now + PLAYER.hurtInvulnerableMs;

    this.sprite.setPosition(x, y).setAlpha(1);
    this.sprite.body.setVelocity(0, 0);
    this.sprite.body.setAcceleration(0, 0);
  }

  update() {
    const now = this.scene.time.now;
    const body = this.sprite.body;

    const input = new Phaser.Math.Vector2(
      (this.keys.right.isDown || this.cursors.right.isDown ? 1 : 0)
        - (this.keys.left.isDown || this.cursors.left.isDown ? 1 : 0),
      (this.keys.down.isDown || this.cursors.down.isDown ? 1 : 0)
        - (this.keys.up.isDown || this.cursors.up.isDown ? 1 : 0),
    );
    // Normalising is what makes diagonal movement the same speed as cardinal.
    if (input.lengthSq() > 0) input.normalize();

    if (this.isDashing) {
      body.setAcceleration(0, 0);
      body.velocity.limit(PLAYER.dashSpeed);
    } else {
      if (input.lengthSq() > 0) this.facing = Player.facingFor(input);
      body.setAcceleration(input.x * PLAYER.acceleration, input.y * PLAYER.acceleration);
      body.velocity.limit(PLAYER.maxSpeed);

      const wantsDash = this.keys.dash.isDown || this.keys.dashAlt.isDown;
      if (wantsDash && now >= this.dashReadyAt) this.startDash(input);
    }

    this.syncVisuals();
  }

  startDash(input) {
    const direction = input.lengthSq() > 0
      ? input
      : new Phaser.Math.Vector2(Math.cos(this.facingAngle()), Math.sin(this.facingAngle()));

    this.sprite.body.setVelocity(direction.x * PLAYER.dashSpeed, direction.y * PLAYER.dashSpeed);
    this.dashUntil = this.scene.time.now + PLAYER.dashMs;
    this.dashReadyAt = this.scene.time.now + PLAYER.dashCooldownMs;
    // I-frames are what turn the dash into a defensive tool rather than just a
    // faster way to walk — it is the only escape available before the axe.
    this.invulnerableUntil = Math.max(this.invulnerableUntil, this.dashUntil);
    this.spawnDashTrail();
    this.bus.emit('player:dashed', {});
  }

  spawnDashTrail() {
    const ghost = this.scene.add.sprite(this.sprite.x, this.sprite.y, this.sprite.texture.key, this.sprite.frame.name);
    ghost.setDepth(this.sprite.y + FEET_OFFSET - 1).setAlpha(0.45).setTint(0x7ec8ff);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 220,
      onComplete: () => ghost.destroy(),
    });
  }

  syncVisuals() {
    const body = this.sprite.body;
    // Depth follows the feet so the player walks behind props above them and in
    // front of props below them.
    this.sprite.setDepth(this.sprite.y + FEET_OFFSET);
    this.shadow.setPosition(this.sprite.x, this.sprite.y + FEET_OFFSET);
    this.shadow.setScale(this.isDashing ? 0.7 : 1);

    // Animation driven by actual velocity, not by the key held, so the dash and
    // the drag-out after releasing a key both animate correctly.
    if (body.velocity.lengthSq() > 400) {
      this.sprite.anims.play(`walk-${this.facing}`, true);
    } else {
      this.sprite.anims.stop();
      const row = SEGURIDAD_SPRITE.rowOrder.indexOf(this.facing);
      this.sprite.setFrame(row * SEGURIDAD_SPRITE.framesPerDirection);
    }

    this.sprite.setAlpha(this.isInvulnerable && !this.isDashing
      ? 0.4 + 0.6 * Math.abs(Math.sin(this.scene.time.now / 60))
      : 1);
  }

  facingAngle() {
    return FACING_ANGLE[this.facing];
  }

  static facingFor(vector) {
    if (Math.abs(vector.x) >= Math.abs(vector.y)) return vector.x > 0 ? 'right' : 'left';
    return vector.y > 0 ? 'down' : 'up';
  }

  canAttack() {
    return this.hasAxe && this.scene.time.now >= this.attackReadyAt && !this.isDashing;
  }

  /**
   * Starts an axe swing and returns the hit test for it. The caller applies the
   * damage, so the player does not need to know what a zombie is.
   */
  beginAttack() {
    this.attackReadyAt = this.scene.time.now + AXE.cooldownMs;
    const angle = this.facingAngle();
    this.drawSwing(angle);
    this.bus.emit('player:attacked', {});

    const origin = { x: this.sprite.x, y: this.sprite.y };
    return {
      angle,
      hits: (target) => {
        const distance = Phaser.Math.Distance.Between(origin.x, origin.y, target.x, target.y);
        if (distance > AXE.range + 16) return false;
        const toTarget = Math.atan2(target.y - origin.y, target.x - origin.x);
        return Math.abs(Phaser.Math.Angle.Wrap(toTarget - angle)) <= AXE.halfArcRad;
      },
    };
  }

  drawSwing(angle) {
    const arc = this.scene.add.graphics();
    arc.setDepth(this.sprite.y + FEET_OFFSET + 1);
    arc.fillStyle(0xfff2c4, 0.5);
    arc.slice(
      this.sprite.x,
      this.sprite.y,
      AXE.range + 16,
      angle - AXE.halfArcRad,
      angle + AXE.halfArcRad,
    );
    arc.fillPath();
    this.scene.tweens.add({
      targets: arc,
      alpha: 0,
      duration: 160,
      onComplete: () => arc.destroy(),
    });
  }

  takeDamage(amount) {
    if (this.isInvulnerable || this.health <= 0) return false;

    this.health = Math.max(0, this.health - amount);
    this.invulnerableUntil = this.scene.time.now + PLAYER.hurtInvulnerableMs;
    this.bus.emit('player:damaged', { health: this.health, max: PLAYER.maxHealth });

    if (this.health === 0) this.bus.emit('player:died', {});
    return true;
  }

  destroy() {
    this.shadow.destroy();
    this.sprite.destroy();
  }
}
