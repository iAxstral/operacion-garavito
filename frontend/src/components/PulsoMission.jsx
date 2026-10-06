import { useEffect, useRef, useState } from 'react';
import useMissionFlow from './useMissionFlow';
import { playSfx } from '../game/sfx';

// Biomedica: tomar el pulso. Una marca recorre el monitor de lado a lado y hay que
// tocar "Marcar" justo cuando pasa por el latido (la franja). Tres aciertos.
const MISSION_TYPE = 'PULSO';
const HITS = 3;
const ZONE = 12;
const SPEED = 70; // % del ancho por segundo

function newZone() {
  return 15 + Math.random() * (85 - 15 - ZONE);
}

export default function PulsoMission() {
  const [zone, setZone] = useState(newZone);
  const [hits, setHits] = useState(0);
  const [flash, setFlash] = useState(null);
  const [marker, setMarker] = useState(0);
  const stateRef = useRef({ pos: 0, dir: 1 });

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_TYPE, () => {
    setZone(newZone());
    setHits(0);
    stateRef.current = { pos: 0, dir: 1 };
  });

  useEffect(() => {
    if (phase !== 'active') return undefined;
    let frame;
    let last = performance.now();
    const loop = (now) => {
      const s = stateRef.current;
      s.pos += s.dir * SPEED * ((now - last) / 1000) * (1 + hits * 0.25);
      last = now;
      if (s.pos >= 100) { s.pos = 100; s.dir = -1; }
      if (s.pos <= 0) { s.pos = 0; s.dir = 1; }
      setMarker(s.pos);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [phase, hits]);

  const mark = () => {
    const pos = stateRef.current.pos;
    if (pos >= zone && pos <= zone + ZONE) {
      playSfx('coins');
      setFlash('ok');
      const next = hits + 1;
      setHits(next);
      if (next >= HITS) finishSuccess();
      else setZone(newZone());
    } else {
      playSfx('empty');
      setFlash('miss');
    }
    setTimeout(() => setFlash(null), 250);
  };

  useEffect(() => {
    if (phase !== 'active') return undefined;
    const onKey = (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        mark();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Tomar el pulso
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Tomar el pulso</h3>
          {phase === 'active' && (
            <>
              <p>Marca cuando la línea pase por el latido (Espacio o el botón).</p>
              <div className={`pulse-monitor${flash ? ` pulse-monitor--${flash}` : ''}`}>
                <svg className="pulse-wave" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
                  <polyline
                    points={`0,15 ${zone - 4},15 ${zone},15 ${zone + 2},4 ${zone + 5},27 ${zone + 8},10 ${zone + ZONE},15 100,15`}
                  />
                </svg>
                <span className="pulse-zone" style={{ left: `${zone}%`, width: `${ZONE}%` }} />
                <span className="pulse-marker" style={{ left: `${marker}%` }} />
              </div>
              <button type="button" className="main-menu-play-btn pulse-mark" onClick={mark}>Marcar</button>
              <div className="mission-progress">{hits} / {HITS} latidos</div>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>Cancelar (Esc)</button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Pulso estable! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
