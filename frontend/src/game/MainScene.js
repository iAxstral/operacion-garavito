import Phaser from 'phaser';
import { USE_REAL_SPRITESHEET, SEGURIDAD_SPRITE } from './spriteConfig';

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;
const PLAYER_SPEED = 160;
const WALL_THICKNESS = 16;

export default class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
    this.player = null;
    this.cursors = null;
    this.wasd = null;
    this.currentDirection = 'down';
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
    this.createStaticMap();

    if (!USE_REAL_SPRITESHEET) {
      this.generatePlaceholderSpritesheet();
    }
    this.createWalkAnimations();

    this.player = this.physics.add.sprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, SEGURIDAD_SPRITE.key, 0);
    this.player.setCollideWorldBounds(true);
    // Bounds sit on the inner edge of the painted walls so the player
    // collides with them instead of walking over them.
    this.physics.world.setBounds(
      WALL_THICKNESS,
      WALL_THICKNESS,
      WORLD_WIDTH - WALL_THICKNESS * 2,
      WORLD_HEIGHT - WALL_THICKNESS * 2,
    );

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
  }

  update() {
    if (!this.player) return;

    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;
    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;

    let vx = 0;
    let vy = 0;
    let direction = null;

    if (left) {
      vx = -PLAYER_SPEED;
      direction = 'left';
    } else if (right) {
      vx = PLAYER_SPEED;
      direction = 'right';
    }

    if (up) {
      vy = -PLAYER_SPEED;
      direction = direction ?? 'up';
    } else if (down) {
      vy = PLAYER_SPEED;
      direction = direction ?? 'down';
    }

    this.player.setVelocity(vx, vy);

    if (direction) {
      this.currentDirection = direction;
      this.player.anims.play(`walk-${direction}`, true);
    } else {
      this.player.anims.stop();
      const row = SEGURIDAD_SPRITE.rowOrder.indexOf(this.currentDirection);
      this.player.setFrame(row * SEGURIDAD_SPRITE.framesPerDirection);
    }
  }

  createStaticMap() {
    // Placeholder single-screen "zona del campus" until a real Tiled map lands.
    const floor = this.add.graphics();
    floor.fillStyle(0xcfc9b8, 1);
    floor.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    floor.lineStyle(1, 0xb8b09a, 1);
    for (let x = 0; x <= WORLD_WIDTH; x += 40) {
      floor.lineBetween(x, 0, x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += 40) {
      floor.lineBetween(0, y, WORLD_WIDTH, y);
    }

    const walls = this.add.graphics();
    walls.fillStyle(0x5b4636, 1);
    walls.fillRect(0, 0, WORLD_WIDTH, WALL_THICKNESS);
    walls.fillRect(0, WORLD_HEIGHT - WALL_THICKNESS, WORLD_WIDTH, WALL_THICKNESS);
    walls.fillRect(0, 0, WALL_THICKNESS, WORLD_HEIGHT);
    walls.fillRect(WORLD_WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, WORLD_HEIGHT);

    this.add.text(24, 24, 'Edificio F — Zona de prueba (Sprint 1)', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#5b4636',
    });
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
      const start = row * framesPerDirection;
      const end = start + framesPerDirection - 1;

      this.anims.create({
        key: `walk-${direction}`,
        frames: this.anims.generateFrameNumbers(key, { start, end }),
        frameRate: 8,
        repeat: -1,
      });
    });
  }
}
