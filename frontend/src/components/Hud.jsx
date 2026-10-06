import { useEffect, useRef, useState } from 'react';
import {
  getLatestState,
  onGameEvent,
  getMyBuilding,
  getMyRole,
  onStateChange,
  onNearVendorChange,
  onNearDoorChange,
  requestDoorToggle,
  requestUseItem,
  requestEquip,
  getNearMission,
  getNearStairs,
  getNearDowned,
  onNearDownedChange,
  getNearBarricade,
  getBarricades,
  getNearEvent,
  isTouchDevice,
  isInputLocked,
  purchaseItem,
  setInputLocked,
} from '../game/gameSync';
import SettingsPanel from './SettingsPanel';
import Icon, { Glyph } from './Icon';
import { playSfx } from '../game/sfx';
import { MISSIONS_PER_KINDER, missionType } from '../game/missionCatalog';
import { FOOD_ITEMS } from '../game/itemCatalog';
import { CAFETERIA_MENU, WEAPON_MACHINE_MENU } from '../game/shopCatalog';
import { AMMO_PER_PACK, weaponById, weaponForItem } from '../game/weaponCatalog';
import { abilityFor, BARRICADE_COOLDOWN_MS, MAX_BARRICADES, priceFor } from '../game/abilityCatalog';
import { roleInfo } from '../game/roleCatalog';
import { displayName, nameWithRole } from '../game/profile';
import { getStamina, onStaminaChange } from '../game/stamina';
import { buildFloorLayout, MAP_COLS, MAP_ROWS, TILE } from '../game/mapLayout';

const MAP_CELL_PX = 12;

const TYPE_COLORS = { WEAPON: '#8a3b3b', FOOD: '#3b8a4e', AMMO: '#8a7a3b' };

const REJECTION_MESSAGES = {
  inventory_full: 'Inventario lleno',
  already_claimed: 'Alguien más lo recogió primero',
  too_far: 'Estás muy lejos de ese item',
  unknown_item: 'Ese item no existe',
  unknown_player: 'Todavía no te uniste a la partida',
  insufficient_garavitos: 'No tienes suficientes Garavitos',
  wrong_role: 'Esa misión no es de tu rol',
  on_cooldown: 'Esa misión ya se completó hace poco, espera un poco',
  unknown_mission: 'Esa misión no existe',
  unknown_door: 'Esa puerta no existe',
  not_usable: 'Ese objeto no se puede usar',
  downed: 'Estás caído',
  no_ammo: 'Sin munición: cómprala en la máquina de armas (piso 2)',
  not_owned: 'No tienes esa arma',
  not_downed: 'Ese compañero ya está de pie',
  too_many_barricades: 'Ya tienes 2 barricadas: repáralas o espera a que caigan',
  blocked_spot: 'No se puede poner la barricada ahí',
  unknown_barricade: 'Esa barricada ya no existe',
  needs_builder: 'Solo Infraestructura sabe arreglar el tablero eléctrico',
  no_event: 'Eso ya se resolvió',
};

const FOOD_HEAL_DEFAULT = 15;
const CHARGED_COOLDOWN_MS = 6000;

function healFor(itemId) {
  return CAFETERIA_MENU.find((item) => item.itemId === itemId)?.healAmount ?? FOOD_HEAL_DEFAULT;
}

function itemIcon(itemId) {
  return [...CAFETERIA_MENU, ...WEAPON_MACHINE_MENU].find((item) => item.itemId === itemId)?.icon ?? null;
}

// Boton del inventario para sacar o guardar un arma.
function WeaponAction({ slot, equipped }) {
  const weapon = weaponForItem(slot.itemId);
  if (!weapon) return <span className="inventory-tag">Munición</span>;
  if (equipped.id === weapon.id) {
    return (
      <button type="button" className="inventory-use inventory-use--secondary" onClick={() => requestEquip(null)}>
        Guardar
      </button>
    );
  }
  return (
    <button type="button" className="inventory-use" onClick={() => requestEquip(weapon.itemId)}>
      Equipar
    </button>
  );
}

function kinderStatus(wave, boss) {
  if (wave.victory) return `¡Edificio despejado! Superaron los ${wave.total} Kinders`;
  if (wave.bossStage) {
    const health = boss ? ` (${boss.health}/${boss.maxHealth})` : '';
    return `Kinder ${wave.number}/${wave.total} — ¡Derroten al Ingeniero de Sistemas!${health}`;
  }
  if (wave.restingSeconds > 0) {
    return wave.number === 0
      ? `Prepárate — Kinder 1 en ${wave.restingSeconds}s`
      : `Kinder ${wave.number} superado — Kinder ${wave.number + 1} en ${wave.restingSeconds}s`;
  }
  if (wave.waitingForMissions) {
    return `Kinder ${wave.number}/${wave.total} — ¡Cuota lista! Faltan misiones (${wave.teamMissionsDone}/${wave.teamMissionsRequired})`;
  }
  return `Kinder ${wave.number}/${wave.total} — ${wave.kills}/${wave.quota} zombis · misiones ${wave.teamMissionsDone}/${wave.teamMissionsRequired}`;
}

// Mision pendiente mas cercana: primero las de mi piso, si no la primera de otro.
function nextMission(me) {
  const pending = (me?.missions ?? []).filter((m) => !m.done);
  const here = pending.filter((m) => m.floor === me.floor)
    .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
  return here[0] ?? pending[0] ?? null;
}

// Siempre sangre: mas oscura y apagada a medida que se acaba la vida.
function healthColor(health) {
  if (health > 60) return 'linear-gradient(180deg, #e8412c 0%, #a3140c 55%, #6a0606 100%)';
  if (health > 30) return 'linear-gradient(180deg, #d0581f 0%, #8f2a0a 55%, #561405 100%)';
  return 'linear-gradient(180deg, #a01010 0%, #5c0505 60%, #300202 100%)';
}

/** Balas del cargador dibujadas: llenas las que quedan, huecas las gastadas. */
function AmmoPips({ loaded, size }) {
  if (!size) return null;
  return (
    <span className="hud-ammo-pips" aria-hidden="true">
      {Array.from({ length: size }, (_, i) => (
        <span key={i} className={`hud-ammo-pip${i < loaded ? ' hud-ammo-pip--full' : ''}`} />
      ))}
    </span>
  );
}

// Apodo (o rol) de un jugador por su id, con el ultimo estado del servidor.
function nameOf(playerId) {
  return displayName(getLatestState().players.find((p) => p.playerId === playerId) ?? { role: playerId });
}

// Texto del aviso para un evento del servidor (o null si a este jugador no le toca).
function toastFor(event) {
  const broadcastTypes = ['REVIVED', 'TRANSFER', 'EVENT_STARTED', 'EVENT_RESOLVED', 'EVENT_FAILED'];
  if (!event || (event.playerId !== getMyRole() && !broadcastTypes.includes(event.type))) return null;

  let message = null;
  // Reanimaciones: se avisa a todos, no solo al que hizo la accion.
  const KINDER_EVENT_MESSAGES = {
    EVENT_STARTED: { BLACKOUT: '⚡ ¡Apagón! Infraestructura tiene que llegar al tablero eléctrico', SUPPLY: '📦 ¡Suministros urgentes! Recójanlos antes de que se acabe el tiempo' },
    EVENT_RESOLVED: { BLACKOUT: '💡 ¡Volvió la luz!', SUPPLY: `📦 ¡Suministros recogidos! +20 Garavitos y +25 de vida para todos` },
    EVENT_FAILED: { SUPPLY: '📦 Se perdieron los suministros… ¡viene una horda!' },
  };
  if (KINDER_EVENT_MESSAGES[event.type]) {
    message = KINDER_EVENT_MESSAGES[event.type][event.reason] ?? null;
    return message ? { message, ms: 3500 } : null;
  }
  if (event.type === 'TRANSFER' && (event.playerId === getMyRole() || event.itemId === getMyRole())) {
    message = event.playerId === getMyRole()
      ? `Enviaste ${event.reason} Garavitos a ${nameOf(event.itemId)}`
      : `¡Economía te envió +${event.reason} Garavitos!`;
    return { message, ms: 2500 };
  }
  if (event.type === 'REVIVED') {
    const revived = nameOf(event.playerId);
    const reviver = nameOf(event.itemId);
    message = event.playerId === getMyRole() ? `¡${reviver} te levantó! Vuelves con 50 de vida`
      : event.itemId === getMyRole() ? `¡Levantaste a ${revived}!`
        : `${revived} volvió a la pelea`;
    return { message, ms: 2500 };
  }
  if (
    event.type === 'PICKUP_REJECTED'
    || event.type === 'PURCHASE_REJECTED'
    || event.type === 'MISSION_REJECTED'
    || event.type === 'DOOR_REJECTED'
    || event.type === 'EQUIP_REJECTED'
    || (event.type === 'RELOAD_REJECTED' && event.reason === 'no_ammo')
    || (event.type === 'ATTACK_REJECTED' && event.reason === 'no_ammo')
  ) {
    message = REJECTION_MESSAGES[event.reason] ?? 'No se pudo completar la acción';
  } else if (event.type === 'PURCHASE_SUCCESS' && event.itemId === 'shop-municion') {
    message = `+${AMMO_PER_PACK} balas de reserva`;
  } else if (event.type === 'PURCHASE_SUCCESS' && weaponForItem(event.itemId)) {
    message = `¡${weaponForItem(event.itemId).name} comprada! Equípala con ${isTouchDevice() ? 'el botón de armas' : 'las teclas 1-4'}`;
  } else if (event.type === 'PURCHASE_SUCCESS') {
    message = '¡Compra exitosa! Está en tu inventario (E)';
  } else if (event.type === 'PICKUP_SUCCESS') {
    const name = FOOD_ITEMS.find((item) => item.itemId === event.itemId)?.itemName ?? 'Objeto';
    message = `${name} guardado en el inventario (E para abrirlo)`;
  } else if (event.type === 'USE_SUCCESS') {
    message = `¡Recuperaste vida! +${healFor(event.itemId)}`;
  } else if (event.type === 'USE_REJECTED') {
    message = REJECTION_MESSAGES[event.reason] ?? 'No se pudo usar ese objeto';
  } else if (event.type === 'ABILITY_REJECTED') {
    message = REJECTION_MESSAGES[event.reason] ?? 'No se pudo usar la habilidad';
  } else if (event.type === 'REVIVE_REJECTED') {
    message = REJECTION_MESSAGES[event.reason] ?? 'No se pudo revivir';
  } else if (event.type === 'MISSION_SUCCESS') {
    const reward = getLatestState().players.find((p) => p.playerId === getMyRole())
      ?.missions?.find((m) => m.missionId === event.itemId)?.reward;
    message = `¡Misión completada! +${reward ?? ''} Garavitos`;
  }
  return message ? { message, ms: 2500 } : null;
}

export default function Hud() {
  const [state, setState] = useState({ players: [], claimedItemIds: [], lastEvent: null });
  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [nearVendor, setNearVendorState] = useState(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [nearDoor, setNearDoorState] = useState(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [nearDowned, setNearDownedState] = useState(null);
  const [waveBanner, setWaveBanner] = useState(null);
  const announcedWaveRef = useRef(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hurtKey, setHurtKey] = useState(0);
  const [stamina, setStaminaView] = useState(getStamina);
  useEffect(() => onStaminaChange(setStaminaView), []);
  const previousHealthRef = useRef(null);
  const lockBeforeSettingsRef = useRef(false);
  const touch = isTouchDevice();
  const mapCanvasRef = useRef(null);
  const stateRef = useRef(state);
  const floorLayoutCacheRef = useRef({ key: null, layout: null });

  useEffect(() => {
    return onStateChange(setState);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Mapa (tecla M): dibuja el piso actual en un canvas y una estela punteada
  // desde el jugador hasta su propia misión, si está en este piso.
  useEffect(() => {
    if (!mapOpen) return undefined;

    let rafId;
    const draw = () => {
      const canvas = mapCanvasRef.current;
      if (!canvas) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      const ctx = canvas.getContext('2d');
      const liveState = stateRef.current;
      const myRole = getMyRole();
      const me = liveState.players.find((p) => p.playerId === myRole);
      const myFloor = me?.floor ?? 1;

      const layoutKey = `${getMyBuilding()}-${myFloor}`;
      if (floorLayoutCacheRef.current.key !== layoutKey) {
        floorLayoutCacheRef.current = { key: layoutKey, layout: buildFloorLayout({ building: getMyBuilding(), floor: myFloor }) };
      }
      const layout = floorLayoutCacheRef.current.layout;

      ctx.fillStyle = '#0d0f10';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < MAP_ROWS; y += 1) {
        for (let x = 0; x < MAP_COLS; x += 1) {
          const cell = layout.grid[y][x];
          if (!cell || cell.type === 'wall' || cell.type === 'glass') continue;
          ctx.fillStyle = cell.type === 'stair' || cell.type === 'landing' ? '#5a4a34' : '#33382c';
          ctx.fillRect(x * MAP_CELL_PX, y * MAP_CELL_PX, MAP_CELL_PX, MAP_CELL_PX);
        }
      }

      liveState.players
        .filter((p) => p.playerId !== myRole && p.floor === myFloor)
        .forEach((p) => {
          ctx.fillStyle = 'rgba(210, 210, 210, 0.55)';
          ctx.beginPath();
          ctx.arc((p.x / TILE) * MAP_CELL_PX, (p.y / TILE) * MAP_CELL_PX, 4, 0, Math.PI * 2);
          ctx.fill();
        });

      const target = me ? nextMission(me) : null;
      const missionHere = target && target.floor === myFloor ? target : null;

      if (me) {
        const px = (me.x / TILE) * MAP_CELL_PX;
        const py = (me.y / TILE) * MAP_CELL_PX;

        if (missionHere) {
          const mx = (missionHere.x / TILE) * MAP_CELL_PX;
          const my = (missionHere.y / TILE) * MAP_CELL_PX;
          const t = performance.now() / 1000;

          ctx.save();
          ctx.strokeStyle = 'rgba(255, 214, 102, 0.85)';
          ctx.lineWidth = 2;
          ctx.setLineDash([7, 6]);
          ctx.lineDashOffset = -((t * 30) % 13);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(mx, my);
          ctx.stroke();
          ctx.restore();

          const pulse = 5 + Math.sin(t * 4) * 2;
          ctx.fillStyle = '#ffd666';
          ctx.beginPath();
          ctx.arc(mx, my, pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#8a6a1f';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#12313d';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [mapOpen]);

  useEffect(() => onNearVendorChange((vendor) => {
    setNearVendorState(vendor);
    if (!vendor) setShopOpen(false);
  }), []);

  useEffect(() => onNearDoorChange(setNearDoorState), []);
  useEffect(() => onNearDownedChange(setNearDownedState), []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        setPanelOpen((open) => !open);
        return;
      }
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        setMapOpen((open) => !open);
        return;
      }

      if (isInputLocked()) return;

      if (event.key === 'Escape' && !shopOpen && !inventoryOpen && !mapOpen) {
        openSettings();
        return;
      }

      if ((event.key === 'e' || event.key === 'E') && nearVendor) {
        event.preventDefault();
        setShopOpen((open) => !open);
        return;
      }
      if ((event.key === 'e' || event.key === 'E') && nearDoor) {
        event.preventDefault();
        requestDoorToggle(nearDoor.doorId, nearDoor.x, nearDoor.y);
        return;
      }
      if ((event.key === 'e' || event.key === 'E' || event.key === 'i' || event.key === 'I')
        && !getNearMission() && !getNearStairs() && !getNearDowned() && !getNearBarricade() && !getNearEvent()) {
        event.preventDefault();
        setInventoryOpen((open) => !open);
        return;
      }
      if (event.key === 'Escape') {
        setShopOpen(false);
        setInventoryOpen(false);
        setMapOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nearVendor, nearDoor, shopOpen, inventoryOpen, mapOpen]);

  // Avisos: se escucha cada evento en orden (con lastEvent, dos casi simultaneos se pisaban).
  const toastTimeoutRef = useRef(null);
  useEffect(() => onGameEvent((event) => {
    const toastInfo = toastFor(event);
    if (!toastInfo) return;
    setToast(toastInfo.message);
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), toastInfo.ms);
  }), []);

  // Aviso de Kinder: una sola vez cuando el Kinder N arranca. Depende solo de numeros
  // que cambian al cambiar de Kinder: con el objeto `state.wave` (nuevo en cada tick del
  // servidor) el cleanup cancelaba el timeout y el aviso nunca se ocultaba.
  const kinderNumber = state.wave?.number ?? 0;
  const kinderActive = !!state.wave && state.wave.restingSeconds === 0 && !state.wave.victory && kinderNumber > 0;
  const kinderQuota = state.wave?.quota ?? 0;
  const bossStage = !!state.wave?.bossStage;
  useEffect(() => {
    if (kinderNumber < announcedWaveRef.current) announcedWaveRef.current = 0; // la corrida se reinicio
    if (!kinderActive || kinderNumber <= announcedWaveRef.current) return undefined;

    announcedWaveRef.current = kinderNumber;
    setWaveBanner(bossStage
      ? { boss: true, title: `Kinder ${kinderNumber}`, big: 'El Ingeniero de Sistemas', sub: 'viene por ustedes' }
      : { boss: false, title: `Kinder ${kinderNumber}`, big: `Kinder ${kinderNumber}`, sub: `Maten ${kinderQuota} zombis y completen ${MISSIONS_PER_KINDER} misiones cada uno` });
    playSfx(bossStage ? 'bossStinger' : 'kinderStinger');
    const timeout = setTimeout(() => setWaveBanner(null), 3600);
    return () => clearTimeout(timeout);
  }, [kinderNumber, kinderActive, kinderQuota, bossStage]);

  const me = state.players.find((p) => p.playerId === getMyRole());
  const others = state.players.filter((p) => p.playerId !== getMyRole());
  const health = me?.health ?? 100;

  // Viñeta roja en los bordes cada vez que baja la vida (la key reinicia la animacion).
  useEffect(() => {
    const previous = previousHealthRef.current;
    previousHealthRef.current = health;
    if (previous != null && health < previous) setHurtKey((key) => key + 1);
  }, [health]);

  function openSettings() {
    // El personaje se queda quieto mientras el panel esta abierto; al cerrarlo se
    // devuelve el bloqueo que hubiera (p. ej. un minijuego de mision abierto).
    lockBeforeSettingsRef.current = isInputLocked();
    setInputLocked(true);
    setShopOpen(false);
    setInventoryOpen(false);
    setMapOpen(false);
    setSettingsOpen(true);
  }

  const closeSettings = () => {
    setSettingsOpen(false);
    setInputLocked(lockBeforeSettingsRef.current);
  };
  const garavitos = me?.garavitos ?? 0;
  const inventory = me?.inventory ?? [];
  const slots = [...inventory, ...Array(5 - inventory.length).fill(null)];
  const inventoryFull = inventory.length >= 5;

  const floor = me?.floor ?? 1;
  const chargedReadyIn = me?.chargedReadyInMs ?? 0;
  const chargedPct = Math.min(100, Math.round(((CHARGED_COOLDOWN_MS - chargedReadyIn) / CHARGED_COOLDOWN_MS) * 100));
  const role = roleInfo(getMyRole());
  const weapon = weaponById(me?.weapon);
  const reloadingMs = me?.reloadingMs ?? 0;
  const reloadPct = weapon.reloadMs ? Math.round((1 - reloadingMs / weapon.reloadMs) * 100) : 100;

  const nearDoorState = state.doors?.find((d) => d.doorId === nearDoor?.doorId);
  const nearDoorOpen = nearDoorState?.open ?? true;

  const ability = abilityFor(getMyRole());
  const abilityCooling = (me?.abilityReadyInMs ?? 0) > 0;
  const abilityPct = Math.round((1 - (me?.abilityReadyInMs ?? 0) / BARRICADE_COOLDOWN_MS) * 100);
  const myBarricades = getBarricades().filter((b) => b.ownerId === getMyRole()).length;
  const nearBarricade = getNearBarricade();
  const missions = me?.missions ?? [];
  const missionsDone = missions.filter((m) => m.done).length;
  const upNext = me ? nextMission(me) : null;
  const myMissionOnThisFloor = upNext && upNext.floor === floor ? upNext : null;
  const myMissionElsewhere = upNext && upNext.floor !== floor ? upNext : null;

  const handleBuy = (item) => {
    if (!nearVendor) return;

    purchaseItem(item.itemId, nearVendor.x, nearVendor.y);
  };

  return (
    <div className={`hud${touch ? ' hud--touch' : ''}`}>
      {hurtKey > 0 && <div key={hurtKey} className={`hud-hurt-vignette${health <= 30 ? ' hud-hurt-vignette--critical' : ''}`} />}
      {health > 0 && health <= 30 && me?.lifeState !== 'DOWNED' && <div className="hud-low-health" aria-hidden="true" />}

      <div className="hud-top-left">
        <div className={`hud-health${health <= 30 ? ' hud-health--low' : ''}`}>
          <Icon name="heart" className="hud-health-heart" />
          <div className="hud-health-bar">
            <div className="hud-health-fill" style={{ width: `${health}%`, background: healthColor(health) }} />
            <span className="hud-health-label">{health} / 100</span>
          </div>
        </div>
        <div
          className={`hud-stamina${stamina.value >= 1 ? ' hud-stamina--full' : ''}${stamina.exhausted ? ' hud-stamina--empty' : ''}`}
          title={touch ? 'Energía: lleva el joystick al tope para correr' : 'Energía: mantén Espacio para correr'}
        >
          <div style={{ width: `${Math.round(stamina.value * 100)}%` }} />
        </div>

        <div className="hud-stats-row">
          <div className="hud-garavitos"><Icon name="coin" /> {garavitos} Garavitos</div>
          <div className="hud-floor">{role.name} — Piso {floor}</div>
        </div>

        <div className="hud-inventory">
          {slots.map((slot, i) => (
            <div
              key={`${slot?.itemId ?? 'empty'}-${i}`}
              className="hud-slot"
              style={slot ? { background: TYPE_COLORS[slot.type] } : undefined}
              title={slot?.itemName ?? 'Vacío'}
            >
              {slot && itemIcon(slot.itemId) && <img src={itemIcon(slot.itemId)} alt={slot.itemName} className="hud-slot-icon" />}
            </div>
          ))}
        </div>

        <div className={`hud-weapon${weapon.ranged && me?.magazine === 0 ? ' hud-weapon--empty' : ''}`}>
          {weapon.icon
            ? <img src={weapon.icon} alt="" className="hud-weapon-icon" />
            : <span className="hud-weapon-glyph" aria-hidden="true"><Glyph value={weapon.glyph} /></span>}
          <span className="hud-weapon-name">{weapon.name}</span>
          {weapon.ranged && (
            <span className="hud-weapon-ammo">
              {reloadingMs > 0 ? 'Recargando…' : <AmmoPips loaded={me?.magazine ?? 0} size={weapon.magazineSize} />}
              <small>{me?.magazine ?? 0}/{weapon.magazineSize} · {me?.reserveAmmo ?? 0}</small>
            </span>
          )}
          {!touch && <span className="hud-weapon-keys">1-4{weapon.ranged ? ' · R' : ''}</span>}
          {reloadingMs > 0 && <div className="hud-weapon-reload" style={{ width: `${reloadPct}%` }} />}
        </div>

        <div className={`hud-ability-chip${abilityCooling ? ' hud-ability-chip--cooling' : ''}`} title={ability.hint}>
          {!touch && <span className="hud-ability-key">F</span>}
          <Glyph value={ability.icon} />
          <span>{ability.name}</span>
          {me?.role === 'INFRAESTRUCTURA' && (
            <small>{myBarricades}/{MAX_BARRICADES}{abilityCooling ? ` · ${Math.ceil(me.abilityReadyInMs / 1000)}s` : ''}</small>
          )}
          {abilityCooling && <div className="hud-ability-fill" style={{ width: `${abilityPct}%` }} />}
        </div>

        {missions.length > 0 && (
          <div className="hud-missions">
            <div className="hud-missions-title">
              Misiones {missionsDone}/{missions.length}
            </div>
            {missions.map((mission) => (
              <div key={mission.missionId} className={`hud-mission${mission.done ? ' hud-mission--done' : ''}`}>
                <Glyph value={mission.done ? '✓' : missionType(mission.type).icon} />
                <span className="hud-mission-room">{mission.room}</span>
                <span className="hud-mission-floor">P{mission.floor}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hud-top-right">
        <div className="hud-menu-buttons">
          {touch && (
            <button
              type="button"
              className="hud-icon-btn"
              aria-label="Mapa y equipo"
              onClick={() => {
                playSfx('click');
                setMapOpen((open) => !open);
              }}
            >
              <Icon name="map" />
            </button>
          )}
          <button
            type="button"
            className="hud-icon-btn"
            aria-label="Configuración"
            title="Configuración (Esc)"
            onClick={() => {
              playSfx('click');
              openSettings();
            }}
          >
            <Icon name="gear" />
          </button>
        </div>

        {state.wave && (
          <div className={`hud-wave${state.wave.restingSeconds > 0 || state.wave.victory ? ' hud-wave--resting' : ' hud-wave--active'}`}>
            {kinderStatus(state.wave, state.boss)}
          </div>
        )}

        <div className="hud-hint">Tab: equipo · M: mapa · E: inventario · Esc: ajustes</div>
      </div>

      {!isTouchDevice() && (
      <div className="hud-abilities">
        <div className="hud-ability">
          <span className="hud-ability-key">Q</span>
          <span className="hud-ability-name">Ataque básico</span>
        </div>
        <div className={`hud-ability${chargedPct < 100 ? ' hud-ability--cooling' : ' hud-ability--ready'}`}>
          <span className="hud-ability-key">C</span>
          <span className="hud-ability-name">
            Ataque cargado{chargedPct < 100 ? ` (${Math.ceil(chargedReadyIn / 1000)}s)` : ''}
          </span>
          <div className="hud-ability-fill" style={{ width: `${chargedPct}%` }} />
        </div>
      </div>
      )}

      {nearVendor && !shopOpen && (
        <div className="hud-interact-hint">
          {touch ? 'Toca' : 'Presiona'} <strong>E</strong> — {nearVendor.label}
        </div>
      )}

      {nearDowned && (
        <div className="hud-interact-hint hud-interact-hint--revive">
          {touch ? 'Mantén' : 'Mantén'} <strong>E</strong> — revivir a {nearDowned.name}
          {me?.reviving === nearDowned.playerId && (
            <div className="hud-revive-bar"><div style={{ width: `${Math.round((me.reviveProgress ?? 0) * 100)}%` }} /></div>
          )}
        </div>
      )}

      {state.event && (
        <div className={`hud-kinder-event hud-kinder-event--${state.event.type.toLowerCase()}`}>
          <Icon name={state.event.type === 'BLACKOUT' ? 'bolt' : 'box'} />{' '}
          {state.event.type === 'BLACKOUT'
            ? `Apagón — tablero en ${state.event.room} (piso ${state.event.floor})`
            : `Suministros en ${state.event.room} (piso ${state.event.floor})`}
          <strong> {Math.ceil(state.event.endsInMs / 1000)}s</strong>
        </div>
      )}

      {getNearEvent() && state.event && (
        <div className="hud-interact-hint">
          {touch ? 'Toca' : 'Presiona'} <strong>E</strong> — {state.event.type === 'BLACKOUT' ? 'Restablecer la luz' : 'Recoger los suministros'}
        </div>
      )}

      {nearBarricade && (
        <div className="hud-interact-hint">
          {touch ? 'Toca' : 'Presiona'} <strong>E</strong> — Reparar barricada ({nearBarricade.health}/20)
        </div>
      )}

      {nearDoor && !nearDowned && !nearBarricade && (
        <div className="hud-interact-hint">
          {touch ? 'Toca' : 'Presiona'} <strong>E</strong> — {nearDoorOpen ? 'Cerrar' : 'Abrir'} puerta
        </div>
      )}

      {toast && <div className="hud-toast">{toast}</div>}
      {waveBanner && (
        <div className={`hud-wave-banner${waveBanner.boss ? ' hud-wave-banner--boss' : ''}`} role="status">
          <span className="hud-wave-banner-bar" aria-hidden="true" />
          {waveBanner.boss && <span className="hud-wave-banner-kicker">{waveBanner.title}</span>}
          <strong className="hud-wave-banner-title">{waveBanner.big}</strong>
          <span className="hud-wave-banner-sub">{waveBanner.sub}</span>
          <span className="hud-wave-banner-bar hud-wave-banner-bar--bottom" aria-hidden="true" />
        </div>
      )}

      {mapOpen && (
        <div className="map-modal map-modal--overview">
          <button type="button" className="modal-close" aria-label="Cerrar mapa" onClick={() => setMapOpen(false)}>✕</button>
          <h3>Mapa — Piso {floor}</h3>
          <div className="map-overview-grid">
            <div className="map-overview-col map-overview-col--map">
              <canvas
                ref={mapCanvasRef}
                width={MAP_COLS * MAP_CELL_PX}
                height={MAP_ROWS * MAP_CELL_PX}
                className="map-canvas"
              />
              <div className="map-legend">
                <span><i className="map-legend-dot map-legend-dot--me" /> Tú</span>
                <span><i className="map-legend-dot map-legend-dot--mate" /> Compañeros</span>
                <span><i className="map-legend-dot map-legend-dot--mission" /> Tu próxima misión</span>
              </div>
              {myMissionOnThisFloor && (
                <p className="map-mission-note">
                  Sigue la estela punteada hasta {missionType(myMissionOnThisFloor.type).icon} {myMissionOnThisFloor.room}, en este piso.
                </p>
              )}
              {myMissionElsewhere && (
                <p className="map-mission-note">
                  Tu próxima misión es en {myMissionElsewhere.room}: ve al piso {myMissionElsewhere.floor}.
                </p>
              )}
            </div>

            <div className="map-overview-col map-overview-col--team">
              <h4>Equipo</h4>
              {others.length === 0 && <p className="team-panel-empty">Nadie más conectado todavía.</p>}
              {others.map((p) => (
                <div key={p.playerId} className="team-panel-row">
                  <strong>{nameWithRole(p)}</strong> — {p.health} / 100
                  <div className="hud-health-bar hud-health-bar--small">
                    <div className="hud-health-fill" style={{ width: `${p.health}%`, background: healthColor(p.health) }} />
                  </div>
                </div>
              ))}
              <div className="team-panel-row team-panel-row--me">
                <strong>Tú ({role.name})</strong> — {health} / 100
                <div className="hud-health-bar hud-health-bar--small">
                  <div className="hud-health-fill" style={{ width: `${health}%`, background: healthColor(health) }} />
                </div>
              </div>
            </div>

            <div className="map-overview-col map-overview-col--inventory">
              <h4>Inventario</h4>
              {inventory.length === 0 && <p className="inventory-empty">Vacío. Recoge comida o compra objetos.</p>}
              <div className="inventory-list">
                {inventory.map((slot, i) => (
                  <div key={`${slot.itemId}-${i}`} className="inventory-row">
                    <span className="inventory-swatch" style={{ background: TYPE_COLORS[slot.type] }}>
                      {itemIcon(slot.itemId) && <img src={itemIcon(slot.itemId)} alt="" className="inventory-icon" />}
                    </span>
                    <span className="inventory-name">{slot.itemName}</span>
                    {slot.type === 'FOOD' ? (
                      <button type="button" className="inventory-use" onClick={() => requestUseItem(slot.itemId)}>
                        Comer +{healFor(slot.itemId)}
                      </button>
                    ) : (
                      <WeaponAction slot={slot} equipped={weapon} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {!touch && <p className="shop-hint">M / Esc para cerrar</p>}
        </div>
      )}

      {inventoryOpen && (
        <div className="inventory-modal">
          <button type="button" className="modal-close" aria-label="Cerrar inventario" onClick={() => setInventoryOpen(false)}>✕</button>
          <h3>Inventario</h3>
          {inventory.length === 0 && <p className="inventory-empty">Vacío. Recoge comida o compra objetos.</p>}
          <div className="inventory-list">
            {inventory.map((slot, i) => (
              <div key={`${slot.itemId}-${i}`} className="inventory-row">
                <span className="inventory-swatch" style={{ background: TYPE_COLORS[slot.type] }}>
                  {itemIcon(slot.itemId) && <img src={itemIcon(slot.itemId)} alt="" className="inventory-icon" />}
                </span>
                <span className="inventory-name">{slot.itemName}</span>
                {slot.type === 'FOOD' ? (
                  <button type="button" className="inventory-use" onClick={() => requestUseItem(slot.itemId)}>
                    Comer +{healFor(slot.itemId)}
                  </button>
                ) : (
                  <WeaponAction slot={slot} equipped={weapon} />
                )}
              </div>
            ))}
          </div>
          {!touch && <p className="shop-hint">E / I / Esc para cerrar</p>}
        </div>
      )}

      {shopOpen && nearVendor && (
        <div className="shop-modal">
          <button type="button" className="modal-close" aria-label="Cerrar tienda" onClick={() => setShopOpen(false)}>✕</button>
          <h3>{nearVendor.label}</h3>
          <div className="shop-items">
            {nearVendor.menu.map((item) => {
              const price = priceFor(getMyRole(), item.price);
              const canAfford = garavitos >= price;
              const disabled = !canAfford || inventoryFull;
              return (
                <button
                  key={item.itemId}
                  type="button"
                  className="shop-item"
                  disabled={disabled}
                  onClick={() => handleBuy(item)}
                  title={disabled ? (inventoryFull ? 'Inventario lleno' : 'No tienes suficientes Garavitos') : undefined}
                >
                  <img src={item.icon} alt={item.itemName} className="shop-item-icon" />
                  <span className="shop-item-name">{item.itemName}</span>
                  {item.healAmount > 0 && <span className="shop-item-heal">+{item.healAmount} vida</span>}
                  {item.detail && <span className="shop-item-heal">{item.detail}</span>}
                  <span className="shop-item-price">
                    {price !== item.price && <s>{item.price}</s>} {price} Garavitos
                  </span>
                </button>
              );
            })}
          </div>
          {!touch && <p className="shop-hint">E / Esc para cerrar</p>}
        </div>
      )}

      {panelOpen && (
        <div className="team-panel">
          <h3>Equipo</h3>
          {others.length === 0 && <p className="team-panel-empty">Nadie más conectado todavía.</p>}
          {others.map((p) => (
            <div key={p.playerId} className="team-panel-row">
              <strong>{p.role}</strong> — {p.garavitos} Garavitos
              <div className="hud-health-bar hud-health-bar--small">
                <div className="hud-health-fill" style={{ width: `${p.health}%`, background: healthColor(p.health) }} />
              </div>
              <div className="hud-inventory hud-inventory--small">
                {p.inventory.length === 0 && <span className="team-panel-empty-inv">sin items</span>}
                {p.inventory.map((slot) => (
                  <div key={slot.itemId} className="hud-slot hud-slot--small" style={{ background: TYPE_COLORS[slot.type] }} title={slot.itemName} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {settingsOpen && <SettingsPanel inGame onClose={closeSettings} />}
    </div>
  );
}
