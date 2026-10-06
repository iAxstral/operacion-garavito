import { audio } from './sfx';
import { channelVolume } from './settings';

// Sonidos grabados (CC0, ver public/sounds/CREDITOS.md) con Web Audio. Cada efecto
// puede tener varias versiones y se elige una al azar con un tono un poco distinto,
// para que no suene repetido. Los que vienen de un punto del mapa se ubican: se oyen a
// la izquierda o a la derecha, mas bajo con la distancia y apagados si hay una pared.

const BASE = '/sounds/sfx/';
const range = (prefix, n, from = 0) => Array.from({ length: n }, (_, i) => `${prefix}${i + from}`);

// Nombre logico -> archivos posibles.
export const SAMPLES = {
  stepConcrete: range('step_concrete_', 5),
  stepWood: range('step_wood_', 5),
  stepCarpet: range('step_carpet_', 5),
  doorOpen: ['door_open_1', 'door_open_2'],
  doorClose: ['door_close_1', 'door_close_2', 'door_close_3'],
  creak: ['creak_1', 'creak_2', 'creak_3'],
  bat: ['bat_1', 'bat_2', 'bat_3'],
  ghost: range('ghost_', 5, 1),
  swing: ['swing', 'swing_2'],
  draw: ['draw'],
  reload: ['reload'],
  empty: ['empty'],
  coins: ['coins'],
  hit: ['hit_1', 'hit_2', 'hit_3'],
  hitHeavy: ['hit_heavy'],
  hurt: ['hurt'],
  plank: ['plank'],
  plankBreak: ['plank_break'],
  pistol: ['pistol'],
  rifle: ['rifle'],
};

// Distancia (px del mundo) a la que un sonido ya no se oye, y ancho para el paneo.
const MAX_HEAR_PX = 1100;
const PAN_PX = 520;

const buffers = new Map();
const loading = new Map();
let listener = { x: 0, y: 0, floor: 1, active: false };
let occlusion = null;

function load(file) {
  if (buffers.has(file)) return Promise.resolve(buffers.get(file));
  if (loading.has(file)) return loading.get(file);
  const ctx = audio();
  if (!ctx) return Promise.resolve(null);
  const promise = fetch(`${BASE}${file}.mp3`)
    .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(response.status))))
    .then((data) => new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject)))
    .then((buffer) => {
      buffers.set(file, buffer);
      return buffer;
    })
    .catch(() => null)
    .finally(() => loading.delete(file));
  loading.set(file, promise);
  return promise;
}

/** Baja de una vez todos los sonidos (o solo los nombres dados). */
export function preloadSamples(names = Object.keys(SAMPLES)) {
  return Promise.all(names.flatMap((name) => (SAMPLES[name] ?? []).map(load)));
}

export function hasSample(name) {
  return (SAMPLES[name] ?? []).some((file) => buffers.has(file));
}

/** Quien escucha (el jugador o a quien se esta espectando). Lo pone la escena cada cuadro. */
export function setListener(x, y, floor) {
  listener = { x, y, floor, active: true };
}

export function clearListener() {
  listener = { ...listener, active: false };
}

/** Funcion (x1, y1, x2, y2) => true si hay una pared entre los dos puntos. */
export function setOcclusion(fn) {
  occlusion = fn;
}

/**
 * Suena un efecto grabado. Opciones: channel, volume (0..1), rate, variance (tono al
 * azar), at: { x, y, floor } para ubicarlo, destination (otro nodo de salida).
 * Devuelve false si no habia nada que tocar (no cargado o fuera de alcance).
 */
export function playSample(name, { channel = 'combat', volume = 1, rate = 1, variance = 0.08, at = null, destination = null } = {}) {
  const ctx = audio();
  const files = (SAMPLES[name] ?? []).filter((file) => buffers.has(file));
  if (!ctx || !files.length) {
    (SAMPLES[name] ?? []).forEach(load);
    return false;
  }
  let gainValue = volume * (destination ? 1 : channelVolume(channel));
  let pan = 0;
  let muffled = false;
  if (at && listener.active) {
    if (at.floor != null && at.floor !== listener.floor) return false;
    const dx = at.x - listener.x;
    const dy = at.y - listener.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= MAX_HEAR_PX) return false;
    gainValue *= (1 - distance / MAX_HEAR_PX) ** 1.6;
    pan = Math.max(-1, Math.min(1, dx / PAN_PX)) * 0.85;
    muffled = distance > 60 && Boolean(occlusion?.(listener.x, listener.y, at.x, at.y));
    if (muffled) gainValue *= 0.55;
  }
  if (gainValue <= 0.003) return false;

  const source = ctx.createBufferSource();
  source.buffer = buffers.get(files[Math.floor(Math.random() * files.length)]);
  source.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * variance);
  let node = source;
  if (muffled) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 850;
    node = node.connect(filter);
  }
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  node = node.connect(gain);
  if (pan && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    node = node.connect(panner);
  }
  node.connect(destination ?? ctx.destination);
  source.start();
  return true;
}
