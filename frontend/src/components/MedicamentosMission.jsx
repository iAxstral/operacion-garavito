import { useState } from 'react';
import useMissionFlow from './useMissionFlow';
import { playSfx } from '../game/sfx';

// Biomedica: ordenar medicamentos de menor a mayor dosis. Un error y se vuelve a
// empezar la fila. Dos bandejas.
const MISSION_TYPE = 'MEDICAMENTOS';
const BOTTLES = 5;
const TRAYS = 2;
const COLORS = ['#c0392b', '#2e86c1', '#27ae60', '#d4ac0d', '#8e44ad', '#d35400'];

function newTray() {
  const doses = new Set();
  while (doses.size < BOTTLES) doses.add(5 * (1 + Math.floor(Math.random() * 40)));
  // Se barajan aparte para que nunca salgan ya ordenados.
  let shuffled;
  do shuffled = [...doses].sort(() => Math.random() - 0.5);
  while (shuffled.every((dose, i) => i === 0 || dose > shuffled[i - 1]));
  return shuffled.map((dose, i) => ({ id: i, dose, color: COLORS[(i + Math.floor(Math.random() * 6)) % COLORS.length] }));
}

export default function MedicamentosMission() {
  const [tray, setTray] = useState(newTray);
  const [picked, setPicked] = useState([]);
  const [done, setDone] = useState(0);
  const [wrong, setWrong] = useState(false);

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_TYPE, () => {
    setTray(newTray());
    setPicked([]);
    setDone(0);
  });

  const order = [...tray].sort((a, b) => a.dose - b.dose).map((b) => b.id);

  const pick = (bottle) => {
    if (picked.includes(bottle.id)) return;
    if (order[picked.length] !== bottle.id) {
      playSfx('empty');
      setWrong(true);
      setPicked([]);
      setTimeout(() => setWrong(false), 400);
      return;
    }
    playSfx('click');
    const next = [...picked, bottle.id];
    setPicked(next);
    if (next.length < BOTTLES) return;
    const trays = done + 1;
    setDone(trays);
    if (trays >= TRAYS) {
      finishSuccess();
      return;
    }
    setTimeout(() => {
      setTray(newTray());
      setPicked([]);
    }, 350);
  };

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Ordenar los medicamentos
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Ordenar medicamentos</h3>
          {phase === 'active' && (
            <>
              <p>Tócalos de la dosis más baja a la más alta.</p>
              <div className={`meds-tray${wrong ? ' meds-tray--wrong' : ''}`}>
                {tray.map((bottle) => {
                  const position = picked.indexOf(bottle.id);
                  return (
                    <button
                      key={bottle.id}
                      type="button"
                      className={`med-bottle${position >= 0 ? ' med-bottle--picked' : ''}`}
                      style={{ '--cap': bottle.color }}
                      onClick={() => pick(bottle)}
                      aria-label={`${bottle.dose} miligramos`}
                    >
                      <span className="med-cap" />
                      <span className="med-label">{bottle.dose}<small>mg</small></span>
                      {position >= 0 && <span className="med-order">{position + 1}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="mission-progress">Bandeja {Math.min(done + 1, TRAYS)} / {TRAYS}</div>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>Cancelar (Esc)</button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Botiquín en orden! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
