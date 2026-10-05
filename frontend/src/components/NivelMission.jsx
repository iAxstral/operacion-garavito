import { useEffect, useRef, useState } from 'react';
import useMissionFlow from './useMissionFlow';
import { playSfx } from '../game/sfx';

// Infraestructura: nivelar la viga mientras la sueldan. La burbuja se va hacia los
// lados; con los botones (o las flechas) hay que mantenerla en el centro hasta llenar
// la barra.
const MISSION_TYPE = 'NIVEL';
const HOLD_SECONDS = 4;
const CENTER = 10; // mitad del ancho de la zona buena, en %
const NUDGE = 14;

export default function NivelMission() {
  const [bubble, setBubble] = useState(50);
  const [progress, setProgress] = useState(0);
  const simRef = useRef({ pos: 50, vel: 0, drift: 0, held: 0 });

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_TYPE, () => {
    simRef.current = { pos: 50 + (Math.random() < 0.5 ? -12 : 12), vel: 0, drift: 0, held: 0 };
    setProgress(0);
  });

  useEffect(() => {
    if (phase !== 'active') return undefined;
    let frame;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = simRef.current;
      // Viento que cambia de a poco y empuja la burbuja lejos del centro.
      s.drift += (Math.random() - 0.5) * 60 * dt;
      s.drift = Math.max(-18, Math.min(18, s.drift));
      s.vel += (s.drift + (s.pos - 50) * 0.6) * dt;
      s.vel *= 0.96;
      s.pos = Math.max(0, Math.min(100, s.pos + s.vel * dt * 6));
      if (Math.abs(s.pos - 50) <= CENTER) s.held += dt;
      setBubble(s.pos);
      setProgress(Math.min(1, s.held / HOLD_SECONDS));
      if (s.held >= HOLD_SECONDS) {
        finishSuccess();
        return;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [phase, finishSuccess]);

  const nudge = (direction) => {
    const s = simRef.current;
    s.vel += direction * NUDGE;
    playSfx('hammer', 0.4);
  };

  useEffect(() => {
    if (phase !== 'active') return undefined;
    const onKey = (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') nudge(-1);
      if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') nudge(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const centered = Math.abs(bubble - 50) <= CENTER;

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Nivelar la viga
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Nivelar la viga</h3>
          {phase === 'active' && (
            <>
              <p>Mantén la burbuja en el centro mientras se suelda (◀ ▶ o las flechas).</p>
              <div className={`level-tube${centered ? ' level-tube--ok' : ''}`}>
                <span className="level-center" style={{ left: `${50 - CENTER}%`, width: `${CENTER * 2}%` }} />
                <span className="level-bubble" style={{ left: `${bubble}%` }} />
              </div>
              <div className="level-controls">
                <button type="button" className="level-btn" onPointerDown={() => nudge(-1)} aria-label="Empujar a la izquierda">◀</button>
                <div className="level-weld"><div style={{ width: `${progress * 100}%` }} /></div>
                <button type="button" className="level-btn" onPointerDown={() => nudge(1)} aria-label="Empujar a la derecha">▶</button>
              </div>
              <div className="mission-progress">Soldadura {Math.round(progress * 100)}%</div>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>Cancelar (Esc)</button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Viga nivelada! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
