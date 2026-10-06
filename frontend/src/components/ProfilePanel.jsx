import { useEffect, useState } from 'react';
import { ACHIEVEMENTS, unlockedAchievements } from '../game/achievements';
import { getBag } from '../game/costumes';
import { favoriteRole, getProfileStats } from '../game/playerStats';
import { MAX_NICKNAME, cleanNickname, getNickname, setNickname } from '../game/profile';
import { roleInfo } from '../game/roleCatalog';
import { buildingLabel } from '../game/mapLayout';
import Icon from './Icon';

const formatHours = (seconds) => {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};
const formatClock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const formatDate = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });

/** Perfil del jugador en este navegador: apodo, rol favorito, totales e historial. */
export default function ProfilePanel({ onClose }) {
  const [stats] = useState(getProfileStats);
  const [name, setName] = useState(getNickname);
  const unlocked = unlockedAchievements();
  const achievements = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  const favorite = favoriteRole(stats);
  const role = favorite ? roleInfo(favorite) : null;
  const winRate = stats.runs ? Math.round((stats.victories / stats.runs) * 100) : 0;

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tiles = [
    ['Corridas', stats.runs],
    ['Victorias', `${stats.victories} (${winRate} %)`],
    ['Mejor Kinder', stats.bestKinder || '—'],
    ['Zombis', stats.kills],
    ['Misiones', stats.missions],
    ['Revividas', stats.revives],
    ['Garavitos ganados', stats.garavitosEarned],
    ['Caídas', stats.downs],
    ['Dulces', getBag().candies],
    ['Logros', `${achievements}/${ACHIEVEMENTS.length}`],
    ['Tiempo jugado', formatHours(stats.secondsPlayed)],
  ];

  return (
    <div className="settings-overlay" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="settings-panel profile-panel" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <header className="settings-header">
          <h2 id="profile-title"><Icon name="skull" /> Perfil</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        </header>

        <div className="profile-head">
          {role ? <img src={role.portrait} alt={role.name} className="profile-portrait" /> : <div className="profile-portrait profile-portrait--empty">?</div>}
          <div>
            <label className="profile-name">
              <span>Apodo</span>
              <input
                value={name}
                maxLength={MAX_NICKNAME}
                placeholder="Sin apodo"
                onChange={(event) => setName(cleanNickname(event.target.value))}
                onBlur={() => setNickname(name)}
              />
            </label>
            <p className="profile-favorite">{role ? `Rol favorito: ${role.name}` : 'Juega una corrida para empezar tu perfil.'}</p>
          </div>
        </div>

        <div className="profile-tiles">
          {tiles.map(([label, value]) => (
            <div key={label} className="profile-tile">
              <strong>{value}</strong>
              <small>{label}</small>
            </div>
          ))}
        </div>

        {Object.keys(stats.bestByBuilding).length > 0 && (
          <p className="profile-buildings">
            Mejor Kinder por edificio: {Object.entries(stats.bestByBuilding).map(([b, k]) => `${b} ${k}`).join(' · ')}
          </p>
        )}

        {stats.history.length > 0 && (
          <>
            <h3 className="profile-subtitle">Últimas corridas</h3>
            <ul className="profile-history">
              {stats.history.map((run) => (
                <li key={run.at} className={run.victory ? 'profile-history--win' : ''}>
                  <span>{formatDate(run.at)}</span>
                  <span>{buildingLabel(run.building)}</span>
                  <span>{roleInfo(run.role).name}</span>
                  <span>{run.victory ? '¡Escaparon!' : `Kinder ${run.kinder}`}</span>
                  <span>{run.kills} zombis</span>
                  <span>{formatClock(run.seconds)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
