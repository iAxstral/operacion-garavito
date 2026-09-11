import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS, buildFloorLayout } from './mapLayout';

// --- Placeholder de respaldo (capsula de color generada en codigo) ---
// Para revertir rapido a este placeholder (sin depender de los atlas reales
// en frontend/public/sprites/), descomentar este import y los tres bloques
// marcados "Placeholder de respaldo" mas abajo, y comentar en su lugar el
// bloque "Atlas real" correspondiente en preload()/create().
// import { USE_REAL_SPRITESHEET, SEGURIDAD_SPRITE } from './spriteConfig';

const MAP_PIXEL_WIDTH = MAP_COLS * TILE;
const MAP_PIXEL_HEIGHT = MAP_ROWS * TILE;
const PLAYER_SPEED = 160;

const TILE_TEXTURE_FILES = {
  v2_floor_terrazo: 'v2_floor_terrazo_64.png',
  v2_floor_terrazo_var1: 'v2_floor_terrazo_var1_64.png',
  v2_floor_terrazo_var2: 'v2_floor_terrazo_var2_64.png',
  v2_floor_terrazo_var3: 'v2_floor_terrazo_var3_64.png',
  v2_floor_terrazo_var4: 'v2_floor_terrazo_var4_64.png',
  v2_wall_concreto: 'v2_wall_concreto_64.png',
  v2_vidrio_lamas: 'v2_vidrio_lamas_64.png',
  v2_escalera: 'v2_escalera_64.png',
  v2_baranda: 'v2_baranda_64.png',
  v2_columna: 'v2_columna_64x128.png',
  v2_door_madera: 'v2_door_madera_64x96.png',
  v2_banca: 'v2_banca_64x32.png',
};

// Tipos de celda del grid que bloquean el paso del jugador. 'floor'/'stair'/
// 'landing' son caminables; puertas y baranda se resuelven en 'decorations'
// porque se dibujan sobre una celda de piso, no la reemplazan.
const SOLID_GRID_TYPES = new Set(['wall', 'glass']);

// El rellano reutiliza la textura de piso pero con un tinte, para que se
// note como una plataforma aparte sin necesitar un asset nuevo.
const LANDING_TINT = 0xbfe0e6;

const STAIRS_ARROW_GLYPH = { up: '▲', down: '▼' };

const SEGURIDAD_ATLAS = {
  key: 'seguridad',
  texture: '/sprites/seguridad.png',
  atlas: '/sprites/seguridad.json',
};

// Ninguna lamina de origen tiene poses de perfil izquierdo: 'left' no es una
// animacion propia, reutiliza los frames de 'right' con el sprite espejado
// (setFlipX) en vez de arte duplicado.
const WALK_ANIM_BY_DIRECTION = {
  down: 'down',
  up: 'up',
  right: 'right',
  left: 'right',
};

const IDLE_FRAME_BY_DIRECTION = {
  down: 'down_idle_0',
  up: 'up_idle_0',
  right: 'right_0',
  left: 'right_0',
};

export default class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
    this.player = null;
    this.cursors = null;
    this.wasd = null;
    this.currentDirection = 'down';
    this.solids = null;
    this.stairsZones = [];
  }

  preload() {
    // --- Atlas real ---
    this.load.atlas(SEGURIDAD_ATLAS.key, SEGURIDAD_ATLAS.texture, SEGURIDAD_ATLAS.atlas);

    Object.entries(TILE_TEXTURE_FILES).forEach(([key, file]) => {
      this.load.image(key, `/tiles/${file}`);
    });

    // --- Placeholder de respaldo ---
    // if (USE_REAL_SPRITESHEET) {
    //   this.load.spritesheet(SEGURIDAD_SPRITE.key, SEGURIDAD_SPRITE.path, {
    //     frameWidth: SEGURIDAD_SPRITE.frameWidth,
    //     frameHeight: SEGURIDAD_SPRITE.frameHeight,
    //   });
    // }
  }

  create() {
    // Piso 1 por ahora: solo tiene escalera de subida (sin piso -1 al que
    // bajar). El cambio de piso real todavia no esta conectado.
    const layout = buildFloorLayout({ hasUpStairs: true, hasDownStairs: false });
    this.createMap(layout);
    this.createAnimations();

    // --- Atlas real ---
    this.player = this.physics.add.sprite(
      layout.spawn.x,
      layout.spawn.y,
      SEGURIDAD_ATLAS.key,
      IDLE_FRAME_BY_DIRECTION.down,
    );

    // --- Placeholder de respaldo ---
    // if (!USE_REAL_SPRITESHEET) {
    //   this.generatePlaceholderSpritesheet();
    // }
    // this.player = this.physics.add.sprite(layout.spawn.x, layout.spawn.y, SEGURIDAD_SPRITE.key, 0);

    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.physics.world.setBounds(0, 0, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT);
    this.physics.add.collider(this.player, this.solids);

    this.cameras.main.setBounds(0, 0, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

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
      this.player.setFlipX(direction === 'left');
      this.player.anims.play(WALK_ANIM_BY_DIRECTION[direction], true);
    } else {
      this.player.anims.stop();
      this.player.setFlipX(this.currentDirection === 'left');
      this.player.setTexture(SEGURIDAD_ATLAS.key, IDLE_FRAME_BY_DIRECTION[this.currentDirection]);
    }

    this.updateStairsZones();
  }

  /**
   * Zonas de escalera (subida y/o bajada, segun el piso): solo marcan el
   * overlap por ahora (sin cambio de piso real todavia). Cada una se
   * dispara una vez al entrar y una vez al salir, en vez de repetir el
   * mensaje en cada frame que el jugador se queda parado ahi.
   */
  updateStairsZones() {
    const body = this.player.body;

    this.stairsZones.forEach((stairs) => {
      const { rect } = stairs;
      const overlapping =
        body.x < rect.x + rect.w &&
        body.x + body.width > rect.x &&
        body.y < rect.y + rect.h &&
        body.y + body.height > rect.y;

      if (overlapping && !stairs.active) {
        stairs.active = true;
        stairs.label.setVisible(true);
        // eslint-disable-next-line no-console
        console.log(`[MainScene] Jugador sobre la escalera de ${stairs.kind === 'up' ? 'subida' : 'bajada'} — cambio de piso pendiente de implementar`);
      } else if (!overlapping && stairs.active) {
        stairs.active = false;
        stairs.label.setVisible(false);
      }
    });
  }

  createMap(layout) {
    this.solids = this.physics.add.staticGroup();
    this.stairsZones = [];

    this.renderGridTiles(layout.grid);
    this.renderDecorations(layout.decorations);
    this.renderFurniture(layout.furniture);
    this.renderLabels(layout.labels);

    [
      { kind: 'up', stairs: layout.upStairs },
      { kind: 'down', stairs: layout.downStairs },
    ]
      .filter((entry) => entry.stairs)
      .forEach(({ kind, stairs }) => {
        const label = this.add
          .text(
            stairs.zone.x,
            stairs.zone.y - 22,
            kind === 'up'
              ? '¡Escaleras arriba! (cambio de piso próximamente)'
              : '¡Escaleras abajo! (cambio de piso próximamente)',
            {
              fontFamily: 'sans-serif',
              fontSize: '13px',
              color: '#ffffff',
              backgroundColor: '#1f6f43',
              padding: { x: 6, y: 3 },
            },
          )
          .setDepth(20)
          .setVisible(false);

        this.stairsZones.push({ kind, rect: stairs.zone, active: false, label });
      });
  }

  renderGridTiles(grid) {
    for (let y = 0; y < MAP_ROWS; y += 1) {
      for (let x = 0; x < MAP_COLS; x += 1) {
        const cell = grid[y][x];
        if (!cell) continue;

        const cx = x * TILE + TILE / 2;
        const cy = y * TILE + TILE / 2;
        const image = this.add.image(cx, cy, cell.texture);

        if (cell.type === 'landing') {
          image.setTint(LANDING_TINT);
        }

        if (SOLID_GRID_TYPES.has(cell.type)) {
          this.solids.add(image);
        }
      }
    }
  }

  renderDecorations(decorations) {
    decorations.forEach((deco) => {
      if (deco.type === 'column') {
        const cx = deco.x * TILE + TILE / 2;
        const cy = deco.y * TILE + TILE; // el sprite mide 2 tiles (128px) de alto
        const image = this.add.image(cx, cy, 'v2_columna').setDepth(5);
        this.solids.add(image);
        return;
      }

      if (deco.type === 'bench') {
        const cx = deco.x * TILE + TILE / 2;
        const cy = deco.y * TILE + TILE / 2;
        const image = this.add.image(cx, cy, 'v2_banca');
        this.solids.add(image);
        return;
      }

      if (deco.type === 'railing') {
        const cx = deco.x * TILE + TILE / 2;
        const cy = deco.y * TILE + TILE / 2;
        const image = this.add.image(cx, cy, 'v2_baranda').setDepth(4);
        this.solids.add(image);
        return;
      }

      if (deco.type === 'stairs-arrow') {
        const cx = deco.x * TILE + TILE / 2;
        const cy = deco.y * TILE + TILE / 2;
        this.add
          .text(cx, cy, STAIRS_ARROW_GLYPH[deco.kind], {
            fontFamily: 'sans-serif',
            fontSize: '28px',
            color: '#ffffff',
          })
          .setOrigin(0.5)
          .setAlpha(0.55)
          .setDepth(2);
        return;
      }

      if (deco.type === 'door') {
        const cx = deco.x * TILE + TILE / 2;
        // La puerta mide 1.5 tiles (96px): sobresale medio tile hacia el
        // lado del vestibulo/conector, igual que en la referencia visual.
        const cy =
          deco.orientation === 'down'
            ? deco.y * TILE + 48 // top alineado con el techo de la fila de pared
            : (deco.y + 1) * TILE - 48; // bottom alineado con el piso de la fila de pared
        this.add.image(cx, cy, 'v2_door_madera').setDepth(8);
        // Las puertas son caminables: no se agregan a `solids`.
      }
    });
  }

  renderFurniture(furniture) {
    furniture.forEach((item) => {
      const rect = this.add.rectangle(item.x, item.y, item.w, item.h, item.color).setDepth(3);
      this.physics.add.existing(rect, true);
      this.solids.add(rect);
    });
  }

  renderLabels(labels) {
    labels.forEach((label) => {
      this.add
        .text(label.x, label.y, label.text, {
          fontFamily: 'sans-serif',
          fontSize: '13px',
          color: '#3a2f22',
          backgroundColor: '#e8e2d4',
          padding: { x: 4, y: 2 },
        })
        .setDepth(15);
    });
  }

  createAnimations() {
    const key = SEGURIDAD_ATLAS.key;

    this.anims.create({
      key: 'down_idle',
      frames: this.anims.generateFrameNames(key, { prefix: 'down_idle_', start: 0, end: 3 }),
      frameRate: 4,
      repeat: -1,
    });
    this.anims.create({
      key: 'up_idle',
      frames: this.anims.generateFrameNames(key, { prefix: 'up_idle_', start: 0, end: 3 }),
      frameRate: 4,
      repeat: -1,
    });
    this.anims.create({
      key: 'right',
      frames: this.anims.generateFrameNames(key, { prefix: 'right_', start: 0, end: 7 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: 'down',
      frames: this.anims.generateFrameNames(key, { prefix: 'down_', start: 0, end: 7 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: 'up',
      frames: this.anims.generateFrameNames(key, { prefix: 'up_', start: 0, end: 7 }),
      frameRate: 10,
      repeat: -1,
    });
    // 'left' reutiliza los frames de 'right' con flipX en vez de una
    // animacion propia (ver WALK_ANIM_BY_DIRECTION / update()).
  }

  // --- Placeholder de respaldo (comentado) ------------------------------
  // Genera una capsula de color con un indicador de direccion, numerada
  // exactamente igual a como Phaser numera un spritesheet cargado desde
  // archivo. Util para aislar bugs de input/fisica del problema de arte,
  // sin depender de los atlas reales. Para reactivar: descomentar esto,
  // el import de spriteConfig arriba, y los bloques "Placeholder de
  // respaldo" en preload()/create().
  //
  // generatePlaceholderSpritesheet() {
  //   const { key, frameWidth, frameHeight, framesPerDirection, rowOrder, color } = SEGURIDAD_SPRITE;
  //   const cols = framesPerDirection;
  //   const rows = rowOrder.length;
  //   const sheetWidth = frameWidth * cols;
  //   const sheetHeight = frameHeight * rows;
  //
  //   const gfx = this.make.graphics({ x: 0, y: 0, add: false });
  //
  //   rowOrder.forEach((direction, row) => {
  //     for (let col = 0; col < cols; col += 1) {
  //       const cx = col * frameWidth + frameWidth / 2;
  //       const cy = row * frameHeight + frameHeight / 2;
  //       const bob = Math.sin((col / cols) * Math.PI * 2) * 3;
  //
  //       gfx.fillStyle(color, 1);
  //       gfx.fillRoundedRect(
  //         cx - frameWidth * 0.28,
  //         cy - frameHeight * 0.36 + bob,
  //         frameWidth * 0.56,
  //         frameHeight * 0.62,
  //         6,
  //       );
  //
  //       gfx.fillStyle(0xe8c39e, 1);
  //       gfx.fillCircle(cx, cy - frameHeight * 0.28 + bob, frameWidth * 0.22);
  //
  //       gfx.fillStyle(0xffffff, 1);
  //       const indicator = MainScene.directionIndicatorOffset(direction, frameWidth, frameHeight);
  //       gfx.fillTriangle(
  //         cx + indicator.x, cy + indicator.y - 4,
  //         cx + indicator.x - 4, cy + indicator.y + 4,
  //         cx + indicator.x + 4, cy + indicator.y + 4,
  //       );
  //     }
  //   });
  //
  //   gfx.generateTexture(key, sheetWidth, sheetHeight);
  //   gfx.destroy();
  //
  //   const texture = this.textures.get(key);
  //   let frameIndex = 0;
  //   rowOrder.forEach((_, row) => {
  //     for (let col = 0; col < cols; col += 1) {
  //       texture.add(frameIndex, 0, col * frameWidth, row * frameHeight, frameWidth, frameHeight);
  //       frameIndex += 1;
  //     }
  //   });
  // }
  //
  // static directionIndicatorOffset(direction, frameWidth, frameHeight) {
  //   switch (direction) {
  //     case 'up':
  //       return { x: 0, y: -frameHeight * 0.32 };
  //     case 'left':
  //       return { x: -frameWidth * 0.3, y: 0 };
  //     case 'right':
  //       return { x: frameWidth * 0.3, y: 0 };
  //     case 'down':
  //     default:
  //       return { x: 0, y: frameHeight * 0.18 };
  //   }
  // }
}
