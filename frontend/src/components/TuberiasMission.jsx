import { useState } from 'react';
import useMissionFlow from './useMissionFlow';
import { playSfx } from '../game/sfx';

// Infraestructura: conectar la tuberia desde la entrada (izquierda) hasta la salida
// (derecha). Cada pieza gira 90 grados al tocarla. Dos tableros.
const MISSION_TYPE = 'TUBERIAS';
const ROWS = 3;
const COLS = 4;
const BOARDS = 2;

// Caminos posibles: cada celda con las dos salidas que necesita (N, E, S, W).
const PATHS = [
  [[1, 0, 'WN'], [0, 0, 'SE'], [0, 1, 'WE'], [0, 2, 'WS'], [1, 2, 'NS'], [2, 2, 'NE'], [2, 3, 'WN'], [1, 3, 'SE']],
  [[1, 0, 'WS'], [2, 0, 'NE'], [2, 1, 'WE'], [2, 2, 'WN'], [1, 2, 'SN'], [0, 2, 'SE'], [0, 3, 'WS'], [1, 3, 'NE']],
  [[1, 0, 'WE'], [1, 1, 'WN'], [0, 1, 'SE'], [0, 2, 'WE'], [0, 3, 'WS'], [1, 3, 'NE']],
];

// Rotacion correcta segun las salidas. Codo: 0 = E+S, 1 = S+W, 2 = W+N, 3 = N+E. Recta: 0 = W+E, 1 = N+S.
const ELBOW = { ES: 0, SW: 1, NW: 2, EN: 3 };
function pieceFor(dirs) {
  const key = [...dirs].sort().join('');
  if (key === 'EW') return { kind: 'straight', target: 0 };
  if (key === 'NS') return { kind: 'straight', target: 1 };
  const elbowKey = { ES: 'ES', SW: 'SW', NW: 'NW', EN: 'EN' }[key];
  return { kind: 'elbow', target: ELBOW[elbowKey] };
}

function newBoard() {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const cells = Array.from({ length: ROWS * COLS }, () => null);
  path.forEach(([row, col, dirs]) => {
    const piece = pieceFor(dirs);
    let rotation;
    do rotation = Math.floor(Math.random() * 4);
    while (isRight({ ...piece, rotation }));
    cells[row * COLS + col] = { ...piece, rotation };
  });
  return cells;
}

function isRight(cell) {
  if (!cell) return true;
  return cell.kind === 'straight' ? cell.rotation % 2 === cell.target : cell.rotation === cell.target;
}

function Pipe({ cell, full }) {
  return (
    <svg viewBox="0 0 40 40" className="pipe-svg" style={{ transform: `rotate(${cell.rotation * 90}deg)` }} aria-hidden="true">
      {cell.kind === 'straight'
        ? <path d="M0 20 H40" className={full ? 'pipe-line pipe-line--full' : 'pipe-line'} />
        : <path d="M40 20 H28 Q20 20 20 28 V40" className={full ? 'pipe-line pipe-line--full' : 'pipe-line'} />}
    </svg>
  );
}

export default function TuberiasMission() {
  const [cells, setCells] = useState(newBoard);
  const [solved, setSolved] = useState(0);

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_TYPE, () => {
    setCells(newBoard());
    setSolved(0);
  });

  const allRight = cells.every(isRight);

  const rotate = (index) => {
    if (!cells[index] || allRight) return;
    const next = cells.map((cell, i) => (i === index ? { ...cell, rotation: (cell.rotation + 1) % 4 } : cell));
    setCells(next);
    playSfx('toggle');
    if (!next.every(isRight)) return;
    playSfx('build');
    const done = solved + 1;
    setSolved(done);
    if (done >= BOARDS) {
      finishSuccess();
      return;
    }
    setTimeout(() => setCells(newBoard()), 700);
  };

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Conectar la tubería
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Conectar tuberías</h3>
          {phase === 'active' && (
            <>
              <p>Gira las piezas para llevar el agua de la entrada a la salida.</p>
              <div className="pipe-board">
                <span className="pipe-inlet" aria-hidden="true" />
                <div className="pipe-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
                  {cells.map((cell, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`pipe-cell${cell ? '' : ' pipe-cell--empty'}`}
                      disabled={!cell}
                      aria-label={cell ? `Pieza ${index + 1}` : 'Vacío'}
                      onClick={() => rotate(index)}
                    >
                      {cell && <Pipe cell={cell} full={allRight} />}
                    </button>
                  ))}
                </div>
                <span className="pipe-outlet" aria-hidden="true" />
              </div>
              <div className="mission-progress">Tablero {Math.min(solved + 1, BOARDS)} / {BOARDS}</div>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>Cancelar (Esc)</button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡El agua corre! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
