import { useEffect, useRef, useState } from 'react';
import { onStateChange, setInputLocked } from '../game/gameSync';

const OUTCOMES = {
  TEAM_WIPED: {
    title: 'Derrota',
    text: 'El equipo cayó. La partida vuelve a empezar desde el Kinder 1.',
    canRetry: true,
  },
  VICTORY: {
    title: '¡Victoria!',
    text: 'Superaron los 5 Kinders y el edificio quedó despejado.',
    canRetry: false,
  },
};

export default function GameOverScreen({ onExitToMenu }) {
  const [outcome, setOutcome] = useState(null);
  // gameSync conserva el ultimo evento (misma referencia) hasta que llega otro: solo se
  // reacciona a un evento nuevo, no al que ya se mostro.
  const seenEventRef = useRef(null);

  useEffect(() => onStateChange((state) => {
    const event = state.lastEvent;
    if (!event || event === seenEventRef.current) return;
    seenEventRef.current = event;
    if (OUTCOMES[event.type]) {
      setOutcome(OUTCOMES[event.type]);
      setInputLocked(true);
    }
  }), []);

  if (!outcome) return null;

  const handleRetry = () => {
    setOutcome(null);
    setInputLocked(false);
  };

  const handleExit = () => {
    setOutcome(null);
    setInputLocked(false);
    onExitToMenu();
  };

  return (
    <div className="game-over-screen">
      <div className="game-over-panel">
        <h2>{outcome.title}</h2>
        <p>{outcome.text}</p>
        <div className="game-over-actions">
          {outcome.canRetry && (
            <button type="button" className="game-over-btn game-over-btn--primary" onClick={handleRetry}>
              Reintentar
            </button>
          )}
          <button
            type="button"
            className={`game-over-btn${outcome.canRetry ? '' : ' game-over-btn--primary'}`}
            onClick={handleExit}
          >
            Menú principal
          </button>
        </div>
      </div>
    </div>
  );
}
