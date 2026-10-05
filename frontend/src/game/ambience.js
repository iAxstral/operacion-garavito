import { audio } from './sfx';
import { channelVolume, onSettingsChange } from './settings';

// Ambiente de las pantallas de afuera (inicio, edificios, sala): viento que sube y baja,
// y cada tanto una puerta que cruje o un gemido lejano. Todo sintetizado con Web Audio
// (canal "Ambiente" de la configuracion). Suena desde el primer toque del jugador, que
// es cuando el navegador deja arrancar el audio.

const BASE_GAIN = 0.55;
const WIND_SECONDS = 4;

let master = null;
let windNodes = null;
let playing = false;
let eventTimer = null;
let unsubscribeSettings = null;

function applyVolume() {
  const ctx = audio();
  if (!ctx || !master) return;
  const target = playing ? BASE_GAIN * channelVolume('ambient') : 0;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(target, ctx.currentTime, 0.6);
}

// Ruido rosado aproximado (mas grave que el blanco): suena a viento y no a estatica.
function windBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * WIND_SECONDS, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    last = 0.985 * last + 0.15 * (Math.random() * 2 - 1);
    data[i] = last;
  }
  // Bordes suaves para que el lazo no haga click.
  const fade = Math.floor(ctx.sampleRate * 0.05);
  for (let i = 0; i < fade; i += 1) {
    data[i] *= i / fade;
    data[data.length - 1 - i] *= i / fade;
  }
  return buffer;
}

function startWind(ctx) {
  const source = ctx.createBufferSource();
  source.buffer = windBuffer(ctx);
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 420;
  filter.Q.value = 1.4;

  // Rafagas: el filtro y el volumen suben y bajan despacio, con dos ritmos que no coinciden.
  const gusts = ctx.createGain();
  gusts.gain.value = 0.55;
  const lfoA = ctx.createOscillator();
  const lfoAGain = ctx.createGain();
  lfoA.frequency.value = 0.09;
  lfoAGain.gain.value = 260;
  lfoA.connect(lfoAGain).connect(filter.frequency);
  const lfoB = ctx.createOscillator();
  const lfoBGain = ctx.createGain();
  lfoB.frequency.value = 0.053;
  lfoBGain.gain.value = 0.35;
  lfoB.connect(lfoBGain).connect(gusts.gain);

  source.connect(filter).connect(gusts).connect(master);
  [source, lfoA, lfoB].forEach((node) => node.start());
  return [source, lfoA, lfoB];
}

// Puerta vieja: chirrido de friccion (una sierra que tartamudea) por un filtro estrecho.
function creak(ctx) {
  const now = ctx.currentTime;
  const length = 0.9 + Math.random() * 0.9;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  const base = 60 + Math.random() * 40;
  osc.frequency.setValueAtTime(base, now);
  for (let t = 0; t < length; t += 0.06) {
    osc.frequency.setValueAtTime(base * (0.8 + Math.random() * 0.7) + t * 30, now + t);
  }
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(700 + Math.random() * 500, now);
  filter.frequency.linearRampToValueAtTime(1300 + Math.random() * 600, now + length);
  filter.Q.value = 9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.5, now + 0.08);
  gain.gain.setValueAtTime(0.5, now + length - 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) pan.pan.value = Math.random() * 1.6 - 0.8;
  osc.connect(filter).connect(gain);
  (pan ? gain.connect(pan) : gain).connect(master);
  osc.start(now);
  osc.stop(now + length + 0.05);
}

// Gemido lejano: voz grave con vibrato que cae, apagada como si viniera de otro piso.
function moan(ctx) {
  const now = ctx.currentTime;
  const length = 1.8 + Math.random() * 1.4;
  const start = 150 + Math.random() * 60;
  const voices = [1, 1.012].map((detune) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(start * detune, now);
    osc.frequency.linearRampToValueAtTime(start * 1.15 * detune, now + length * 0.35);
    osc.frequency.exponentialRampToValueAtTime(start * 0.62 * detune, now + length);
    return osc;
  });
  const vibrato = ctx.createOscillator();
  const vibratoGain = ctx.createGain();
  vibrato.frequency.value = 5.5;
  vibratoGain.gain.value = 4;
  vibrato.connect(vibratoGain);
  voices.forEach((osc) => vibratoGain.connect(osc.frequency));

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 520;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.32, now + length * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) pan.pan.value = Math.random() * 1.4 - 0.7;

  voices.forEach((osc) => osc.connect(filter));
  filter.connect(gain);
  (pan ? gain.connect(pan) : gain).connect(master);
  [...voices, vibrato].forEach((node) => {
    node.start(now);
    node.stop(now + length + 0.05);
  });
}

function scheduleEvent() {
  eventTimer = setTimeout(() => {
    const ctx = audio();
    if (playing && ctx && ctx.state === 'running') {
      if (Math.random() < 0.45) creak(ctx);
      else moan(ctx);
    }
    if (playing) scheduleEvent();
  }, 6000 + Math.random() * 9000);
}

export function startAmbience() {
  const ctx = audio();
  if (!ctx) return;
  if (!master) {
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }
  if (playing) return;
  playing = true;
  windNodes = startWind(ctx);
  applyVolume();
  unsubscribeSettings = onSettingsChange(applyVolume);
  scheduleEvent();
}

export function stopAmbience() {
  if (!playing) return;
  playing = false;
  clearTimeout(eventTimer);
  unsubscribeSettings?.();
  unsubscribeSettings = null;
  applyVolume();
  const nodes = windNodes;
  windNodes = null;
  const ctx = audio();
  // Se deja que el volumen baje antes de cortar el viento.
  setTimeout(() => nodes?.forEach((node) => {
    try {
      node.stop();
    } catch {
      // ya estaba detenido
    }
  }), ctx ? 2500 : 0);
}
