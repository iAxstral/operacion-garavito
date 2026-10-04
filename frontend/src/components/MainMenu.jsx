import { useState } from 'react';
import SettingsPanel from './SettingsPanel';
import { isTouchDevice } from '../game/gameSync';
import { playSfx } from '../game/sfx';

export default function MainMenu({ onPlay }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const touch = isTouchDevice();

  return (
    <div className="main-menu">
      <div className="main-menu-vignette" />
      <img src="/sprites/seguridad_down.png" alt="" className="main-menu-hero" />

      <div className="main-menu-content">
        <p className="main-menu-kicker">Edificio F — ECI</p>
        <h1 className="main-menu-title">OPERACIÓN GARAVITO</h1>
        <p className="main-menu-tagline">Sobrevive a la horda. Cumple tu misión. No caigas.</p>

        <div className="main-menu-actions">
          <button
            type="button"
            className="main-menu-play-btn"
            onClick={() => {
              playSfx('click');
              onPlay();
            }}
          >
            Jugar
          </button>
          <button
            type="button"
            className="main-menu-secondary-btn"
            onClick={() => {
              playSfx('click');
              setSettingsOpen(true);
            }}
          >
            <span aria-hidden="true">⚙</span> Configuración
          </button>
        </div>

        {touch ? (
          <div className="main-menu-controls">
            <span><strong>Joystick</strong> moverse</span>
            <span><strong>⚔</strong> atacar / disparar</span>
            <span><strong>💥</strong> ataque cargado</span>
            <span><strong>»</strong> dash</span>
            <span><strong>★</strong> habilidad del rol</span>
          </div>
        ) : (
          <div className="main-menu-controls">
            <span><strong>WASD</strong> moverse</span>
            <span><strong>Q / clic</strong> atacar / disparar</span>
            <span><strong>Mouse</strong> apuntar</span>
            <span><strong>1-4</strong> armas</span>
            <span><strong>R</strong> recargar</span>
            <span><strong>C</strong> ataque cargado</span>
            <span><strong>Shift</strong> dash</span>
            <span><strong>F</strong> habilidad del rol</span>
            <span><strong>E</strong> interactuar / inventario</span>
          </div>
        )}
        <p className="main-menu-tip">Cuando un zombi se ponga rojo va a morder: aléjate o golpéalo para cortarlo.</p>
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
