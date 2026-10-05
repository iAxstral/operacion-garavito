import { useState } from 'react';
import useMissionFlow from './useMissionFlow';
import { playSfx } from '../game/sfx';

// Economia: cuadrar el presupuesto. Hay que escoger los gastos que suman exactamente
// lo aprobado. Siempre tiene solucion: la meta sale de sumar algunos de los gastos.
const MISSION_TYPE = 'PRESUPUESTO';
const ROUNDS = 2;
const ITEMS = ['Linternas', 'Vendas', 'Pilas', 'Candados', 'Tablas', 'Agua', 'Radios', 'Cinta'];

function newBudget() {
  const names = [...ITEMS].sort(() => Math.random() - 0.5).slice(0, 6);
  const items = names.map((name, id) => ({ id, name, price: 5 * (2 + Math.floor(Math.random() * 15)) }));
  const chosen = items.filter(() => Math.random() < 0.5);
  const pick = chosen.length >= 2 ? chosen : items.slice(0, 3);
  return { items, target: pick.reduce((sum, item) => sum + item.price, 0) };
}

export default function PresupuestoMission() {
  const [budget, setBudget] = useState(newBudget);
  const [selected, setSelected] = useState([]);
  const [round, setRound] = useState(0);

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_TYPE, () => {
    setBudget(newBudget());
    setSelected([]);
    setRound(0);
  });

  const total = budget.items.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + item.price, 0);

  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    const sum = budget.items.filter((item) => next.includes(item.id)).reduce((s, item) => s + item.price, 0);
    if (sum !== budget.target) {
      playSfx('click');
      return;
    }
    playSfx('coins');
    if (round + 1 >= ROUNDS) {
      finishSuccess();
      return;
    }
    setTimeout(() => {
      setRound(round + 1);
      setBudget(newBudget());
      setSelected([]);
    }, 400);
  };

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Cuadrar el presupuesto
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Cuadrar el presupuesto</h3>
          {phase === 'active' && (
            <>
              <p>Escoge los gastos que suman exactamente lo aprobado.</p>
              <div className={`budget-total${total > budget.target ? ' budget-total--over' : ''}`}>
                <span>Aprobado <strong>{budget.target}</strong></span>
                <span>Llevas <strong>{total}</strong></span>
              </div>
              <div className="budget-items">
                {budget.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`budget-item${selected.includes(item.id) ? ' budget-item--on' : ''}`}
                    aria-pressed={selected.includes(item.id)}
                    onClick={() => toggle(item.id)}
                  >
                    <span>{item.name}</span>
                    <strong>{item.price}</strong>
                  </button>
                ))}
              </div>
              <div className="mission-progress">Presupuesto {round + 1} / {ROUNDS}</div>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>Cancelar (Esc)</button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Cuentas claras! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
