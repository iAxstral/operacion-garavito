import { audio } from '../game/sfx';
import { channelVolume } from '../game/settings';

// Sonidos de la intro de Navidad, generados con Web Audio (sin archivos nuevos) salvo
// los gruñidos, que son las grabaciones que ya usa el juego. Cada efecto se agenda con
// el reloj del AudioContext para que quede en sincronia con la animacion CSS.

function envelope(ctx, node, { start, gain, attack = 0.005, decay = 0.4 }) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  node.connect(env);
  return env;
}

function tone(ctx, out, { start, freq, to = freq, type = 'sine', gain, attack, decay }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, start + attack + decay);
  envelope(ctx, osc, { start, gain, attack, decay }).connect(out);
  osc.start(start);
  osc.stop(start + attack + decay + 0.05);
}

function noise(ctx, out, { start, gain, decay, freq, q = 1, type = 'bandpass' }) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * (decay + 0.05)));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  src.buffer = buffer;
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  src.connect(filter);
  envelope(ctx, filter, { start, gain, decay }).connect(out);
  src.start(start);
}

const CUES = {
  // Tic-tac del reloj.
  tick: (ctx, out, start) => tone(ctx, out, { start, freq: 2400, type: 'square', gain: 0.05, attack: 0.001, decay: 0.03 }),
  // Nota de caja de musica, algo desafinada.
  box: (ctx, out, start, freq) => {
    const detune = 1 + (Math.random() - 0.5) * 0.014;
    tone(ctx, out, { start, freq: freq * detune, gain: 0.09, attack: 0.004, decay: 1.4 });
    tone(ctx, out, { start, freq: freq * 2.76 * detune, gain: 0.02, attack: 0.002, decay: 0.45 });
  },
  // Chispazo del bombillo y el zumbido que se corta.
  spark: (ctx, out, start) => {
    noise(ctx, out, { start, gain: 0.35, decay: 0.12, freq: 3200, q: 0.8 });
    tone(ctx, out, { start, freq: 120, to: 40, type: 'sawtooth', gain: 0.12, attack: 0.01, decay: 0.5 });
  },
  // Golpe grave del titulo.
  thud: (ctx, out, start) => {
    tone(ctx, out, { start, freq: 90, to: 30, gain: 0.7, attack: 0.003, decay: 0.9 });
    noise(ctx, out, { start, gain: 0.25, decay: 0.5, freq: 300, type: 'lowpass' });
  },
  // Relampago: ruido blanco largo que se aleja.
  thunder: (ctx, out, start) => noise(ctx, out, { start, gain: 0.3, decay: 2.2, freq: 500, type: 'lowpass' }),
  // Viento helado de fondo: ruido grave que sube y baja durante `duration` segundos.
  wind: (ctx, out, start, duration) => {
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      last = last * 0.98 + (Math.random() * 2 - 1) * 0.02; // ruido "marron", mas suave
      data[i] = last * 6;
    }
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(350, start);
    filter.frequency.linearRampToValueAtTime(700, start + duration * 0.5);
    filter.frequency.linearRampToValueAtTime(300, start + duration);
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.5, start + 2);
    gain.gain.linearRampToValueAtTime(0.35, start + duration - 1.5);
    gain.gain.linearRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(gain).connect(out);
    src.start(start);
  },
  // Cascabeles de trineo distorsionados.
  bells: (ctx, out, start) => {
    [0, 0.07, 0.15].forEach((d) => noise(ctx, out, { start: start + d, gain: 0.12, decay: 0.08, freq: 7000, q: 3 }));
  },
};

/**
 * Agenda en `ctx` los efectos sintetizados de `cues` ([segundo, nombre, ...args]) desde
 * `elapsed` (s ya transcurridos). Las grabaciones (gruñido, rugido) se las pasa a
 * `onSample(nombre, segundoDeInicio)`: en vivo suenan con <audio>, y al exportar el
 * video se mezclan desde un buffer.
 */
export function scheduleIntroCues(ctx, out, cues, elapsed, onSample) {
  const now = ctx.currentTime;
  cues.forEach(([at, name, ...args]) => {
    if (at < elapsed) return;
    const start = now + (at - elapsed);
    if (name === 'groan' || name === 'roar') onSample?.(name, start);
    else CUES[name]?.(ctx, out, start, ...args);
  });
}

export const SAMPLE_URLS = { groan: '/sounds/zombie_groan.wav', roar: '/sounds/zombie_roar.wav' };

/** Suena la intro en vivo desde `elapsed`. Devuelve una funcion que la corta (al saltar). */
export function playIntroCues(cues, elapsed) {
  const ctx = audio();
  if (!ctx) return () => {};
  ctx.resume?.();
  const out = ctx.createGain();
  out.gain.value = channelVolume('music') * 1.4;
  out.connect(ctx.destination);
  const samples = [];
  scheduleIntroCues(ctx, out, cues, elapsed, (name, start) => {
    const timer = setTimeout(() => {
      const sample = new Audio(SAMPLE_URLS[name]);
      sample.volume = Math.min(1, channelVolume('zombies') * 0.8);
      sample.play().catch(() => {});
      samples.push(sample);
    }, (start - ctx.currentTime) * 1000);
    samples.push({ pause: () => clearTimeout(timer) });
  });
  return () => {
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    samples.forEach((s) => s.pause());
    setTimeout(() => out.disconnect(), 400);
  };
}
