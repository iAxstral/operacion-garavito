import { useEffect, useState } from 'react';
import { API_BASE } from '../services/socketService';
import { roleInfo } from '../game/roleCatalog';
import { playSfx } from '../game/sfx';
import Icon from './Icon';
import { MODES } from '../game/gameModes';

import { BUILDINGS } from '../game/mapLayout';
const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const formatDate = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });

/** Mejores partidas guardadas por edificio (GET /api/ranking). */
export default function RankingPanel({ onClose, initialBuilding = 'F' }) {
  const [building, setBuilding] = useState(BUILDINGS.includes(initialBuilding) ? initialBuilding : 'F');
  const [mode, setMode] = useState('NORMAL');
  const [result, setResult] = useState({ status: 'loading', data: null, building: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/ranking?building=${building}&mode=${mode}`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((data) => !cancelled && setResult({ status: 'ok', data, building, mode }))
      .catch(() => !cancelled && setResult({ status: 'error', data: null, building, mode }));
    return () => {
      cancelled = true;
    };
  }, [building, mode]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const loading = result.building !== building || result.mode !== mode;
  const data = loading ? null : result.data;

  return (
    <div className="settings-overlay" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="settings-panel ranking-panel" role="dialog" aria-modal="true" aria-labelledby="ranking-title">
        <header className="settings-header">
          <h2 id="ranking-title"><Icon name="trophy" /> Ranking</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>

        <div className="howto-tabs" role="tablist">
          {BUILDINGS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={building === id}
              className={`howto-tab${building === id ? ' howto-tab--active' : ''}`}
              onClick={() => {
                setBuilding(id);
                playSfx('click');
              }}
            >
              {id === 'BIBLIOTECA' ? 'Biblioteca' : id}
            </button>
          ))}
        </div>

        <div className="howto-tabs ranking-mode-tabs" role="tablist" aria-label="Modo">
          {Object.entries(MODES).map(([id, info]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={`howto-tab${mode === id ? ' howto-tab--active' : ''}`}
              onClick={() => {
                setMode(id);
                playSfx('click');
              }}
            >
              {id === 'DAILY' ? 'Hoy' : info.label}
            </button>
          ))}
        </div>

        {loading && <p className="howto-muted">Cargando…</p>}
        {!loading && result.status === 'error' && (
          <p className="lobby-error">No se pudo cargar el ranking. ¿Está prendido el servidor?</p>
        )}
        {data && (
          <>
            <p className="howto-muted">
              {data.matches} partidas jugadas · {data.victories} victorias
            </p>
            {data.best.length === 0 ? (
              <p className="team-panel-empty">Todavía no hay partidas en este edificio. ¡Sean los primeros!</p>
            ) : (
              <div className="results-table-wrap">
                <table className="results-table ranking-table">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Resultado</th>
                      <th scope="col">Tiempo</th>
                      <th scope="col"><Icon name="people" title="Jugadores" /></th>
                      <th scope="col"><Icon name="zombie" title="Zombis eliminados" /></th>
                      <th scope="col">MVP</th>
                      <th scope="col">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.best.map((match, index) => (
                      <tr key={match.id}>
                        <td>{index + 1}</td>
                        <td>{match.victory ? <><Icon name="trophy" /> Victoria</> : `Kinder ${match.kinderReached}`}</td>
                        <td>{formatTime(match.durationSeconds)}</td>
                        <td>{match.players}</td>
                        <td>{match.totalKills}</td>
                        <td>{match.mvpRole ? (match.mvpName ? `${match.mvpName} (${roleInfo(match.mvpRole).name})` : roleInfo(match.mvpRole).name) : '—'}</td>
                        <td>{formatDate(match.playedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
