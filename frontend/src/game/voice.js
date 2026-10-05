import { channelVolume } from './settings';
import { playSfx } from './sfx';

// Avisos hablados del equipo ("¡Zombis aquí!"). Usa la voz del sistema (Web Speech
// API) en español, con un tono y una velocidad distintos por rol para que se sepa
// quién habla sin mirar. Antes suena un chasquido de radio. Si el navegador no tiene
// voces, queda solo el chasquido y el aviso escrito.

export const PING_KINDS = {
  ZOMBIES: {
    label: '¡Zombis aquí!',
    icon: 'zombie',
    key: 'Z',
    phrases: ['¡Zombis aquí!', '¡Cuidado, vienen zombis!', '¡Hay una horda por acá!'],
  },
  HELP: {
    label: '¡Necesito ayuda!',
    icon: 'hand',
    key: 'X',
    phrases: ['¡Necesito ayuda!', '¡Ayúdenme, rápido!', '¡Me están rodeando!'],
  },
  REVIVE: {
    label: '¡Revívanme!',
    icon: 'cross',
    key: 'V',
    phrases: ['¡Revívanme, por favor!', '¡Estoy caído!', '¡Biomédica, te necesito!'],
  },
  GO: {
    label: '¡Vamos por aquí!',
    icon: 'arrow',
    key: 'G',
    phrases: ['¡Vamos por aquí!', '¡Síganme!', '¡Por acá, rápido!'],
  },
  AMMO: {
    label: '¡Necesito munición!',
    icon: 'gun',
    key: 'B',
    phrases: ['¡Necesito munición!', '¡Me quedé sin balas!', '¿Alguien tiene balas?'],
  },
};

// Tono (pitch 0-2) y velocidad por rol, y si prefiere una voz femenina o masculina.
const ROLE_VOICES = {
  SEGURIDAD: { pitch: 0.75, rate: 1.0, prefer: 'male' },
  SALUD: { pitch: 1.35, rate: 1.05, prefer: 'female' },
  ECONOMIA: { pitch: 1.1, rate: 1.22, prefer: 'female' },
  INFRAESTRUCTURA: { pitch: 0.5, rate: 0.9, prefer: 'male' },
};

const FEMALE_HINTS = /(female|mujer|helena|laura|sabina|monica|mónica|paulina|elvira|dalia|lucia|lucía|ximena|google español)/i;
const MALE_HINTS = /(male|hombre|pablo|jorge|raul|raúl|alvaro|álvaro|diego|juan|enrique|carlos)/i;

let cachedVoices = [];

function spanishVoices() {
  const synth = window.speechSynthesis;
  if (!synth) return [];
  const all = synth.getVoices();
  if (all.length) cachedVoices = all.filter((voice) => voice.lang?.toLowerCase().startsWith('es'));
  return cachedVoices;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  // Chrome carga las voces de forma asincrona.
  window.speechSynthesis.addEventListener?.('voiceschanged', spanishVoices);
  spanishVoices();
}

function voiceFor(prefer) {
  const voices = spanishVoices();
  if (!voices.length) return null;
  const hint = prefer === 'female' ? FEMALE_HINTS : MALE_HINTS;
  return voices.find((voice) => hint.test(voice.name)) ?? voices[prefer === 'female' ? voices.length - 1 : 0];
}

export function canSpeak() {
  return typeof window !== 'undefined' && Boolean(window.speechSynthesis) && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Frase al azar del aviso (la misma para todos no hace falta: cada cliente elige). */
export function phraseFor(kind) {
  const phrases = PING_KINDS[kind]?.phrases ?? ['¡Atención!'];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

/** Dice el aviso con la voz del rol. Corta lo que se estuviera diciendo para no amontonar. */
export function speakPing(kind, role) {
  const volume = channelVolume('voices');
  playSfx('radio', Math.min(1, volume + 0.2));
  if (!canSpeak() || volume <= 0.01) return;
  const style = ROLE_VOICES[role] ?? ROLE_VOICES.SEGURIDAD;
  const utterance = new SpeechSynthesisUtterance(phraseFor(kind));
  utterance.lang = 'es-ES';
  const voice = voiceFor(style.prefer);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.pitch = style.pitch;
  utterance.rate = style.rate;
  utterance.volume = Math.min(1, volume);
  try {
    window.speechSynthesis.cancel();
    // Pequeña pausa para que el chasquido de radio suene antes que la voz.
    setTimeout(() => window.speechSynthesis.speak(utterance), 140);
  } catch {
    // Algunos navegadores bloquean la voz sin interaccion previa: queda el aviso escrito.
  }
}
