import { useEffect, useState } from 'react';
import { ROLE_CATALOG } from '../game/roleCatalog';
import { MAX_NICKNAME, cleanNickname, getNickname, setNickname } from '../game/profile';
import MissionSummary from './MissionSummary';
import { getLobbyCode, getMyBuilding, joinAs, onStateChange } from '../game/gameSync';
import HalloweenCreatures from './HalloweenCreatures';

const ERROR_MESSAGES = {
  role_taken: 'Ese rol ya lo eligió otro jugador.',
  lobby_not_found: 'La sala ya no existe.',
  timeout: 'El servidor no respondió.',
};

export default function RoleSelect({ onJoined, onBack }) {
  const [takenRoles, setTakenRoles] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nickname, setNicknameState] = useState(getNickname);

  useEffect(() => onStateChange((state) => setTakenRoles(state.players.map((p) => p.role))), []);

  const handleSelect = async (role) => {
    setBusy(true);
    setError(null);
    try {
      await joinAs(role);
      onJoined();
    } catch (err) {
      setError(ERROR_MESSAGES[err.message] ?? 'No se pudo entrar con ese rol.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="role-select">
      <div className="main-menu-vignette" />
      <HalloweenCreatures bats={4} spiders={2} />
      <div className="role-select-content">
        <p className="main-menu-kicker">Edificio {getMyBuilding()} — Sala {getLobbyCode()}</p>
        <h2 className="role-select-title">Elige tu rol</h2>

        <label className="nickname-field">
          <span>Tu apodo</span>
          <input
            value={nickname}
            maxLength={MAX_NICKNAME + 8}
            placeholder="Opcional — si no, te llaman por tu rol"
            autoComplete="nickname"
            onChange={(event) => {
              const value = cleanNickname(event.target.value);
              setNicknameState(value);
              setNickname(value);
            }}
          />
        </label>

        <div className="role-select-grid">
          {ROLE_CATALOG.map((entry) => {
            const taken = takenRoles.includes(entry.role);
            return (
              <button
                key={entry.role}
                type="button"
                className={`role-card${taken ? ' role-card--taken' : ''}`}
                disabled={taken || busy}
                onClick={() => handleSelect(entry.role)}
              >
                <img src={entry.portrait} alt={entry.name} className="role-card-portrait" />
                <span className="role-card-name">{entry.name}</span>
                <span className="role-card-blurb">{entry.blurb}</span>
                <span className="role-card-mission">
                  {taken ? 'Ya elegido' : <>Misiones: <MissionSummary role={entry.role} /></>}
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="lobby-error">{error}</p>}

        <button type="button" className="screen-back-btn" onClick={onBack}>
          Salir de la sala
        </button>
      </div>
    </div>
  );
}
