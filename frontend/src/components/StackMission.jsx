import { useEffect, useRef, useState } from 'react';
import useMissionFlow from './useMissionFlow';

const MISSION_ID = 'mission-infraestructura';
const WIDTH = 320;
const HEIGHT = 380;
const BLOCK_H = 26;
const BASE_W = 150;
const FLOOR_Y = HEIGHT - 20;
const BLOCKS_TARGET = 8;
const PERFECT_PX = 4;
const BASE_SPEED = 120;
const SPEED_STEP = 16;
const RESET_DELAY_MS = 900;

const BLOCK_COLORS = ['#c0603a', '#b5533a', '#d0704a', '#a9482f'];

function freshState() {
  return {
    tower: [{ x: (WIDTH - BASE_W) / 2, w: BASE_W }],
    moving: { x: 0, w: BASE_W, dir: 1 },
    falling: null,
    failedAt: 0,
  };
}

function draw(ctx, game) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#18222b';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#2a3944';
  ctx.fillRect(0, FLOOR_Y, WIDTH, HEIGHT - FLOOR_Y);

  const blockTop = (index) => FLOOR_Y - (index + 1) * BLOCK_H;

  game.tower.forEach((block, index) => {
    ctx.fillStyle = BLOCK_COLORS[index % BLOCK_COLORS.length];
    ctx.fillRect(block.x, blockTop(index), block.w, BLOCK_H - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(block.x, blockTop(index), block.w, 4);
  });

  const movingY = blockTop(game.tower.length);
  if (!game.falling) {
    ctx.strokeStyle = '#e8c34a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(game.moving.x + game.moving.w / 2, 0);
    ctx.lineTo(game.moving.x + game.moving.w / 2, movingY);
    ctx.stroke();
    ctx.fillStyle = BLOCK_COLORS[game.tower.length % BLOCK_COLORS.length];
    ctx.fillRect(game.moving.x, movingY, game.moving.w, BLOCK_H - 2);
  }

  if (game.falling) {
    ctx.fillStyle = '#c0603a';
    ctx.fillRect(game.falling.x, game.falling.y, game.falling.w, BLOCK_H - 2);
  }

  ctx.fillStyle = 'rgba(232,195,74,0.35)';
  ctx.fillRect(0, FLOOR_Y - BLOCKS_TARGET * BLOCK_H, WIDTH, 2);
}

export default function StackMission() {
  const [placed, setPlaced] = useState(0);
  const [message, setMessage] = useState(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(freshState());
  const doneRef = useRef(false);

  const { phase, nearMission, finishSuccess, cancel } = useMissionFlow(MISSION_ID, () => {
    gameRef.current = freshState();
    doneRef.current = false;
    setPlaced(0);
    setMessage(null);
  });

  const drop = () => {
    const game = gameRef.current;
    if (doneRef.current || game.falling) return;

    const top = game.tower[game.tower.length - 1];
    const left = Math.max(top.x, game.moving.x);
    const right = Math.min(top.x + top.w, game.moving.x + game.moving.w);
    const overlap = right - left;

    if (overlap <= 0) {
      game.falling = { x: game.moving.x, y: FLOOR_Y - (game.tower.length + 1) * BLOCK_H, w: game.moving.w, vy: 0 };
      game.failedAt = performance.now();
      setMessage('¡Se cayó la estructura! Intenta de nuevo.');
      return;
    }

    const perfect = Math.abs(game.moving.x - top.x) <= PERFECT_PX;
    const next = perfect ? { x: top.x, w: top.w } : { x: left, w: overlap };
    game.tower.push(next);
    setPlaced(game.tower.length - 1);
    setMessage(perfect ? '¡Perfecto!' : null);

    if (game.tower.length - 1 >= BLOCKS_TARGET) {
      doneRef.current = true;
      finishSuccess();
      return;
    }
    game.moving = { x: 0, w: next.w, dir: 1 };
  };

  const dropRef = useRef(drop);
  useEffect(() => {
    dropRef.current = drop;
  });

  useEffect(() => {
    if (phase !== 'active') return undefined;

    const onKeyDown = (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        dropRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    let rafId;
    let last = performance.now();
    const loop = (now) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      const game = gameRef.current;

      if (game.falling) {
        game.falling.vy += 900 * delta;
        game.falling.y += game.falling.vy * delta;
        if (now - game.failedAt > RESET_DELAY_MS) {
          gameRef.current = freshState();
          setPlaced(0);
          setMessage(null);
        }
      } else if (!doneRef.current) {
        const speed = BASE_SPEED + SPEED_STEP * (game.tower.length - 1);
        game.moving.x += game.moving.dir * speed * delta;
        if (game.moving.x <= 0) {
          game.moving.x = 0;
          game.moving.dir = 1;
        } else if (game.moving.x + game.moving.w >= WIDTH) {
          game.moving.x = WIDTH - game.moving.w;
          game.moving.dir = -1;
        }
      }

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) draw(ctx, gameRef.current);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [phase]);

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Levantar la estructura
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Construcción</h3>
          {phase === 'active' && (
            <>
              <p>Apila los bloques alineados. Suelta con Espacio, clic o el botón.</p>
              <canvas
                ref={canvasRef}
                className="stack-board"
                width={WIDTH}
                height={HEIGHT}
                onPointerDown={(event) => {
                  event.preventDefault();
                  drop();
                }}
              />
              <div className="mission-progress">
                {placed} / {BLOCKS_TARGET} pisos{message ? ` — ${message}` : ''}
              </div>
              <div className="stack-actions">
                <button type="button" className="math-option" onClick={drop}>
                  Colocar
                </button>
                <button type="button" className="mission-cancel-btn" onClick={cancel}>
                  Cancelar (Esc)
                </button>
              </div>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Estructura terminada! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
