import { useEffect, useRef, useState } from 'react';
import { MAP_COLS, MAP_ROWS, TILE, buildFloorLayout } from '../game/mapLayout';
import { lerpEntity } from '../game/replay';
import { roleInfo } from '../game/roleCatalog';

// Dibuja la mejor jugada vista desde arriba: los muros del piso, los jugadores (con su
// inicial), los zombis por tipo, el jefe y las explosiones. La camara sigue al
// protagonista. Se puede repetir y cambiar la velocidad.

const VIEW_W = 1100;
const ROLE_COLORS = { SEGURIDAD: '#4aa3ff', SALUD: '#ff6fa8', ECONOMIA: '#ffd23a', INFRAESTRUCTURA: '#ff8a1a' };
const ZOMBIE_COLORS = {
  WALKER: '#6a9a3a', RUNNER: '#3fd8ff', SPITTER: '#9dff3a', TOUGH: '#ff3a2a',
  EXPLODER: '#ff8a1a', SCREAMER: '#d94aff', BLIND: '#dedede',
};

function wallsFor(building, floor) {
  try {
    const { grid } = buildFloorLayout({ building, floor });
    const walls = [];
    for (let y = 0; y < MAP_ROWS; y += 1) {
      for (let x = 0; x < MAP_COLS; x += 1) {
        const cell = grid[y]?.[x];
        if (!cell || cell.type === 'wall') walls.push([x, y]);
      }
    }
    return walls;
  } catch {
    return [];
  }
}

export default function ReplayViewer({ play, onClose }) {
  const canvasRef = useRef(null);
  const [speed, setSpeed] = useState(1);
  const [run, setRun] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || play.frames.length < 2) return undefined;
    const frames = play.frames;
    const start = frames[0].t;
    const length = frames[frames.length - 1].t - start;
    const wallCache = new Map();
    const blastBorn = new Map();
    let raf = 0;
    let clock = 0;
    let last = performance.now();

    const draw = (now) => {
      clock = Math.min(length, clock + (now - last) * speed);
      last = now;
      const t = start + clock;
      let i = frames.findIndex((f) => f.t > t);
      if (i <= 0) i = i === 0 ? 1 : frames.length - 1;
      const a = frames[i - 1];
      const b = frames[i];
      const alpha = b.t === a.t ? 0 : Math.min(1, (t - a.t) / (b.t - a.t));

      const focus = a.players.find((p) => p.id === play.focusId) ?? a.players[0];
      const focusNext = b.players.find((p) => p.id === focus?.id);
      const cam = focus ? lerpEntity(focus, focusNext, alpha) : { x: 1280, y: 960, floor: 1 };
      const floor = cam.floor ?? 1;
      if (!wallCache.has(floor)) wallCache.set(floor, wallsFor(play.building, floor));

      const scale = canvas.width / VIEW_W;
      const viewH = canvas.height / scale;
      const ox = cam.x - VIEW_W / 2;
      const oy = cam.y - viewH / 2;
      const sx = (x) => (x - ox) * scale;
      const sy = (y) => (y - oy) * scale;

      ctx.fillStyle = '#1c1416';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#4a3a34';
      wallCache.get(floor).forEach(([x, y]) => ctx.fillRect(sx(x * TILE), sy(y * TILE), TILE * scale + 1, TILE * scale + 1));

      a.blasts.filter((bl) => bl.floor === floor).forEach((bl) => {
        if (!blastBorn.has(bl.id)) blastBorn.set(bl.id, t);
        const age = (t - blastBorn.get(bl.id)) / 500;
        if (age > 1) return;
        ctx.strokeStyle = `rgba(255, 140, 40, ${1 - age})`;
        ctx.lineWidth = 6 * scale;
        ctx.beginPath();
        ctx.arc(sx(bl.x), sy(bl.y), (20 + 80 * age) * scale, 0, Math.PI * 2);
        ctx.stroke();
      });

      a.zombies.filter((z) => z.floor === floor).forEach((z) => {
        const p = lerpEntity(z, b.zombies.find((n) => n.id === z.id), alpha);
        ctx.fillStyle = ZOMBIE_COLORS[z.kind] ?? ZOMBIE_COLORS.WALKER;
        ctx.beginPath();
        ctx.arc(sx(p.x), sy(p.y), 11 * scale, 0, Math.PI * 2);
        ctx.fill();
      });

      if (a.boss && a.boss.floor === floor) {
        const p = lerpEntity(a.boss, b.boss, alpha);
        ctx.fillStyle = '#c01010';
        ctx.beginPath();
        ctx.arc(sx(p.x), sy(p.y), 30 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      a.players.filter((pl) => pl.floor === floor && !pl.gone).forEach((pl) => {
        const p = lerpEntity(pl, b.players.find((n) => n.id === pl.id), alpha);
        const r = 15 * scale;
        ctx.fillStyle = pl.down ? '#777' : ROLE_COLORS[pl.role] ?? '#fff';
        ctx.beginPath();
        ctx.arc(sx(p.x), sy(p.y), r, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = (pl.id === play.focusId ? 4 : 2) * scale;
        ctx.strokeStyle = pl.id === play.focusId ? '#fff' : '#000';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(11, 14 * scale)}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillText(pl.name ?? roleInfo(pl.role).name, sx(p.x), sy(p.y) - r - 6 * scale);
      });

      // Bordes oscuros: que se sienta como camara de seguridad.
      const fade = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.35,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.65);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      setProgress(length ? clock / length : 1);
      if (clock < length) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [play, speed, run]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="settings-overlay replay-overlay" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="settings-panel replay-panel" role="dialog" aria-modal="true" aria-label="Mejor jugada">
        <header className="settings-header">
          <h2>⏪ {play.title}</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>
        <div className="replay-screen">
          <canvas ref={canvasRef} width={880} height={495} />
          <span className="replay-rec">● REC</span>
        </div>
        <div className="replay-bar"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        <div className="replay-controls">
          <button type="button" className="game-over-btn" onClick={() => setRun((n) => n + 1)}>Repetir</button>
          {[0.5, 1, 2].map((s) => (
            <button
              key={s}
              type="button"
              className={`game-over-btn${speed === s ? ' game-over-btn--primary' : ''}`}
              onClick={() => {
                setSpeed(s);
                setRun((n) => n + 1);
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
