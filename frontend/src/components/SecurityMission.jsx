import { useCallback, useEffect, useRef, useState } from 'react';
import {
  onNearMissionChange,
  onStateChange,
  getMyRole,
  requestMissionStart,
  requestMissionCancel,
  requestMissionComplete,
  setInputLocked,
} from '../game/gameSync';

const KILLS_TARGET = 10;
const WINDOW_W = 420;
const WINDOW_H = 260;
const SPAWN_INTERVAL_MS = 900;
const TRAVEL_MS_MAX = 5200;
const TRAVEL_MS_MIN = 2400;
const HIT_PADDING_PX = 10;
const SUCCESS_CLOSE_DELAY_MS = 1100;

const EDGE_RADIUS = Math.hypot(WINDOW_W, WINDOW_H) / 2;

function zombiePose(zombie, now) {
  const progress = Math.min(1, (now - zombie.spawnAt) / zombie.travelMs);
  const dist = EDGE_RADIUS * (1 - progress);
  return {
    x: WINDOW_W / 2 + Math.cos(zombie.angle) * dist,
    y: WINDOW_H / 2 + Math.sin(zombie.angle) * dist,
    size: 14 + progress * 44,
    progress,
  };
}

function drawScene(ctx, zombies, now, mouse) {
  ctx.clearRect(0, 0, WINDOW_W, WINDOW_H);
  ctx.fillStyle = '#0b120b';
  ctx.fillRect(0, 0, WINDOW_W, WINDOW_H);

  const gradient = ctx.createRadialGradient(
    WINDOW_W / 2, WINDOW_H / 2, WINDOW_H * 0.25,
    WINDOW_W / 2, WINDOW_H / 2, WINDOW_H * 0.75,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WINDOW_W, WINDOW_H);

  zombies.forEach((zombie) => {
    const { x, y, size } = zombiePose(zombie, now);
    ctx.fillStyle = '#2f3a26';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.32, size * 0.42, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a6b38';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d2417';
    ctx.beginPath();
    ctx.arc(x - size * 0.16, y - size * 0.05, Math.max(1.4, size * 0.08), 0, Math.PI * 2);
    ctx.arc(x + size * 0.16, y - size * 0.05, Math.max(1.4, size * 0.08), 0, Math.PI * 2);
    ctx.fill();
  });

  if (mouse) {
    ctx.strokeStyle = '#ffcf4d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 14, 0, Math.PI * 2);
    ctx.moveTo(mouse.x - 22, mouse.y);
    ctx.lineTo(mouse.x - 6, mouse.y);
    ctx.moveTo(mouse.x + 6, mouse.y);
    ctx.lineTo(mouse.x + 22, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 22);
    ctx.lineTo(mouse.x, mouse.y - 6);
    ctx.moveTo(mouse.x, mouse.y + 6);
    ctx.lineTo(mouse.x, mouse.y + 22);
    ctx.stroke();
  }
}

export default function SecurityMission() {
  const [nearMission, setNearMissionState] = useState(null);
  const [phase, setPhase] = useState('closed');
  const [kills, setKills] = useState(0);
  const [lastEvent, setLastEvent] = useState(null);

  const canvasRef = useRef(null);
  const zombiesRef = useRef([]);
  const killsRef = useRef(0);
  const finishedRef = useRef(false);
  const mouseRef = useRef({ x: WINDOW_W / 2, y: WINDOW_H / 2 });
  const nextSpawnAtRef = useRef(0);
  const activeMissionRef = useRef(null);

  // 'SEGURIDAD' es el rol dueno de este minijuego: ahora hay 3 salas/instancias posibles
  // (mission-seguridad, mission-seguridad-f1, mission-seguridad-f3), asi que se filtra
  // por rol en vez de por un missionId fijo.
  useEffect(
    () => onNearMissionChange((mission) => setNearMissionState(mission?.role === 'SEGURIDAD' ? mission : null)),
    [],
  );

  useEffect(() => onStateChange((state) => setLastEvent(state.lastEvent)), []);

  useEffect(() => {
    const event = lastEvent;
    const activeId = activeMissionRef.current?.missionId;
    if (!event || event.playerId !== getMyRole() || !activeId || event.itemId !== activeId) return;

    if (event.type === 'MISSION_STARTED') {
      finishedRef.current = false;
      killsRef.current = 0;
      setKills(0);
      setPhase('active');
      setInputLocked(true);
    } else if (event.type === 'MISSION_REJECTED' && phase !== 'closed') {
      setPhase('closed');
      setInputLocked(false);
    }

  }, [lastEvent]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.key === 'e' || event.key === 'E') && phase === 'closed' && nearMission) {
        event.preventDefault();
        activeMissionRef.current = nearMission;
        requestMissionStart(nearMission.missionId);
      } else if (event.key === 'Escape' && phase === 'active') {
        event.preventDefault();
        requestMissionCancel(activeMissionRef.current?.missionId ?? 'mission-seguridad');
        setInputLocked(false);
        setPhase('closed');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, nearMission]);

  const finishSuccess = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    zombiesRef.current = [];
    setPhase('success');
    const mission = activeMissionRef.current;
    setTimeout(() => {
      if (mission) requestMissionComplete(mission.missionId, mission.x, mission.y);
      setInputLocked(false);
      setPhase('closed');
    }, SUCCESS_CLOSE_DELAY_MS);
  }, []);

  useEffect(() => {
    if (phase !== 'active') return undefined;

    zombiesRef.current = [];
    nextSpawnAtRef.current = performance.now() + 350;

    let rafId;
    const loop = (now) => {
      if (now >= nextSpawnAtRef.current) {
        nextSpawnAtRef.current = now + SPAWN_INTERVAL_MS + (Math.random() * 300 - 150);
        const travelMs = Math.max(
          TRAVEL_MS_MIN,
          TRAVEL_MS_MAX - killsRef.current * 220 - Math.random() * 500,
        );
        zombiesRef.current.push({
          id: `${now}-${Math.random()}`,
          angle: Math.random() * Math.PI * 2,
          spawnAt: now,
          travelMs,
        });
      }

      zombiesRef.current = zombiesRef.current.filter((z) => zombiePose(z, now).progress < 1);

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawScene(ctx, zombiesRef.current, now, mouseRef.current);

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [phase]);

  const handlePointerMove = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handleClick = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const now = performance.now();

    let bestIndex = -1;
    let bestProgress = -1;
    zombiesRef.current.forEach((zombie, index) => {
      const pose = zombiePose(zombie, now);
      const distance = Math.hypot(pose.x - clickX, pose.y - clickY);
      if (distance <= pose.size / 2 + HIT_PADDING_PX && pose.progress > bestProgress) {
        bestProgress = pose.progress;
        bestIndex = index;
      }
    });

    if (bestIndex === -1) return;
    zombiesRef.current.splice(bestIndex, 1);
    killsRef.current += 1;
    setKills(killsRef.current);
    if (killsRef.current >= KILLS_TARGET) finishSuccess();
  };

  const handleCancelClick = () => {
    requestMissionCancel(activeMissionRef.current?.missionId ?? 'mission-seguridad');
    setInputLocked(false);
    setPhase('closed');
  };

  return (
    <>
      {phase === 'closed' && nearMission && (
        <div className="mission-hint">
          Presiona <strong>E</strong> — Tarea de Seguridad
        </div>
      )}

      {(phase === 'active' || phase === 'success') && (
        <div className="mission-modal">
          <h3>Cámaras de vigilancia</h3>
          {phase === 'active' && (
            <>
              <p>Dispara a los zombis que se acercan por la cámara.</p>
              <div
                className="mission-window"
                style={{ width: WINDOW_W, height: WINDOW_H, cursor: 'none' }}
              >
                <canvas
                  ref={canvasRef}
                  width={WINDOW_W}
                  height={WINDOW_H}
                  onMouseMove={handlePointerMove}
                  onClick={handleClick}
                />
              </div>
              <div className="mission-progress">{kills} / {KILLS_TARGET} eliminados</div>
              <button type="button" className="mission-cancel-btn" onClick={handleCancelClick}>
                Cancelar (Esc)
              </button>
            </>
          )}
          {phase === 'success' && <p className="mission-success">¡Zona asegurada! Enviando reporte…</p>}
        </div>
      )}
    </>
  );
}
