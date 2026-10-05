import { useState } from 'react';
import useMissionFlow from './useMissionFlow';
import { playSfx } from '../game/sfx';

// Economia: revisar facturas. De tres facturas, una tiene mal sumado el total: hay que
// encontrarla. Tres aciertos; un error trae facturas nuevas sin sumar.
const MISSION_TYPE = 'FACTURAS';
const GOAL = 3;
const CONCEPTS = ['Gasolina', 'Comida', 'Vendas', 'Cables', 'Tornillos', 'Baterías', 'Papel', 'Café', 'Linternas'];

function newInvoices() {
  const wrong = Math.floor(Math.random() * 3);
  return [0, 1, 2].map((id) => {
    const lines = [...CONCEPTS].sort(() => Math.random() - 0.5).slice(0, 3)
      .map((concept) => ({ concept, price: 1 + Math.floor(Math.random() * 48) }));
    const real = lines.reduce((sum, line) => sum + line.price, 0);
    const off = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 9));
    return { id, lines, total: id === wrong ? real + off : real, wrong: id === wrong };
  });
}

export default function FacturasMission() {
  const [invoices, setInvoices] = useState(newInvoices);
  const [found, setFound] = useState(0);
  const [miss, setMiss] = useState(null);

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_TYPE, () => {
    setInvoices(newInvoices());
    setFound(0);
  });

  const choose = (invoice) => {
    if (!invoice.wrong) {
      playSfx('empty');
      setMiss(invoice.id);
      setTimeout(() => {
        setMiss(null);
        setInvoices(newInvoices());
      }, 450);
      return;
    }
    playSfx('coins');
    const next = found + 1;
    setFound(next);
    if (next >= GOAL) finishSuccess();
    else setInvoices(newInvoices());
  };

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Revisar las facturas
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Revisar facturas</h3>
          {phase === 'active' && (
            <>
              <p>Una de las tres está mal sumada. Tócala.</p>
              <div className="invoices">
                {invoices.map((invoice) => (
                  <button
                    key={invoice.id}
                    type="button"
                    className={`invoice${miss === invoice.id ? ' invoice--miss' : ''}`}
                    onClick={() => choose(invoice)}
                  >
                    {invoice.lines.map((line) => (
                      <span key={line.concept} className="invoice-line">
                        <span>{line.concept}</span>
                        <span>{line.price}</span>
                      </span>
                    ))}
                    <span className="invoice-total">
                      <span>Total</span>
                      <strong>{invoice.total}</strong>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mission-progress">{found} / {GOAL} encontradas</div>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>Cancelar (Esc)</button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Fraude descubierto! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
