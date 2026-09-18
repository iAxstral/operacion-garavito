import { useEffect, useState } from 'react';
import { socketService } from '../services/socketService';
import {
  ensureJoined,
  getMyRole,
  onStateChange,
  submitDecision,
  onNearVendorChange,
  onNearDoorChange,
  requestDoorToggle,
  isInputLocked,
  purchaseItem,
} from '../game/gameSync';
import { REWARD_GARAVITOS } from '../game/missionCatalog';

// Placeholder: una sola accion fija. El catalogo real de acciones por rol
// (y su UI) es un cambio aparte — esto solo demuestra el flujo end-to-end
// de decision -> RoundCoordinator -> resolucion -> broadcast.
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
};

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

  useEffect(() => {
    socketService.connect({ onConnect: () => ensureJoined() });
    return onStateChange(setState);
  }, []);

  useEffect(() => onNearVendorChange((vendor) => {
    setNearVendorState(vendor);
    if (!vendor) setShopOpen(false); // el jugador se alejo: cerrar el menu si estaba abierto
  }), []);

  useEffect(() => onNearDoorChange(setNearDoorState), []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Tab' || event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        setPanelOpen((open) => !open);
        return;
      }
      // Con una tarea de mision abierta (SecurityMission.jsx) el jugador
      // esta inmovilizado — ninguna de estas interacciones deberia disparar
      // mientras tanto.
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
      if (event.key === 'Escape' && shopOpen) {
        setShopOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nearVendor, nearDoor, shopOpen]);

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
      message = '¡Compra exitosa!';
    } else if (event.type === 'MISSION_SUCCESS') {
      message = `¡Misión completada! +${REWARD_GARAVITOS} Garavitos`;
    }
    if (!message) return undefined;

    setToast(message);
    const timeout = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lastEvent]);

  // Aviso de ronda resuelta: a diferencia del toast de pickup (solo para el
  // jugador afectado), esto lo ve cualquier jugador conectado — resolver
  // una ronda es un evento del juego entero, no de un jugador especifico.
  useEffect(() => {
    if (!state.round?.resolved) return undefined;

    setRoundBanner(`¡Ronda ${state.round.number} resuelta!`);
    const timeout = setTimeout(() => setRoundBanner(null), 3000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.round]);

  const me = state.players.find((p) => p.playerId === getMyRole());
  const others = state.players.filter((p) => p.playerId !== getMyRole());
  const health = me?.health ?? 100;
  const garavitos = me?.garavitos ?? 0;
  const inventory = me?.inventory ?? [];
  const slots = [...inventory, ...Array(5 - inventory.length).fill(null)];
  const inventoryFull = inventory.length >= 5;

  const nearDoorState = state.doors?.find((d) => d.doorId === nearDoor?.doorId);
  const nearDoorOpen = nearDoorState?.open ?? true;

  const handleBuy = (item) => {
    if (!nearVendor) return;
    // El vendedor tiene posicion fija y conocida; si el menu esta abierto es
    // porque el cliente ya se detecto dentro de rango de ESE vendedor, asi
    // que enviar su propia posicion como x/y satisface la validacion de
    // proximidad del backend sin necesitar un puente aparte para la
    // posicion exacta del jugador.
    purchaseItem(item.itemId, nearVendor.x, nearVendor.y);
  };

  return (
    <div className="hud">
      <div className="hud-health-bar">
        <div className="hud-health-fill" style={{ width: `${health}%`, background: healthColor(health) }} />
        <span className="hud-health-label">{health} / 100</span>
      </div>

      <div className="hud-garavitos">{garavitos} Garavitos</div>

      <div className="hud-inventory">
        {slots.map((slot, i) => (
          <div
            key={slot?.itemId ?? `empty-${i}`}
            className="hud-slot"
            style={slot ? { background: TYPE_COLORS[slot.type] } : undefined}
            title={slot?.itemName ?? 'Vacío'}
          />
        ))}
      </div>

      <div className="hud-hint">Tab / M: equipo</div>

      {state.round && <div className="hud-round">Ronda {state.round.number}</div>}

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
