import { useEffect, useState } from 'react';
import { ROLE_CATALOG, roleInfo } from '../game/roleCatalog';
import { getLobbyCode, getMyRole, onStateChange, startGame, voteBuilding } from '../game/gameSync';
import HalloweenCreatures from './HalloweenCreatures';
import BuildingSelect from './BuildingSelect';
import { DAILY_RULES, MODES } from '../game/gameModes';
import { BUILDINGS, buildingLabel, floorCount } from '../game/mapLayout';
import { playSfx } from '../game/sfx';

export default function WaitingRoom({ onStarted, onLeave }) {
  const [state, setState] = useState({ players: [], lobby: null });
  const [showMap, setShowMap] = useState(false);

  useEffect(() => onStateChange(setState), []);

  const started = state.lobby?.started;
  useEffect(() => {
    if (started) onStarted();
  }, [started, onStarted]);

  const isHost = state.lobby?.host === getMyRole();
  const joinedRoles = state.players.map((p) => p.role);

  // Votacion del edificio: cada jugador presente vota uno; al empezar gana el mas votado.
  const votes = state.lobby?.votes ?? {};
  const myVote = votes[getMyRole()];
  const leading = state.lobby?.leading;
  const voteCount = Object.keys(votes).length;
  const missingVotes = Math.max(0, joinedRoles.length - voteCount);
  const votersOf = (building) => Object.keys(votes).filter((role) => votes[role] === building);
  const vote = (building) => {
    playSfx('click');
    voteBuilding(building);
  };

  if (showMap) {
    return (
      <BuildingSelect
        prompt="Toca un edificio del campus para votarlo."
        action="clic para votar"
        onSelect={(building) => {
          vote(building);
          setShowMap(false);
        }}
        onBack={() => setShowMap(false)}
      />
    );
  }

  return (
    <div className="role-select">
      <div className="main-menu-vignette" />
      <HalloweenCreatures bats={4} spiders={2} />
      <div className="role-select-content">
        <p className="main-menu-kicker">Código de la sala</p>
        <h2 className="waiting-code">{getLobbyCode()}</h2>
        {state.lobby?.mode && state.lobby.mode !== 'NORMAL' && (
          <p className={`waiting-mode lobby-mode--${state.lobby.mode.toLowerCase()}`}>
            {MODES[state.lobby.mode]?.label}
            {state.lobby.dailyRule && ` · ${DAILY_RULES[state.lobby.dailyRule]?.label}: ${DAILY_RULES[state.lobby.dailyRule]?.text}`}
          </p>
        )}
        <p className="lobby-help">Comparte este código con tu equipo. Deben estar en la misma red Wi-Fi.</p>

        <div className="waiting-players">
          {ROLE_CATALOG.map((entry) => {
            const present = joinedRoles.includes(entry.role);
            const player = state.players.find((p) => p.role === entry.role);
            return (
              <div key={entry.role} className={`waiting-slot${present ? ' waiting-slot--present' : ''}`}>
                <img src={entry.portrait} alt="" className="waiting-slot-portrait" />
                <span className="waiting-slot-name">{entry.name}</span>
                {player?.name && <span className="waiting-slot-nick">{player.name}</span>}
                <span className="waiting-slot-tag">
                  {present
                    ? `${entry.role === state.lobby?.host ? 'Anfitrión' : 'Listo'}${entry.role === getMyRole() ? ' (tú)' : ''}`
                    : 'Esperando…'}
                </span>
              </div>
            );
          })}
        </div>

        <section className="vote-panel" aria-label="Votación del edificio">
          <p className="main-menu-kicker">
            Voten el edificio · {voteCount}/{joinedRoles.length} {joinedRoles.length === 1 ? 'voto' : 'votos'}
          </p>
          <div className="vote-grid">
            {BUILDINGS.map((building) => {
              const voters = votersOf(building);
              return (
                <button
                  key={building}
                  type="button"
                  aria-pressed={myVote === building}
                  className={[
                    'vote-card',
                    myVote === building ? 'vote-card--mine' : '',
                    voteCount > 0 && leading === building ? 'vote-card--leading' : '',
                  ].join(' ')}
                  onClick={() => vote(building)}
                >
                  <span className="vote-card-name">{buildingLabel(building)}</span>
                  <span className="vote-card-floors">{floorCount(building)} pisos</span>
                  <span className="vote-card-count">
                    {voters.length} {voters.length === 1 ? 'voto' : 'votos'}
                  </span>
                  <span className="vote-card-voters">
                    {voters.map((role) => (
                      <img key={role} src={roleInfo(role).portrait} alt={roleInfo(role).name} title={roleInfo(role).name} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="lobby-help">
            {voteCount === 0
              ? `Nadie ha votado: si empiezan así se juega en ${buildingLabel(leading ?? 'F')}.`
              : `Va ganando: ${buildingLabel(leading)}${missingVotes > 0 ? ` · faltan ${missingVotes} por votar` : ''}`}
            {' '}
            <button type="button" className="vote-map-link" onClick={() => setShowMap(true)}>
              Ver el mapa del campus
            </button>
          </p>
        </section>

        {isHost ? (
          <button type="button" className="main-menu-play-btn" onClick={startGame}>
            Comenzar en {buildingLabel(leading ?? 'F')} ({roleInfo(getMyRole()).name})
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
