import { useEffect, useState } from 'react';
import { API_BASE } from '../services/socketService';
import Icon from './Icon';

const REFRESH_MS = 3000;

const buildingName = (id) => (id === 'BIBLIOTECA' ? 'Biblioteca' : `Edificio ${id}`);

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function roomStage(room) {
  if (!room.enCurso) return 'En la sala de espera';
  if (room.jefe) return 'Peleando contra el jefe';
  return room.kinder > 0 ? `Kinder ${room.kinder} de ${room.kinders}` : 'Empezando';
}

/** Estado en vivo del servidor (GET /api/estado): se refresca solo cada 3 s. */
export default function ServerStatus({ onClose }) {
  const [result, setResult] = useState({ status: 'loading', data: null, at: null });

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`${API_BASE}/api/estado`)
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.json();
        })
        .then((data) => !cancelled && setResult({ status: 'ok', data, at: new Date() }))
        .catch(() => !cancelled && setResult((previous) => ({ ...previous, status: 'error' })));
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const data = result.data;

  return (
    <div className="settings-overlay" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="settings-panel ranking-panel" role="dialog" aria-modal="true" aria-labelledby="estado-title">
        <header className="settings-header">
          <h2 id="estado-title"><Icon name="pulse" /> Estado del servidor</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>

        {result.status === 'loading' && <p className="howto-muted">Cargando…</p>}
        {result.status === 'error' && (
          <p className="lobby-error">
            {data ? 'Se perdió la conexión con el servidor; mostrando los últimos datos.' : 'No se pudo consultar el servidor. ¿Está prendido?'}
          </p>
        )}

        {data && (
          <>
            <div className="estado-cifras" aria-live="polite">
              <div className="estado-cifra">
                <span className="estado-valor">{data.salas}</span>
                <span className="estado-etiqueta"><Icon name="map" /> Salas</span>
              </div>
              <div className="estado-cifra">
                <span className="estado-valor">{data.jugadores}</span>
                <span className="estado-etiqueta"><Icon name="people" /> Jugadores</span>
              </div>
              <div className="estado-cifra">
                <span className="estado-valor">{data.zombis}</span>
                <span className="estado-etiqueta"><Icon name="zombie" /> Zombis</span>
              </div>
              <div className="estado-cifra" title="Lo que tarda el 99 % de los ticks de una sala (se corre uno cada 66 ms)">
                <span className="estado-valor">{data.tickP99Ms == null ? '—' : `${data.tickP99Ms.toFixed(2)} ms`}</span>
                <span className="estado-etiqueta"><Icon name="pulse" /> Tick p99</span>
              </div>
            </div>

            <p className="howto-muted estado-nodo">
              <span className="estado-punto" aria-hidden="true" /> En línea hace {formatUptime(data.segundosEncendido)}
              {' · '}nodo {data.nodo}
              {result.at && ` · actualizado ${result.at.toLocaleTimeString('es-CO')}`}
            </p>

            {data.partidas.length === 0 ? (
              <p className="team-panel-empty">No hay partidas abiertas ahora mismo. ¡Crea una!</p>
            ) : (
              <div className="results-table-wrap">
                <table className="results-table ranking-table">
                  <thead>
                    <tr>
                      <th scope="col">Edificio</th>
                      <th scope="col"><Icon name="people" title="Jugadores" /></th>
                      <th scope="col"><Icon name="zombie" title="Zombis vivos" /></th>
                      <th scope="col">Cómo va</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.partidas.map((room, index) => (
                      // Sin codigo de sala (el servidor no lo expone): el orden es estable por llenado.
                      <tr key={index}>
                        <td>{buildingName(room.edificio)}</td>
                        <td>{room.jugadores}/4</td>
                        <td>{room.zombis}</td>
                        <td>{roomStage(room)}</td>
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
