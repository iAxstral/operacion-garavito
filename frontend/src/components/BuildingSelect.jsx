import { useState } from 'react';

const IMAGE_W = 1024;
const IMAGE_H = 572;

const BUILDINGS = [
  { id: 'F', enabled: true, button: [133, 105, 244, 146], marker: [820, 226, 866, 271] },
  { id: 'G', button: [259, 105, 370, 146], marker: [700, 304, 745, 349], extra: [[634, 372, 656, 398]] },
  { id: 'A', button: [385, 105, 497, 146], marker: [485, 287, 530, 331] },
  { id: 'B', button: [511, 105, 623, 146], marker: [398, 218, 443, 262], extra: [[334, 306, 360, 334]] },
  { id: 'C', enabled: true, button: [637, 105, 749, 146], marker: [197, 258, 243, 303] },
  { id: 'Biblioteca', button: [763, 105, 889, 146], marker: [525, 232, 648, 266] },
];

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

  const handleClick = (building) => {
    if (building.enabled) {
      onSelect(building.id);
      return;
    }
    setNotice(`El edificio ${building.id} todavía no está disponible. Por ahora solo los edificios F y C.`);
  };

  return (
    <div className="building-select">
      <div className="building-select-stage">
        <img
          className="building-select-map"
          src="/mapa/seleccion-edificio.jpeg"
          alt="Selecciona un edificio"
          draggable={false}
        />

        {BUILDINGS.flatMap((building) => {
          const spots = [building.button, building.marker, ...(building.extra ?? [])];
          return spots.map((box, index) => (
            <button
              key={`${building.id}-${index}`}
              type="button"
              className={`building-hotspot${building.enabled ? ' building-hotspot--enabled' : ' building-hotspot--locked'}`}
              style={toStyle(box)}
              onClick={() => handleClick(building)}
              aria-label={building.enabled ? `Edificio ${building.id}` : `Edificio ${building.id} (no disponible)`}
              title={building.enabled ? `Entrar al edificio ${building.id}` : 'Próximamente'}
            />
          ));
        })}
      </div>

      <div className="building-select-bar">
        <button type="button" className="screen-back-btn" onClick={onBack}>
          Volver
        </button>
        <span className="building-select-notice">
          {notice ?? 'Elige el edificio F o el edificio C para comenzar la operación.'}
        </span>
      </div>
    </div>
  );
}
