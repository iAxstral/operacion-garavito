// Puente chico entre la escena de Phaser y React para las cifras en vivo de la partida
// (por ahora, los FPS). La escena publica y el indicador de la esquina se suscribe.

let stats = { fps: null };
const listeners = new Set();

export function getLiveStats() {
  return stats;
}

/** La escena publica los FPS redondeados; solo se avisa si cambiaron. */
export function publishFps(fps) {
  const rounded = Number.isFinite(fps) ? Math.round(fps) : null;
  if (rounded === stats.fps) return;
  stats = { ...stats, fps: rounded };
  listeners.forEach((callback) => callback(stats));
}

export function onLiveStats(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Al salir de la partida: sin escena no hay FPS que mostrar. */
export function resetLiveStats() {
  publishFps(null);
}
