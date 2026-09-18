import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS, buildFloorLayout } from './mapLayout';
import { FOOD_ITEMS, PICKUP_RANGE_PX } from './itemCatalog';
import { VENDORS, SHOP_RANGE_PX } from './shopCatalog';
import { MISSION_ZONES, MISSION_RANGE_PX } from './missionCatalog';
import {
  ensureJoined,
  getZombies,
  isInputLocked,
  onStateChange,
  reportPosition,
  requestAttack,
  requestPickup,
  setNearVendor,
  setNearMission,
  setNearDoor,
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

// Caja de colision del jugador: solo los pies. Bastante mas angosta que un
// tile (64) para que quepa por los vanos de puerta sin pelear con el borde.
const PLAYER_BODY_WIDTH = 30;
const PLAYER_BODY_HEIGHT = 18;
/** Cuanto sube la caja desde el borde inferior del frame. */
const PLAYER_BODY_FOOT_INSET = 6;

const MAP_PIXEL_WIDTH = MAP_COLS * TILE;
const MAP_PIXEL_HEIGHT = MAP_ROWS * TILE;
const PLAYER_SPEED = 160;

// Solo hay UNA pose fija por direccion (sin frames de ciclo de caminata, ver
// SEGURIDAD_TEXTURE_BY_DIRECTION): sin esto el personaje se desliza por el
// piso como un cartel pegado, sin ningun indicio de que esta caminando. Un
// balanceo leve (rotacion, no posicion — no le pega en nada a la caja de
// colision, que ignora la rotacion del sprite) alcanza para que se sienta
// vivo sin necesitar frames de arte nuevos.
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

// Distancia (px) del jugador al centro de una puerta para ofrecer la
// interaccion "Presiona E" (abrir/cerrar) — un poco mas de un tile.
const DOOR_PROXIMITY_PX = 90;

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

// Unica mision con tarea propia por ahora (el resto sigue con el patron
// viejo de "completar al pisar"): abre el popup con el minijuego en vez de
// completarse sola al entrar en rango — ver SecurityMission.jsx.
const SECURITY_MISSION_ID = 'mission-seguridad';

// 4 fotos fijas (una pose por direccion, sin ciclo de caminata) en vez del
// atlas auto-detectado anterior: ese atlas armaba el ciclo mezclando poses de
// angulos distintos dentro de una misma lamina de referencia, lo que se veia
// como si el personaje "diera vueltas" al caminar. Con una textura estatica
// por direccion ese problema no puede volver a aparecer — no hay frames que
// mezclar, solo un cambio de textura al girar (ver build_seguridad_static_
// sprites.py).
const SEGURIDAD_TEXTURE_BY_DIRECTION = {
  down: 'seguridad_down',
  up: 'seguridad_up',
  right: 'seguridad_right',
  left: 'seguridad_left',
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
    // Angulo continuo (no uno de 4 direcciones) hacia donde apunta el golpe:
    // ver el comentario en updateAttack sobre por que el golpe fallaba en
    // diagonal cuando esto estaba atado a 'facing' de 4 valores.
    this.facingAngle = FACING_RADIANS.down;
    this.walkWobblePhaseMs = 0;
    this.dashUntil = 0;
    this.dashReadyAt = 0;
    this.dashVx = 0;
    this.dashVy = 0;
    this.nextAttackAt = 0;
  }

  preload() {
    Object.values(SEGURIDAD_TEXTURE_BY_DIRECTION).forEach((key) => {
      this.load.image(key, `/sprites/${key}.png`);
    });

    Object.entries(TILE_TEXTURE_FILES).forEach(([key, file]) => {
      this.load.image(key, `/tiles/${file}`);
    });

    VENDORS.forEach((vendor) => {
      this.load.image(vendor.sprite, vendor.spriteFile);
    });
  }

  create() {
    // Piso 1 por ahora: solo tiene escalera de subida (sin piso -1 al que
    // bajar). El cambio de piso real todavia no esta conectado.
    const layout = buildFloorLayout({ hasUpStairs: true, hasDownStairs: false });
    this.createMap(layout);

    this.player = this.physics.add.sprite(
      layout.spawn.x,
      layout.spawn.y,
      SEGURIDAD_TEXTURE_BY_DIRECTION.down,
    );

    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    // El sprite mide 57x132: sin esto el cuerpo de colision es TODO el
    // sprite (cabeza y aire incluidos), mas del doble de alto que un tile de
    // 64, asi que el personaje no cabe por una puerta y choca "con la
    // cabeza". La caja va solo en los pies, que es lo estandar en top-down:
    // lo que colisiona es donde el personaje pisa.
    this.player.body.setSize(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT);
    this.player.body.setOffset(
      (this.player.width - PLAYER_BODY_WIDTH) / 2,
      this.player.height - PLAYER_BODY_HEIGHT - PLAYER_BODY_FOOT_INSET,
    );
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

      // Estado de puertas: el backend es la unica fuente de verdad (asi
      // decide tambien si un zombi puede pasar). Cerrada = mismo trato que
      // una pared para el jugador: se prende el body que ya existe desde
      // renderDecorations (ver ese comentario sobre por que nunca se
      // agrega/quita del grupo).
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

    // Con una tarea de mision abierta (ver SecurityMission.jsx) el jugador
    // queda inmune en el backend Y quieto en el cliente — estilo Among Us,
    // el mapa/los zombis siguen corriendo alrededor, pero no se puede
    // caminar ni atacar mientras el popup esta abierto.
    if (isInputLocked()) {
      this.player.setVelocity(0, 0);
      this.zombieLayer.sync(getZombies());
      this.zombieLayer.update(delta);
      return;
    }

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
      // Angulo real de movimiento (incluye diagonales), no uno de los 4
      // valores de FACING_RADIANS — es lo que le llega al backend como
      // 'facing' para decidir que golpea el ataque.
      this.facingAngle = Math.atan2(vy, vx);
    }

    if (direction) this.currentDirection = direction;

    if (time < this.dashUntil) {
      // Durante el dash se conserva la velocidad que se fijo al arrancarlo,
      // aunque el jugador suelte las teclas.
      this.player.setVelocity(this.dashVx, this.dashVy);
    } else {
      this.player.setVelocity(vx, vy);

      if (this.dashKey.isDown && time >= this.dashReadyAt) {
        // vx/vy ya vienen escalados a PLAYER_SPEED, asi que dividir devuelve
        // el vector unitario. Sin teclas, el dash sale hacia donde se mira.
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
    this.zombieLayer.sync(getZombies());
    this.zombieLayer.update(delta);

    // Una sola pose fija por direccion (ver SEGURIDAD_TEXTURE_BY_DIRECTION):
    // no hay ciclo que animar ni flip que aplicar (izquierda y derecha ya
    // son arte distinto, no un espejo) — el balanceo de abajo es lo unico
    // que distingue caminar de estar quieto.
    this.player.setTexture(SEGURIDAD_TEXTURE_BY_DIRECTION[this.currentDirection]);
    if (direction) {
      this.walkWobblePhaseMs += delta;
      const wobble = Math.sin((this.walkWobblePhaseMs / 1000) * WALK_WOBBLE_HZ * Math.PI * 2);
      this.player.setAngle(wobble * WALK_WOBBLE_DEG);
    } else {
      this.walkWobblePhaseMs = 0;
      this.player.setAngle(0);
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
    requestAttack(Math.round(this.player.x), Math.round(this.player.y), this.facingAngle);
    this.drawSwing(this.facingAngle);
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
        if (zone.missionId === SECURITY_MISSION_ID) {
          setNearMission(zone);
        } else {
          requestMissionComplete(zone.missionId, px, py);
        }
      } else if (!withinRange && zone.inRange) {
        zone.inRange = false;
        if (zone.missionId === SECURITY_MISSION_ID) {
          setNearMission(null);
        }
      }
    });
  }

  /**
   * Cambia la textura de cada puerta a abierta/cerrada segun la distancia
   * al jugador — sin fisica ni overlap, es puramente visual (las puertas ya
   * son caminables en ambos estados, la puerta cerrada bloquea de verdad —
   * ver el listener de onStateChange en createFoodItems que sincroniza
   * textura + colision con lo que confirma el backend).
   *
   * El abrir/cerrar ya no es automatico por proximidad: ahora es una accion
   * del jugador (boton E, ver Hud.jsx) — esto solo decide cual puerta ofrece
   * esa interaccion.
   */
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
        const image = this.add.image(cx, cy, 'v2_door_madera_open').setDepth(8);
        // Siempre se agrega a `solids` (asi el cuerpo fisico existe desde el
        // arranque) pero con el body deshabilitado — el backend manda todas
        // las puertas abiertas al empezar. Abrir/cerrar despues solo
        // prende/apaga ese body (ver el listener de onStateChange abajo),
        // nunca se agrega/quita del grupo — es la forma estandar de Arcade
        // Physics de togglear colision sin recrear el cuerpo cada vez.
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
