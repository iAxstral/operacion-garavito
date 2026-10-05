import { audio } from './sfx';
import { channelVolume, onSettingsChange } from './settings';

// Musica generada en vivo con Web Audio (el proyecto no tiene pistas grabadas).
// Tres capas que se suman segun la intensidad:
//   0 calma   — drone grave y un acorde oscuro que cambia despacio (menu y respiro)
//   1 Kinder  — latido (bombo doble) y bajo pulsante
//   2 peligro — tempo mas rapido, platillos y notas disonantes (jefe, faltan misiones)
// Se programa con un "lookahead": cada 100 ms se agendan las notas del proximo trozo
// con el reloj del AudioContext, asi el ritmo no depende del setInterval.

const LOOKAHEAD_MS = 100;
const SCHEDULE_AHEAD_S = 0.25;
const BASE_GAIN = 0.35;
const FADE_S = 2.5;

// La menor -> Fa -> Re menor -> Mi (cadencia oscura), en Hz.
const CHORDS = [
  [110.0, 130.81, 164.81],
  [87.31, 110.0, 130.81],
  [73.42, 87.31, 110.0],
  [82.41, 103.83, 123.47],
];
const BASS = [55.0, 43.65, 36.71, 41.2];
const BELLS = [440, 523.25, 659.25, 587.33, 493.88, 392];

let master = null;
let layers = null;
let intensity = 0;
let playing = false;
let timer = null;
let nextBeatAt = 0;
let beat = 0;
let pad = null;
let unsubscribeSettings = null;

function tempoFor(level) {
  return level >= 2 ? 132 : 98;
}

function ensureGraph(ctx) {
  if (master) return;
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  layers = [0, 1, 2].map((level) => {
    const gain = ctx.createGain();
    gain.gain.value = level === 0 ? 1 : 0;
    gain.connect(master);
    return gain;
  });
}

function applyVolume() {
  const ctx = audio();
  if (!ctx || !master) return;
  const target = playing ? BASE_GAIN * channelVolume('music') : 0;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
}

function applyIntensity() {
  const ctx = audio();
  if (!ctx || !layers) return;
  layers.forEach((gain, level) => {
    const on = level === 0 || level <= intensity;
    gain.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, FADE_S / 3);
  });
}

// Drone continuo: dos sierras desafinadas por un filtro grave que "respira".
function startPad(ctx) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  filter.Q.value = 6;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(filter.frequency);
  const gain = ctx.createGain();
  gain.gain.value = 0.18;
  filter.connect(gain).connect(layers[0]);
  const oscillators = [-7, 7].map((detune) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start();
    return osc;
  });
  lfo.start();
  pad = { oscillators, lfo, filter, gain };
}

function stopPad() {
  if (!pad) return;
  pad.oscillators.forEach((osc) => osc.stop());
  pad.lfo.stop();
  pad.gain.disconnect();
  pad = null;
}

function envelopeNote(ctx, destination, { type, freq, start, duration, gain, attack = 0.02 }) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env).connect(destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function kick(ctx, start, gain) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.frequency.setValueAtTime(110, start);
  osc.frequency.exponentialRampToValueAtTime(38, start + 0.18);
  env.gain.setValueAtTime(gain, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
  osc.connect(env).connect(layers[1]);
  osc.start(start);
  osc.stop(start + 0.3);
}

function hat(ctx, start) {
  const length = Math.floor(ctx.sampleRate * 0.05);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  src.buffer = buffer;
  filter.type = 'highpass';
  filter.frequency.value = 6000;
  env.gain.value = 0.12;
  src.connect(filter).connect(env).connect(layers[2]);
  src.start(start);
}

// Un pulso (corchea). 16 por acorde.
function scheduleBeat(ctx, time, step) {
  const bar = Math.floor(step / 16) % CHORDS.length;
  const inBar = step % 16;
  const chord = CHORDS[bar];

  if (inBar === 0) {
    pad?.oscillators.forEach((osc) => osc.frequency.setTargetAtTime(BASS[bar], time, 0.6));
    chord.forEach((freq) => envelopeNote(ctx, layers[0], {
      type: 'triangle', freq, start: time, duration: 3.6, gain: 0.05, attack: 0.8,
    }));
  }
  // Campanita lejana de vez en cuando (calma).
  if (inBar === 10 && Math.random() < 0.55) {
    envelopeNote(ctx, layers[0], {
      type: 'sine', freq: BELLS[Math.floor(Math.random() * BELLS.length)], start: time, duration: 2.2, gain: 0.035,
    });
  }
  // Latido: bombo doble en el pulso 1 y bajo en corcheas.
  if (inBar % 8 === 0) kick(ctx, time, 0.5);
  if (inBar % 8 === 1) kick(ctx, time, 0.32);
  if (inBar % 2 === 0) {
    envelopeNote(ctx, layers[1], { type: 'square', freq: BASS[bar] * 2, start: time, duration: 0.18, gain: 0.04, attack: 0.005 });
  }
  // Peligro: platillos en cada corchea y una nota disonante que tensa.
  hat(ctx, time);
  if (inBar === 6 || inBar === 14) {
    envelopeNote(ctx, layers[2], { type: 'sawtooth', freq: chord[2] * 2 * 1.0595, start: time, duration: 0.3, gain: 0.03, attack: 0.005 });
  }
}

function scheduler() {
  const ctx = audio();
  if (!ctx || !playing) return;
  while (nextBeatAt < ctx.currentTime + SCHEDULE_AHEAD_S) {
    scheduleBeat(ctx, nextBeatAt, beat);
    beat += 1;
    nextBeatAt += 60 / tempoFor(intensity) / 2;
  }
}

/** Empieza (o sigue) la musica. Necesita que el jugador ya haya tocado algo (politica de audio). */
export function startMusic(level = 0) {
  const ctx = audio();
  if (!ctx) return;
  ensureGraph(ctx);
  intensity = level;
  applyIntensity();
  if (!playing) {
    playing = true;
    startPad(ctx);
    beat = 0;
    nextBeatAt = ctx.currentTime + 0.1;
    timer = setInterval(scheduler, LOOKAHEAD_MS);
    unsubscribeSettings = onSettingsChange(applyVolume);
  }
  applyVolume();
}

/** 0 calma, 1 Kinder activo, 2 peligro. */
export function setMusicIntensity(level) {
  if (level === intensity) return;
  intensity = level;
  applyIntensity();
}

export function stopMusic() {
  if (!playing) return;
  playing = false;
  applyVolume();
  clearInterval(timer);
  timer = null;
  unsubscribeSettings?.();
  unsubscribeSettings = null;
  const ctx = audio();
  setTimeout(() => {
    if (!playing) stopPad();
  }, ctx ? 1500 : 0);
}

export function isMusicPlaying() {
  return playing;
}
