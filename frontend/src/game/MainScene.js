import Phaser from 'phaser';

import { USE_REAL_SPRITESHEET, SEGURIDAD_SPRITE } from './spriteConfig';
import { createEventBus } from './systems/eventBus.js';
import { createGameState } from './systems/gameState.js';
import { AXE_COST } from './systems/economy.js';
import {
  PLAY_AREA,
  WORLD,
  addVignette,
  buildCampus,
  isAtSecurityPost,
} from './world/campus';
import Player, { AXE } from './entities/Player';
import Zombie, { bakeZombieTextures } from './entities/Zombie';
import WaveDirector from './WaveDirector';

/**
 * The only gameplay scene. It owns the Phaser side of things — entities,
 * physics, camera — and forwards everything that matters to the rule modules
 * in `systems/` through the event bus (see GAMEPLAY.md).
 */
export default class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
    this.player = null;
    this.zombies = [];
    this.gameOver = false;
    this.hintVisible = false;
  }

  preload() {
    if (USE_REAL_SPRITESHEET) {
      this.load.spritesheet(SEGURIDAD_SPRITE.key, SEGURIDAD_SPRITE.path, {
        frameWidth: SEGURIDAD_SPRITE.frameWidth,
        frameHeight: SEGURIDAD_SPRITE.frameHeight,
      });
    }
  }

  create() {
    this.bus = createEventBus();
    this.gameState = createGameState(this.bus);

    const { obstacles } = buildCampus(this);

    if (!USE_REAL_SPRITESHEET) this.generatePlaceholderSpritesheet();
    this.createWalkAnimations();
    bakeZombieTextures(this);

    this.physics.world.setBounds(PLAY_AREA.x, PLAY_AREA.y, PLAY_AREA.width, PLAY_AREA.height);

    this.player = new Player(this, WORLD.width / 2, WORLD.height / 2, this.bus);
    this.zombieGroup = this.physics.add.group();

    this.physics.add.collider(this.player.sprite, obstacles);
    this.physics.add.collider(this.zombieGroup, obstacles);
    this.physics.add.overlap(
      this.player.sprite,
      this.zombieGroup,
      (_playerSprite, zombieSprite) => zombieSprite.owner?.touch(this.player),
    );

    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.startFollow(this.player.sprite, true, 0.09, 0.09);
    addVignette(this);

    this.waveDirector = new WaveDirector(
      this,
      this.bus,
      (x, y, stats) => this.spawnZombie(x, y, stats),
    );
    this.waveDirector.start();

    this.bindBus();

    this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.input.mouse?.disableContextMenu();

    this.scene.launch('HudScene', { bus: this.bus, gameState: this.gameState });
  }

  bindBus() {
    this.bus.on('weapon:equipped', () => this.player.equipAxe());

    this.bus.on('player:damaged', () => {
      this.cameras.main.shake(120, 0.006);
      this.cameras.main.flash(90, 120, 20, 20);
    });

    this.bus.on('player:died', () => {
      this.gameOver = true;
      this.player.sprite.body.setVelocity(0, 0);
    });

    this.bus.on('zombie:killed', () => this.cameras.main.shake(60, 0.002));
  }

  spawnZombie(x, y, stats) {
    const zombie = new Zombie(this, x, y, stats, this.bus);
    this.zombieGroup.add(zombie.sprite);
    this.zombies.push(zombie);
  }

  livingZombies() {
    return this.zombies.filter((zombie) => zombie.alive).length;
  }

  update(time, delta) {
    if (this.gameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.restartKey)) this.restart();
      return;
    }

    this.player.update(time, delta);

    // Dead zombies are dropped from the list once their fade-out finished, so
    // the separation loop below stays proportional to what is actually on
    // screen instead of to everything ever spawned.
    this.zombies = this.zombies.filter((zombie) => zombie.sprite.active);
    this.zombies.forEach((zombie) => zombie.update(this.player, this.zombies));

    this.waveDirector.update(this.livingZombies(), this.player);
    this.resolveAttack();
    this.resolveSecurityPost();
  }

  resolveAttack() {
    if (!this.player.wantsToAttack() || !this.player.canAttack()) return;

    const swing = this.player.beginAttack();
    this.zombies.forEach((zombie) => {
      if (zombie.alive && swing.hits(zombie)) {
        zombie.hit(AXE.damage, swing.angle, AXE.knockback);
      }
    });
  }

  resolveSecurityPost() {
    const near = isAtSecurityPost(this.player.x, this.player.y);
    const claimable = near && this.gameState.canClaimAxe();

    if (claimable !== this.hintVisible) {
      this.hintVisible = claimable;
      this.bus.emit(
        claimable ? 'hint:show' : 'hint:hide',
        { text: `E · Reclamar el hacha (${AXE_COST} Garavitos)` },
      );
    }

    if (claimable && this.player.wantsToInteract()) this.gameState.claimAxe();
  }

  restart() {
    this.zombies.forEach((zombie) => zombie.destroy());
    this.zombies = [];
    this.gameOver = false;
    this.hintVisible = false;

    this.player.reset(WORLD.width / 2, WORLD.height / 2);
    this.gameState.reset();
    this.waveDirector.start();
    this.bus.emit('game:restarted', {});
  }

  /**
   * Draws a role-colored placeholder onto a canvas texture, then registers
   * frames on it exactly the way Phaser numbers a loaded spritesheet
   * (row-major: row 0 = rowOrder[0], columns left-to-right). This keeps
   * `createWalkAnimations` identical whether the texture is generated here
   * or loaded from a real spritesheet file.
   */
  generatePlaceholderSpritesheet() {
    const { key, frameWidth, frameHeight, framesPerDirection, rowOrder, color } = SEGURIDAD_SPRITE;
    if (this.textures.exists(key)) return;

    const cols = framesPerDirection;
    const rows = rowOrder.length;
    const sheetWidth = frameWidth * cols;
    const sheetHeight = frameHeight * rows;

    const gfx = this.make.graphics({ x: 0, y: 0, add: false });

    rowOrder.forEach((direction, row) => {
      for (let col = 0; col < cols; col += 1) {
        const cx = col * frameWidth + frameWidth / 2;
        const cy = row * frameHeight + frameHeight / 2;
        const bob = Math.sin((col / cols) * Math.PI * 2) * 3;

        gfx.fillStyle(color, 1);
        gfx.fillRoundedRect(
          cx - frameWidth * 0.28,
          cy - frameHeight * 0.36 + bob,
          frameWidth * 0.56,
          frameHeight * 0.62,
          6,
        );

        gfx.fillStyle(0xe8c39e, 1);
        gfx.fillCircle(cx, cy - frameHeight * 0.28 + bob, frameWidth * 0.22);

        gfx.fillStyle(0xffffff, 1);
        const indicator = MainScene.directionIndicatorOffset(direction, frameWidth, frameHeight);
        gfx.fillTriangle(
          cx + indicator.x, cy + indicator.y - 4,
          cx + indicator.x - 4, cy + indicator.y + 4,
          cx + indicator.x + 4, cy + indicator.y + 4,
        );
      }
    });

    gfx.generateTexture(key, sheetWidth, sheetHeight);
    gfx.destroy();

    const texture = this.textures.get(key);
    let frameIndex = 0;
    rowOrder.forEach((_, row) => {
      for (let col = 0; col < cols; col += 1) {
        texture.add(frameIndex, 0, col * frameWidth, row * frameHeight, frameWidth, frameHeight);
        frameIndex += 1;
      }
    });
  }

  static directionIndicatorOffset(direction, frameWidth, frameHeight) {
    switch (direction) {
      case 'up':
        return { x: 0, y: -frameHeight * 0.32 };
      case 'left':
        return { x: -frameWidth * 0.3, y: 0 };
      case 'right':
        return { x: frameWidth * 0.3, y: 0 };
      case 'down':
      default:
        return { x: 0, y: frameHeight * 0.18 };
    }
  }

  createWalkAnimations() {
    const { key, framesPerDirection, rowOrder } = SEGURIDAD_SPRITE;

    rowOrder.forEach((direction, row) => {
      const animKey = `walk-${direction}`;
      if (this.anims.exists(animKey)) return;

      const start = row * framesPerDirection;
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(key, {
          start,
          end: start + framesPerDirection - 1,
        }),
        frameRate: 8,
        repeat: -1,
      });
    });
  }
}
