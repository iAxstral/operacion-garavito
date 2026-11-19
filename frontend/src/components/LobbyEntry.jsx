import { useEffect, useState } from 'react';
import { generateLobbyCode, openLobby } from '../game/gameSync';
import { DAILY_RULES, MODES, fetchDailyChallenge } from '../game/gameModes';
import { buildingLabel } from '../game/mapLayout';
import { playSfx } from '../game/sfx';
import NavidadCreatures from './NavidadCreatures';
import RegaloMaldito from './RegaloMaldito';

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
  const [mode, setMode] = useState('NORMAL');
  const [daily, setDaily] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchDailyChallenge().then((value) => !cancelled && setDaily(value));
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (action) => {
    playSfx('click');
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
        const created = await openLobby(generateLobbyCode(), true, building, false, mode);
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
    if (normalized.length < 4) return;
    run(async () => {
      await openLobby(normalized, false, building);
      onEntered(normalized);
    });
  };

  return (
    <div className="lobby-screen">
      <form className="xl-board" onSubmit={handleJoin}>
        <header className="xl-header">
          <span className="lobby-building-tag xl-building">{buildingLabel(building)}</span>
          <h1 className="xl-title">Sala de juego</h1>
          <p className="xl-sub">Nadie sale de la ECI esta Nochebuena sin su equipo.</p>
        </header>
        <div className="xl-cards">
          <section className="xl-card xl-card--create">
            <span className="xl-card-gift" aria-hidden="true"><RegaloMaldito /></span>
            <h2>Crear sala</h2>
            <p>Genera un código para compartir con tu equipo.</p>
            <button type="button" className="xl-btn xl-btn--primary" disabled={busy} onClick={handleCreate} aria-label="Crear sala">
              Crear
            </button>
          </section>
          <section className="xl-card xl-card--join">
            <h2>Unirse con código</h2>
            <p>Pídele las 4 letras a quien creó la sala.</p>
            <input
              className="xl-code"
              value={code}
              maxLength={4}
              placeholder="ABCD"
              aria-label="Código de la sala"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
            <button
              type="submit"
              className="xl-btn"
              disabled={busy || code.trim().length < 4}
              aria-label="Entrar"
              title={code.trim().length < 4 ? 'Escribe el código de 4 letras' : 'Entrar a la sala'}
            >
              Entrar
            </button>
          </section>
        </div>
        <button
          type="button"
          className="screen-back-btn xl-back"
          onClick={() => {
            playSfx('click');
            onBack();
          }}
        >
          Volver
        </button>
      </form>

      <div className="lobby-modes" role="radiogroup" aria-label="Modo de la sala nueva">
        {Object.entries(MODES).map(([id, info]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            className={`lobby-mode${mode === id ? ' lobby-mode--active' : ''} lobby-mode--${id.toLowerCase()}`}
            title={info.text}
            onClick={() => {
              playSfx('click');
              setMode(id);
            }}
          >
            {info.label}
          </button>
        ))}
      </div>
      <p className="lobby-mode-help">
        {mode === 'DAILY' && daily?.rule
          ? `Hoy: ${DAILY_RULES[daily.rule]?.label} — ${DAILY_RULES[daily.rule]?.text}`
          : MODES[mode].text}
        {' '}<small>(solo al crear la sala; al unirte juegas el modo de esa sala)</small>
      </p>

      <NavidadCreatures ornaments={0} snow={18} />

      <p className={`lobby-status${error ? ' lobby-status--error' : ''}`} role={error ? 'alert' : undefined}>
        {busy
          ? 'Abriendo la sala…'
          : (error ?? 'Todos en la misma red Wi-Fi: uno crea la sala y los demás entran con su código.')}
      </p>
    </div>
  );
}
