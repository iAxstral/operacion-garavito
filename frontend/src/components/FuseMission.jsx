import { useState } from 'react';
import useMissionFlow from './useMissionFlow';
import { playSfx } from '../game/sfx';

// Infraestructura: encender todos los fusibles. Cada palanca invierte la suya y las de
// al lado (arriba, abajo, izquierda, derecha), asi que hay que pensar el orden.
const MISSION_TYPE = 'FUSIBLES';
const SIZE = 3;
const BOARDS = 2;

function toggle(board, index) {
  const next = [...board];
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) next[r * SIZE + c] = !next[r * SIZE + c];
  });
  return next;
}

// Parte del tablero resuelto y aplica palancas al azar: siempre tiene solucion.
function newBoard() {
  let board = Array(SIZE * SIZE).fill(true);
  const presses = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < presses; i += 1) board = toggle(board, Math.floor(Math.random() * SIZE * SIZE));
  return board.every(Boolean) ? toggle(board, 4) : board;
}

export default function FuseMission() {
  const [board, setBoard] = useState(newBoard);
  const [solved, setSolved] = useState(0);
  const [moves, setMoves] = useState(0);

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_TYPE, () => {
    setBoard(newBoard());
    setSolved(0);
    setMoves(0);
  });

  const flip = (index) => {
    const next = toggle(board, index);
    playSfx('toggle');
    setMoves((value) => value + 1);
    if (!next.every(Boolean)) {
      setBoard(next);
      return;
    }
    const done = solved + 1;
    setSolved(done);
    if (done >= BOARDS) {
      setBoard(next);
      finishSuccess();
      return;
    }
    setBoard(newBoard());
    setMoves(0);
  };

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Restablecer los fusibles
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Tablero de fusibles</h3>
          {phase === 'active' && (
            <>
              <p>Enciende todos. Cada palanca también cambia las de al lado.</p>
              <div className="fuse-board">
                {board.map((on, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Fusible ${index + 1} ${on ? 'encendido' : 'apagado'}`}
                    className={`fuse${on ? ' fuse--on' : ''}`}
                    onClick={() => flip(index)}
                  >
                    <span className="fuse-lever" />
                  </button>
                ))}
              </div>
              <div className="mission-progress">Tablero {solved + 1} / {BOARDS} · {moves} movimientos</div>
              <button type="button" className="mission-cancel-btn" onClick={() => setBoard(newBoard())}>
                Reiniciar tablero
              </button>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>
                Cancelar (Esc)
              </button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Corriente restablecida! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
