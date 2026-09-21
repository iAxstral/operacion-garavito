import { useEffect, useState } from 'react';
import { ROLE_CATALOG } from '../game/roleCatalog';
import { getLobbyCode, joinAs, onStateChange } from '../game/gameSync';

const ERROR_MESSAGES = {
  role_taken: 'Ese rol ya lo eligió otro jugador.',
  lobby_not_found: 'La sala ya no existe.',
  timeout: 'El servidor no respondió.',
};

export default function RoleSelect({ building, onJoined, onBack }) {
  const [takenRoles, setTakenRoles] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

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
      <div className="role-select-content">
        <p className="main-menu-kicker">Edificio {building} — Sala {getLobbyCode()}</p>
        <h2 className="role-select-title">Elige tu rol</h2>

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
                  {taken ? 'Ya elegido' : `Misión: ${entry.mission}`}
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
