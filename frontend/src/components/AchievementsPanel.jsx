import { useEffect } from 'react';
import { ACHIEVEMENTS, unlockedAchievements } from '../game/achievements';
import Icon from './Icon';

const formatDate = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

/** Lista de logros: los conseguidos en este navegador (con fecha) y los que faltan. */
export default function AchievementsPanel({ onClose }) {
  const unlocked = unlockedAchievements();
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="settings-overlay" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="settings-panel achievements-panel" role="dialog" aria-modal="true" aria-labelledby="achievements-title">
        <header className="settings-header">
          <h2 id="achievements-title"><Icon name="star" /> Logros</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        </header>
        <p className="achievements-count">{count} de {ACHIEVEMENTS.length} conseguidos</p>
        <div className="achievement-list">
          {ACHIEVEMENTS.map((a) => (
            <div key={a.id} className={`achievement${unlocked[a.id] ? '' : ' achievement--locked'}`}>
              <Icon name={unlocked[a.id] ? a.icon : 'lock'} />
              <span>
                <strong>{a.name}</strong>
                <small>{a.description}</small>
              </span>
              {unlocked[a.id] && <time dateTime={unlocked[a.id]}>{formatDate(unlocked[a.id])}</time>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
