import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS, buildFloorLayout, floorCount } from './mapLayout';
import { ROLE_CATALOG, roleInfo } from './roleCatalog';
import { FOOD_ITEMS, PICKUP_RANGE_PX } from './itemCatalog';
import { VENDORS, SHOP_RANGE_PX } from './shopCatalog';
import { missionSitesFor, missionType, MISSION_RANGE_PX } from './missionCatalog';
import {
  changeFloor,
  getLatestState,
  getMyBuilding,
  getMyPlayerState,
  getMyRole,
  getBoss,
  getProjectiles,
  getZombies,
  isInputLocked,
  onStateChange,
  reportPosition,
  requestAttack,
  requestPickup,
  requestEquip,
  requestReload,
  requestReviveStart,
  requestReviveCancel,
  setNearDowned,
  getSpectateTarget,
  setSpectateTarget,
  spectatableTeammates,
  getBarricades,
  requestPlaceBarricade,
  requestRepairBarricade,
  setNearBarricade,
  getAbilityPanel,
  setAbilityPanel,
  onGameEvent,
  getKinderEvent,
  requestEventInteract,
  setNearEvent,
  setNearVendor,
  setNearMission,
  setNearDoor,
  setNearStairs,
  touchInput,
} from './gameSync';
import ZombieLayer from './ZombieLayer';
import WeaponLayer from './WeaponLayer';
import { ownedWeapons, weaponById } from './weaponCatalog';
import { BARRICADE_REPAIR_RANGE_PX } from './abilityCatalog';
import { channelVolume, getSettings, vibrate } from './settings';
import { playSfx } from './sfx';
import { setMusicIntensity, startMusic } from './music';
import BossLayer, { preloadBoss } from './BossLayer';
import Lighting from './Lighting';
import { bakeHauntedTextures, decorateFloor, startDust, GoreFx, SHADOW_KEY } from './HauntedDecor';
import { OUTSIDE_MARGIN_TILES, PROPS_KEY, SHEET_KEY, preloadOutside, renderOutside } from './outsideDecor';

const DASH_SPEED = 420;
const DASH_MS = 180;
const DASH_COOLDOWN_MS = 1200;

const ATTACK_REQUEST_MS = 400;
const LOCAL_HOLDER = '__me';
// Con el mouse quieto este tiempo se vuelve a apuntar hacia donde camina.
const MOUSE_AIM_MS = 2500;
// Asistencia de apuntado (teclado y celular): el zombi mas cercano dentro de este cono.
const AIM_ASSIST_RAD = Math.PI / 4;
const SHOT_STEP_PX = 8;
const SHOT_RADIUS = { normal: 16, tough: 20, boss: 30 };
const EMPTY_CLICK_MS = 300;
const WEAPON_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR'];
const AIM_DIRECTIONS = ['right', 'down', 'left', 'up'];
// Debe coincidir con GameSession.REVIVE_RANGE_PX / REVIVER_ROLE.
const REVIVE_RANGE_PX = 80;
const REVIVER_ROLE = 'SALUD';
// Con el telefono de camaras abierto, Seguridad camina a esta fraccion de su velocidad.
const PHONE_SPEED_FACTOR = 0.5;
const BARRICADE_TEXTURE = 'barricade_planks';
const CHARGED_COOLDOWN_MS = 6000;
const CHARGED_RADIUS = 150;
const FLOOR_FADE_MS = 180;
const ROAR_RANGE_PX = 260;
const GROAN_RANGE_PX = 170;
const FAR_COOLDOWN_MS = 6000;
const NEAR_COOLDOWN_MS = 1800;
const MAX_ROAR_VOLUME = 0.75;
const MAX_GROAN_VOLUME = 0.5;
const MAX_BITE_VOLUME = 0.6;
// Distancia hasta la que se oyen las mordidas, golpes y avisos de otros zombis.
const COMBAT_HEARING_PX = 520;
// Solo se avisa con sonido la preparacion de un zombi que esta encima de ti.
const WINDUP_WARN_PX = 70;
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

// En pantallas chicas (celular) la camara se aleja para que se vea mas mapa alrededor:
// con zoom 1 el personaje ocupaba casi la mitad del alto en horizontal.
const ZOOM_REFERENCE_PX = 620;
const MIN_CAMERA_ZOOM = 0.6;
const BANNER_TOP_PX = 70;

export function cameraZoomFor(width, height) {
  const shortSide = Math.min(width, height);
  if (shortSide >= ZOOM_REFERENCE_PX) return 1;
  return Math.max(MIN_CAMERA_ZOOM, Math.round((shortSide / ZOOM_REFERENCE_PX) * 20) / 20);
}

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

// El Edificio C tiene piso de baldosa cafe (no el terrazo gris ni el rellano celeste
// del F) y escaleras de ladrillo/madera oscura, distintas de las del F.
const LANDING_TINT = 0xc9a876;
const CAFE_FLOOR_TINT = 0x9c6b3e;
const CAFE_STAIR_TINT = 0x6b4326;

const STAIRS_ARROW_GLYPH = { up: '▲', down: '▼' };

const ITEM_TYPE_COLORS = { WEAPON: 0x8a3b3b, FOOD: 0x3b8a4e, AMMO: 0x8a7a3b };


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
    this.missionMarkers = new Map();
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
    // Al volver de una desconexion la escena arranca donde el servidor tiene al jugador.
    const me = getMyPlayerState();
    this.floor = data?.floor ?? me?.floor ?? 1;
    this.spawnOverride = data?.spawn ?? (me ? { x: me.x, y: me.y } : null);
    // Caido y mirando a un compañero: la escena muestra el piso de ese compañero.
    this.spectating = Boolean(data?.spectating);
    this.reviving = null;
    // Los sprites del piso anterior ya se destruyeron con la escena.
    this.acidSprites = new Map();
    this.barricadeSprites = new Map();
    this.eventMarker = null;
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
    preloadBoss(this);

    this.load.audio('zombie_roar', '/sounds/zombie_roar.wav');
    this.load.audio('zombie_groan', '/sounds/zombie_groan.wav');
    this.load.audio('zombie_attack', '/sounds/zombie_attack.wav');
    this.load.audio('rain', '/sounds/rain.wav');
  }

  startRain() {
    // El sound manager es global: la lluvia sigue sonando al cambiar de piso.
    if (this.sound.get('rain')) return;
    this.sound.add('rain', { loop: true, volume: RAIN_MIN_VOLUME * channelVolume('ambient') }).play();
  }

  playZombieSound(key, volume) {
    const sound = this.sound.get(key) ?? this.sound.add(key);
    if (sound.isPlaying) return;
    sound.play({ volume: volume * channelVolume('zombies') });
  }

  // 1 pegado al jugador, bajando hasta 0 a COMBAT_HEARING_PX.
  hearing(x, y) {
    if (!this.player) return 0;
    const distance = Math.hypot(this.player.x - x, this.player.y - y);
    return Math.max(0, 1 - distance / COMBAT_HEARING_PX) ** 1.5;
  }

  // Jugador (local o remoto) mas cercano: hacia ahi embiste el zombi al morder.
  nearestPlayerTo(x, y) {
    let best = this.player ? { x: this.player.x, y: this.player.y } : null;
    let bestDistance = best ? Math.hypot(best.x - x, best.y - y) : Infinity;
    this.remotePlayers.forEach(({ sprite }) => {
      const distance = Math.hypot(sprite.x - x, sprite.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x: sprite.x, y: sprite.y };
      }
    });
    return best;
  }

  zombieHooks() {
    return {
      onWindup: (entry) => {
        if (entry.spitting) {
          playSfx('spitCharge', this.hearing(entry.x, entry.y));
          return;
        }
        if (Math.hypot(this.player.x - entry.x, this.player.y - entry.y) <= WINDUP_WARN_PX) playSfx('warn');
      },
      onStrike: (entry) => {
        if (entry.spitting) {
          playSfx('spit', this.hearing(entry.x, entry.y));
          return;
        }
        const volume = MAX_BITE_VOLUME * this.hearing(entry.x, entry.y) * channelVolume('zombies');
        if (volume > 0.01) this.sound.play('zombie_attack', { volume });
      },
      onStagger: (entry) => playSfx('stagger', this.hearing(entry.x, entry.y)),
      onHit: (entry, amount) => {
        playSfx('hit', this.hearing(entry.x, entry.y));
        const from = this.nearestPlayerTo(entry.x, entry.y) ?? { x: entry.x, y: entry.y - 1 };
        this.gore.splatter(entry.x, entry.y, from.x, from.y);
        this.gore.blood(entry.x, entry.y);
        if (amount > 0) this.gore.damageNumber(entry.x, entry.y - 34, amount, { crit: amount >= 3 });
      },
      onDeath: (entry) => this.gore.burst(entry.x, entry.y + 6, entry.kind === 'SPITTER' ? 0x6f8526 : 0x6e0b0b),
    };
  }

  // Mordida (o golpe del jefe) recibida: destello, sacudida, numero flotante y vibracion.
  checkDamageTaken() {
    const me = getMyPlayerState();
    if (!me) return;
    const previous = this.lastHealth;
    this.lastHealth = me.health;
    if (previous == null || me.health >= previous) return;

    const amount = previous - me.health;
    this.player.setTint(0xff4040);
    this.time.delayedCall(140, () => {
      if (!this.spectating) this.player?.clearTint();
    });
    if (getSettings().screenShake) this.cameras.main.shake(140, 0.006);
    playSfx('hurt');
    vibrate(amount >= 7 ? [70, 40, 70] : 60);

    const label = this.add
      .text(this.player.x, this.player.y - this.player.height / 2, `-${amount}`, {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ff5a5a',
        stroke: '#1a0000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(6000);
    this.tweens.add({
      targets: label,
      y: label.y - 34,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  applyCameraZoom() {
    const { width, height } = this.scale;
    this.cameras.main.setZoom(cameraZoomFor(width, height));
  }

  // La lluvia sube y baja despacio para no ser un ruido constante.
  updateRain(time) {
    const rain = this.sound.get('rain');
    if (!rain) return;
    const swell = 0.5 + 0.5 * Math.sin((time / RAIN_SWELL_MS) * Math.PI * 2);
    rain.setVolume((RAIN_MIN_VOLUME + (RAIN_MAX_VOLUME - RAIN_MIN_VOLUME) * swell) * channelVolume('ambient'));
  }

  // Cuanto mas cerca el zombi, mas fuerte y mas seguido suena.
  updateZombieAudio(time) {
    let nearest = null;

    this.zombiesOnFloor().forEach((zombie) => {
      const distance = Math.hypot(this.player.x - zombie.x, this.player.y - zombie.y);
      const range = zombie.tough ? ROAR_RANGE_PX : GROAN_RANGE_PX;
      if (distance > range) return;
      const closeness = 1 - distance / range;
      if (!nearest || closeness > nearest.closeness) nearest = { closeness, tough: zombie.tough };
    });

    if (!nearest || time < this.nextZombieSoundAt) return;

    const { closeness, tough } = nearest;
    this.nextZombieSoundAt = time + FAR_COOLDOWN_MS - (FAR_COOLDOWN_MS - NEAR_COOLDOWN_MS) * closeness;
    const volume = (tough ? MAX_ROAR_VOLUME : MAX_GROAN_VOLUME) * (0.15 + 0.85 * closeness * closeness);
    this.playZombieSound(tough ? 'zombie_roar' : 'zombie_groan', volume);
  }

  create() {

    const layout = buildFloorLayout({ building: getMyBuilding(), floor: this.floor });
    this.createMap(layout);

    const spawn = this.spawnOverride ?? layout.spawn;
    this.player = this.physics.add.sprite(spawn.x, spawn.y, this.roleTexture('down'));

    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.playerShadow = this.add.image(spawn.x, spawn.y, SHADOW_KEY).setDisplaySize(36, 13).setDepth(1.6);
    startDust(this, this.player);

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
    this.applyCameraZoom();
    this.scale.on('resize', this.applyCameraZoom, this);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.dashKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.attackAltKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.chargedKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.input.keyboard.addCapture([Phaser.Input.Keyboard.KeyCodes.Q, Phaser.Input.Keyboard.KeyCodes.C]);
    this.input.mouse?.disableContextMenu();
    this.weaponLayer = new WeaponLayer(this, { onDraw: () => playSfx('draw') });
    this.weaponKeys = WEAPON_KEYS.map((name) => this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[name]));
    this.reloadKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.abilityKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.bakeBarricadeTexture();
    this.aimAngle = this.facingAngle;
    this.mouseAimAt = -Infinity;
    this.weaponSynced = false;
    this.wasReloading = false;
    this.nextEmptyClickAt = 0;
    this.input.on('pointermove', (pointer) => {
      if (!pointer.wasTouch) this.mouseAimAt = this.time.now;
    });
    this.zombieLayer = new ZombieLayer(this, {
      hooks: this.zombieHooks(),
      findTarget: (x, y) => this.nearestPlayerTo(x, y),
    });
    this.bossLayer = new BossLayer(this);
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.nextZombieSoundAt = 0;
    this.lastHealth = null;
    startMusic(this.musicLevel());
    this.startRain();
    this.createFoodItems();
    this.createVendors();
    this.missionMarkers = new Map();
    if (this.spectating) {
      this.enterSpectate();
    } else {
      changeFloor(this.floor, Math.round(spawn.x), Math.round(spawn.y));
    }
    this.reviveGfx = this.add.graphics().setDepth(5500);
    this.cameras.main.fadeIn(FLOOR_FADE_MS);
    this.showFloorBanner(layout.name);
    // El servidor rechazo una posicion (movimiento imposible): se vuelve a la suya.
    const offCorrection = onGameEvent((event) => {
      if (event.type === 'POSITION_CORRECTED' && event.playerId === getMyRole()) this.applyServerPosition();
    });
    this.events.once('shutdown', () => {
      offCorrection();
      this.scale.off('resize', this.applyCameraZoom, this);
      this.weaponLayer?.destroy();
      setNearBarricade(null);
      if (this.reviving) requestReviveCancel();
      setNearDowned(null);
      this.unsubscribeGameState?.();
      this.lighting?.destroy();
      setNearVendor(null);
      setNearStairs(null);
    });
  }

  showFloorBanner(name) {
    // Fijo a la pantalla: con zoom el texto se compensa para quedar arriba y del mismo tamano.
    const zoom = this.cameras.main.zoom;
    const { width, height } = this.scale;
    const banner = this.add
      .text(width / 2, height / 2 + (BANNER_TOP_PX - height / 2) / zoom, name, {
        fontFamily: 'sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#f2fbe2',
        stroke: '#0b120b',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setScale(1 / zoom)
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

  // Marcadores de MIS misiones pendientes en este piso (las reparte el servidor por Kinder).
  syncMissionMarkers() {
    const me = getMyPlayerState();
    const pending = (me?.missions ?? []).filter((m) => !m.done && m.floor === this.floor);
    const keep = new Set(pending.map((m) => m.missionId));

    this.missionMarkers.forEach((marker, id) => {
      if (keep.has(id)) return;
      this.tweens.killTweensOf(marker.text);
      marker.text.destroy();
      this.missionMarkers.delete(id);
    });
    pending.forEach((mission) => {
      if (this.missionMarkers.has(mission.missionId)) return;
      const info = missionType(mission.type);
      const text = this.add
        .text(mission.x, mission.y, `${info.icon}\nMisión`, {
          fontFamily: 'sans-serif',
          fontSize: '13px',
          color: '#ffffff',
          align: 'center',
          backgroundColor: '#5b3fa0',
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(4)
        .setAlpha(0.95);
      this.tweens.add({ targets: text, scale: 1.12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.missionMarkers.set(mission.missionId, { text, mission });
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
        const shadow = this.add.image(state.x, state.y, SHADOW_KEY).setDisplaySize(36, 13).setDepth(1.6);
        entry = { sprite, shadow, label, prefix, aim: Math.PI / 2, shotSeq: state.shotSeq ?? 0, weaponSeen: false };
        this.remotePlayers.set(state.playerId, entry);
      }

      const dx = state.x - entry.sprite.x;
      const dy = state.y - entry.sprite.y;
      if (Math.hypot(dx, dy) > 3) {
        const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        entry.sprite.setTexture(`${entry.prefix}_${direction}`);
        entry.aim = Math.atan2(dy, dx);
      }
      if ((state.shotSeq ?? 0) > entry.shotSeq) {
        // Un compañero disparo: se dibuja su bala con la direccion que reporto el servidor.
        entry.shotSeq = state.shotSeq;
        entry.aim = state.shotFacing;
        const weapon = weaponById(state.weapon);
        const end = this.traceShot(entry.sprite.x, entry.sprite.y, state.shotFacing, weapon);
        this.weaponLayer.fire(state.playerId, end, { heavy: weapon.id === 'RIFLE' });
        playSfx(weapon.id === 'RIFLE' ? 'rifle' : 'pistol', 0.7 * this.hearing(entry.sprite.x, entry.sprite.y));
      }
      const blend = Math.min(1, (delta / 1000) * REMOTE_LERP_PER_SECOND);
      entry.sprite.x += dx * blend;
      entry.sprite.y += dy * blend;
      const downed = state.lifeState === 'DOWNED';
      entry.sprite.setAlpha(downed ? 0.75 : 1).setAngle(downed ? 90 : 0);
      if (downed) entry.sprite.setTint(0x9a9a9a);
      else entry.sprite.clearTint();
      entry.downed = downed;
      entry.label.setPosition(entry.sprite.x, entry.sprite.y - entry.sprite.height / 2 - 2);
      entry.shadow.setPosition(entry.sprite.x, entry.sprite.y + entry.sprite.displayHeight / 2 - 5);
      const labelText = state.connected === false ? `${roleInfo(state.role).name} (desconectado)` : roleInfo(state.role).name;
      if (entry.label.text !== labelText) entry.label.setText(labelText);
      entry.sprite.setAlpha(state.connected === false ? 0.45 : entry.sprite.alpha);
      this.weaponLayer.update(state.playerId, {
        x: entry.sprite.x,
        y: entry.sprite.y,
        aim: entry.aim,
        depth: entry.sprite.depth,
        weaponId: state.lifeState === 'DOWNED' ? 'FISTS' : (state.weapon ?? 'FISTS'),
        silent: !entry.weaponSeen,
      });
      entry.weaponSeen = true;
    });

    this.remotePlayers.forEach((entry, id) => {
      if (seen.has(id)) return;
      entry.sprite.destroy();
      entry.shadow.destroy();
      entry.label.destroy();
      this.weaponLayer.remove(id);
      this.remotePlayers.delete(id);
    });
  }

  // Evento del Kinder: apagon (oscuridad + tablero) o caja de suministros.
  syncKinderEvent() {
    const event = getKinderEvent();
    this.lighting?.setBlackout(event?.type === 'BLACKOUT');
    const here = event && event.floor === this.floor ? event : null;
    if (this.eventMarker && this.eventMarker.id !== here?.id) {
      this.tweens.killTweensOf(this.eventMarker.text);
      this.eventMarker.text.destroy();
      this.eventMarker.glow.destroy();
      this.eventMarker = null;
    }
    if (here && !this.eventMarker) {
      const blackout = here.type === 'BLACKOUT';
      const glow = this.add.circle(here.x, here.y, 34, blackout ? 0xffd23f : 0x6fd36f, 0.35)
        .setDepth(5300).setBlendMode(Phaser.BlendModes.ADD);
      const text = this.add.text(here.x, here.y, blackout ? '⚡\nTablero' : '📦\nSuministros', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        backgroundColor: blackout ? '#7a5a00' : '#2d6a2d',
        padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(5301);
      this.tweens.add({ targets: [text, glow], scale: 1.15, duration: 500, yoyo: true, repeat: -1 });
      this.eventMarker = { id: here.id, text, glow };
    }

    const near = Boolean(here && this.player && !this.spectating
      && Math.hypot(this.player.x - here.x, this.player.y - here.y) <= 90);
    setNearEvent(near);
    if (near && this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      requestEventInteract();
      playSfx(here.type === 'BLACKOUT' ? 'hammer' : 'coins');
    }
  }

  bakeBarricadeTexture() {
    if (this.textures.exists(BARRICADE_TEXTURE)) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x4a2e17, 1).fillRect(6, 10, 6, 48).fillRect(52, 10, 6, 48);
    [[2, 14], [2, 30], [2, 46]].forEach(([x, y]) => {
      g.fillStyle(0x8a5a2b, 1).fillRect(x, y, 60, 10);
      g.fillStyle(0xa8743c, 1).fillRect(x, y, 60, 3);
      g.fillStyle(0x2b2e33, 1).fillRect(x + 6, y + 4, 3, 3).fillRect(x + 51, y + 4, 3, 3);
    });
    g.lineStyle(5, 0x6b4322, 1).lineBetween(8, 54, 56, 16);
    g.generateTexture(BARRICADE_TEXTURE, 64, 64);
    g.destroy();
  }

  // Barricadas de este piso: solidas para el jugador, con barra de vida.
  syncBarricades() {
    const seen = new Set();
    getBarricades().filter((b) => b.floor === this.floor).forEach((b) => {
      seen.add(b.id);
      let entry = this.barricadeSprites.get(b.id);
      if (!entry) {
        const x = b.col * TILE + TILE / 2;
        const y = b.row * TILE + TILE / 2;
        const image = this.physics.add.staticImage(x, y, BARRICADE_TEXTURE).setDepth(y + 20);
        const collider = this.physics.add.collider(this.player, image);
        const bar = this.add.graphics().setDepth(5600);
        image.setScale(0.4);
        this.tweens.add({ targets: image, scale: 1, duration: 220, ease: 'Back.easeOut', onUpdate: () => image.refreshBody() });
        entry = { image, collider, bar, x, y, health: b.health };
        this.barricadeSprites.set(b.id, entry);
        playSfx('build', this.hearing(x, y));
      }
      if (b.health < entry.health) {
        this.tweens.add({ targets: entry.image, x: { from: entry.x - 3, to: entry.x + 3 }, duration: 50, yoyo: true, onComplete: () => entry.image.setX(entry.x) });
      }
      entry.health = b.health;
      const pct = b.health / b.maxHealth;
      entry.bar.clear();
      entry.bar.fillStyle(0x000000, 0.6).fillRect(entry.x - 26, entry.y - 42, 52, 7);
      entry.bar.fillStyle(pct > 0.5 ? 0xe8c34a : pct > 0.25 ? 0xe07a3a : 0xc0392b, 1).fillRect(entry.x - 25, entry.y - 41, 50 * pct, 5);
    });
    this.barricadeSprites.forEach((entry, id) => {
      if (seen.has(id)) return;
      for (let i = 0; i < 6; i += 1) {
        const plank = this.add.rectangle(entry.x, entry.y, 18, 5, 0x8a5a2b).setDepth(entry.y + 21);
        this.tweens.add({
          targets: plank,
          x: entry.x + Phaser.Math.Between(-40, 40),
          y: entry.y + Phaser.Math.Between(-30, 30),
          angle: Phaser.Math.Between(-180, 180),
          alpha: 0,
          duration: 500,
          onComplete: () => plank.destroy(),
        });
      }
      playSfx('breakWood', this.hearing(entry.x, entry.y));
      this.physics.world.removeCollider(entry.collider);
      entry.image.destroy();
      entry.bar.destroy();
      this.barricadeSprites.delete(id);
    });
  }

  // Tecla F / boton ★: la habilidad del rol. E repara la barricada que esta al lado.
  updateAbility() {
    const me = getMyPlayerState();
    if (!me) return;
    const pressed = Phaser.Input.Keyboard.JustDown(this.abilityKey) || touchInput.ability;
    touchInput.ability = false;

    if (me.role === 'INFRAESTRUCTURA') {
      let near = null;
      this.barricadeSprites.forEach((entry, id) => {
        if (Math.hypot(this.player.x - entry.x, this.player.y - entry.y) <= BARRICADE_REPAIR_RANGE_PX) near = { id, ...entry };
      });
      setNearBarricade(near ? { barricadeId: near.id, health: near.health } : null);
      if (near && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        requestRepairBarricade(near.id);
        playSfx('hammer');
      }
    } else {
      setNearBarricade(null);
    }

    if (!pressed) return;
    if (me.role === 'SEGURIDAD') {
      setAbilityPanel(getAbilityPanel() === 'phone' ? null : 'phone');
      playSfx('click');
    } else if (me.role === 'ECONOMIA') {
      setAbilityPanel(getAbilityPanel() === 'treasury' ? null : 'treasury');
      playSfx('click');
    } else if (me.role === 'INFRAESTRUCTURA') {
      requestPlaceBarricade(Math.round(this.player.x), Math.round(this.player.y), this.aimAngle);
    }
  }

  // Bolas de acido de los escupidores en este piso: bola verde con estela y salpicadura.
  syncProjectiles(delta) {
    if (!this.acidSprites) this.acidSprites = new Map();
    const seen = new Set();
    const blend = Math.min(1, (delta / 1000) * 14);
    getProjectiles().filter((p) => p.floor === this.floor).forEach((p) => {
      seen.add(p.id);
      let entry = this.acidSprites.get(p.id);
      if (!entry) {
        const glow = this.add.circle(p.x, p.y, 13, 0x9dff3a, 0.25).setDepth(5200).setBlendMode(Phaser.BlendModes.ADD);
        const ball = this.add.circle(p.x, p.y, 7, 0xb6ff5a, 1).setStrokeStyle(2, 0x3d5a10).setDepth(5201);
        entry = { glow, ball };
        this.acidSprites.set(p.id, entry);
      }
      const x = entry.ball.x + (p.x - entry.ball.x) * blend;
      const y = entry.ball.y + (p.y - entry.ball.y) * blend;
      entry.ball.setPosition(x, y);
      entry.glow.setPosition(x, y).setScale(0.9 + Math.sin(this.time.now / 60) * 0.15);
      if (Math.random() < 0.35) {
        const drop = this.add.circle(x, y, 3, 0x9dff3a, 0.6).setDepth(5199);
        this.tweens.add({ targets: drop, alpha: 0, scale: 0.3, duration: 260, onComplete: () => drop.destroy() });
      }
    });
    this.acidSprites.forEach((entry, id) => {
      if (seen.has(id)) return;
      const splash = this.add.ellipse(entry.ball.x, entry.ball.y + 4, 30, 14, 0x9dff3a, 0.55).setDepth(3);
      this.tweens.add({ targets: splash, alpha: 0, scaleX: 1.6, duration: 600, onComplete: () => splash.destroy() });
      playSfx('splash', this.hearing(entry.ball.x, entry.ball.y));
      entry.ball.destroy();
      entry.glow.destroy();
      this.acidSprites.delete(id);
    });
  }

  // El jefe solo se dibuja si esta en el piso de este jugador.
  syncBoss(delta) {
    this.syncProjectiles(delta);
    this.syncBarricades();
    this.syncKinderEvent();
    const boss = getBoss();
    this.bossLayer.sync(boss && boss.floor === this.floor ? boss : null);
    this.bossLayer.update(delta);
  }

  update(time, delta) {
    if (!this.player) return;
    this.syncRemotePlayers(delta);
    this.playerShadow
      .setPosition(this.player.x, this.player.y + this.player.displayHeight / 2 - 5)
      .setVisible(this.player.visible);
    this.lighting.update(time, this.focusSprite(), this.remotePlayers);
    this.checkDamageTaken();
    this.drawReviveProgress();
    if (this.updateSpectate(delta)) return;
    this.updateRevive();

    if (isInputLocked()) {
      this.player.setVelocity(0, 0);
      this.zombieLayer.sync(this.zombiesOnFloor());
      this.zombieLayer.update(delta);
      this.syncBoss(delta);
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
    const speed = PLAYER_SPEED * (getAbilityPanel() === 'phone' ? PHONE_SPEED_FACTOR : 1);
    if (magnitude > 0) {
      vx = (vx / magnitude) * speed;
      vy = (vy / magnitude) * speed;

      this.facingAngle = Math.atan2(vy, vx);
    }

    if (direction) this.currentDirection = direction;

    if (time < this.dashUntil) {

      this.player.setVelocity(this.dashVx, this.dashVy);
    } else {
      this.player.setVelocity(vx, vy);

      if ((this.dashKey.isDown || touchInput.dash) && time >= this.dashReadyAt) {

        const dx = magnitude > 0 ? vx / speed : Math.cos(this.facingAngle);
        const dy = magnitude > 0 ? vy / speed : Math.sin(this.facingAngle);
        this.dashVx = dx * DASH_SPEED;
        this.dashVy = dy * DASH_SPEED;
        this.dashUntil = time + DASH_MS;
        this.dashReadyAt = time + DASH_COOLDOWN_MS;
        this.spawnDashTrail();
      }
    }

    reportPosition(Math.round(this.player.x), Math.round(this.player.y), time);
    this.updateAim(time);
    this.updateWeaponSelection();
    this.updateAbility();
    this.updateAttack(time);
    this.zombieLayer.sync(this.zombiesOnFloor());
    this.zombieLayer.update(delta);
    this.syncBoss(delta);

    if (time - this.mouseAimAt < MOUSE_AIM_MS) {
      // Con el mouse el personaje mira hacia donde apunta.
      const quarter = Math.round(Phaser.Math.Angle.Wrap(this.aimAngle) / (Math.PI / 2));
      this.currentDirection = AIM_DIRECTIONS[(quarter + 4) % 4];
    }
    this.player.setTexture(this.roleTexture(this.currentDirection));
    this.syncLocalWeapon();
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
    setMusicIntensity(this.musicLevel());
  }

  // Calma en el respiro, latido en el Kinder, peligro con el jefe, cuando ya solo
  // faltan misiones (la horda no para) o con poca vida.
  musicLevel() {
    const wave = getLatestState().wave;
    const me = getMyPlayerState();
    if (!wave || wave.victory || wave.restingSeconds > 0) return 0;
    if (wave.bossStage || wave.waitingForMissions || (me && me.health > 0 && me.health <= 30)) return 2;
    return 1;
  }

  applyServerPosition() {
    const me = getMyPlayerState();
    if (!me || this.spectating || this.changingFloor) return;
    this.corrections = (this.corrections ?? 0) + 1;
    if (me.floor !== this.floor) {
      this.changingFloor = true;
      this.scene.restart({ floor: me.floor, spawn: { x: me.x, y: me.y } });
      return;
    }
    this.player.setPosition(me.x, me.y);
    this.player.setVelocity(0, 0);
    changeFloor(this.floor, Math.round(me.x), Math.round(me.y));
  }

  // Lo que ilumina la luz "del jugador": el compañero que se mira si esta caido.
  focusSprite() {
    if (!this.spectating) return this.player;
    return this.remotePlayers.get(getSpectateTarget())?.sprite ?? this.player;
  }

  enterSpectate() {
    this.spectating = true;
    this.player.setVelocity(0, 0);
    if (this.reviving) {
      requestReviveCancel();
      this.reviving = null;
    }
    setNearDowned(null);
    const me = getMyPlayerState();
    // El cuerpo propio queda tirado donde cayo, si es este piso.
    if (me && me.floor === this.floor) {
      this.player.setPosition(me.x, me.y).setAngle(90).setTint(0x9a9a9a).setVisible(true);
    } else {
      this.player.setVisible(false);
    }
    this.player.body.enable = false;
    this.cameras.main.stopFollow();
  }

  exitSpectate(me) {
    if (me.floor !== this.floor) {
      this.scene.restart({ floor: me.floor, spawn: { x: me.x, y: me.y } });
      return;
    }
    this.spectating = false;
    this.player.body.enable = true;
    this.player.setPosition(me.x, me.y).setAngle(0).clearTint().setVisible(true);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.lastHealth = me.health;
    setSpectateTarget(null);
  }

  /**
   * Caido: la camara sigue al compañero elegido (si esta en otro piso, la escena se
   * recarga en ese piso sin mover al jugador). Devuelve true mientras dura.
   */
  updateSpectate(delta) {
    const me = getMyPlayerState();
    if (!me) return false;
    const downed = me.lifeState === 'DOWNED';
    if (!downed) {
      if (this.spectating) this.exitSpectate(me);
      return this.spectating;
    }
    if (!this.spectating) this.enterSpectate();

    const teammates = spectatableTeammates();
    let target = teammates.find((p) => p.playerId === getSpectateTarget());
    if (!target && teammates.length > 0) {
      target = teammates[0];
      setSpectateTarget(target.playerId);
    }
    if (target && target.floor !== this.floor && !this.changingFloor) {
      this.changingFloor = true;
      this.cameras.main.fadeOut(FLOOR_FADE_MS);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.restart({ floor: target.floor, spawn: { x: target.x, y: target.y }, spectating: true });
      });
    } else if (target) {
      const sprite = this.remotePlayers.get(target.playerId)?.sprite;
      const camera = this.cameras.main;
      const goal = sprite ?? target;
      const blend = Math.min(1, (delta / 1000) * 6);
      camera.centerOn(
        camera.midPoint.x + (goal.x - camera.midPoint.x) * blend,
        camera.midPoint.y + (goal.y - camera.midPoint.y) * blend,
      );
    }

    this.zombieLayer.sync(this.zombiesOnFloor());
    this.zombieLayer.update(delta);
    this.syncBoss(delta);
    this.updateRain(this.time.now);
    return true;
  }

  // Biomedica: mantener E al lado de un compañero caido lo revive (lo decide el servidor).
  updateRevive() {
    const me = getMyPlayerState();
    if (!me || me.role !== REVIVER_ROLE || me.lifeState === 'DOWNED') {
      setNearDowned(null);
      return;
    }
    let near = null;
    let best = REVIVE_RANGE_PX;
    getLatestState().players.forEach((p) => {
      if (p.playerId === me.playerId || p.lifeState !== 'DOWNED' || p.floor !== this.floor) return;
      const distance = Math.hypot(p.x - this.player.x, p.y - this.player.y);
      if (distance <= best) {
        best = distance;
        near = { playerId: p.playerId, role: p.role, name: roleInfo(p.role).name };
      }
    });
    setNearDowned(near);

    const holding = this.interactKey.isDown && near && !isInputLocked();
    if (holding && this.reviving !== near.playerId) {
      this.reviving = near.playerId;
      requestReviveStart(near.playerId);
    } else if (!holding && this.reviving) {
      this.reviving = null;
      requestReviveCancel();
    }
  }

  // Anillo de progreso sobre cada caido que esta siendo revivido.
  drawReviveProgress() {
    const gfx = this.reviveGfx;
    if (!gfx) return;
    gfx.clear();
    const players = getLatestState().players;
    players.forEach((reviver) => {
      if (!reviver.reviving || reviver.reviveProgress <= 0) return;
      const target = players.find((p) => p.playerId === reviver.reviving);
      if (!target || target.floor !== this.floor) return;
      const body = target.playerId === getMyRole() ? this.player : this.remotePlayers.get(target.playerId)?.sprite;
      const x = body?.x ?? target.x;
      const y = (body?.y ?? target.y) - 46;
      gfx.fillStyle(0x000000, 0.55).fillCircle(x, y, 17);
      gfx.lineStyle(5, 0x9bf0b8, 1);
      gfx.beginPath();
      gfx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * reviver.reviveProgress);
      gfx.strokePath();
      gfx.fillStyle(0x9bf0b8, 1).fillRect(x - 2, y - 7, 4, 14).fillRect(x - 7, y - 2, 14, 4);
    });
  }

  myWeapon() {
    const me = getMyPlayerState();
    return { me, weapon: weaponById(me?.weapon) };
  }

  // Apunta al mouse si se esta usando; si no, hacia donde camina, corrigiendo hacia el
  // zombi mas cercano dentro de un cono (en celular no hay como apuntar fino).
  updateAim(time) {
    if (time - this.mouseAimAt < MOUSE_AIM_MS) {
      const pointer = this.input.activePointer;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.aimAngle = Math.atan2(world.y - this.player.y, world.x - this.player.x);
      return;
    }
    const { weapon } = this.myWeapon();
    const reach = weapon.ranged ? weapon.range : weapon.range + 40;
    let best = null;
    const targets = [...this.zombiesOnFloor()];
    const boss = getBoss();
    if (boss && boss.floor === this.floor) targets.push(boss);
    targets.forEach((target) => {
      const distance = Math.hypot(target.x - this.player.x, target.y - this.player.y);
      if (distance > reach) return;
      const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
      if (Math.abs(Phaser.Math.Angle.Wrap(angle - this.facingAngle)) > AIM_ASSIST_RAD) return;
      if (!best || distance < best.distance) best = { distance, angle };
    });
    this.aimAngle = best ? best.angle : this.facingAngle;
  }

  // Teclas 1-4 (puños + armas del inventario en orden), boton de cambiar en celular y R para recargar.
  updateWeaponSelection() {
    const { me, weapon } = this.myWeapon();
    if (!me) return;
    const owned = ownedWeapons(me.inventory);
    let wanted = null;
    this.weaponKeys.forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(key) && owned[index]) wanted = owned[index];
    });
    if (touchInput.cycleWeapon) {
      touchInput.cycleWeapon = false;
      const index = owned.findIndex((entry) => entry.id === weapon.id);
      wanted = owned[(index + 1) % owned.length];
    }
    if (wanted && wanted.id !== weapon.id) requestEquip(wanted.itemId);

    const wantsReload = Phaser.Input.Keyboard.JustDown(this.reloadKey) || touchInput.reload;
    touchInput.reload = false;
    if (wantsReload && weapon.ranged && me.reloadingMs === 0 && me.magazine < weapon.magazineSize && me.reserveAmmo > 0) {
      requestReload();
    }

    const reloading = me.reloadingMs > 0;
    if (reloading && !this.wasReloading) {
      this.weaponLayer.reload(LOCAL_HOLDER, me.reloadingMs);
      playSfx('reload');
    }
    this.wasReloading = reloading;
  }

  syncLocalWeapon() {
    const me = getMyPlayerState();
    this.weaponLayer.update(LOCAL_HOLDER, {
      x: this.player.x,
      y: this.player.y,
      aim: this.aimAngle,
      depth: this.player.depth,
      weaponId: me && me.lifeState !== 'DOWNED' ? (me.weapon ?? 'FISTS') : 'FISTS',
      // Al cambiar de piso la escena se recrea: no se repite la animacion de sacar el arma.
      silent: !this.weaponSynced,
    });
    this.weaponSynced = Boolean(me);
  }

  isOpenAt(x, y) {
    const cell = this.layoutGrid?.[Math.floor(y / TILE)]?.[Math.floor(x / TILE)];
    if (!cell || SOLID_GRID_TYPES.has(cell.type)) return false;
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    return !this.doors.some((door) => !door.open && door.col === col && door.row === row);
  }

  // Mismo calculo que GameSession.shoot en el servidor, solo para dibujar hasta donde llega la bala.
  traceShot(x, y, angle, weapon) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    let reach = 0;
    while (reach < weapon.range && this.isOpenAt(x + dirX * (reach + SHOT_STEP_PX), y + dirY * (reach + SHOT_STEP_PX))) {
      reach += SHOT_STEP_PX;
    }
    const hits = [];
    const consider = (target, radius) => {
      const dx = target.x - x;
      const dy = target.y - y;
      const along = dx * dirX + dy * dirY;
      if (along < 0 || along > reach + radius) return;
      if (Math.abs(dx * dirY - dy * dirX) <= radius) hits.push(along);
    };
    this.zombiesOnFloor().forEach((zombie) => consider(zombie, zombie.tough ? SHOT_RADIUS.tough : SHOT_RADIUS.normal));
    const boss = getBoss();
    if (boss && boss.floor === this.floor) consider(boss, SHOT_RADIUS.boss);
    hits.sort((a, b) => a - b);
    const end = hits.length >= weapon.pierce ? hits[weapon.pierce - 1] : reach;
    return { x: x + dirX * end, y: y + dirY * end };
  }

  updateAttack(time) {
    const wants = this.attackKey.isDown
      || this.attackAltKey.isDown
      || touchInput.attack
      || (!this.input.activePointer.wasTouch && this.input.activePointer.leftButtonDown());
    if (!wants || time < this.nextAttackAt) return;

    const { me, weapon } = this.myWeapon();
    const x = Math.round(this.player.x);
    const y = Math.round(this.player.y);
    if (weapon.ranged) {
      if (!me || me.reloadingMs > 0) return;
      if (me.magazine <= 0) {
        // Gatillo en seco: el servidor empieza a recargar solo si hay balas de reserva.
        if (time >= this.nextEmptyClickAt) {
          this.nextEmptyClickAt = time + EMPTY_CLICK_MS;
          playSfx('empty');
          requestAttack('BASIC', x, y, this.aimAngle);
        }
        return;
      }
      this.nextAttackAt = time + weapon.cooldownMs;
      requestAttack('BASIC', x, y, this.aimAngle);
      const heavy = weapon.id === 'RIFLE';
      this.weaponLayer.fire(LOCAL_HOLDER, this.traceShot(this.player.x, this.player.y, this.aimAngle, weapon), { heavy });
      playSfx(heavy ? 'rifle' : 'pistol');
      if (heavy && getSettings().screenShake) this.cameras.main.shake(90, 0.003);
      return;
    }

    this.nextAttackAt = time + Math.max(ATTACK_REQUEST_MS, weapon.cooldownMs);
    requestAttack('BASIC', x, y, this.aimAngle);
    this.drawSwing(this.aimAngle, weapon.range);
    this.weaponLayer.swing(LOCAL_HOLDER);
    playSfx('swing');
  }

  updateChargedAttack(time) {
    const pressed = Phaser.Input.Keyboard.JustDown(this.chargedKey) || touchInput.charged;
    touchInput.charged = false;
    if (!pressed || time < this.chargedReadyAt) return;

    this.chargedReadyAt = time + CHARGED_COOLDOWN_MS;
    requestAttack('CHARGED', Math.round(this.player.x), Math.round(this.player.y), this.aimAngle);
    this.drawShockwave();
    playSfx('charged');
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
    if (getSettings().screenShake) this.cameras.main.shake(160, 0.004);
  }

  drawSwing(facing, radius = 62) {
    const arc = this.add.graphics();
    arc.setDepth(this.player.y + 1);
    arc.fillStyle(0xfff2c4, 0.45);
    arc.slice(this.player.x, this.player.y, radius, facing - Math.PI / 4, facing + Math.PI / 4);
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
    this.syncMissionMarkers();
    let closest = null;
    let closestDistance = MISSION_RANGE_PX;
    this.missionMarkers.forEach(({ mission }) => {
      const distance = Math.hypot(this.player.x - mission.x, this.player.y - mission.y);
      if (distance <= closestDistance) {
        closest = mission;
        closestDistance = distance;
      }
    });
    // El minijuego que se abre depende del tipo de mision, no del rol.
    setNearMission(closest ? { ...closest, role: missionType(closest.type).role } : null);
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
    if (pressed && active && !this.changingFloor && !this.reviving) {
      this.travel(active.kind);
    }
  }

  travel(kind) {
    const target = kind === 'up' ? this.floor + 1 : this.floor - 1;
    if (target < 1 || target > floorCount(getMyBuilding())) return;

    const arrival = buildFloorLayout({ building: getMyBuilding(), floor: target });
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

    this.layoutGrid = layout.grid;
    this.lighting = new Lighting(this);
    bakeHauntedTextures(this);
    this.gore = new GoreFx(this);
    renderOutside(this, layout.grid, this.lighting, getMyBuilding());
    this.renderGridTiles(layout.grid);
    this.renderDecorations(layout.decorations);
    this.renderFurniture(layout.furniture);
    this.renderLabels(layout.labels);
    this.addInteriorLights(layout);
    decorateFloor(this, layout.grid, this.lighting, { building: getMyBuilding(), floor: this.floor });

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
    // Salones: en algunos el bombillo esta fallando (parpadea o se va por ratos).
    const roomModes = ['broken', null, 'flicker', null, 'broken', 'flicker'];
    missionSitesFor(getMyBuilding()).filter((site) => site.floor === this.floor).forEach((site, i) => {
      const mode = roomModes[i % roomModes.length];
      if (mode) this.lighting.addLight({ x: site.x, y: site.y - TILE, radius: 230, mode });
      else this.lighting.addLight({ x: site.x, y: site.y, radius: 130, mode: 'steady', bulb: false });
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
        } else if (cell.type === 'floor' && cell.sheet !== 'outside') {
          // Baldosa cafe del Edificio C: no el terrazo gris del F.
          image.setTint(CAFE_FLOOR_TINT);
        } else if (cell.type === 'stair') {
          // Escalera de ladrillo/madera oscura del Edificio C, distinta de la del F.
          image.setTint(CAFE_STAIR_TINT);
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
        this.doors.push({ image, x: cx, y: cy, open: true, doorId: deco.doorId, col: deco.x, row: deco.y });
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
