import { useEffect, useState } from 'react';

function requestFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  return Promise.resolve();
}

function exitFullscreen() {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  return Promise.resolve();
}

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export default function FullscreenButton() {
  const [active, setActive] = useState(isFullscreen);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    setSupported(!!(el.requestFullscreen || el.webkitRequestFullscreen));

    const onChange = () => setActive(isFullscreen());
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (isFullscreen()) exitFullscreen().catch(() => {});
    else requestFullscreen().catch(() => {});
  };

  return (
    <button
      type="button"
      className="fullscreen-btn"
      onClick={toggle}
      aria-label={active ? 'Salir de pantalla completa' : 'Pantalla completa'}
      title={active ? 'Salir de pantalla completa' : 'Pantalla completa'}
    >
      {active ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        </svg>
      )}
    </button>
  );
}
