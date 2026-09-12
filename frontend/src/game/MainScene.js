import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS, buildFloorLayout } from './mapLayout';
import { FOOD_ITEMS, PICKUP_RANGE_PX } from './itemCatalog';
import { VENDORS, SHOP_RANGE_PX } from './shopCatalog';
import { MISSION_ZONES, MISSION_RANGE_PX } from './missionCatalog';
import {
  ensureJoined,
  getZombies,
  onStateChange,
  reportPosition,
  requestAttack,
  requestPickup,
  setNearVendor,
  requestMissionComplete,
} from './gameSync';
import ZombieLayer from './ZombieLayer';

// Dash: unico recurso defensivo antes de conseguir un arma. La
// invulnerabilidad es lo que lo vuelve una herramienta y no solo una forma
// de ir mas rapido.
const DASH_SPEED = 420;
const DASH_MS = 180;
const DASH_COOLDOWN_MS = 1200;

// El servidor valida su propio cooldown de ataque; este solo evita inundar
// el socket con golpes que van a ser rechazados.
const ATTACK_REQUEST_MS = 400;

const FACING_RADIANS = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

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
  v2_door_madera_open: 'v2_door_madera_open_64x96.png',
  v2_banca: 'v2_banca_64x32.png',
};

// Distancia (px) del jugador al centro de una puerta para considerarla
// "abierta" — un poco mas de un tile, para que el cambio de textura no se
// sienta pegado al umbral exacto.
const DOOR_PROXIMITY_PX = 90;

// Ventana de gracia (ms) para seguir animando la caminata cuando NINGUNA
// tecla de direccion esta activa. Un teclado real casi nunca suelta una
// tecla y presiona la opuesta (ej. Left -> Right) en el mismo frame — hay
// un hueco de varios frames sin ninguna tecla activa mientras la mano se
// mueve. Sin esta ventana, ese hueco se lee como "se solto todo" y la
// animacion salta a idle por 1-varios frames antes de retomar la caminata,
// el "salta y despues va hacia donde quiere" reportado. 120ms alcanza para
// cubrir un cambio de tecla humano tipico sin sentirse como input-lag en
// una parada real.
const DIRECTION_HOLD_MS = 120;

// Tipos de celda del grid que bloquean el paso del jugador. 'floor'/'stair'/
// 'landing' son caminables; puertas y baranda se resuelven en 'decorations'
// porque se dibujan sobre una celda de piso, no la reemplazan.
const SOLID_GRID_TYPES = new Set(['wall', 'glass']);

// El rellano reutiliza la textura de piso pero con un tinte, para que se
// note como una plataforma aparte sin necesitar un asset nuevo.
const LANDING_TINT = 0xbfe0e6;

const STAIRS_ARROW_GLYPH = { up: '▲', down: '▼' };

// Placeholder de color por tipo de item recolectable (mismo criterio que el
// HUD en Hud.jsx) — se reemplaza por sprites reales mas adelante.
const ITEM_TYPE_COLORS = { WEAPON: 0x8a3b3b, FOOD: 0x3b8a4e, AMMO: 0x8a7a3b };

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
    this.lastMoveAt = 0;
    this.solids = null;
    this.stairsZones = [];
    this.doors = [];
    this.foodItems = [];
    this.vendors = [];
    this.missionZones = [];
    this.unsubscribeGameState = null;
    this.zombieLayer = null;
    this.facing = 'down';
    this.dashUntil = 0;
    this.dashReadyAt = 0;
    this.dashVx = 0;
    this.dashVy = 0;
    this.nextAttackAt = 0;
  }

  preload() {
    // --- Atlas real ---
    this.load.atlas(SEGURIDAD_ATLAS.key, SEGURIDAD_ATLAS.texture, SEGURIDAD_ATLAS.atlas);

    Object.entries(TILE_TEXTURE_FILES).forEach(([key, file]) => {
      this.load.image(key, `/tiles/${file}`);
    });

    VENDORS.forEach((vendor) => {
      this.load.image(vendor.sprite, vendor.spriteFile);
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
    this.dashKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.input.mouse?.disableContextMenu();
    this.zombieLayer = new ZombieLayer(this);
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.createFoodItems();
    this.createVendors();
    this.createMissionZones();
    ensureJoined();
    this.events.once('shutdown', () => {
      this.unsubscribeGameState?.();
      setNearVendor(null);
    });
  }

  /**
   * NPC de la vendedora + maquina expendedora: sprites estaticos en
   * posiciones fijas (VENDORS en shopCatalog.js). Solidos (no se puede
   * caminar sobre ellos) — la interaccion es por proximidad, no por
   * overlap fisico (ver updateVendorProximity).
   */
  createVendors() {
    this.vendors = VENDORS.map((vendor) => {
      const image = this.add.image(vendor.x, vendor.y, vendor.sprite).setDepth(6);
      this.solids.add(image);
      return { ...vendor, inRange: false };
    });
  }

  /**
   * Zonas de mision (una por rol): se completan automaticamente al
   * pisarlas, mismo patron de "disparar en el flanco de entrada" que la
   * comida y las escaleras — no solidas, no requieren tecla.
   */
  createMissionZones() {
    this.missionZones = MISSION_ZONES.map((zone) => {
      this.add
        .text(zone.x, zone.y, `Misión\n(${zone.role})`, {
          fontFamily: 'sans-serif',
          fontSize: '11px',
          color: '#ffffff',
          align: 'center',
          backgroundColor: '#5b3fa0',
          padding: { x: 4, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(4)
        .setAlpha(0.85);
      return { ...zone, inRange: false };
    });
  }

  /**
   * Items de comida de la Cafeteria: placeholder de color, no solidos.
   * `applyClaimedItems` oculta los que el backend ya marco como reclamados
   * (por este jugador o por otro) — la unica fuente de verdad de "que
   * queda en el mapa" es el broadcast, no un estado local aparte.
   */
  createFoodItems() {
    this.foodItems = FOOD_ITEMS.map((item) => {
      const rect = this.add
        .rectangle(item.x, item.y, 26, 26, ITEM_TYPE_COLORS[item.type])
        .setStrokeStyle(2, 0x1f5c2e)
        .setDepth(3);
      return { ...item, rect, inRange: false };
    });

    this.unsubscribeGameState = onStateChange((state) => {
      const claimed = new Set(state.claimedItemIds);
      this.foodItems.forEach((food) => food.rect.setVisible(!claimed.has(food.itemId)));
    });
  }

  updateFoodProximity() {
    const px = this.player.x;
    const py = this.player.y;

    this.foodItems.forEach((food) => {
      if (!food.rect.visible) return; // ya reclamado, no hay nada que recoger

      const dx = px - food.x;
      const dy = py - food.y;
      const withinRange = dx * dx + dy * dy <= PICKUP_RANGE_PX * PICKUP_RANGE_PX;

      if (withinRange && !food.inRange) {
        food.inRange = true;
        requestPickup(food.itemId, px, py);
      } else if (!withinRange && food.inRange) {
        food.inRange = false;
      }
    });
  }

  update(time, delta) {
    if (!this.player) return;

    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;
    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;

    let vx = (right ? 1 : 0) - (left ? 1 : 0);
    let vy = (down ? 1 : 0) - (up ? 1 : 0);
    let direction = null;

    if (left) direction = 'left';
    else if (right) direction = 'right';
    if (up) direction = direction ?? 'up';
    else if (down) direction = direction ?? 'down';

    // Normalizar es lo que hace que la diagonal vaya igual de rapido que la
    // horizontal: con velocidad por eje, moverse en diagonal daba ~41% extra.
    const magnitude = Math.hypot(vx, vy);
    if (magnitude > 0) {
      vx = (vx / magnitude) * PLAYER_SPEED;
      vy = (vy / magnitude) * PLAYER_SPEED;
    }

    if (direction) this.facing = direction;

    if (time < this.dashUntil) {
      // Durante el dash se conserva la velocidad que se fijo al arrancarlo,
      // aunque el jugador suelte las teclas.
      this.player.setVelocity(this.dashVx, this.dashVy);
    } else {
      this.player.setVelocity(vx, vy);

      if (this.dashKey.isDown && time >= this.dashReadyAt) {
        // vx/vy ya vienen escalados a PLAYER_SPEED, asi que dividir devuelve
        // el vector unitario. Sin teclas, el dash sale hacia donde se mira.
        const dx = magnitude > 0 ? vx / PLAYER_SPEED : Math.cos(FACING_RADIANS[this.facing]);
        const dy = magnitude > 0 ? vy / PLAYER_SPEED : Math.sin(FACING_RADIANS[this.facing]);
        this.dashVx = dx * DASH_SPEED;
        this.dashVy = dy * DASH_SPEED;
        this.dashUntil = time + DASH_MS;
        this.dashReadyAt = time + DASH_COOLDOWN_MS;
        this.spawnDashTrail();
      }
    }

    reportPosition(Math.round(this.player.x), Math.round(this.player.y), time);
    this.updateAttack(time);
    this.zombieLayer.sync(getZombies());
    this.zombieLayer.update(delta);

    if (direction) {
      this.currentDirection = direction;
      this.lastMoveAt = this.time.now;
      this.player.setFlipX(direction === 'left');
      this.player.anims.play(WALK_ANIM_BY_DIRECTION[direction], true);
    } else if (this.time.now - this.lastMoveAt < DIRECTION_HOLD_MS) {
      // Hueco corto sin ninguna tecla activa (probable cambio de direccion
      // en curso): seguir mostrando la caminata de la ultima direccion en
      // vez de cortar a idle — ver DIRECTION_HOLD_MS.
      this.player.setFlipX(this.currentDirection === 'left');
      this.player.anims.play(WALK_ANIM_BY_DIRECTION[this.currentDirection], true);
    } else {
      this.player.anims.stop();
      this.player.setFlipX(this.currentDirection === 'left');
      this.player.setTexture(SEGURIDAD_ATLAS.key, IDLE_FRAME_BY_DIRECTION[this.currentDirection]);
    }

    this.updateStairsZones();
    this.updateDoorProximity();
    this.updateFoodProximity();
    this.updateVendorProximity();
    this.updateMissionProximity();
  }

  /**
   * Pide un golpe al servidor y lo anima localmente. El arco que se dibuja es
   * solo feedback: quien decide si algo fue golpeado es el backend, que valida
   * arma, cooldown, alcance y angulo.
   */
  updateAttack(time) {
    const wants = this.attackKey.isDown || this.input.activePointer.leftButtonDown();
    if (!wants || time < this.nextAttackAt) return;

    this.nextAttackAt = time + ATTACK_REQUEST_MS;
    const facing = FACING_RADIANS[this.facing];
    requestAttack(Math.round(this.player.x), Math.round(this.player.y), facing);
    this.drawSwing(facing);
  }

  drawSwing(facing) {
    const arc = this.add.graphics();
    arc.setDepth(this.player.y + 1);
    arc.fillStyle(0xfff2c4, 0.45);
    arc.slice(this.player.x, this.player.y, 62, facing - Math.PI / 4, facing + Math.PI / 4);
    arc.fillPath();
    this.tweens.add({ targets: arc, alpha: 0, duration: 160, onComplete: () => arc.destroy() });
  }

  spawnDashTrail() {
    const ghost = this.add.sprite(this.player.x, this.player.y, this.player.texture.key, this.player.frame.name);
    ghost.setDepth(this.player.depth - 1).setAlpha(0.45).setTint(0x7ec8ff).setFlipX(this.player.flipX);
    this.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
  }

  /**
   * A diferencia de las puertas (puramente visual), aca la proximidad
   * decide si Hud.jsx ofrece la interaccion "Presiona E" — se notifica via
   * gameSync.setNearVendor, que ya deduplica si no hay cambios.
   */
  updateVendorProximity() {
    const px = this.player.x;
    const py = this.player.y;
    let closest = null;
    let closestDistSq = Infinity;

    this.vendors.forEach((vendor) => {
      const dx = px - vendor.x;
      const dy = py - vendor.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= SHOP_RANGE_PX * SHOP_RANGE_PX && distSq < closestDistSq) {
        closest = vendor;
        closestDistSq = distSq;
      }
    });

    setNearVendor(closest);
  }

  /**
   * Mismo patron de flanco de entrada que la comida: se envia el pickup
   * una vez al entrar al rango, no en cada frame. El backend valida rol y
   * cooldown — este cliente no necesita saber de antemano si la mision es
   * del rol propio, el rechazo "wrong_role" del backend ya lo cubre.
   */
  updateMissionProximity() {
    const px = this.player.x;
    const py = this.player.y;

    this.missionZones.forEach((zone) => {
      const dx = px - zone.x;
      const dy = py - zone.y;
      const withinRange = dx * dx + dy * dy <= MISSION_RANGE_PX * MISSION_RANGE_PX;

      if (withinRange && !zone.inRange) {
        zone.inRange = true;
        requestMissionComplete(zone.missionId, px, py);
      } else if (!withinRange && zone.inRange) {
        zone.inRange = false;
      }
    });
  }

  /**
   * Cambia la textura de cada puerta a abierta/cerrada segun la distancia
   * al jugador — sin fisica ni overlap, es puramente visual (las puertas ya
   * son caminables en ambos estados).
   */
  updateDoorProximity() {
    const px = this.player.x;
    const py = this.player.y;

    this.doors.forEach((door) => {
      const dx = px - door.x;
      const dy = py - door.y;
      const withinRange = dx * dx + dy * dy <= DOOR_PROXIMITY_PX * DOOR_PROXIMITY_PX;

      if (withinRange && !door.open) {
        door.open = true;
        door.image.setTexture('v2_door_madera_open');
      } else if (!withinRange && door.open) {
        door.open = false;
        door.image.setTexture('v2_door_madera');
      }
    });
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
    this.doors = [];

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
        const image = this.add.image(cx, cy, 'v2_door_madera').setDepth(8);
        // Las puertas son caminables: no se agregan a `solids`. Se guarda la
        // referencia para actualizar textura abierta/cerrada por proximidad
        // (ver updateDoorProximity).
        this.doors.push({ image, x: cx, y: cy, open: false });
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
    // Ciclos reducidos a 6 frames: la lamina fuente es una hoja de
    // referencia de personaje (multiples angulos), no un ciclo de caminata
    // diseñado — algunos indices de cada bloque de 8 muestran un angulo
    // distinto (de frente/de espaldas colado en el ciclo) y rompian la
    // fluidez. Diagnostico completo y frames descartados documentados en
    // ARCHITECTURE.md.
    this.anims.create({
      key: 'right',
      frames: this.anims.generateFrameNames(key, { prefix: 'right_', start: 2, end: 7 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: 'down',
      frames: this.anims.generateFrameNames(key, { prefix: 'down_', frames: [0, 1, 2, 3, 5, 6] }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: 'up',
      frames: this.anims.generateFrameNames(key, { prefix: 'up_', start: 2, end: 7 }),
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
