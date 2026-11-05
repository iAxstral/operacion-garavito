import { useCallback, useEffect, useRef, useState } from 'react';
import SettingsPanel from './SettingsPanel';
import HowToPlay from './HowToPlay';
import RankingPanel from './RankingPanel';
import ServerStatus from './ServerStatus';
import AchievementsPanel from './AchievementsPanel';
import ItemShop from './ItemShop';
import ProfilePanel from './ProfilePanel';
import TemporadaCreatures from './TemporadaCreatures';
import Icon from './Icon';
import { playSfx } from '../game/sfx';
import { channelVolume, onSettingsChange } from '../game/settings';
import { startMusic, stopMusic } from '../game/music';
import { TEMPORADAS, setTemporadaPreferida } from '../game/temporada';
import useTemporada from './useTemporada';

const VIDEO_SRC = '/video/inicio.mp4';
const POSTER_SRC = '/video/inicio-poster.jpg';
// Navidad tiene su propio video de intro; despues, el menu queda sobre el campus de noche.
const NAVIDAD_VIDEO_SRC = '/video/intro-navidad.mp4';
const NAVIDAD_POSTER_SRC = '/video/intro-navidad-poster.jpg';
const CAMPUS_SRC = '/mapa/seleccion-edificio-halloween.jpg';
// En este segundo del video no esta el texto "Happy Halloween": ahi queda quieto de fondo.
const MENU_FRAME_S = 4.0;
const INTRO_SEEN_KEY = 'garavito.introSeen';
const EMBERS = 14;

function introAlreadySeen() {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // Sin almacenamiento la intro se vuelve a ver: no pasa nada.
  }
}

/**
 * Pantalla de inicio: la primera vez en la sesion se ve el video completo como intro
 * (se puede saltar); despues el menu queda sobre un cuadro del video con un zoom
 * lento, chispas y el titulo del juego.
 */
export default function MainMenu({ onPlay }) {
  const videoRef = useRef(null);
  const temporada = useTemporada();
  const halloween = temporada.id === 'HALLOWEEN';
  // La primera vez en la sesion se ve la intro: cada temporada tiene su video.
  const [phase, setPhase] = useState(() => (introAlreadySeen() ? 'menu' : 'intro'));
  const [soundOn, setSoundOn] = useState(false);
  const [panel, setPanel] = useState(null);

  const showMenu = useCallback(() => {
    markIntroSeen();
    startMusic(0);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = MENU_FRAME_S;
    }
    setPhase('menu');
  }, []);

  const replayIntro = () => {
    playSfx('click');
    stopMusic();
    const video = videoRef.current;
    setPhase('intro');
    if (!video) return; // Navidad: el video se monta con la intro y arranca solo (autoPlay).
    video.currentTime = 0;
    video.play().catch(showMenu);
  };

  // Intro: se reproduce sola (en silencio, como exigen los navegadores); si el
  // navegador no deja, se pasa directo al menu.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      startMusic(0);
      return;
    }
    if (phase === 'intro') {
      video.play().catch(showMenu);
    } else {
      video.pause();
      if (Math.abs(video.currentTime - MENU_FRAME_S) > 0.2) video.currentTime = MENU_FRAME_S;
      // Suena desde el primer toque del jugador (los navegadores no dejan antes).
      startMusic(0);
    }
    // Solo al montar: despues las transiciones las hacen showMenu y replayIntro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El audio del video sigue el volumen de Musica de la configuracion.
  useEffect(() => {
    const apply = () => {
      if (videoRef.current) videoRef.current.volume = Math.min(1, channelVolume('music') * 1.6);
    };
    apply();
    return onSettingsChange(apply);
  }, []);

  useEffect(() => {
    if (phase !== 'intro') return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') showMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const toggleSound = () => {
    const video = videoRef.current;
    if (video) video.muted = soundOn;
    setSoundOn(!soundOn);
  };

  const open = (which) => {
    playSfx('click');
    setPanel(which);
  };

  return (
    <div className={`start-screen start-screen--${phase}`}>
      {!halloween && <img className="start-video start-campus" src={CAMPUS_SRC} alt="" aria-hidden="true" />}
      {(halloween || phase === 'intro') && (
        <video
          ref={videoRef}
          key={temporada.id}
          className={`start-video${halloween ? '' : ' start-video--navidad'}`}
          src={halloween ? VIDEO_SRC : NAVIDAD_VIDEO_SRC}
          poster={halloween ? POSTER_SRC : NAVIDAD_POSTER_SRC}
          muted={!soundOn}
          playsInline
          autoPlay={!halloween}
          preload="auto"
          onEnded={showMenu}
          onError={halloween ? undefined : showMenu}
          onLoadedMetadata={(event) => {
            // Al volver a Halloween desde el menu, el video queda en su cuadro quieto.
            if (halloween && phase === 'menu') event.currentTarget.currentTime = MENU_FRAME_S;
          }}
          aria-hidden="true"
        />
      )}
      <div className="start-shade" />
      <div className="start-fog" aria-hidden="true" />
      <div className="start-flash" aria-hidden="true" />
      {phase === 'menu' && <TemporadaCreatures bats={5} spiders={3} />}
      <div className="start-embers" aria-hidden="true">
        {Array.from({ length: EMBERS }, (_, i) => (
          <span key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--d': `${6 + (i % 5) * 1.3}s` }} />
        ))}
      </div>

      {phase === 'intro' && (
        <div className="start-intro-controls">
          <button type="button" className="start-chip" onClick={toggleSound}>
            <Icon name={soundOn ? 'sound' : 'mute'} /> {soundOn ? 'Sonido' : 'Activar sonido'}
          </button>
          <button type="button" className="start-chip start-chip--skip" onClick={showMenu}>
            Saltar ›
          </button>
        </div>
      )}

      {phase === 'menu' && (
        <main className="start-menu">
          <p className="start-kicker">{temporada.kicker}</p>
          <h1 className="start-title">
            <span>Operación</span>
            <span className="start-title-big">Garavito</span>
          </h1>
          <p className="start-tagline">{temporada.tagline}</p>

          <div className="start-season" role="radiogroup" aria-label="Evento">
            {Object.values(TEMPORADAS).map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                role="radio"
                aria-checked={temporada.id === opcion.id}
                className={`start-season-option start-season-option--${opcion.id.toLowerCase()}${temporada.id === opcion.id ? ' start-season-option--active' : ''}`}
                title={opcion.descripcion}
                onClick={() => {
                  playSfx('click');
                  setTemporadaPreferida(opcion.id);
                }}
              >
                <Icon name={opcion.moneda.icono} />
                <span className="start-season-name">{opcion.nombre}</span>
                <span className="start-season-tag">{opcion.etiqueta}</span>
              </button>
            ))}
          </div>

          <nav className="start-actions" aria-label="Menú principal">
            <button
              type="button"
              className="start-btn start-btn--primary"
              onClick={() => {
                playSfx('click');
                onPlay();
              }}
            >
              <Icon name="play" /> Jugar
            </button>
            <button type="button" className="start-btn start-btn--shop" onClick={() => open('costumes')}>
              <Icon name={temporada.moneda.icono} /> Tienda de objetos
              <span className="start-btn-badge">Nuevo</span>
            </button>
            <button type="button" className="start-btn" onClick={() => open('settings')}>
              <Icon name="gear" /> Configuración
            </button>
            <button type="button" className="start-btn" onClick={() => open('howto')}>
              <Icon name="book" /> Cómo jugar
            </button>
            <button type="button" className="start-btn" onClick={() => open('ranking')}>
              <Icon name="trophy" /> Ranking
            </button>
            <button type="button" className="start-btn" onClick={() => open('achievements')}>
              <Icon name="star" /> Logros
            </button>
            <button type="button" className="start-btn" onClick={() => open('profile')}>
              <Icon name="skull" /> Perfil
            </button>
            <button type="button" className="start-btn" onClick={() => open('estado')}>
              <Icon name="pulse" /> Servidor en vivo
            </button>
          </nav>

          <button type="button" className="start-link" onClick={replayIntro}>
            Ver la intro otra vez
          </button>
        </main>
      )}

      {phase === 'menu' && <footer className="start-footer">ARSW · Sprint 4</footer>}

      {panel === 'settings' && <SettingsPanel onClose={() => setPanel(null)} />}
      {panel === 'howto' && <HowToPlay onClose={() => setPanel(null)} />}
      {panel === 'ranking' && <RankingPanel onClose={() => setPanel(null)} />}
      {panel === 'achievements' && <AchievementsPanel onClose={() => setPanel(null)} />}
      {panel === 'costumes' && <ItemShop onClose={() => setPanel(null)} />}
      {panel === 'profile' && <ProfilePanel onClose={() => setPanel(null)} />}
      {panel === 'estado' && <ServerStatus onClose={() => setPanel(null)} />}
    </div>
  );
}
