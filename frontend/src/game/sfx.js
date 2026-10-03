import { channelVolume } from './settings';

// Efectos cortos sintetizados con Web Audio: golpes, impactos, dano y clicks. No hay
// archivos para estos sonidos y generarlos asi pesa cero y suena igual en todos lados.
// El AudioContext se crea en el primer sonido (siempre tras un toque o tecla del
// jugador), que es cuando los navegadores moviles dejan reproducir audio.

let context = null;
let noiseBuffer = null;

function audio() {
  if (!context) {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    noiseBuffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

function envelope(ctx, gainValue, attack, decay) {
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
  gain.connect(ctx.destination);
  return gain;
}

function tone(ctx, { type = 'sine', from, to, gain, attack = 0.005, decay = 0.15 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  const now = ctx.currentTime;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(to ?? from, now + attack + decay);
  osc.connect(envelope(ctx, gain, attack, decay));
  osc.start(now);
  osc.stop(now + attack + decay + 0.05);
}

function noise(ctx, { gain, attack = 0.005, decay = 0.12, filter = 'bandpass', freq = 1200, freqTo, q = 1 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.Q.value = q;
  const now = ctx.currentTime;
  biquad.frequency.setValueAtTime(freq, now);
  if (freqTo) biquad.frequency.exponentialRampToValueAtTime(freqTo, now + attack + decay);
  src.connect(biquad);
  biquad.connect(envelope(ctx, gain, attack, decay));
  src.start(now);
  src.stop(now + attack + decay + 0.05);
}

const SOUNDS = {
  // Interfaz
  click: { channel: 'ui', play: (ctx, v) => tone(ctx, { type: 'triangle', from: 880, to: 660, gain: 0.25 * v, decay: 0.06 }) },
  toggle: {
    channel: 'ui',
    play: (ctx, v) => {
      tone(ctx, { type: 'triangle', from: 600, to: 900, gain: 0.2 * v, decay: 0.08 });
    },
  },
  // Combate del jugador
  swing: { channel: 'combat', play: (ctx, v) => noise(ctx, { gain: 0.35 * v, decay: 0.14, freq: 600, freqTo: 2400, q: 0.8 }) },
  hit: {
    channel: 'combat',
    play: (ctx, v) => {
      tone(ctx, { type: 'square', from: 180, to: 60, gain: 0.25 * v, decay: 0.09 });
      noise(ctx, { gain: 0.3 * v, decay: 0.07, filter: 'lowpass', freq: 1800 });
    },
  },
  charged: {
    channel: 'combat',
    play: (ctx, v) => {
      tone(ctx, { type: 'sawtooth', from: 90, to: 40, gain: 0.3 * v, attack: 0.01, decay: 0.4 });
      noise(ctx, { gain: 0.35 * v, attack: 0.01, decay: 0.35, filter: 'lowpass', freq: 900, freqTo: 120 });
    },
  },
  hurt: {
    channel: 'combat',
    play: (ctx, v) => {
      tone(ctx, { type: 'sawtooth', from: 320, to: 110, gain: 0.22 * v, decay: 0.22 });
      noise(ctx, { gain: 0.25 * v, decay: 0.12, filter: 'lowpass', freq: 700 });
    },
  },
  // Zombi preparando la mordida justo a tu lado: siseo corto que sube.
  warn: {
    channel: 'zombies',
    play: (ctx, v) => noise(ctx, { gain: 0.22 * v, attack: 0.12, decay: 0.1, filter: 'highpass', freq: 900, freqTo: 3200, q: 0.7 }),
  },
  stagger: { channel: 'combat', play: (ctx, v) => tone(ctx, { type: 'triangle', from: 1400, to: 1900, gain: 0.12 * v, decay: 0.12 }) },
};

/** Reproduce un efecto. `scale` (0..1) atenua por distancia u otra razon. */
export function playSfx(name, scale = 1) {
  const sound = SOUNDS[name];
  if (!sound) return;
  const volume = channelVolume(sound.channel) * scale;
  if (volume <= 0.001) return;
  const ctx = audio();
  if (!ctx) return;
  sound.play(ctx, volume);
}
