import { useState } from 'react';
import useMissionFlow from './useMissionFlow';
import { playSfx } from '../game/sfx';

// Seguridad: calibrar tres sensores de movimiento. Cada perilla tiene que quedar dentro
// de la franja que marca el sensor (con un margen de tolerancia).
const MISSION_TYPE = 'SENSORES';
const SENSORS = ['Pasillo norte', 'Escalera', 'Vestíbulo'];
const TOLERANCE = 5;

function newTargets() {
  return SENSORS.map(() => 12 + Math.floor(Math.random() * 76));
}

function newValues(targets) {
  return targets.map((target) => {
    let value;
    do value = Math.floor(Math.random() * 101);
    while (Math.abs(value - target) <= TOLERANCE * 3);
    return value;
  });
}

export default function SensoresMission() {
  const [targets, setTargets] = useState(newTargets);
  const [values, setValues] = useState(() => newValues(targets));

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_TYPE, () => {
    const next = newTargets();
    setTargets(next);
    setValues(newValues(next));
  });

  const inRange = values.map((value, i) => Math.abs(value - targets[i]) <= TOLERANCE);

  const change = (index, value) => {
    const next = [...values];
    next[index] = value;
    setValues(next);
    const ok = next.every((v, i) => Math.abs(v - targets[i]) <= TOLERANCE);
    if (Math.abs(value - targets[index]) <= TOLERANCE && !inRange[index]) playSfx('toggle');
    if (ok) finishSuccess();
  };

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Calibrar los sensores
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Calibrar sensores</h3>
          {phase === 'active' && (
            <>
              <p>Lleva cada perilla a la franja verde de su sensor.</p>
              <div className="sensor-list">
                {SENSORS.map((name, i) => (
                  <label key={name} className={`sensor${inRange[i] ? ' sensor--ok' : ''}`}>
                    <span className="sensor-name">{name}</span>
                    <span className="sensor-track">
                      <span
                        className="sensor-target"
                        style={{ left: `${targets[i] - TOLERANCE}%`, width: `${TOLERANCE * 2}%` }}
                      />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={values[i]}
                        aria-label={`Sensor ${name}`}
                        onChange={(event) => change(i, Number(event.target.value))}
                      />
                    </span>
                  </label>
                ))}
              </div>
              <div className="mission-progress">{inRange.filter(Boolean).length} / {SENSORS.length} calibrados</div>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>Cancelar (Esc)</button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Sensores en línea! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
