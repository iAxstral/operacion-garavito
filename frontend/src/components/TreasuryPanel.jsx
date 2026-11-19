import { useEffect, useState } from 'react';
import {
  getMyRole,
  onAbilityPanelChange,
  onStateChange,
  requestTransfer,
  setAbilityPanel,
} from '../game/gameSync';
import { nameWithRole } from '../game/profile';
import { playSfx } from '../game/sfx';

const AMOUNTS = [5, 10, 25];

/** Habilidad de Economia: enviar Garavitos a los compañeros desde cualquier lugar. */
export default function TreasuryPanel() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ players: [] });

  useEffect(() => onAbilityPanelChange((panel) => setOpen(panel === 'treasury')), []);
  useEffect(() => onStateChange(setState), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      // Captura: que el Esc no llegue al HUD (abriria la configuracion).
      event.stopPropagation();
      setAbilityPanel(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  if (!open) return null;

  const me = state.players.find((p) => p.playerId === getMyRole());
  const balance = me?.garavitos ?? 0;
  const mates = state.players.filter((p) => p.playerId !== getMyRole());

  return (
    <div className="treasury-panel" role="dialog" aria-label="Tesorería">
      <div className="phone-header">
        <span>💰 Tesorería — tienes {balance} Garavitos</span>
        <button type="button" className="modal-close phone-close" aria-label="Cerrar tesorería" onClick={() => setAbilityPanel(null)}>✕</button>
      </div>
      <p className="phone-note">Reparte el dinero del equipo: armas, munición y comida. Compras con 20% de descuento.</p>
      {mates.length === 0 && <p className="team-panel-empty">No hay compañeros en la sala.</p>}
      {mates.map((mate) => (
        <div key={mate.playerId} className="treasury-row">
          <span className="treasury-name">
            <strong>{nameWithRole(mate)}</strong>
            <small>{mate.garavitos} G · {mate.health} vida{mate.lifeState === 'DOWNED' ? ' · caído' : ''}</small>
          </span>
          {AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              className="inventory-use"
              disabled={balance < amount}
              onClick={() => {
                requestTransfer(mate.playerId, amount);
                playSfx('coins');
              }}
            >
              +{amount}
            </button>
          ))}
        </div>
      ))}
      <p className="phone-note">F / Esc para cerrar.</p>
    </div>
  );
}
