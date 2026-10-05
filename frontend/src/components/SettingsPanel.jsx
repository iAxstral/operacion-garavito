import { useEffect, useRef, useState } from 'react';
import {
  VOLUME_CHANNELS,
  canVibrate,
  channelVolume,
  getSettings,
  onSettingsChange,
  resetSettings,
  setChannelVolume,
  updateSettings,
  vibrate,
} from '../game/settings';
import { playSfx } from '../game/sfx';
import { resetTutorial } from '../game/tutorial';
import { isMusicPlaying, startMusic, stopMusic } from '../game/music';

// Muestra que se escucha al soltar cada barra, con el volumen recien elegido.
const PREVIEW_FILES = { ambient: '/sounds/rain.wav', zombies: '/sounds/zombie_groan.wav' };
const PREVIEW_SFX = { master: 'click', combat: 'hit', ui: 'click' };
const PREVIEW_MS = 1400;

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="settings-toggle">
      <span className="settings-toggle-text">
        <span className="settings-row-label">{label}</span>
        {hint && <span className="settings-row-hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
          playSfx('toggle');
        }}
      />
      <span className="settings-switch" aria-hidden="true" />
    </label>
  );
}

export default function SettingsPanel({ onClose, inGame = false }) {
  const [settings, setSettingsState] = useState(getSettings);
  const previewRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => onSettingsChange(setSettingsState), []);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      previewRef.current?.pause();
    };
  }, [onClose]);

  const preview = (channel) => {
    previewRef.current?.pause();
    if (channel === 'music') {
      // Si no estaba sonando, se escucha un momento para probar el volumen.
      if (!isMusicPlaying()) {
        startMusic(0);
        setTimeout(stopMusic, 3500);
      }
      return;
    }
    const file = PREVIEW_FILES[channel];
    if (!file) {
      playSfx(PREVIEW_SFX[channel] ?? 'click');
      return;
    }
    const volume = channelVolume(channel);
    if (volume <= 0) return;
    const sample = new Audio(file);
    sample.volume = volume;
    sample.play().catch(() => {});
    previewRef.current = sample;
    setTimeout(() => {
      if (previewRef.current === sample) sample.pause();
    }, PREVIEW_MS);
  };

  const muted = settings.muted;

  return (
    <div className="settings-overlay" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
      >
        <header className="settings-header">
          <h2 id="settings-title">Configuración</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Cerrar configuración">
            ✕
          </button>
        </header>

        {inGame && (
          <p className="settings-note">La partida sigue corriendo mientras ajustas: tu personaje se queda quieto.</p>
        )}

        <section className="settings-section">
          <div className="settings-section-head">
            <h3>Sonido</h3>
            <button
              type="button"
              className={`settings-mute${muted ? ' settings-mute--on' : ''}`}
              aria-pressed={muted}
              onClick={() => {
                updateSettings({ muted: !muted });
                if (muted) playSfx('toggle');
              }}
            >
              {muted ? '🔇 Silenciado' : '🔈 Silenciar todo'}
            </button>
          </div>

          {VOLUME_CHANNELS.map((channel) => {
            const value = Math.round(settings.volumes[channel.id] * 100);
            const isMaster = channel.id === 'master';
            return (
              <div
                key={channel.id}
                className={`settings-slider${isMaster ? ' settings-slider--master' : ''}${muted ? ' settings-slider--muted' : ''}`}
              >
                <div className="settings-slider-head">
                  <label htmlFor={`vol-${channel.id}`} className="settings-row-label">
                    <span aria-hidden="true">{channel.icon}</span> {channel.label}
                  </label>
                  <output htmlFor={`vol-${channel.id}`} className="settings-value">{value}%</output>
                </div>
                <input
                  id={`vol-${channel.id}`}
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={value}
                  style={{ '--fill': `${value}%` }}
                  aria-describedby={`vol-${channel.id}-hint`}
                  onChange={(event) => setChannelVolume(channel.id, Number(event.target.value) / 100)}
                  onPointerUp={() => preview(channel.id)}
                  onKeyUp={(event) => event.key.startsWith('Arrow') && preview(channel.id)}
                />
                <span id={`vol-${channel.id}-hint`} className="settings-row-hint">{channel.hint}</span>
              </div>
            );
          })}
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h3>Efectos</h3>
          </div>
          <Toggle
            label="Sacudida de cámara"
            hint="Al recibir mordidas y con el ataque cargado"
            checked={settings.screenShake}
            onChange={(screenShake) => updateSettings({ screenShake })}
          />
          {canVibrate() && (
            <Toggle
              label="Vibración"
              hint="El celular vibra cuando un zombi te muerde"
              checked={settings.vibration}
              onChange={(vibration) => {
                updateSettings({ vibration });
                if (vibration) vibrate(60);
              }}
            />
          )}
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h3>Ayudas</h3>
          </div>
          <Toggle
            label="Mostrar ayudas de primera vez"
            hint="Consejos cortos la primera vez que usas cada mecánica"
            checked={settings.tips}
            onChange={(tips) => updateSettings({ tips })}
          />
          <button
            type="button"
            className="settings-mute"
            onClick={() => {
              resetTutorial();
              updateSettings({ tips: true });
              playSfx('click');
            }}
          >
            ↺ Volver a ver todas las ayudas
          </button>
        </section>

        <footer className="settings-footer">
          <button
            type="button"
            className="screen-back-btn"
            onClick={() => {
              resetSettings();
              playSfx('click');
            }}
          >
            Restablecer
          </button>
          <button type="button" className="main-menu-play-btn settings-done" onClick={onClose}>
            Listo
          </button>
        </footer>
      </div>
    </div>
  );
}
