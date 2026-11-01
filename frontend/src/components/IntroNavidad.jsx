import { useEffect, useRef } from 'react';
import NavidadCreatures from './NavidadCreatures';
import { playIntroCues } from './introNavidadAudio';
import { BULBS, BULB_COLORS, CUES, EYES, GOLPES, T, ZOMBIES } from './introNavidadTiempos';
import { CandidataEscarcha, CandidatoNochebueno, PlacaDecanatura } from './CandidatosDecanatura';
import './introNavidad.css';

const CAMPUS_SRC = '/mapa/seleccion-edificio-halloween.jpg';
const ROLES = ['seguridad', 'biomedica', 'economia', 'infraestructura'];

function ZombieSilhouette() {
  return (
    <svg viewBox="0 0 60 120" className="xi-zombie-svg" aria-hidden="true">
      {/* Gorro de Papa Noel caido hacia atras. */}
      <path d="M22 18 C26 2 42 0 50 8 L52 14 C46 12 44 16 40 20 Z" fill="#6e0b0b" />
      <circle cx="52" cy="13" r="4" fill="#cfc8ba" />
      <rect x="20" y="16" width="22" height="6" rx="2" fill="#cfc8ba" />
      {/* Cabeza ladeada, cuerpo encorvado y brazos estirados hacia adelante. */}
      <ellipse cx="30" cy="30" rx="10" ry="11" fill="#07090c" />
      <path d="M18 42 C16 60 18 78 22 84 L40 84 C44 70 44 54 40 42 Z" fill="#07090c" />
      <path d="M20 46 L2 54 L3 59 L22 54 Z M36 46 L8 58 L9 63 L38 54 Z" fill="#07090c" />
      <path d="M22 84 L18 116 L25 116 L30 92 L34 116 L41 116 L40 84 Z" fill="#07090c" />
      <circle cx="25" cy="29" r="1.8" className="xi-zombie-eye" />
      <circle cx="31" cy="29" r="1.8" className="xi-zombie-eye" />
    </svg>
  );
}

/**
 * Intro animada de la temporada de Navidad (~20 s): la noche del 24 en la ECI, dos
 * candidatos (ficticios) se pelean por la Decanatura y, mientras tanto, se apagan las
 * luces y llega la horda; los cuatro roles bajo una linterna y el titulo. Se puede
 * saltar; con `soundOn` suena sincronizada.
 */
export default function IntroNavidad({ onEnd, soundOn = false }) {
  const startedAt = useRef(0);
  const stopSound = useRef(null);

  useEffect(() => {
    startedAt.current = performance.now();
    // Con "reducir movimiento" no hay animacion: se va directo al menu.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      onEnd();
      return undefined;
    }
    const timer = setTimeout(onEnd, T.fin * 1000);
    return () => clearTimeout(timer);
  }, [onEnd]);

  // El sonido puede activarse a mitad: se agenda solo lo que falta.
  useEffect(() => {
    if (!soundOn) return undefined;
    const elapsed = (performance.now() - startedAt.current) / 1000;
    stopSound.current = playIntroCues(CUES, elapsed);
    return () => stopSound.current?.();
  }, [soundOn]);

  const at = (seconds) => ({ '--at': `${seconds}s` });

  return (
    <div className="xi-root" aria-label="Intro de Operación Garavito" role="img" style={{ '--fin': `${T.fin}s` }}>
      {/* Escena 2: el campus de noche, que se apaga. */}
      <div className="xi-campus-wrap" style={{ '--campus': `${T.campus}s`, '--apagon': `${T.apagon}s`, '--titulo': `${T.titulo}s` }}>
        <img className="xi-campus" src={CAMPUS_SRC} alt="" />
      </div>

      <div className="xi-snow" style={at(T.campus)}>
        <NavidadCreatures ornaments={0} lights={false} />
      </div>

      <div className="xi-garland" style={{ '--apagon': `${T.apagon}s` }}>
        {Array.from({ length: BULBS }, (_, i) => (
          <span
            key={i}
            className={`xi-bulb${i === 7 ? ' xi-bulb--spark' : ''}`}
            style={{ ...at(T.luces + i * 0.14), '--color': BULB_COLORS[i % BULB_COLORS.length], '--i': i }}
          />
        ))}
      </div>

      {/* Escena 1: la hora. */}
      <div className="xi-dateline">
        <p className="xi-type" style={{ ...at(0.3), '--chars': 33 }}>Escuela Colombiana de Ingeniería</p>
        <p className="xi-type xi-type--time" style={{ ...at(1.25), '--chars': 23 }}>24 de diciembre · 23:58</p>
      </div>

      {/* Escena 2: la pelea por la Decanatura. */}
      <div className="xd-stage" style={{ '--apagon': `${T.apagon}s` }}>
        <div className="xd-sign" style={{ ...at(T.cartel), '--hasta': `${T.apagon}s` }}>
          <span className="xd-sign-small">Elecciones a la</span>
          <span className="xd-sign-big">Decanatura</span>
        </div>

        <div className="xd-noche" style={{ ...at(T.entrada), '--pelea': `${T.pelea}s`, '--gana': `${T.gana}s` }}>
          <div className="xd-pose xd-pose--antes"><CandidatoNochebueno /></div>
          <div className="xd-pose xd-pose--gana"><CandidatoNochebueno brazoArriba /></div>
          <span className="xd-name">Candidato Nochebueno</span>
        </div>
        <div className="xd-escarcha" style={{ ...at(T.entrada), '--pelea': `${T.pelea}s`, '--gana': `${T.gana}s` }}>
          <CandidataEscarcha />
          <span className="xd-name">Candidata Escarcha</span>
        </div>

        <div className="xd-placa" style={{ ...at(T.agarran), '--pelea': `${T.pelea}s`, '--gana': `${T.gana}s` }}>
          <PlacaDecanatura />
        </div>

        {/* La nube de pelea de caricatura, con brazos, piernas y onomatopeyas. */}
        <div className="xd-cloud" style={{ ...at(T.pelea), '--gana': `${T.gana}s` }}>
          <span className="xd-puff" style={{ '--px': '22%', '--py': '40%', '--ps': 1 }} />
          <span className="xd-puff" style={{ '--px': '50%', '--py': '30%', '--ps': 1.25 }} />
          <span className="xd-puff" style={{ '--px': '76%', '--py': '42%', '--ps': 1.05 }} />
          <span className="xd-puff" style={{ '--px': '38%', '--py': '64%', '--ps': 1.1 }} />
          <span className="xd-puff" style={{ '--px': '64%', '--py': '66%', '--ps': 1.15 }} />
          <span className="xd-limb xd-limb--rojo" style={{ '--lx': '8%', '--ly': '46%', '--lr': '-30deg' }} />
          <span className="xd-limb xd-limb--verde" style={{ '--lx': '84%', '--ly': '34%', '--lr': '25deg' }} />
          <span className="xd-limb xd-limb--bota" style={{ '--lx': '30%', '--ly': '84%', '--lr': '70deg' }} />
          <span className="xd-limb xd-limb--rojo" style={{ '--lx': '66%', '--ly': '8%', '--lr': '-80deg' }} />
          {GOLPES.map(([texto, x, y, giro, cuando]) => (
            <span
              key={texto}
              className="xd-pow"
              style={{ ...at(T.pelea + cuando), left: `${x}%`, top: `${y}%`, '--giro': `${giro}deg` }}
            >
              {texto}
            </span>
          ))}
        </div>
      </div>

      <p className="xi-caption xi-caption--pelea" style={{ ...at(T.agarran), '--hasta': `${T.pelea + 1.2}s` }}>
        Dos candidatos. Una sola Decanatura.
      </p>
      <p className="xi-caption xi-caption--pelea" style={{ ...at(T.gana + 0.4), '--hasta': `${T.apagon - 0.5}s` }}>
        Ganó el Candidato Nochebueno…
      </p>
      <p className="xi-caption xi-caption--pelea" style={{ ...at(T.apagon - 0.3), '--hasta': `${T.linterna - 0.2}s` }}>
        …y nadie vigiló las luces.
      </p>

      {/* Escena 3: ojos y la horda. */}
      <div className="xi-eyes" style={{ '--hasta': `${T.titulo - 0.4}s` }}>
        {EYES.map(([x, y, s], i) => (
          <span key={i} className="xi-eye-pair" style={{ ...at(T.ojos + i * 0.22), left: `${x}%`, top: `${y}%`, '--s': s }}>
            <span />
            <span />
          </span>
        ))}
      </div>

      <div className="xi-horde" style={{ '--hasta': `${T.titulo}s` }}>
        {ZOMBIES.map(([delay, dur, scale, dy], i) => (
          <span
            key={i}
            className="xi-zombie"
            style={{ ...at(T.zombis + delay), '--dur': `${dur}s`, '--scale': scale, '--dy': `${dy}vh` }}
          >
            <ZombieSilhouette />
          </span>
        ))}
      </div>

      {/* Escena 4: la linterna encuentra a los cuatro roles. */}
      <div className="xi-team" style={{ ...at(T.linterna), '--hasta': `${T.titulo}s` }}>
        {ROLES.map((role, i) => (
          <img key={role} className="xi-hero" src={`/personajes/${role}.png`} alt="" style={{ '--i': i }} />
        ))}
      </div>
      <div className="xi-flashlight" style={{ ...at(T.linterna), '--hasta': `${T.titulo}s` }} />
      <p className="xi-caption xi-caption--team" style={{ ...at(T.linterna + 1), '--hasta': `${T.titulo - 0.1}s` }}>
        Cuatro roles. Cinco Kinders. Una sola noche.
      </p>

      {/* Escena 5: relampago y titulo. */}
      <div className="xi-flash" style={at(T.titulo)} />
      <div className="xi-title" style={at(T.titulo)}>
        <span className="xi-title-small">Operación</span>
        <span className="xi-title-big">Garavito</span>
        <span className="xi-title-sub">Nochebuena maldita</span>
      </div>

      <div className="xi-fadeout" />
    </div>
  );
}
