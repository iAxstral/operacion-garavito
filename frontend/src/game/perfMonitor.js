// Vigila los cuadros por segundo de la partida y avisa cuando conviene bajar la calidad.
// No sabe nada de Phaser: recibe muestras (fps, instante) y responde si hay que actuar,
// para poder probarlo en Node.
//
// Reglas:
//  - El promedio es de una ventana movil (por defecto 5 s).
//  - Si el promedio queda por debajo del umbral durante `sustainMs` seguidos, pide bajar.
//  - Despues de pedirlo no vuelve a decidir durante `cooldownMs` (le da tiempo al cambio).
//  - Los primeros `warmupMs` no cuentan: al cargar el piso los FPS caen siempre.

export const PERF_DEFAULTS = Object.freeze({
  threshold: 40,
  windowMs: 5000,
  sustainMs: 5000,
  cooldownMs: 20000,
  warmupMs: 3000,
});

export function createPerfMonitor(options = {}) {
  const config = { ...PERF_DEFAULTS, ...options };
  const samples = [];
  let startedAt = null;
  let lowSince = null;
  let quietUntil = 0;

  function average() {
    if (!samples.length) return null;
    return samples.reduce((sum, sample) => sum + sample.fps, 0) / samples.length;
  }

  /**
   * Agrega una muestra. Devuelve 'lower' cuando hay que bajar la calidad y null si no.
   * Muestras con fps invalido (NaN, negativos, infinitos) se ignoran.
   */
  function sample(fps, now) {
    if (!Number.isFinite(fps) || fps < 0) return null;
    if (startedAt === null) startedAt = now;
    samples.push({ fps, at: now });
    while (samples.length && now - samples[0].at > config.windowMs) samples.shift();

    if (now - startedAt < config.warmupMs || now < quietUntil) {
      lowSince = null;
      return null;
    }
    if (average() >= config.threshold) {
      lowSince = null;
      return null;
    }
    if (lowSince === null) lowSince = now;
    if (now - lowSince < config.sustainMs) return null;

    lowSince = null;
    quietUntil = now + config.cooldownMs;
    return 'lower';
  }

  function reset() {
    samples.length = 0;
    startedAt = null;
    lowSince = null;
    quietUntil = 0;
  }

  return { sample, average, reset };
}
