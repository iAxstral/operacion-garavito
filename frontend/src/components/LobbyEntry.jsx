import { useState } from 'react';
import { generateLobbyCode, openLobby } from '../game/gameSync';

const ERROR_MESSAGES = {
  lobby_not_found: 'No existe una sala con ese código.',
  invalid_code: 'El código debe tener 4 letras o números.',
  timeout: 'El servidor no respondió. ¿Estás en la misma red que el anfitrión?',
};

const MAX_CREATE_ATTEMPTS = 5;

export default function LobbyEntry({ building, onEntered, onBack }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (action) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(ERROR_MESSAGES[err.message] ?? 'No se pudo conectar con la sala.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () => run(async () => {
    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
      try {
        const created = await openLobby(generateLobbyCode(), true);
        onEntered(created);
        return;
      } catch (err) {
        if (err.message !== 'code_taken') throw err;
      }
    }
    throw new Error('code_taken');
  });

  const handleJoin = (event) => {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    run(async () => {
      await openLobby(normalized, false);
      onEntered(normalized);
    });
  };

  return (
    <div className="role-select">
      <div className="main-menu-vignette" />
      <div className="role-select-content">
        <p className="main-menu-kicker">Edificio {building}</p>
        <h2 className="role-select-title">Sala de juego</h2>
        <p className="lobby-help">
          Todos deben estar en la misma red Wi-Fi. Un jugador crea la sala y los demás entran con su código.
        </p>

        <div className="lobby-panels">
          <div className="lobby-panel">
            <h3>Crear sala</h3>
            <p>Genera un código para compartir con tu equipo.</p>
            <button type="button" className="main-menu-play-btn" disabled={busy} onClick={handleCreate}>
              Crear
            </button>
          </div>

          <form className="lobby-panel" onSubmit={handleJoin}>
            <h3>Unirse con código</h3>
            <input
              className="lobby-code-input"
              value={code}
              maxLength={4}
              placeholder="ABCD"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <button type="submit" className="main-menu-play-btn" disabled={busy || code.trim().length < 4}>
              Entrar
            </button>
          </form>
        </div>

        {error && <p className="lobby-error">{error}</p>}

        <button type="button" className="screen-back-btn" onClick={onBack}>
          Volver
        </button>
      </div>
    </div>
  );
}
