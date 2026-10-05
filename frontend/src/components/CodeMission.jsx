import { useEffect, useState } from 'react';
import useMissionFlow from './useMissionFlow';

// Seguridad: memorizar el codigo de acceso y marcarlo en el teclado de la cerradura.
const MISSION_TYPE = 'CODIGO';
const ROUND_LENGTHS = [4, 4, 5];
const SHOW_MS = 2200;
const WRONG_FLASH_MS = 500;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];

function newCode(length) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

export default function CodeMission() {
  const [round, setRound] = useState(0);
  const [code, setCode] = useState(() => newCode(ROUND_LENGTHS[0]));
  const [typed, setTyped] = useState('');
  const [showing, setShowing] = useState(true);
  const [wrong, setWrong] = useState(false);

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_TYPE, () => {
    setRound(0);
    setCode(newCode(ROUND_LENGTHS[0]));
    setTyped('');
    setShowing(true);
    setWrong(false);
  });

  // El codigo se ve un momento y se esconde.
  useEffect(() => {
    if (phase !== 'active' || !showing) return undefined;
    const timeout = setTimeout(() => setShowing(false), SHOW_MS);
    return () => clearTimeout(timeout);
  }, [phase, showing, code]);

  const submit = (value) => {
    if (value !== code) {
      setWrong(true);
      setTimeout(() => {
        setWrong(false);
        setTyped('');
        setShowing(true);
      }, WRONG_FLASH_MS);
      return;
    }
    const next = round + 1;
    if (next >= ROUND_LENGTHS.length) {
      finishSuccess();
      return;
    }
    setRound(next);
    setCode(newCode(ROUND_LENGTHS[next]));
    setTyped('');
    setShowing(true);
  };

  const press = (key) => {
    if (showing || wrong) return;
    if (key === '⌫') {
      setTyped((value) => value.slice(0, -1));
    } else if (key === '✓') {
      submit(typed);
    } else if (typed.length < code.length) {
      const value = typed + key;
      setTyped(value);
      if (value.length === code.length) submit(value);
    }
  };

  useEffect(() => {
    if (phase !== 'active') return undefined;
    const onKeyDown = (event) => {
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('⌫');
      else if (event.key === 'Enter') press('✓');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Reprogramar la cerradura
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Código de acceso</h3>
          {phase === 'active' && (
            <>
              <p>{showing ? 'Memoriza el código…' : 'Márcalo en el teclado'}</p>
              <div className={`code-display${wrong ? ' code-display--wrong' : ''}`}>
                {showing
                  ? code
                  : Array.from({ length: code.length }, (_, i) => typed[i] ?? '·').join(' ')}
              </div>
              <div className="code-keypad">
                {KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="math-option code-key"
                    disabled={showing}
                    onClick={() => press(key)}
                  >
                    {key}
                  </button>
                ))}
              </div>
              <div className="mission-progress">Cerradura {round + 1} / {ROUND_LENGTHS.length}</div>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>
                Cancelar (Esc)
              </button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Cerraduras reprogramadas! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
