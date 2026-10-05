import { useEffect, useState } from 'react';
import {
  getMyRole,
  onSpectateChange,
  onStateChange,
  setSpectateTarget,
  spectatableTeammates,
} from '../game/gameSync';
import { roleInfo } from '../game/roleCatalog';
import { playSfx } from '../game/sfx';

const REVIVER_ROLE = 'SALUD';

// Se muestra mientras este jugador esta caido: a quien esta mirando y con que
// compañero cambiar (botones, flechas o A/D).
export default function SpectatorPanel() {
  const [state, setState] = useState({ players: [] });
  const [target, setTarget] = useState(null);

  useEffect(() => onStateChange(setState), []);
  useEffect(() => onSpectateChange(setTarget), []);

  const me = state.players.find((p) => p.playerId === getMyRole());
  const downed = me?.lifeState === 'DOWNED';
  const teammates = downed ? spectatableTeammates() : [];

  useEffect(() => {
    if (!downed) return undefined;
    const onKeyDown = (event) => {
      const step = event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D' ? 1
        : event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A' ? -1 : 0;
      if (!step) return;
      const list = spectatableTeammates();
      if (list.length === 0) return;
      const index = Math.max(0, list.findIndex((p) => p.playerId === target));
      setSpectateTarget(list[(index + step + list.length) % list.length].playerId);
      playSfx('click');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [downed, target]);

  if (!downed) return null;

  const medic = state.players.find((p) => p.role === REVIVER_ROLE && p.playerId !== getMyRole());
  const medicCanHelp = medic && medic.lifeState !== 'DOWNED';
  const beingRevived = state.players.find((p) => p.reviving === getMyRole());
  const watching = teammates.find((p) => p.playerId === target);

  const cycle = (step) => {
    if (teammates.length === 0) return;
    const index = Math.max(0, teammates.findIndex((p) => p.playerId === target));
    setSpectateTarget(teammates[(index + step + teammates.length) % teammates.length].playerId);
    playSfx('click');
  };

  return (
    <div className="spectator">
      <div className="spectator-banner">
        <strong>Estás caído</strong>
        <span>
          {beingRevived
            ? `¡${roleInfo(beingRevived.role).name} te está levantando! ${Math.round(beingRevived.reviveProgress * 100)}%`
            : medicCanHelp
              ? 'Biomédica puede revivirte: pídele que venga'
              : 'Volverás a levantarte cuando termine el Kinder'}
        </span>
      </div>

      {teammates.length > 0 && (
        <div className="spectator-picker">
          <button type="button" className="spectator-arrow" aria-label="Compañero anterior" onClick={() => cycle(-1)}>◀</button>
          <div className="spectator-current">
            <span className="spectator-label">Viendo a</span>
            <strong>{watching ? `${roleInfo(watching.role).name} · Piso ${watching.floor}` : '—'}</strong>
            <div className="spectator-chips">
              {teammates.map((p) => (
                <button
                  key={p.playerId}
                  type="button"
                  className={`spectator-chip${p.playerId === target ? ' spectator-chip--active' : ''}`}
                  onClick={() => {
                    setSpectateTarget(p.playerId);
                    playSfx('click');
                  }}
                >
                  {roleInfo(p.role).name}
                  <span className="spectator-chip-hp">{p.health}</span>
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="spectator-arrow" aria-label="Compañero siguiente" onClick={() => cycle(1)}>▶</button>
        </div>
      )}
    </div>
  );
}
