import { useEffect, useRef, useState } from 'react';
import {
  getBoss,
  getLatestState,
  getMyBuilding,
  getMyPlayerState,
  getMyRole,
  getZombies,
  onAbilityPanelChange,
  setAbilityPanel,
} from '../game/gameSync';
import { buildFloorLayout, floorCount, MAP_COLS, MAP_ROWS, TILE } from '../game/mapLayout';
import { missionSitesFor } from '../game/missionCatalog';
import { CAMERA_RANGE_PX } from '../game/abilityCatalog';
import { playSfx } from '../game/sfx';

const CELL = 8;
const ZOMBIE_COLORS = { WALKER: '#e05a5a', RUNNER: '#4fc3f7', SPITTER: '#b6ff5a' };

// Celda caminable mas cercana a (x, y): las camaras de pasillo se ubican ahi.
function nearestWalkable(grid, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (let row = 0; row < MAP_ROWS; row += 1) {
    for (let col = 0; col < MAP_COLS; col += 1) {
      const cell = grid[row]?.[col];
      const type = typeof cell === 'string' ? cell : cell?.type;
      if (!type || type === 'wall' || type === 'glass') continue;
      const cx = col * TILE + TILE / 2;
      const cy = row * TILE + TILE / 2;
      const distance = Math.hypot(cx - x, cy - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x: cx, y: cy };
      }
    }
  }
  return best;
}

// Camaras del piso: una por sala de mision y tres en el pasillo central.
function camerasFor(building, floor, grid) {
  const rooms = missionSitesFor(building).filter((site) => site.floor === floor).map((site) => ({ x: site.x, y: site.y }));
  const midY = (MAP_ROWS * TILE) / 2;
  const hall = [0.25, 0.5, 0.75]
    .map((fraction) => nearestWalkable(grid, MAP_COLS * TILE * fraction, midY))
    .filter(Boolean);
  return [...rooms, ...hall];
}

// Grilla y camaras de cada piso: se calculan una vez (el mapa no cambia en la partida).
const floorCache = new Map();
function floorView(building, floor) {
  const key = `${building}-${floor}`;
  if (!floorCache.has(key)) {
    const { grid } = buildFloorLayout({ building, floor });
    floorCache.set(key, { grid, cameras: camerasFor(building, floor, grid) });
  }
  return floorCache.get(key);
}

const seenBy = (cameras, x, y) => cameras.some((cam) => Math.hypot(cam.x - x, cam.y - y) <= CAMERA_RANGE_PX);

/**
 * Habilidad de Seguridad: un telefono con las camaras del edificio. Muestra los
 * zombis que caen dentro del alcance de alguna camara, piso por piso; fuera de ellas
 * hay puntos ciegos.
 */
export default function PhonePanel() {
  const [open, setOpen] = useState(false);
  const [floor, setFloor] = useState(() => getMyPlayerState()?.floor ?? 1);
  const canvasRef = useRef(null);

  useEffect(() => onAbilityPanelChange((panel) => {
    setOpen(panel === 'phone');
    if (panel === 'phone') setFloor(getMyPlayerState()?.floor ?? 1);
  }), []);

  const building = getMyBuilding();
  const floors = floorCount(building);
  const { grid, cameras } = floorView(building, floor);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      // Captura: que el Esc no llegue al HUD (abriria la configuracion).
      event.stopPropagation();
      setAbilityPanel(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let rafId;
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const t = performance.now() / 1000;
        ctx.fillStyle = '#05080a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let row = 0; row < MAP_ROWS; row += 1) {
          for (let col = 0; col < MAP_COLS; col += 1) {
            const cell = grid[row]?.[col];
            const type = typeof cell === 'string' ? cell : cell?.type;
            if (!type || type === 'wall' || type === 'glass') continue;
            ctx.fillStyle = type === 'stair' || type === 'landing' ? '#2a3a2a' : '#1a2a22';
            ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
          }
        }
        const scale = CELL / TILE;
        cameras.forEach((cam) => {
          ctx.fillStyle = 'rgba(80, 220, 140, 0.08)';
          ctx.beginPath();
          ctx.arc(cam.x * scale, cam.y * scale, CAMERA_RANGE_PX * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = Math.sin(t * 3) > 0 ? '#ff4040' : '#7a1a1a';
          ctx.fillRect(cam.x * scale - 2, cam.y * scale - 2, 4, 4);
        });

        getZombies()
          .filter((z) => z.floor === floor && seenBy(cameras, z.x, z.y))
          .forEach((z) => {
            ctx.fillStyle = ZOMBIE_COLORS[z.kind] ?? ZOMBIE_COLORS.WALKER;
            ctx.beginPath();
            ctx.arc(z.x * scale, z.y * scale, z.tough ? 3.5 : 2.6, 0, Math.PI * 2);
            ctx.fill();
          });
        const boss = getBoss();
        if (boss && boss.floor === floor && seenBy(cameras, boss.x, boss.y)) {
          ctx.fillStyle = '#c77dff';
          ctx.beginPath();
          ctx.arc(boss.x * scale, boss.y * scale, 6 + Math.sin(t * 6), 0, Math.PI * 2);
          ctx.fill();
        }
        getLatestState().players.filter((p) => p.floor === floor).forEach((p) => {
          ctx.fillStyle = p.playerId === getMyRole() ? '#4fc3f7' : '#f2fbe2';
          ctx.fillRect(p.x * scale - 3, p.y * scale - 3, 6, 6);
        });

        // Lineas de interferencia: es una camara de seguridad vieja.
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        for (let y = (t * 40) % 6; y < canvas.height; y += 6) ctx.fillRect(0, y, canvas.width, 1);
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [open, floor, grid, cameras]);

  if (!open) return null;

  const counts = Array.from({ length: floors }, (_, i) => {
    const f = i + 1;
    const cams = floorView(building, f).cameras;
    return getZombies().filter((z) => z.floor === f && seenBy(cams, z.x, z.y)).length;
  });

  return (
    <div className="phone-panel" role="dialog" aria-label="Teléfono de cámaras">
      <div className="phone-header">
        <span>📱 Cámaras — Edificio {building}</span>
        <button type="button" className="modal-close phone-close" aria-label="Guardar el teléfono" onClick={() => setAbilityPanel(null)}>✕</button>
      </div>
      <div className="phone-tabs">
        {counts.map((count, i) => (
          <button
            key={i + 1}
            type="button"
            className={`phone-tab${floor === i + 1 ? ' phone-tab--active' : ''}`}
            onClick={() => {
              setFloor(i + 1);
              playSfx('click');
            }}
          >
            Piso {i + 1}
            {count > 0 && <span className="phone-tab-count">{count}🧟</span>}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} width={MAP_COLS * CELL} height={MAP_ROWS * CELL} className="phone-screen" />
      <div className="phone-legend">
        <span><i style={{ background: ZOMBIE_COLORS.WALKER }} />Zombi</span>
        <span><i style={{ background: ZOMBIE_COLORS.RUNNER }} />Corredor</span>
        <span><i style={{ background: ZOMBIE_COLORS.SPITTER }} />Escupidor</span>
        <span><i style={{ background: '#4fc3f7' }} />Tú</span>
      </div>
      <p className="phone-note">Fuera de las cámaras hay puntos ciegos. F / Esc para guardarlo.</p>
    </div>
  );
}
