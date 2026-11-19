// Retrato del rol en el HUD que reacciona a lo que le pasa al jugador: respira, se
// sacude al recibir daño, se ensangrienta con poca vida, se apaga al caer, se oscurece
// escondido y brilla verde al escapar.
export default function HudPortrait({ portrait, name, health, downed, hurtKey, hidden, escaped }) {
  const mood = downed ? 'downed' : escaped ? 'escaped' : hidden ? 'hidden' : health <= 30 ? 'critical' : health <= 60 ? 'hurt' : 'ok';
  return (
    <div className={`hud-portrait hud-portrait--${mood}`} title={name}>
      <div key={hurtKey} className={`hud-portrait-frame${hurtKey > 0 ? ' hud-portrait-frame--hit' : ''}`}>
        <img src={portrait} alt={name} draggable="false" />
        <span className="hud-portrait-blood" aria-hidden="true" />
      </div>
    </div>
  );
}
