import { useEffect, useState, useSyncExternalStore } from 'react';
import { API_BASE } from '../services/socketService';
import { createLatencyMeter, fpsLevel, pingLevel } from '../game/latency';
import { getLiveStats, onLiveStats } from '../game/liveStats';
import { getSettings, onSettingsChange } from '../game/settings';
import './statsOverlay.css';

// Cada cuanto se mide el ping mientras el indicador esta visible (ms).
const PING_EVERY_MS = 3000;

/**
 * Recuadro chico en la partida con los FPS y el ping (ajuste "Mostrar FPS y ping").
 * El ping solo se mide mientras se ve, para no gastar red si nadie lo mira.
 */
export default function StatsOverlay() {
  const visible = useSyncExternalStore(onSettingsChange, () => getSettings().showStats);
  const { fps } = useSyncExternalStore(onLiveStats, getLiveStats);
  const [ping, setPing] = useState(null);

  useEffect(() => {
    if (!visible) return undefined;
    const meter = createLatencyMeter({ url: `${API_BASE}/api/ping`, everyMs: PING_EVERY_MS, onChange: setPing });
    meter.start();
    return () => {
      meter.stop();
      setPing(null);
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="stats-overlay" role="status" aria-label="Rendimiento">
      <span className={`stats-overlay-item stats-overlay-item--${fpsLevel(fps)}`}>
        <strong>{fps ?? '–'}</strong> FPS
      </span>
      <span className={`stats-overlay-item stats-overlay-item--${pingLevel(ping)}`}>
        <strong>{ping ?? '–'}</strong> ms
      </span>
    </div>
  );
}
