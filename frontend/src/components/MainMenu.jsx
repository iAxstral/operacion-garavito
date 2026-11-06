import { useCallback, useEffect, useRef, useState } from 'react';
import SettingsPanel from './SettingsPanel';
import HowToPlay from './HowToPlay';
import RankingPanel from './RankingPanel';
import ServerStatus from './ServerStatus';
import AchievementsPanel from './AchievementsPanel';
import ItemShop from './ItemShop';
import ProfilePanel from './ProfilePanel';
import NavidadCreatures from './NavidadCreatures';
import Icon from './Icon';
import { playSfx } from '../game/sfx';
import { channelVolume, onSettingsChange } from '../game/settings';
import { startMusic, stopMusic } from '../game/music';
import { NAVIDAD } from '../game/navidad';

// La intro es un video; despues, el menu queda sobre el campus de noche.
const VIDEO_SRC = '/video/intro-navidad.mp4';
const POSTER_SRC = '/video/intro-navidad-poster.jpg';
const CAMPUS_SRC = '/mapa/campus-noche.jpg';
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
 * (se puede saltar); despues el menu queda sobre el campus de noche, con chispas y el
 * titulo del juego.
 */
export default function MainMenu({ onPlay }) {
  const videoRef = useRef(null);
  // La primera vez en la sesion se ve la intro.
  const [phase, setPhase] = useState(() => (introAlreadySeen() ? 'menu' : 'intro'));
  const [soundOn, setSoundOn] = useState(false);
  const [panel, setPanel] = useState(null);

  const showMenu = useCallback(() => {
    markIntroSeen();
    startMusic(0);
    setPhase('menu');
  }, []);

  const replayIntro = () => {
    playSfx('click');
    stopMusic();
    // El video se monta con la intro y arranca solo (autoPlay).
    setPhase('intro');
  };

  // Intro: se reproduce sola (en silencio, como exigen los navegadores); si el
  // navegador no deja, se pasa directo al menu.
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.play().catch(showMenu);
    } else {
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
      <img className="start-video start-campus" src={CAMPUS_SRC} alt="" aria-hidden="true" />
      {phase === 'intro' && (
        <video
          ref={videoRef}
          className="start-video start-video--navidad"
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          muted={!soundOn}
          playsInline
          autoPlay
          preload="auto"
          onEnded={showMenu}
          onError={showMenu}
          aria-hidden="true"
        />
      )}
      <div className="start-shade" />
      <div className="start-fog" aria-hidden="true" />
      <div className="start-flash" aria-hidden="true" />
      {phase === 'menu' && <NavidadCreatures ornaments={3} snow={30} />}
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
          <p className="start-kicker">{NAVIDAD.kicker}</p>
          <h1 className="start-title">
            <span>Operación</span>
            <span className="start-title-big">Garavito</span>
          </h1>
          <p className="start-tagline">{NAVIDAD.tagline}</p>

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
              <Icon name={NAVIDAD.moneda.icono} /> Tienda de objetos
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
