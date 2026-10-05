import { useEffect, useRef, useState } from 'react';
import SettingsPanel from './SettingsPanel';
import HowToPlay from './HowToPlay';
import RankingPanel from './RankingPanel';
import { playSfx } from '../game/sfx';
import { channelVolume, onSettingsChange } from '../game/settings';
import { startMusic, stopMusic } from '../game/music';

const VIDEO_SRC = '/video/inicio.mp4';
const POSTER_SRC = '/video/inicio-poster.jpg';
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
  const [phase, setPhase] = useState(() => (introAlreadySeen() ? 'menu' : 'intro'));
  const [soundOn, setSoundOn] = useState(false);
  const [panel, setPanel] = useState(null);

  const showMenu = () => {
    markIntroSeen();
    startMusic(0);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = MENU_FRAME_S;
    }
    setPhase('menu');
  };

  const replayIntro = () => {
    playSfx('click');
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    stopMusic();
    setPhase('intro');
    video.play().catch(showMenu);
  };

  // Intro: se reproduce sola (en silencio, como exigen los navegadores); si el
  // navegador no deja, se pasa directo al menu.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
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
    if (!video) return;
    video.muted = soundOn;
    setSoundOn(!soundOn);
  };

  const open = (which) => {
    playSfx('click');
    setPanel(which);
  };

  return (
    <div className={`start-screen start-screen--${phase}`}>
      <video
        ref={videoRef}
        className="start-video"
        src={VIDEO_SRC}
        poster={POSTER_SRC}
        muted={!soundOn}
        playsInline
        preload="auto"
        onEnded={showMenu}
        aria-hidden="true"
      />
      <div className="start-shade" />
      <div className="start-embers" aria-hidden="true">
        {Array.from({ length: EMBERS }, (_, i) => (
          <span key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--d': `${6 + (i % 5) * 1.3}s` }} />
        ))}
      </div>

      {phase === 'intro' && (
        <div className="start-intro-controls">
          <button type="button" className="start-chip" onClick={toggleSound}>
            {soundOn ? '🔊 Sonido' : '🔇 Activar sonido'}
          </button>
          <button type="button" className="start-chip start-chip--skip" onClick={showMenu}>
            Saltar ›
          </button>
        </div>
      )}

      {phase === 'menu' && (
        <main className="start-menu">
          <p className="start-kicker">ECI · Edificios F y C</p>
          <h1 className="start-title">
            <span>Operación</span>
            <span className="start-title-big">Garavito</span>
          </h1>
          <p className="start-tagline">
            Cuatro roles, cinco Kinders y una horda que no para. Cumplan sus misiones, cuídense y no caigan.
          </p>

          <nav className="start-actions" aria-label="Menú principal">
            <button
              type="button"
              className="start-btn start-btn--primary"
              onClick={() => {
                playSfx('click');
                onPlay();
              }}
            >
              <span aria-hidden="true">▶</span> Jugar
            </button>
            <button type="button" className="start-btn" onClick={() => open('settings')}>
              <span aria-hidden="true">⚙</span> Configuración
            </button>
            <button type="button" className="start-btn" onClick={() => open('howto')}>
              <span aria-hidden="true">📖</span> Cómo jugar
            </button>
            <button type="button" className="start-btn" onClick={() => open('ranking')}>
              <span aria-hidden="true">🏆</span> Ranking
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
    </div>
  );
}
