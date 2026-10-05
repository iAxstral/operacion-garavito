import { useEffect, useRef, useState } from 'react';
import useMissionFlow from './useMissionFlow';
import { playSfx } from '../game/sfx';

// Seguridad: ronda de vigilancia. Se encienden camaras en orden y hay que repetir la
// secuencia. Dos rondas: de 3 y de 4 camaras.
const MISSION_TYPE = 'RONDA';
const CAMERAS = 9;
const ROUNDS = [3, 4];
const SHOW_MS = 520;
const GAP_MS = 180;

function newSequence(length) {
  const sequence = [];
  while (sequence.length < length) {
    const next = Math.floor(Math.random() * CAMERAS);
    if (next !== sequence[sequence.length - 1]) sequence.push(next);
  }
  return sequence;
}

export default function RondaMission() {
  const [round, setRound] = useState(0);
  const [sequence, setSequence] = useState(() => newSequence(ROUNDS[0]));
  const [lit, setLit] = useState(null);
  const [showing, setShowing] = useState(false);
  const [entered, setEntered] = useState([]);
  const [wrong, setWrong] = useState(false);
  const timersRef = useRef([]);

  const play = (seq) => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setShowing(true);
    setEntered([]);
    seq.forEach((camera, i) => {
      timersRef.current.push(setTimeout(() => {
        setLit(camera);
        playSfx('toggle');
      }, 500 + i * (SHOW_MS + GAP_MS)));
      timersRef.current.push(setTimeout(() => setLit(null), 500 + i * (SHOW_MS + GAP_MS) + SHOW_MS));
    });
    timersRef.current.push(setTimeout(() => setShowing(false), 500 + seq.length * (SHOW_MS + GAP_MS)));
  };

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_TYPE, () => {
    const seq = newSequence(ROUNDS[0]);
    setRound(0);
    setSequence(seq);
    play(seq);
  });

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const press = (camera) => {
    if (showing || phase !== 'active') return;
    const position = entered.length;
    if (sequence[position] !== camera) {
      playSfx('empty');
      setWrong(true);
      setTimeout(() => setWrong(false), 400);
      play(sequence);
      return;
    }
    playSfx('click');
    const next = [...entered, camera];
    setEntered(next);
    if (next.length < sequence.length) return;
    if (round + 1 >= ROUNDS.length) {
      finishSuccess();
      return;
    }
    const seq = newSequence(ROUNDS[round + 1]);
    setRound(round + 1);
    setSequence(seq);
    play(seq);
  };

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Hacer la ronda de vigilancia
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Ronda de vigilancia</h3>
          {phase === 'active' && (
            <>
              <p>{showing ? 'Mira qué cámaras se encienden…' : 'Tócalas en el mismo orden.'}</p>
              <div className={`ronda-grid${wrong ? ' ronda-grid--wrong' : ''}`}>
                {Array.from({ length: CAMERAS }, (_, camera) => (
                  <button
                    key={camera}
                    type="button"
                    className={`ronda-cam${lit === camera ? ' ronda-cam--lit' : ''}${entered.includes(camera) && !showing ? ' ronda-cam--done' : ''}`}
                    aria-label={`Cámara ${camera + 1}`}
                    disabled={showing}
                    onClick={() => press(camera)}
                  >
                    <span>CAM {camera + 1}</span>
                  </button>
                ))}
              </div>
              <div className="mission-progress">
                Ronda {round + 1} / {ROUNDS.length} · {entered.length}/{sequence.length}
              </div>
              <button type="button" className="mission-cancel-btn" onClick={() => play(sequence)} disabled={showing}>
                Ver otra vez
              </button>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>Cancelar (Esc)</button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Ronda completa! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
