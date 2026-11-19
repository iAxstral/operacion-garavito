// Mide la latencia (ida y vuelta) con el servidor pidiendo /api/ping cada tanto y la
// suaviza con una media movil exponencial para que el numero no salte en cada medida.
// Las cuentas son puras (smoothRtt, pingLevel) y se prueban en Node; la medicion usa
// fetch y performance.now, que se pueden reemplazar en las pruebas.

/** Peso de la medida nueva en la media (0..1): mas alto reacciona mas rapido. */
export const RTT_ALPHA = 0.3;

/** Media movil exponencial: la primera medida se toma tal cual. */
export function smoothRtt(previous, sample, alpha = RTT_ALPHA) {
  if (!Number.isFinite(sample) || sample < 0) return previous;
  if (previous == null) return sample;
  return previous + alpha * (sample - previous);
}

/** Que tan bueno es un ping (ms) o unos FPS, para pintar el indicador. */
export function pingLevel(ms) {
  if (ms == null) return 'unknown';
  if (ms < 80) return 'good';
  if (ms < 180) return 'fair';
  return 'bad';
}

export function fpsLevel(fps) {
  if (!Number.isFinite(fps)) return 'unknown';
  if (fps >= 50) return 'good';
  if (fps >= 30) return 'fair';
  return 'bad';
}

/**
 * Crea un medidor. `start()` mide ya y luego cada `everyMs`; `onChange(ms)` recibe la
 * latencia suavizada. Si una medida falla o tarda mas de `timeoutMs`, se descarta.
 */
export function createLatencyMeter({
  url,
  everyMs = 3000,
  timeoutMs = 2000,
  onChange = () => {},
  fetchImpl = (...args) => fetch(...args),
  now = () => performance.now(),
} = {}) {
  let rtt = null;
  let timer = null;
  let running = false;

  async function measure() {
    const controller = new AbortController();
    const abort = setTimeout(() => controller.abort(), timeoutMs);
    const sentAt = now();
    try {
      const response = await fetchImpl(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return rtt;
      await response.json();
      const next = smoothRtt(rtt, now() - sentAt);
      if (next !== rtt) {
        rtt = next;
        onChange(Math.round(rtt));
      }
    } catch {
      // Sin red o tiempo agotado: se mantiene la ultima medida.
    } finally {
      clearTimeout(abort);
    }
    return rtt;
  }

  function loop() {
    if (!running) return;
    measure().finally(() => {
      if (running) timer = setTimeout(loop, everyMs);
    });
  }

  return {
    measure,
    start() {
      if (running) return;
      running = true;
      loop();
    },
    stop() {
      running = false;
      clearTimeout(timer);
    },
    get rtt() {
      return rtt == null ? null : Math.round(rtt);
    },
  };
}
