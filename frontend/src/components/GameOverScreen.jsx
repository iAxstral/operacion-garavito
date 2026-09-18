import { useEffect, useState } from 'react';
import { onStateChange, setInputLocked } from '../game/gameSync';

/**
 * Pantalla de derrota: se dispara con el evento TEAM_WIPED del backend (cae
 * el equipo completo — con un solo rol jugable este sprint, eso es "el
 * jugador murio"). Para entonces el backend YA reinicio la partida (oleada
 * 1, vida llena, ver GameSession.resetGame/tick) — este popup solo bloquea
 * el control hasta que el jugador decide seguir o volver al menu, para que
 * la muerte se sienta como un evento y no como un parpadeo de vida.
 */
export default function GameOverScreen({ onExitToMenu }) {
  const [lastEvent, setLastEvent] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => onStateChange((state) => setLastEvent(state.lastEvent)), []);

  // Depender de la REFERENCIA de lastEvent (no de su tipo) es lo que evita
  // reabrir este popup en cada broadcast de zombis mientras el evento de
  // wipe sigue siendo el "ultimo" conservado — mismo bug que ya se dio en
  // SecurityMission.jsx con MISSION_STARTED.
  useEffect(() => {
    if (lastEvent?.type !== 'TEAM_WIPED') return;
    setVisible(true);
    setInputLocked(true);
  }, [lastEvent]);

  if (!visible) return null;

  const handleRetry = () => {
    setVisible(false);
    setInputLocked(false);
  };

  const handleExit = () => {
    setVisible(false);
    onExitToMenu();
  };

  return (
    <div className="game-over-screen">
      <div className="game-over-panel">
        <h2>Derrota</h2>
        <p>El equipo cayó. La partida vuelve a empezar desde la oleada 1.</p>
        <div className="game-over-actions">
          <button type="button" className="game-over-btn game-over-btn--primary" onClick={handleRetry}>
            Reintentar
          </button>
          <button type="button" className="game-over-btn" onClick={handleExit}>
            Menú principal
          </button>
        </div>
      </div>
    </div>
  );
}
