import { useEffect, useRef, useState } from 'react';
import {
  getMyRole,
  onStateChange,
  submitDecision,
  onNearVendorChange,
  onNearDoorChange,
  requestDoorToggle,
  requestUseItem,
  getNearMission,
  getNearStairs,
  isTouchDevice,
  isInputLocked,
  purchaseItem,
} from '../game/gameSync';
import { MISSION_ZONES, REWARD_GARAVITOS } from '../game/missionCatalog';
import { FOOD_ITEMS } from '../game/itemCatalog';
import { CAFETERIA_MENU } from '../game/shopCatalog';
import { roleInfo } from '../game/roleCatalog';
import { buildFloorLayout, MAP_COLS, MAP_ROWS, TILE } from '../game/mapLayout';

const MAP_CELL_PX = 12;

const PLACEHOLDER_ACTION = 'placeholder_action';

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
};

const FOOD_HEAL_DEFAULT = 15;
const CHARGED_COOLDOWN_MS = 6000;

function healFor(itemId) {
  return CAFETERIA_MENU.find((item) => item.itemId === itemId)?.healAmount ?? FOOD_HEAL_DEFAULT;
}

function itemIcon(itemId) {
  return CAFETERIA_MENU.find((item) => item.itemId === itemId)?.icon ?? null;
}

function healthColor(health) {
  if (health > 60) return '#4caf50';
  if (health > 30) return '#e0a13a';
  return '#c0392b';
}

export default function Hud() {
  const [state, setState] = useState({ players: [], claimedItemIds: [], lastEvent: null, round: null });
  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [roundBanner, setRoundBanner] = useState(null);
  const [nearVendor, setNearVendorState] = useState(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [nearDoor, setNearDoorState] = useState(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [waveBanner, setWaveBanner] = useState(null);
  const announcedWaveRef = useRef(0);
  const [mapOpen, setMapOpen] = useState(false);
  const mapCanvasRef = useRef(null);
  const stateRef = useRef(state);
  const floorLayoutCacheRef = useRef({ floor: null, layout: null });

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

      if (floorLayoutCacheRef.current.floor !== myFloor) {
        floorLayoutCacheRef.current = { floor: myFloor, layout: buildFloorLayout({ floor: myFloor }) };
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

      const missionHere = MISSION_ZONES.find((zone) => zone.role === myRole && zone.floor === myFloor);

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
        && !getNearMission() && !getNearStairs()) {
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
  }, [nearVendor, nearDoor]);

  useEffect(() => {
    const event = state.lastEvent;
    if (!event || event.playerId !== getMyRole()) return undefined;

    let message = null;
    if (
      event.type === 'PICKUP_REJECTED'
      || event.type === 'PURCHASE_REJECTED'
      || event.type === 'MISSION_REJECTED'
      || event.type === 'DOOR_REJECTED'
    ) {
      message = REJECTION_MESSAGES[event.reason] ?? 'No se pudo completar la acción';
    } else if (event.type === 'PURCHASE_SUCCESS') {
      message = '¡Compra exitosa! Está en tu inventario (E)';
    } else if (event.type === 'PICKUP_SUCCESS') {
      const name = FOOD_ITEMS.find((item) => item.itemId === event.itemId)?.itemName ?? 'Objeto';
      message = `${name} guardado en el inventario (E para abrirlo)`;
    } else if (event.type === 'USE_SUCCESS') {
      message = `¡Recuperaste vida! +${healFor(event.itemId)}`;
    } else if (event.type === 'USE_REJECTED') {
      message = REJECTION_MESSAGES[event.reason] ?? 'No se pudo usar ese objeto';
    } else if (event.type === 'MISSION_SUCCESS') {
      message = `¡Misión completada! +${REWARD_GARAVITOS} Garavitos`;
    }
    if (!message) return undefined;

    setToast(message);
    const timeout = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timeout);

  }, [state.lastEvent]);

  useEffect(() => {
    if (!state.round?.resolved) return undefined;

    setRoundBanner(`¡Ronda ${state.round.number} resuelta!`);
    const timeout = setTimeout(() => setRoundBanner(null), 3000);
    return () => clearTimeout(timeout);

  }, [state.round]);

  // Aviso de oleada: se dispara una sola vez apenas la oleada N empieza a spawnear
  // (restingSeconds llega a 0 y ya hay zombis por aparecer), sin importar el piso o
  // el edificio — el Edificio C tambien tiene oleadas desde el piso 2 en adelante.
  useEffect(() => {
    const wave = state.wave;
    if (!wave || wave.restingSeconds > 0 || wave.remaining <= 0) return undefined;
    if (wave.number <= announcedWaveRef.current) return undefined;

    announcedWaveRef.current = wave.number;
    setWaveBanner(`¡Oleada ${wave.number}! Se acercan ${wave.remaining} zombis`);
    const timeout = setTimeout(() => setWaveBanner(null), 3200);
    return () => clearTimeout(timeout);
  }, [state.wave]);

  const me = state.players.find((p) => p.playerId === getMyRole());
  const others = state.players.filter((p) => p.playerId !== getMyRole());
  const health = me?.health ?? 100;
  const garavitos = me?.garavitos ?? 0;
  const inventory = me?.inventory ?? [];
  const slots = [...inventory, ...Array(5 - inventory.length).fill(null)];
  const inventoryFull = inventory.length >= 5;

  const floor = me?.floor ?? 1;
  const chargedReadyIn = me?.chargedReadyInMs ?? 0;
  const chargedPct = Math.min(100, Math.round(((CHARGED_COOLDOWN_MS - chargedReadyIn) / CHARGED_COOLDOWN_MS) * 100));
  const role = roleInfo(getMyRole());

  const nearDoorState = state.doors?.find((d) => d.doorId === nearDoor?.doorId);
  const nearDoorOpen = nearDoorState?.open ?? true;

  const myMissionOnThisFloor = MISSION_ZONES.find((zone) => zone.role === getMyRole() && zone.floor === floor);
  const myMissionElsewhere = !myMissionOnThisFloor
    ? MISSION_ZONES.find((zone) => zone.role === getMyRole())
    : null;

  const handleBuy = (item) => {
    if (!nearVendor) return;

    purchaseItem(item.itemId, nearVendor.x, nearVendor.y);
  };

  return (
    <div className="hud">
      <div className="hud-health-bar">
        <div className="hud-health-fill" style={{ width: `${health}%`, background: healthColor(health) }} />
        <span className="hud-health-label">{health} / 100</span>
      </div>

      <div className="hud-garavitos">{garavitos} Garavitos</div>

      <div className="hud-floor">{role.name} — Piso {floor}</div>

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

      <div className="hud-hint">Tab: equipo · M: mapa · E: inventario</div>

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

      {state.round && <div className="hud-round">Ronda {state.round.number}</div>}

      {state.wave && (
        <div className={`hud-wave${state.wave.restingSeconds > 0 ? ' hud-wave--resting' : ' hud-wave--active'}`}>
          {state.wave.restingSeconds > 0
            ? `Prepárate — oleada ${state.wave.number + 1} en ${state.wave.restingSeconds}s`
            : `Oleada ${state.wave.number} — quedan ${state.wave.remaining} zombis`}
        </div>
      )}

      <button type="button" className="hud-decide-btn" onClick={() => submitDecision(PLACEHOLDER_ACTION)}>
        Decidir
      </button>

      {nearVendor && !shopOpen && (
        <div className="hud-interact-hint">
          Presiona <strong>E</strong> — {nearVendor.label}
        </div>
      )}

      {nearDoor && (
        <div className="hud-interact-hint">
          Presiona <strong>E</strong> — {nearDoorOpen ? 'Cerrar' : 'Abrir'} puerta
        </div>
      )}

      {toast && <div className="hud-toast">{toast}</div>}
      {roundBanner && <div className="hud-round-banner">{roundBanner}</div>}
      {waveBanner && <div className="hud-wave-banner">{waveBanner}</div>}

      {mapOpen && (
        <div className="map-modal map-modal--overview">
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
                <span><i className="map-legend-dot map-legend-dot--mission" /> {role.missionIcon} Tu misión</span>
              </div>
              {myMissionOnThisFloor && (
                <p className="map-mission-note">
                  Sigue la estela punteada hasta {role.missionIcon} Misión, en este piso.
                </p>
              )}
              {myMissionElsewhere && (
                <p className="map-mission-note">
                  Tu misión no está en este piso: sube o baja al piso {myMissionElsewhere.floor}.
                </p>
              )}
            </div>

            <div className="map-overview-col map-overview-col--team">
              <h4>Equipo</h4>
              {others.length === 0 && <p className="team-panel-empty">Nadie más conectado todavía.</p>}
              {others.map((p) => (
                <div key={p.playerId} className="team-panel-row">
                  <strong>{roleInfo(p.role).name}</strong> — {p.health} / 100
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
                      <span className="inventory-tag">{slot.type === 'WEAPON' ? 'Arma equipada' : 'Munición'}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="shop-hint">M / Esc para cerrar</p>
        </div>
      )}

      {inventoryOpen && (
        <div className="inventory-modal">
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
                  <span className="inventory-tag">{slot.type === 'WEAPON' ? 'Arma equipada' : 'Munición'}</span>
                )}
              </div>
            ))}
          </div>
          <p className="shop-hint">E / I / Esc para cerrar</p>
        </div>
      )}

      {shopOpen && nearVendor && (
        <div className="shop-modal">
          <h3>{nearVendor.label}</h3>
          <div className="shop-items">
            {nearVendor.menu.map((item) => {
              const canAfford = garavitos >= item.price;
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
                  <span className="shop-item-price">{item.price} Garavitos</span>
                </button>
              );
            })}
          </div>
          <p className="shop-hint">E / Esc para cerrar</p>
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
    </div>
  );
}
