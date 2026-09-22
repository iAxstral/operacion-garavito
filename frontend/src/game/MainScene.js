import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS, FLOOR_COUNT, buildFloorLayout } from './mapLayout';
import { ROLE_CATALOG, roleInfo } from './roleCatalog';
import { FOOD_ITEMS, PICKUP_RANGE_PX } from './itemCatalog';
import { VENDORS, SHOP_RANGE_PX } from './shopCatalog';
import { MISSION_ZONES, MISSION_RANGE_PX } from './missionCatalog';
import {
  changeFloor,
  getLatestState,
  getMyRole,
  getZombies,
  isInputLocked,
  onStateChange,
  reportPosition,
  requestAttack,
  requestPickup,
  setNearVendor,
  setNearMission,
  setNearDoor,
  setNearStairs,
  touchInput,
  requestMissionComplete,
} from './gameSync';
import ZombieLayer from './ZombieLayer';
import Lighting from './Lighting';
import { OUTSIDE_MARGIN_TILES, PROPS_KEY, SHEET_KEY, preloadOutside, renderOutside } from './outsideDecor';

const DASH_SPEED = 420;
const DASH_MS = 180;
const DASH_COOLDOWN_MS = 1200;

const ATTACK_REQUEST_MS = 400;
const CHARGED_COOLDOWN_MS = 6000;
const CHARGED_RADIUS = 150;
const FLOOR_FADE_MS = 180;
const ROAR_RANGE_PX = 260;
const GROAN_RANGE_PX = 170;
const BITE_RANGE_PX = 48;
const FAR_COOLDOWN_MS = 6000;
const NEAR_COOLDOWN_MS = 1800;
const MAX_ROAR_VOLUME = 0.75;
const MAX_GROAN_VOLUME = 0.5;
const BITE_COOLDOWN_MS = 1500;
const RAIN_MIN_VOLUME = 0.3;
const RAIN_MAX_VOLUME = 0.6;
const RAIN_SWELL_MS = 11000;
const TOUCH_DEADZONE = 0.3;
const REMOTE_LERP_PER_SECOND = 10;

const FACING_RADIANS = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

const PLAYER_BODY_WIDTH = 30;
const PLAYER_BODY_HEIGHT = 18;

const PLAYER_BODY_FOOT_INSET = 6;

const MAP_PIXEL_WIDTH = MAP_COLS * TILE;
const MAP_PIXEL_HEIGHT = MAP_ROWS * TILE;
const PLAYER_SPEED = 160;

const WALK_WOBBLE_HZ = 3;
const WALK_WOBBLE_DEG = 2.5;

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

const DOOR_PROXIMITY_PX = 90;

const SOLID_GRID_TYPES = new Set(['wall', 'glass']);

const LANDING_TINT = 0xbfe0e6;

const STAIRS_ARROW_GLYPH = { up: '▲', down: '▼' };

const ITEM_TYPE_COLORS = { WEAPON: 0x8a3b3b, FOOD: 0x3b8a4e, AMMO: 0x8a7a3b };

const INTERACTIVE_MISSIONS = new Set(['mission-seguridad', 'mission-salud', 'mission-economia', 'mission-infraestructura']);

const DIRECTIONS = ['down', 'up', 'right', 'left'];

const ROLE_ACCENT = {
  SEGURIDAD: 0x7ec8ff,
  SALUD: 0x9bf0b8,
  ECONOMIA: 0xffd36b,
  INFRAESTRUCTURA: 0xffa45c,
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
    this.doors = [];
    this.foodItems = [];
    this.vendors = [];
    this.missionZones = [];
    this.unsubscribeGameState = null;
    this.zombieLayer = null;
    this.remotePlayers = new Map();

    this.facingAngle = FACING_RADIANS.down;
    this.walkWobblePhaseMs = 0;
    this.dashUntil = 0;
    this.dashReadyAt = 0;
    this.dashVx = 0;
    this.dashVy = 0;
    this.nextAttackAt = 0;
    this.chargedReadyAt = 0;
    this.floor = 1;
    this.spawnOverride = null;
    this.changingFloor = false;
    this.spritePrefix = 'seguridad';
  }

  init(data) {
    this.remotePlayers = new Map();
    this.floor = data?.floor ?? 1;
    this.spawnOverride = data?.spawn ?? null;
    this.changingFloor = false;
    this.spritePrefix = roleInfo(getMyRole()).spritePrefix;
  }

  roleTexture(direction) {
    return `${this.spritePrefix}_${direction}`;
  }

  preload() {
    ROLE_CATALOG.forEach(({ spritePrefix }) => {
      DIRECTIONS.forEach((direction) => {
        this.load.image(`${spritePrefix}_${direction}`, `/sprites/${spritePrefix}_${direction}.png`);
      });
    });

    Object.entries(TILE_TEXTURE_FILES).forEach(([key, file]) => {
      this.load.image(key, `/tiles/${file}`);
    });

    VENDORS.forEach((vendor) => {
      this.load.image(vendor.sprite, vendor.spriteFile);
    });

    preloadOutside(this);

    this.load.audio('zombie_roar', '/sounds/zombie_roar.wav');
    this.load.audio('zombie_groan', '/sounds/zombie_groan.wav');
    this.load.audio('zombie_attack', '/sounds/zombie_attack.wav');
    this.load.audio('rain', '/sounds/rain.wav');
  }

  startRain() {
    // El sound manager es global: la lluvia sigue sonando al cambiar de piso.
    if (this.sound.get('rain')) return;
    this.sound.add('rain', { loop: true, volume: RAIN_MIN_VOLUME }).play();
  }

  playZombieSound(key, volume) {
    const sound = this.sound.get(key) ?? this.sound.add(key);
    if (sound.isPlaying) return;
    sound.play({ volume });
  }

  // La lluvia sube y baja despacio para no ser un ruido constante.
  updateRain(time) {
    const rain = this.sound.get('rain');
    if (!rain) return;
    const swell = 0.5 + 0.5 * Math.sin((time / RAIN_SWELL_MS) * Math.PI * 2);
    rain.setVolume(RAIN_MIN_VOLUME + (RAIN_MAX_VOLUME - RAIN_MIN_VOLUME) * swell);
  }

  // Cuanto mas cerca el zombi, mas fuerte y mas seguido suena.
  updateZombieAudio(time) {
    let nearest = null;
    let bite = false;

    this.zombiesOnFloor().forEach((zombie) => {
      const distance = Math.hypot(this.player.x - zombie.x, this.player.y - zombie.y);
      if (distance <= BITE_RANGE_PX) bite = true;
      const range = zombie.tough ? ROAR_RANGE_PX : GROAN_RANGE_PX;
      if (distance > range) return;
      const closeness = 1 - distance / range;
      if (!nearest || closeness > nearest.closeness) nearest = { closeness, tough: zombie.tough };
    });

    if (bite && time >= this.nextBiteSoundAt) {
      this.nextBiteSoundAt = time + BITE_COOLDOWN_MS;
      this.playZombieSound('zombie_attack', 0.5);
    }
    if (!nearest || time < this.nextZombieSoundAt) return;

    const { closeness, tough } = nearest;
    this.nextZombieSoundAt = time + FAR_COOLDOWN_MS - (FAR_COOLDOWN_MS - NEAR_COOLDOWN_MS) * closeness;
    const volume = (tough ? MAX_ROAR_VOLUME : MAX_GROAN_VOLUME) * (0.15 + 0.85 * closeness * closeness);
    this.playZombieSound(tough ? 'zombie_roar' : 'zombie_groan', volume);
  }

  create() {

    const layout = buildFloorLayout({ floor: this.floor });
    this.createMap(layout);

    const spawn = this.spawnOverride ?? layout.spawn;
    this.player = this.physics.add.sprite(spawn.x, spawn.y, this.roleTexture('down'));

    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    this.player.body.setSize(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT);
    this.player.body.setOffset(
      (this.player.width - PLAYER_BODY_WIDTH) / 2,
      this.player.height - PLAYER_BODY_HEIGHT - PLAYER_BODY_FOOT_INSET,
    );
    this.physics.world.setBounds(0, 0, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT);
    this.physics.add.collider(this.player, this.solids);

    const outside = OUTSIDE_MARGIN_TILES * TILE;
    this.cameras.main.setBounds(-outside, -outside, MAP_PIXEL_WIDTH + 2 * outside, MAP_PIXEL_HEIGHT + 2 * outside);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.dashKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.attackAltKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.chargedKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.input.keyboard.addCapture([Phaser.Input.Keyboard.KeyCodes.Q, Phaser.Input.Keyboard.KeyCodes.C]);
    this.input.mouse?.disableContextMenu();
    this.zombieLayer = new ZombieLayer(this);
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.nextBiteSoundAt = 0;
    this.nextZombieSoundAt = 0;
    this.startRain();
    this.createFoodItems();
    this.createVendors();
    this.createMissionZones();
    changeFloor(this.floor, Math.round(spawn.x), Math.round(spawn.y));
    this.cameras.main.fadeIn(FLOOR_FADE_MS);
    this.showFloorBanner(layout.name);
    this.events.once('shutdown', () => {
      this.unsubscribeGameState?.();
      this.lighting?.destroy();
      setNearVendor(null);
      setNearStairs(null);
    });
  }

  showFloorBanner(name) {
    const banner = this.add
      .text(this.scale.width / 2, 70, name, {
        fontFamily: 'sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#f2fbe2',
        stroke: '#0b120b',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(6000);
    this.tweens.add({ targets: banner, alpha: 0, delay: 1200, duration: 700, onComplete: () => banner.destroy() });
  }

  createVendors() {
    this.vendors = VENDORS.filter((vendor) => vendor.floor === this.floor).map((vendor) => {
      const image = this.add.image(vendor.x, vendor.y, vendor.sprite).setDepth(6);
      this.solids.add(image);
      return { ...vendor, inRange: false };
    });
  }

  createMissionZones() {
    this.missionZones = MISSION_ZONES.filter((zone) => zone.floor === this.floor).map((zone) => {
      const mine = zone.role === getMyRole();
      this.add
        .text(zone.x, zone.y, `Misión (${roleInfo(zone.role).name})\n${zone.room}`, {
          fontFamily: 'sans-serif',
          fontSize: '11px',
          color: '#ffffff',
          align: 'center',
          backgroundColor: mine ? '#5b3fa0' : '#3a3a44',
          padding: { x: 4, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(4)
        .setAlpha(mine ? 0.95 : 0.55);
      return { ...zone, mine, inRange: false };
    });
  }

  createFoodItems() {
    this.foodItems = FOOD_ITEMS.filter((item) => item.floor === this.floor).map((item) => {
      const rect = this.add
        .rectangle(item.x, item.y, 26, 26, ITEM_TYPE_COLORS[item.type])
        .setStrokeStyle(2, 0x1f5c2e)
        .setDepth(3);
      return { ...item, rect, inRange: false };
    });

    this.unsubscribeGameState = onStateChange((state) => {
      const claimed = new Set(state.claimedItemIds);
      this.foodItems.forEach((food) => food.rect.setVisible(!claimed.has(food.itemId)));

      (state.doors ?? []).forEach((doorState) => {
        const door = this.doors.find((d) => d.doorId === doorState.doorId);
        if (!door || door.open === doorState.open) return;
        door.open = doorState.open;
        door.image.setTexture(doorState.open ? 'v2_door_madera_open' : 'v2_door_madera');
        door.image.body.enable = !doorState.open;
      });
    });
  }

  updateFoodProximity() {
    const px = this.player.x;
    const py = this.player.y;

    this.foodItems.forEach((food) => {
      if (!food.rect.visible) return;

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

  zombiesOnFloor() {
    return getZombies().filter((zombie) => zombie.floor === this.floor);
  }

  syncRemotePlayers(delta) {
    const seen = new Set();

    getLatestState().players.forEach((state) => {
      if (state.playerId === getMyRole() || state.floor !== this.floor) return;
      seen.add(state.playerId);

      let entry = this.remotePlayers.get(state.playerId);
      const prefix = roleInfo(state.role).spritePrefix;
      if (!entry) {
        const sprite = this.add.sprite(state.x, state.y, `${prefix}_down`).setDepth(9);
        const label = this.add
          .text(state.x, state.y, roleInfo(state.role).name, {
            fontFamily: 'sans-serif',
            fontSize: '11px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.55)',
            padding: { x: 4, y: 1 },
          })
          .setOrigin(0.5, 1)
          .setDepth(11);
        entry = { sprite, label, prefix };
        this.remotePlayers.set(state.playerId, entry);
      }

      const dx = state.x - entry.sprite.x;
      const dy = state.y - entry.sprite.y;
      if (Math.hypot(dx, dy) > 3) {
        const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        entry.sprite.setTexture(`${entry.prefix}_${direction}`);
      }
      const blend = Math.min(1, (delta / 1000) * REMOTE_LERP_PER_SECOND);
      entry.sprite.x += dx * blend;
      entry.sprite.y += dy * blend;
      entry.sprite.setAlpha(state.lifeState === 'DOWNED' ? 0.4 : 1);
      entry.label.setPosition(entry.sprite.x, entry.sprite.y - entry.sprite.height / 2 - 2);
    });

    this.remotePlayers.forEach((entry, id) => {
      if (seen.has(id)) return;
      entry.sprite.destroy();
      entry.label.destroy();
      this.remotePlayers.delete(id);
    });
  }

  update(time, delta) {
    if (!this.player) return;
    this.syncRemotePlayers(delta);
    this.lighting.update(time, this.player, this.remotePlayers);

    if (isInputLocked()) {
      this.player.setVelocity(0, 0);
      this.zombieLayer.sync(this.zombiesOnFloor());
      this.zombieLayer.update(delta);
      return;
    }

    const up = this.cursors.up.isDown || this.wasd.up.isDown || touchInput.moveY < -TOUCH_DEADZONE;
    const down = this.cursors.down.isDown || this.wasd.down.isDown || touchInput.moveY > TOUCH_DEADZONE;
    const left = this.cursors.left.isDown || this.wasd.left.isDown || touchInput.moveX < -TOUCH_DEADZONE;
    const right = this.cursors.right.isDown || this.wasd.right.isDown || touchInput.moveX > TOUCH_DEADZONE;

    let vx = (right ? 1 : 0) - (left ? 1 : 0);
    let vy = (down ? 1 : 0) - (up ? 1 : 0);
    let direction = null;

    if (left) direction = 'left';
    else if (right) direction = 'right';
    if (up) direction = direction ?? 'up';
    else if (down) direction = direction ?? 'down';

    const magnitude = Math.hypot(vx, vy);
    if (magnitude > 0) {
      vx = (vx / magnitude) * PLAYER_SPEED;
      vy = (vy / magnitude) * PLAYER_SPEED;

      this.facingAngle = Math.atan2(vy, vx);
    }

    if (direction) this.currentDirection = direction;

    if (time < this.dashUntil) {

      this.player.setVelocity(this.dashVx, this.dashVy);
    } else {
      this.player.setVelocity(vx, vy);

      if ((this.dashKey.isDown || touchInput.dash) && time >= this.dashReadyAt) {

        const dx = magnitude > 0 ? vx / PLAYER_SPEED : Math.cos(this.facingAngle);
        const dy = magnitude > 0 ? vy / PLAYER_SPEED : Math.sin(this.facingAngle);
        this.dashVx = dx * DASH_SPEED;
        this.dashVy = dy * DASH_SPEED;
        this.dashUntil = time + DASH_MS;
        this.dashReadyAt = time + DASH_COOLDOWN_MS;
        this.spawnDashTrail();
      }
    }

    reportPosition(Math.round(this.player.x), Math.round(this.player.y), time);
    this.updateAttack(time);
    this.zombieLayer.sync(this.zombiesOnFloor());
    this.zombieLayer.update(delta);

    this.player.setTexture(this.roleTexture(this.currentDirection));
    if (direction) {
      this.walkWobblePhaseMs += delta;
      const wobble = Math.sin((this.walkWobblePhaseMs / 1000) * WALK_WOBBLE_HZ * Math.PI * 2);
      this.player.setAngle(wobble * WALK_WOBBLE_DEG);
    } else {
      this.walkWobblePhaseMs = 0;
      this.player.setAngle(0);
    }

    this.updateStairsZones();
    this.updateChargedAttack(time);
    this.updateDoorProximity();
    this.updateFoodProximity();
    this.updateVendorProximity();
    this.updateMissionProximity();
    this.updateZombieAudio(time);
    this.updateRain(time);
  }

  updateAttack(time) {
    const wants = this.attackKey.isDown
      || this.attackAltKey.isDown
      || touchInput.attack
      || (!this.input.activePointer.wasTouch && this.input.activePointer.leftButtonDown());
    if (!wants || time < this.nextAttackAt) return;

    this.nextAttackAt = time + ATTACK_REQUEST_MS;
    requestAttack('BASIC', Math.round(this.player.x), Math.round(this.player.y), this.facingAngle);
    this.drawSwing(this.facingAngle);
  }

  updateChargedAttack(time) {
    const pressed = Phaser.Input.Keyboard.JustDown(this.chargedKey) || touchInput.charged;
    touchInput.charged = false;
    if (!pressed || time < this.chargedReadyAt) return;

    this.chargedReadyAt = time + CHARGED_COOLDOWN_MS;
    requestAttack('CHARGED', Math.round(this.player.x), Math.round(this.player.y), this.facingAngle);
    this.drawShockwave();
  }

  drawShockwave() {
    const accent = ROLE_ACCENT[getMyRole()] ?? 0xffffff;
    const ring = this.add.graphics();
    ring.setDepth(this.player.y + 1);
    ring.lineStyle(6, accent, 0.9);
    ring.strokeCircle(0, 0, CHARGED_RADIUS);
    ring.fillStyle(accent, 0.18);
    ring.fillCircle(0, 0, CHARGED_RADIUS);
    ring.setPosition(this.player.x, this.player.y);
    ring.setScale(0.15);
    this.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.cameras.main.shake(160, 0.004);
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
    const ghost = this.add.sprite(this.player.x, this.player.y, this.player.texture.key);
    ghost.setDepth(this.player.depth - 1).setAlpha(0.45).setTint(0x7ec8ff);
    this.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
  }

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

  updateMissionProximity() {
    const px = this.player.x;
    const py = this.player.y;

    this.missionZones.forEach((zone) => {
      const dx = px - zone.x;
      const dy = py - zone.y;
      const withinRange = dx * dx + dy * dy <= MISSION_RANGE_PX * MISSION_RANGE_PX;

      if (withinRange && !zone.inRange) {
        zone.inRange = true;
        if (!zone.mine) return;
        if (INTERACTIVE_MISSIONS.has(zone.missionId)) {
          setNearMission(zone);
        } else {
          requestMissionComplete(zone.missionId, px, py);
        }
      } else if (!withinRange && zone.inRange) {
        zone.inRange = false;
        if (zone.mine && INTERACTIVE_MISSIONS.has(zone.missionId)) {
          setNearMission(null);
        }
      }
    });
  }

  updateDoorProximity() {
    const px = this.player.x;
    const py = this.player.y;
    let closest = null;
    let closestDistSq = Infinity;

    this.doors.forEach((door) => {
      const dx = px - door.x;
      const dy = py - door.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= DOOR_PROXIMITY_PX * DOOR_PROXIMITY_PX && distSq < closestDistSq) {
        closest = door;
        closestDistSq = distSq;
      }
    });

    setNearDoor(closest);
  }

  updateStairsZones() {
    const body = this.player.body;
    let active = null;

    this.stairsZones.forEach((stairs) => {
      const { rect } = stairs;
      const overlapping =
        body.x < rect.x + rect.w &&
        body.x + body.width > rect.x &&
        body.y < rect.y + rect.h &&
        body.y + body.height > rect.y;

      stairs.label.setVisible(overlapping);
      if (overlapping) active = stairs;
    });

    setNearStairs(active ? { kind: active.kind } : null);

    const pressed = Phaser.Input.Keyboard.JustDown(this.interactKey);
    if (pressed && active && !this.changingFloor) {
      this.travel(active.kind);
    }
  }

  travel(kind) {
    const target = kind === 'up' ? this.floor + 1 : this.floor - 1;
    if (target < 1 || target > FLOOR_COUNT) return;

    const arrival = buildFloorLayout({ floor: target });
    const spawn = (kind === 'up' ? arrival.downStairs : arrival.upStairs).arrivalSpawn;

    this.changingFloor = true;
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(FLOOR_FADE_MS);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.restart({ floor: target, spawn });
    });
  }

  createMap(layout) {
    this.solids = this.physics.add.staticGroup();
    this.stairsZones = [];
    this.doors = [];

    this.lighting = new Lighting(this);
    renderOutside(this, layout.grid, this.lighting);
    this.renderGridTiles(layout.grid);
    this.renderDecorations(layout.decorations);
    this.renderFurniture(layout.furniture);
    this.renderLabels(layout.labels);
    this.addInteriorLights(layout);

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
              ? `Presiona E — subir al piso ${this.floor + 1}`
              : `Presiona E — bajar al piso ${this.floor - 1}`,
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

  // Bombillos del edificio: solo algunas columnas del vestibulo, y luz suave en misiones y vendedores.
  addInteriorLights(layout) {
    const modes = ['flicker', 'steady', 'broken'];
    layout.decorations
      .filter((deco) => deco.type === 'column')
      .filter((deco, i) => i % 2 === 0)
      .forEach((deco, i) => {
        this.lighting.addLight({
          x: deco.x * TILE + TILE / 2,
          y: (deco.y + 2.5) * TILE,
          radius: 260,
          mode: modes[i % modes.length],
        });
      });

    VENDORS.filter((vendor) => vendor.floor === this.floor).forEach((vendor) => {
      this.lighting.addLight({ x: vendor.x, y: vendor.y, radius: 150, mode: 'steady', bulb: false });
    });
    MISSION_ZONES.filter((zone) => zone.floor === this.floor).forEach((zone) => {
      this.lighting.addLight({ x: zone.x, y: zone.y, radius: 130, mode: 'steady', bulb: false });
    });

    // Luces fluorescentes del techo del corredor porticado: parejas, sin foco visible.
    layout.decorations
      .filter((deco) => deco.type === 'plaza-lamp' || deco.type === 'plaza-tree')
      .forEach((deco) => {
        this.lighting.addLight({ x: deco.x * TILE + TILE / 2, y: deco.y * TILE + TILE / 2, radius: 200, mode: 'steady', bulb: false });
      });
  }

  renderGridTiles(grid) {
    for (let y = 0; y < MAP_ROWS; y += 1) {
      for (let x = 0; x < MAP_COLS; x += 1) {
        const cell = grid[y][x];
        if (!cell) continue;

        const cx = x * TILE + TILE / 2;
        const cy = y * TILE + TILE / 2;
        // El piso del patio (espina de pescado / baldosa de bano) viene del tileset exterior
        // del Edificio C en vez de un archivo suelto.
        const image = cell.sheet === 'outside'
          ? this.add.image(cx, cy, 'outside_tiles', cell.frame).setScale(TILE / 32)
          : this.add.image(cx, cy, cell.texture);

        if (cell.type === 'landing') {
          image.setTint(LANDING_TINT);
        } else if (cell.type === 'wall') {
          // Tinte calido para que los muros interiores combinen con el ladrillo del Edificio C.
          image.setTint(0xd9b79a);
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
        const cy = deco.y * TILE + TILE;
        // Tinte crema para que las columnas combinen con el patio del Edificio C.
        const image = this.add.image(cx, cy, 'v2_columna').setDepth(5).setTint(0xd8cdb6);
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

      if (deco.type === 'plaza-lamp') {
        const cx = deco.x * TILE + TILE / 2;
        const cy = deco.y * TILE + TILE / 2;
        this.add.image(cx, cy, PROPS_KEY, 'farola').setOrigin(0.5, 0.95).setDepth(6);
        return;
      }

      if (deco.type === 'plaza-tree') {
        const cx = deco.x * TILE + TILE / 2;
        const cy = deco.y * TILE + TILE / 2;
        // Jardinera/arbol central del patio: bloquea poco, el pasillo sigue teniendo 4+ tiles libres.
        const image = this.add.image(cx, cy, PROPS_KEY, 'arbol').setOrigin(0.5, 0.85).setScale(1.1).setDepth(6);
        this.solids.add(image);
        return;
      }

      if (deco.type === 'plaza-bench') {
        const cx = deco.x * TILE + TILE / 2;
        const cy = deco.y * TILE + TILE / 2;
        const image = this.add.image(cx, cy, PROPS_KEY, 'banca_roja').setDepth(6);
        this.solids.add(image);
        return;
      }

      if (deco.type === 'plaza-table') {
        const cx = deco.x * TILE + TILE / 2;
        const cy = deco.y * TILE + TILE / 2;
        const table = this.add.image(cx, cy, PROPS_KEY, 'mesa_redonda').setDepth(6);
        this.solids.add(table);
        [[-18, -14], [18, 14]].forEach(([dx, dy]) => {
          this.add.image(cx + dx, cy + dy, PROPS_KEY, 'silla_negra').setDepth(6);
        });
        return;
      }

      if (deco.type === 'bath-door') {
        const cx = deco.x * TILE + TILE / 2;
        const cy = deco.y * TILE + TILE / 2;
        // Solo decorativa: el nicho de banos no tiene mecanica de puerta interactiva.
        this.add.image(cx, cy, SHEET_KEY, 21).setScale(TILE / 32).setDepth(7);
        return;
      }

      if (deco.type === 'pictogram') {
        const cx = deco.x * TILE + TILE / 2;
        const cy = deco.y * TILE + TILE / 2;
        this.add.text(cx, cy, deco.glyph, { fontSize: '20px' }).setOrigin(0.5).setDepth(7);
        return;
      }

      if (deco.type === 'camera') {
        const cx = deco.x * TILE + TILE / 2;
        const cy = deco.y * TILE + TILE / 2;
        this.add.text(cx, cy, '📷', { fontSize: '16px' }).setOrigin(0.5).setAlpha(0.85).setDepth(7);
        return;
      }

      if (deco.type === 'door') {
        const cx = deco.x * TILE + TILE / 2;

        const cy =
          deco.orientation === 'down'
            ? deco.y * TILE + 48
            : (deco.y + 1) * TILE - 48;
        const image = this.add.image(cx, cy, 'v2_door_madera_open').setDepth(8);

        this.solids.add(image);
        image.body.enable = false;
        this.doors.push({ image, x: cx, y: cy, open: true, doorId: deco.doorId });
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

}
