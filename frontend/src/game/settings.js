// Configuracion del jugador (volumenes y efectos). Vive en este navegador: se guarda en
// localStorage y cualquier parte del juego puede leerla o suscribirse a sus cambios.

const STORAGE_KEY = 'garavito.settings.v1';

export const VOLUME_CHANNELS = [
  { id: 'master', label: 'Volumen general', hint: 'Afecta a todos los sonidos del juego', icon: '🔊' },
  { id: 'music', label: 'Música', hint: 'Música del menú y de la partida', icon: '🎵' },
  { id: 'ambient', label: 'Ambiente', hint: 'Viento, lluvia, pasos, puertas, crujidos y gemidos lejanos', icon: '🌧️' },
  { id: 'zombies', label: 'Zombis', hint: 'Gruñidos, rugidos y mordidas', icon: '🧟' },
  { id: 'combat', label: 'Combate', hint: 'Tus golpes, impactos y el daño que recibes', icon: '⚔️' },
  { id: 'ui', label: 'Interfaz', hint: 'Botones y menús', icon: '🖱️' },
  { id: 'voices', label: 'Voces del equipo', hint: 'Los avisos hablados de tus compañeros', icon: '📣' },
];

export const DEFAULT_SETTINGS = Object.freeze({
  volumes: Object.freeze({ master: 0.8, music: 0.5, ambient: 0.6, zombies: 0.9, combat: 0.8, ui: 0.6, voices: 0.9 }),
  muted: false,
  vibration: true,
  screenShake: true,
  tips: true,
  typeShapes: false,
  lowPerf: false,
  // Si el juego va lento, activa solo el modo de rendimiento (ver perfMonitor.js).
  autoPerf: true,
  // Recuadro con los FPS y el ping durante la partida.
  showStats: false,
});

// Ajustes de si/no: si lo guardado no es un booleano se usa el valor por defecto.
const FLAGS = ['muted', 'vibration', 'screenShake', 'tips', 'typeShapes', 'lowPerf', 'autoPerf', 'showStats'];

function sanitize(raw) {
  const volumes = { ...DEFAULT_SETTINGS.volumes };
  VOLUME_CHANNELS.forEach(({ id }) => {
    const value = Number(raw?.volumes?.[id]);
    if (Number.isFinite(value)) volumes[id] = Math.min(1, Math.max(0, value));
  });
  const flags = Object.fromEntries(FLAGS.map((key) => [
    key,
    typeof raw?.[key] === 'boolean' ? raw[key] : DEFAULT_SETTINGS[key],
  ]));
  return { volumes, ...flags };
}

function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return sanitize(stored ? JSON.parse(stored) : null);
  } catch {
    // Modo privado o almacenamiento bloqueado: se juega con los valores por defecto.
    return sanitize(null);
  }
}

let settings = load();
const listeners = new Set();

export function getSettings() {
  return settings;
}

export function updateSettings(patch) {
  settings = sanitize({
    ...settings,
    ...patch,
    volumes: { ...settings.volumes, ...(patch.volumes ?? {}) },
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Sin almacenamiento el cambio igual aplica durante esta sesion.
  }
  listeners.forEach((callback) => callback(settings));
}

export function setChannelVolume(channel, value) {
  updateSettings({ volumes: { [channel]: value } });
}

export function resetSettings() {
  updateSettings({ ...DEFAULT_SETTINGS, volumes: { ...DEFAULT_SETTINGS.volumes } });
}

export function onSettingsChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Volumen efectivo (0..1) de un canal: general × canal, o 0 si esta silenciado. */
export function channelVolume(channel) {
  if (settings.muted) return 0;
  const master = settings.volumes.master;
  return channel === 'master' ? master : master * (settings.volumes[channel] ?? 1);
}

export function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibrate(pattern) {
  if (!settings.vibration || !canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Algunos navegadores lo bloquean sin interaccion previa.
  }
}
