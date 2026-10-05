import { useState } from 'react';
import HalloweenCreatures from './HalloweenCreatures';
import { playSfx } from '../game/sfx';

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
    id: 'B', info: 'Edificio B · sellado',
    button: [818, 175, 1005, 238], marker: [624, 368, 690, 430], extra: [[535, 505, 575, 560]],
  },
  {
    id: 'C', enabled: true, info: 'Edificio C · 2 pisos',
    button: [1032, 175, 1213, 238], marker: [292, 420, 356, 480],
  },
  {
    id: 'Biblioteca', info: 'Biblioteca · sellada',
    button: [1237, 175, 1435, 238], marker: [828, 395, 998, 442],
  },
];

const DEFAULT_NOTICE = 'Elige un edificio para comenzar la operación: F, C, G o A.';

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
    setNotice(`${building.id === 'Biblioteca' ? 'La Biblioteca' : `El edificio ${building.id}`} está sellado. Por ahora: F, C, G y A.`);
  };

  const hoveredBuilding = BUILDINGS.find((b) => b.id === hovered);
  const message = hoveredBuilding
    ? `${hoveredBuilding.info}${hoveredBuilding.enabled ? ' — clic para entrar' : ''}`
    : (notice ?? DEFAULT_NOTICE);

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
              aria-label={building.enabled ? `Edificio ${building.id}` : `Edificio ${building.id} (no disponible)`}
              title={building.enabled ? `Entrar al edificio ${building.id}` : 'Sellado'}
            />
          ));
        })}
      </div>

      <HalloweenCreatures />
      <div className="building-select-vignette" aria-hidden="true" />

      <div className="building-select-bar">
        <button type="button" className="screen-back-btn" onClick={onBack}>
          Volver
        </button>
        <span key={lockedTry} className={`building-select-notice${lockedTry && notice && !hoveredBuilding ? ' building-select-notice--locked' : ''}`}>
          {message}
        </span>
      </div>
    </div>
  );
}
