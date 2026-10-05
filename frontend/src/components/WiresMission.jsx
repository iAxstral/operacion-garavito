import { useRef, useState } from 'react';
import useMissionFlow from './useMissionFlow';

const MISSION_ROLE = 'SALUD';
const WIDTH = 420;
const HEIGHT = 300;
const LEFT_X = 46;
const RIGHT_X = WIDTH - 46;
const SLOT_Y = [50, 116, 182, 248];
const HIT_RADIUS = 30;

const WIRE_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#d81b60'];

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function newLayout() {
  return { left: shuffled(WIRE_COLORS), right: shuffled(WIRE_COLORS) };
}

export default function WiresMission() {
  const [layout, setLayout] = useState(newLayout);
  const [connected, setConnected] = useState([]);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_ROLE, () => {
    setLayout(newLayout());
    setConnected([]);
    setDrag(null);
  });

  const pointerPosition = (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const handleStart = (index, event) => {
    const color = layout.left[index];
    if (connected.includes(color)) return;
    svgRef.current.setPointerCapture(event.pointerId);
    setDrag({ color, fromY: SLOT_Y[index], ...pointerPosition(event) });
  };

  const handleMove = (event) => {
    if (!drag) return;
    setDrag({ ...drag, ...pointerPosition(event) });
  };

  const handleEnd = (event) => {
    if (!drag) return;
    const { x, y } = pointerPosition(event);
    const targetIndex = SLOT_Y.findIndex((slotY) => Math.hypot(RIGHT_X - x, slotY - y) <= HIT_RADIUS);
    setDrag(null);
    if (targetIndex === -1 || layout.right[targetIndex] !== drag.color) return;

    const next = [...connected, drag.color];
    setConnected(next);
    if (next.length === WIRE_COLORS.length) finishSuccess();
  };

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Reparar cableado del laboratorio
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Reparar cableado</h3>
          {phase === 'active' && (
            <>
              <p>Arrastra cada cable hasta el conector del mismo color.</p>
              <svg
                ref={svgRef}
                className="wires-board"
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                width={WIDTH}
                height={HEIGHT}
                onPointerMove={handleMove}
                onPointerUp={handleEnd}
                onPointerCancel={handleEnd}
              >
                <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="10" fill="#1b2128" />
                <rect x="14" y="14" width="34" height={HEIGHT - 28} rx="6" fill="#3a434d" />
                <rect x={WIDTH - 48} y="14" width="34" height={HEIGHT - 28} rx="6" fill="#3a434d" />

                {layout.left.map((color, index) => {
                  const done = connected.includes(color);
                  const rightIndex = layout.right.indexOf(color);
                  return (
                    <g key={`l-${color}`}>
                      <rect x="24" y={SLOT_Y[index] - 12} width="24" height="24" rx="4" fill={color} />
                      {done && (
                        <path
                          d={`M ${LEFT_X} ${SLOT_Y[index]} C ${WIDTH / 2} ${SLOT_Y[index]}, ${WIDTH / 2} ${SLOT_Y[rightIndex]}, ${RIGHT_X} ${SLOT_Y[rightIndex]}`}
                          stroke={color}
                          strokeWidth="9"
                          strokeLinecap="round"
                          fill="none"
                        />
                      )}
                      <circle
                        cx={LEFT_X}
                        cy={SLOT_Y[index]}
                        r="13"
                        fill={color}
                        stroke="#0b0f13"
                        strokeWidth="3"
                        style={{ cursor: done ? 'default' : 'grab', touchAction: 'none' }}
                        onPointerDown={(event) => handleStart(index, event)}
                      />
                    </g>
                  );
                })}

                {layout.right.map((color, index) => (
                  <g key={`r-${color}`}>
                    <rect x={WIDTH - 48} y={SLOT_Y[index] - 12} width="24" height="24" rx="4" fill={color} />
                    <circle cx={RIGHT_X} cy={SLOT_Y[index]} r="13" fill={color} stroke="#0b0f13" strokeWidth="3" />
                  </g>
                ))}

                {drag && (
                  <path
                    d={`M ${LEFT_X} ${drag.fromY} L ${drag.x} ${drag.y}`}
                    stroke={drag.color}
                    strokeWidth="9"
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
              </svg>
              <div className="mission-progress">{connected.length} / {WIRE_COLORS.length} cables conectados</div>
              <button type="button" className="mission-cancel-btn" onClick={cancel}>
                Cancelar (Esc)
              </button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Cableado reparado! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
