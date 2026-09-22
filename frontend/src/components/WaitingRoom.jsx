import { useEffect, useState } from 'react';
import { ROLE_CATALOG, roleInfo } from '../game/roleCatalog';
import { getLobbyCode, getMyRole, onStateChange, startGame } from '../game/gameSync';

export default function WaitingRoom({ onStarted, onLeave }) {
  const [state, setState] = useState({ players: [], lobby: null });

  useEffect(() => onStateChange(setState), []);

  const started = state.lobby?.started;
  useEffect(() => {
    if (started) onStarted();
  }, [started, onStarted]);

  const isHost = state.lobby?.host === getMyRole();
  const joinedRoles = state.players.map((p) => p.role);

  return (
    <div className="role-select">
      <div className="main-menu-vignette" />
      <div className="role-select-content">
        <p className="main-menu-kicker">Código de la sala</p>
        <h2 className="waiting-code">{getLobbyCode()}</h2>
        <p className="lobby-help">Comparte este código con tu equipo. Deben estar en la misma red Wi-Fi.</p>

        <div className="waiting-players">
          {ROLE_CATALOG.map((entry) => {
            const present = joinedRoles.includes(entry.role);
            return (
              <div key={entry.role} className={`waiting-slot${present ? ' waiting-slot--present' : ''}`}>
                <img src={entry.portrait} alt="" className="waiting-slot-portrait" />
                <span className="waiting-slot-name">{entry.name}</span>
                <span className="waiting-slot-tag">
                  {present
                    ? `${entry.role === state.lobby?.host ? 'Anfitrión' : 'Listo'}${entry.role === getMyRole() ? ' (tú)' : ''}`
                    : 'Esperando…'}
                </span>
              </div>
            );
          })}
        </div>

        {isHost ? (
          <button type="button" className="main-menu-play-btn" onClick={startGame}>
            Comenzar ({roleInfo(getMyRole()).name})
          </button>
        ) : (
          <p className="lobby-help">Esperando a que el anfitrión comience la partida…</p>
        )}

        <button type="button" className="screen-back-btn" onClick={onLeave}>
          Salir de la sala
        </button>
      </div>
    </div>
  );
}
