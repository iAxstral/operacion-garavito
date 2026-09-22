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
import { REWARD_GARAVITOS } from '../game/missionCatalog';
import { FOOD_ITEMS } from '../game/itemCatalog';
import { CAFETERIA_MENU } from '../game/shopCatalog';
import { roleInfo } from '../game/roleCatalog';

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

  useEffect(() => {
    return onStateChange(setState);
  }, []);

  useEffect(() => onNearVendorChange((vendor) => {
    setNearVendorState(vendor);
    if (!vendor) setShopOpen(false);
  }), []);

  useEffect(() => onNearDoorChange(setNearDoorState), []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Tab' || event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        setPanelOpen((open) => !open);
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

      <div className="hud-hint">Tab / M: equipo · E: inventario</div>

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
