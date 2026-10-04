import { useState } from 'react';
import useMissionFlow from './useMissionFlow';

// Economia: dar el cambio exacto a cada cliente de la cafeteria.
const MISSION_TYPE = 'CAJA';
const CUSTOMERS = 3;
const MONEY = [50, 100, 200, 500, 1000, 2000];

const peso = (value) => `$${value.toLocaleString('es-CO')}`;

function newSale() {
  const price = (Math.floor(Math.random() * 60) + 8) * 50; // $400 a $3.350
  const paid = price <= 1950 ? 2000 : price <= 4950 ? 5000 : 10000;
  return { price, paid, change: paid - price };
}

export default function CashMission() {
  const [sale, setSale] = useState(newSale);
  const [given, setGiven] = useState([]);
  const [served, setServed] = useState(0);
  const [wrong, setWrong] = useState(false);

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_TYPE, () => {
    setSale(newSale());
    setGiven([]);
    setServed(0);
    setWrong(false);
  });

  const total = given.reduce((sum, value) => sum + value, 0);

  const deliver = () => {
    if (total !== sale.change) {
      setWrong(true);
      setTimeout(() => setWrong(false), 600);
      return;
    }
    const next = served + 1;
    setServed(next);
    if (next >= CUSTOMERS) {
      finishSuccess();
      return;
    }
    setSale(newSale());
    setGiven([]);
  };

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Dar el cambio exacto
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Dar el cambio</h3>
          {phase === 'active' && (
            <>
              <p>
                La cuenta es <strong>{peso(sale.price)}</strong> y el cliente paga con <strong>{peso(sale.paid)}</strong>.
              </p>
              <div className={`cash-total${wrong ? ' cash-total--wrong' : ''}`}>
                Cambio entregado: {peso(total)}
              </div>
              <div className="cash-money">
                {MONEY.map((value) => (
                  <button key={value} type="button" className="math-option cash-coin" onClick={() => setGiven((list) => [...list, value])}>
                    {peso(value)}
                  </button>
                ))}
              </div>
              <div className="stack-actions">
                <button type="button" className="mission-cancel-btn" onClick={() => setGiven((list) => list.slice(0, -1))}>
                  Deshacer
                </button>
                <button type="button" className="inventory-use" onClick={deliver}>
                  Entregar
                </button>
              </div>
              <div className="mission-progress">Cliente {served + 1} / {CUSTOMERS}</div>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>
                Cancelar (Esc)
              </button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Caja al día! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
