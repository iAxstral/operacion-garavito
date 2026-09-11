import { useEffect, useState } from 'react';
import { socketService } from '../services/socketService';
import { ensureJoined, getMyRole, onStateChange, submitDecision } from '../game/gameSync';

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

  useEffect(() => {
    socketService.connect({ onConnect: () => ensureJoined() });
    return onStateChange(setState);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Tab' || event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        setPanelOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const event = state.lastEvent;
    if (!event || event.playerId !== getMyRole() || event.type !== 'PICKUP_REJECTED') return undefined;

    setToast(REJECTION_MESSAGES[event.reason] ?? 'No se pudo recoger el item');
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
  const inventory = me?.inventory ?? [];
  const slots = [...inventory, ...Array(5 - inventory.length).fill(null)];

  return (
    <div className="hud">
      <div className="hud-health-bar">
        <div className="hud-health-fill" style={{ width: `${health}%`, background: healthColor(health) }} />
        <span className="hud-health-label">{health} / 100</span>
      </div>

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

      {toast && <div className="hud-toast">{toast}</div>}
      {roundBanner && <div className="hud-round-banner">{roundBanner}</div>}

      {panelOpen && (
        <div className="team-panel">
          <h3>Equipo</h3>
          {others.length === 0 && <p className="team-panel-empty">Nadie más conectado todavía.</p>}
          {others.map((p) => (
            <div key={p.playerId} className="team-panel-row">
              <strong>{p.role}</strong>
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
