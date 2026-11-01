import { useState } from 'react';
import TemporadaCreatures from './TemporadaCreatures';
import useTemporada from './useTemporada';
import { playSfx } from '../game/sfx';
import { buildingLabel } from '../game/mapLayout';

// Medidas reales de /mapa/seleccion-edificio-halloween.jpg: las cajas de abajo estan
// en pixeles de esa imagen y se pasan a porcentajes para que escalen con ella.
const IMAGE_W = 1647;
const IMAGE_H = 955;

const BUILDINGS = [
  {
    id: 'F', enabled: true, info: 'Edificio F · 3 pisos',
    button: [205, 175, 383, 238], marker: [1295, 382, 1362, 447],
  },
  {
    id: 'G', enabled: true, info: 'Edificio G · Ingeniería · 2 pisos',
    button: [410, 175, 588, 238], marker: [1097, 515, 1165, 578], extra: [[1005, 615, 1055, 665]],
  },
  {
    id: 'A', enabled: true, info: 'Edificio A · Administrativo · 3 pisos',
    button: [612, 175, 790, 238], marker: [764, 476, 830, 537],
  },
  {
    id: 'B', enabled: true, info: 'Edificio B · Ciencias Básicas · 3 pisos',
    button: [818, 175, 1005, 238], marker: [624, 368, 690, 430], extra: [[535, 505, 575, 560]],
  },
  {
    id: 'C', enabled: true, info: 'Edificio C · 2 pisos',
    button: [1032, 175, 1213, 238], marker: [292, 420, 356, 480],
  },
  {
    id: 'BIBLIOTECA', enabled: true, info: 'Biblioteca · 2 pisos',
    button: [1237, 175, 1435, 238], marker: [828, 395, 998, 442],
  },
];

const DEFAULT_NOTICE = 'Elige un edificio para comenzar la operación.';
// Navidad: cada edificio es una puerta del calendario de adviento (dia y apodo).
const ADVIENTO = {
  F: { dia: 19, apodo: 'El de las aulas' },
  G: { dia: 20, apodo: 'Ingeniería' },
  A: { dia: 21, apodo: 'Administrativo' },
  B: { dia: 22, apodo: 'Ciencias Básicas' },
  C: { dia: 23, apodo: 'Laboratorios' },
  BIBLIOTECA: { dia: 24, apodo: 'Nochebuena' },
};

function toStyle([x0, y0, x1, y1]) {
  return {
    left: `${(x0 / IMAGE_W) * 100}%`,
    top: `${(y0 / IMAGE_H) * 100}%`,
    width: `${((x1 - x0) / IMAGE_W) * 100}%`,
    height: `${((y1 - y0) / IMAGE_H) * 100}%`,
  };
}

export default function BuildingSelect({ onSelect, onBack }) {
  const [notice, setNotice] = useState(null);
  const temporada = useTemporada();
  const [hovered, setHovered] = useState(null);
  // Cambia en cada clic a un edificio cerrado para reiniciar la sacudida del aviso.
  const [lockedTry, setLockedTry] = useState(0);

  const handleClick = (building) => {
    if (building.enabled) {
      playSfx('click');
      onSelect(building.id);
      return;
    }
    playSfx('empty');
    setLockedTry((n) => n + 1);
    setNotice(`${building.id === 'BIBLIOTECA' ? 'La Biblioteca' : `El edificio ${building.id}`} está sellado.`);
  };

  const hoveredBuilding = BUILDINGS.find((b) => b.id === hovered);
  const message = hoveredBuilding
    ? `${hoveredBuilding.info}${hoveredBuilding.enabled ? ' — clic para entrar' : ''}`
    : (notice ?? DEFAULT_NOTICE);

  const bar = (
    <div className="building-select-bar">
      <button type="button" className="screen-back-btn" onClick={onBack}>
        Volver
      </button>
      <span key={lockedTry} className={`building-select-notice${lockedTry && notice && !hoveredBuilding ? ' building-select-notice--locked' : ''}`}>
        {message}
      </span>
    </div>
  );

  // Navidad: un calendario de adviento maldito hecho por codigo (sin la ilustracion
  // de Halloween). Cada puerta es un edificio; al pasar por encima se entreabre.
  if (temporada.id === 'NAVIDAD') {
    return (
      <div className="building-select xa-screen">
        <TemporadaCreatures />
        <header className="xa-header">
          <p className="xa-kicker">Calendario de adviento · ECI</p>
          <h1 className="xa-title">Elige tu edificio</h1>
          <p className="xa-sub">Cada puerta abre un edificio. Ninguna trae chocolates.</p>
        </header>
        <div className="xa-calendar">
          {BUILDINGS.map((building) => {
            const { dia, apodo } = ADVIENTO[building.id];
            return (
              <button
                key={building.id}
                type="button"
                className={`xa-door${building.enabled ? '' : ' xa-door--locked'}${hovered === building.id ? ' xa-door--open' : ''}`}
                onClick={() => handleClick(building)}
                onMouseEnter={() => setHovered(building.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(building.id)}
                onBlur={() => setHovered(null)}
                aria-label={building.enabled ? buildingLabel(building.id) : `${buildingLabel(building.id)} (no disponible)`}
              >
                <span className="xa-inside" aria-hidden="true">
                  <span className="xa-eyes"><span /><span /></span>
                  <span className="xa-enter">Entrar</span>
                </span>
                <span className="xa-leaf" aria-hidden="true">
                  <span className="xa-day">{dia}</span>
                  <span className="xa-letter">{building.id === 'BIBLIOTECA' ? 'Bib' : building.id}</span>
                  <span className="xa-name">{apodo}</span>
                  <span className="xa-info">{building.info.split(' · ').at(-1)}</span>
                </span>
              </button>
            );
          })}
        </div>
        {bar}
      </div>
    );
  }

  return (
    <div className="building-select">
      <div className="building-select-stage">
        <img
          className="building-select-map"
          src="/mapa/seleccion-edificio-halloween.jpg"
          alt="Selecciona un edificio"
          draggable={false}
        />
        <div className="building-select-fog" aria-hidden="true" />
        <div className="building-select-flash" aria-hidden="true" />

        {BUILDINGS.flatMap((building) => {
          const spots = [building.button, building.marker, ...(building.extra ?? [])];
          return spots.map((box, index) => (
            <button
              key={`${building.id}-${index}`}
              type="button"
              className={[
                'building-hotspot',
                building.enabled ? 'building-hotspot--enabled' : 'building-hotspot--locked',
                hovered === building.id ? 'building-hotspot--hover' : '',
              ].join(' ')}
              style={toStyle(box)}
              onClick={() => handleClick(building)}
              onMouseEnter={() => setHovered(building.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(building.id)}
              onBlur={() => setHovered(null)}
              aria-label={building.enabled ? buildingLabel(building.id) : `${buildingLabel(building.id)} (no disponible)`}
              title={building.enabled ? `Entrar: ${buildingLabel(building.id)}` : 'Sellado'}
            />
          ));
        })}
      </div>

      <TemporadaCreatures />
      <div className="building-select-vignette" aria-hidden="true" />

      {bar}
    </div>
  );
}
