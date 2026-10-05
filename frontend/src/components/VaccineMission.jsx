import { useEffect, useRef, useState } from 'react';
import useMissionFlow from './useMissionFlow';
import { playSfx } from '../game/sfx';

// Biomedica: repetir el orden en que se iluminan los frascos para mezclar la vacuna.
const MISSION_TYPE = 'VACUNA';
const VIALS = [
  { color: '#e05a5a', label: 'Rojo' },
  { color: '#4fc3f7', label: 'Azul' },
  { color: '#9bf0b8', label: 'Verde' },
  { color: '#ffd666', label: 'Amarillo' },
];
const ROUND_LENGTHS = [3, 4, 5];
const STEP_MS = 620;

function newSequence(length) {
  return Array.from({ length }, () => Math.floor(Math.random() * VIALS.length));
}

export default function VaccineMission() {
  const [round, setRound] = useState(0);
  const [sequence, setSequence] = useState(() => newSequence(ROUND_LENGTHS[0]));
  const [lit, setLit] = useState(null);
  const [playing, setPlaying] = useState(true);
  const [input, setInput] = useState([]);
  const [wrong, setWrong] = useState(false);
  const timersRef = useRef([]);

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_TYPE, () => {
    setRound(0);
    setSequence(newSequence(ROUND_LENGTHS[0]));
    setInput([]);
    setPlaying(true);
  });

  // Muestra la secuencia: cada frasco se ilumina por turno.
  useEffect(() => {
    if (phase !== 'active' || !playing) return undefined;
    const timers = [];
    sequence.forEach((vial, index) => {
      timers.push(setTimeout(() => {
        setLit(vial);
        playSfx('click');
      }, 400 + index * STEP_MS));
      timers.push(setTimeout(() => setLit(null), 400 + index * STEP_MS + STEP_MS * 0.6));
    });
    timers.push(setTimeout(() => setPlaying(false), 400 + sequence.length * STEP_MS));
    timersRef.current = timers;
    return () => timers.forEach(clearTimeout);
  }, [phase, playing, sequence]);

  const pick = (vial) => {
    if (playing || wrong) return;
    const next = [...input, vial];
    setLit(vial);
    setTimeout(() => setLit(null), 180);
    if (sequence[next.length - 1] !== vial) {
      setWrong(true);
      setTimeout(() => {
        setWrong(false);
        setInput([]);
        setPlaying(true);
      }, 600);
      return;
    }
    setInput(next);
    if (next.length < sequence.length) return;
    const nextRound = round + 1;
    if (nextRound >= ROUND_LENGTHS.length) {
      finishSuccess();
      return;
    }
    setRound(nextRound);
    setInput([]);
    setSequence(newSequence(ROUND_LENGTHS[nextRound]));
    setPlaying(true);
  };

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Mezclar la vacuna
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Preparar la vacuna</h3>
          {phase === 'active' && (
            <>
              <p>{playing ? 'Observa el orden de los frascos…' : wrong ? '¡Mezcla equivocada! Mira otra vez' : 'Repite el orden'}</p>
              <div className="vaccine-vials">
                {VIALS.map((vial, index) => (
                  <button
                    key={vial.label}
                    type="button"
                    aria-label={vial.label}
                    className={`vaccine-vial${lit === index ? ' vaccine-vial--lit' : ''}`}
                    style={{ '--vial': vial.color }}
                    disabled={playing}
                    onClick={() => pick(index)}
                  >
                    <span className="vaccine-liquid" />
                  </button>
                ))}
              </div>
              <div className="mission-progress">
                Dosis {round + 1} / {ROUND_LENGTHS.length} · {input.length}/{sequence.length}
              </div>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>
                Cancelar (Esc)
              </button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Vacuna lista! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
