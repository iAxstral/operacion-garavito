/**
 * Pantalla de arranque: ambientada con la misma textura de pared del mapa y
 * el sprite real de Seguridad (nada de arte nuevo) para que se sienta parte
 * del mismo juego y no una pantalla de carga generica. El juego (socket,
 * join, Phaser) recien arranca cuando se aprieta "Jugar" — ver App.jsx.
 */
export default function MainMenu({ onPlay }) {
  return (
    <div className="main-menu">
      <div className="main-menu-vignette" />
      <img src="/sprites/seguridad_down.png" alt="" className="main-menu-hero" />

      <div className="main-menu-content">
        <p className="main-menu-kicker">Edificio F — ECI</p>
        <h1 className="main-menu-title">OPERACIÓN GARAVITO</h1>
        <p className="main-menu-tagline">Sobrevive a la horda. Cumple tu misión. No caigas.</p>

        <button type="button" className="main-menu-play-btn" onClick={onPlay}>
          Jugar
        </button>

        <div className="main-menu-controls">
          <span><strong>WASD</strong> moverse</span>
          <span><strong>J</strong> / clic atacar</span>
          <span><strong>Shift</strong> dash</span>
          <span><strong>E</strong> interactuar</span>
        </div>
      </div>
    </div>
  );
}
