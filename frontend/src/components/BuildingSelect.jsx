import { useState } from 'react';
import NavidadCreatures from './NavidadCreatures';
import { playSfx } from '../game/sfx';
import { buildingLabel } from '../game/mapLayout';

const BUILDINGS = [
  { id: 'F', enabled: true, info: 'Edificio F · 3 pisos' },
  { id: 'G', enabled: true, info: 'Edificio G · Ingeniería · 2 pisos' },
  { id: 'A', enabled: true, info: 'Edificio A · Administrativo · 3 pisos' },
  { id: 'B', enabled: true, info: 'Edificio B · Ciencias Básicas · 3 pisos' },
  { id: 'C', enabled: true, info: 'Edificio C · 2 pisos' },
  { id: 'BIBLIOTECA', enabled: true, info: 'Biblioteca · 2 pisos' },
];

const DEFAULT_NOTICE = 'Elige un edificio para comenzar la operación.';
// Cada edificio es una puerta del calendario de adviento (dia y apodo).
const ADVIENTO = {
  F: { dia: 19, apodo: 'El de las aulas' },
  G: { dia: 20, apodo: 'Ingeniería' },
  A: { dia: 21, apodo: 'Administrativo' },
  B: { dia: 22, apodo: 'Ciencias Básicas' },
  C: { dia: 23, apodo: 'Laboratorios' },
  BIBLIOTECA: { dia: 24, apodo: 'Nochebuena' },
};

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

  // Un calendario de adviento maldito hecho por codigo: cada puerta es un edificio; al
  // pasar por encima se entreabre.
  return (
    <div className="building-select xa-screen">
      <NavidadCreatures />
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
