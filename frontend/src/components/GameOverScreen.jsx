import { useEffect, useState } from 'react';
import { onStateChange, setInputLocked } from '../game/gameSync';

export default function GameOverScreen({ onExitToMenu }) {
  const [lastEvent, setLastEvent] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => onStateChange((state) => setLastEvent(state.lastEvent)), []);

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
