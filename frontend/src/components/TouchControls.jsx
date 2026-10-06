import { useEffect, useRef, useState } from 'react';
import { getMyPlayerState, isTouchDevice, onStateChange, touchInput } from '../game/gameSync';
import { ownedWeapons, weaponById } from '../game/weaponCatalog';
import { abilityFor } from '../game/abilityCatalog';
import Icon, { Glyph } from './Icon';

const CHARGED_COOLDOWN_MS = 6000;

function keyEvent(type, key, keyCode) {
  window.dispatchEvent(new KeyboardEvent(type, { key, keyCode, which: keyCode, bubbles: true }));
}

function HoldButton({ label, className, field, ariaLabel, style }) {
  const press = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    touchInput[field] = true;
  };
  const release = () => {
    touchInput[field] = false;
  };
  return (
    <button
      type="button"
      className={`touch-btn ${className ?? ''}`}
      style={style}
      aria-label={ariaLabel}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  );
}

// Joystick flotante: aparece donde el pulgar toca la mitad izquierda de la pantalla, asi
// no hay que apuntarle a un circulo fijo y el pulgar no tapa la esquina.
export default function TouchControls() {
  const [stick, setStick] = useState(null);
  const [chargedPct, setChargedPct] = useState(100);
  const [arms, setArms] = useState({ weapon: weaponById('FISTS'), count: 1, canReload: false });
  const [downed, setDowned] = useState(false);
  const eHeldRef = useRef(false);
  const zoneRef = useRef(null);

  useEffect(() => onStateChange(() => {
    const readyIn = getMyPlayerState()?.chargedReadyInMs ?? 0;
    const pct = Math.round(((CHARGED_COOLDOWN_MS - readyIn) / CHARGED_COOLDOWN_MS) * 100);
    setChargedPct(Math.max(0, Math.min(100, pct)));
    const me = getMyPlayerState();
    setDowned(me?.lifeState === 'DOWNED');
    const weapon = weaponById(me?.weapon);
    const canReload = weapon.ranged && me?.reloadingMs === 0 && me.magazine < weapon.magazineSize && me.reserveAmmo > 0;
    setArms((previous) => {
      const count = ownedWeapons(me?.inventory).length;
      return previous.weapon === weapon && previous.count === count && previous.canReload === canReload
        ? previous
        : { weapon, count, canReload };
    });
  }), []);

  // Caido no hay controles: el panel de espectador ocupa su lugar.
  if (!isTouchDevice() || downed) return null;

  const radius = () => {
    const base = zoneRef.current?.querySelector('.touch-stick');
    return (base?.offsetWidth ?? 120) / 2 - 8;
  };

  const updateStick = (event, origin) => {
    const max = radius();
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    const distance = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(distance, max);
    const x = (dx / distance) * clamped;
    const y = (dy / distance) * clamped;
    setStick({ origin, knob: { x, y } });
    touchInput.moveX = x / max;
    touchInput.moveY = y / max;
  };

  const startStick = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = zoneRef.current.getBoundingClientRect();
    const origin = { x: event.clientX, y: event.clientY, left: event.clientX - rect.left, top: event.clientY - rect.top };
    updateStick(event, origin);
  };

  const endStick = () => {
    setStick(null);
    touchInput.moveX = 0;
    touchInput.moveY = 0;
  };

  const chargedReady = chargedPct >= 100;

  return (
    <div className="touch-controls">
      <div
        ref={zoneRef}
        className="touch-stick-zone"
        onPointerDown={startStick}
        onPointerMove={(event) => stick && event.buttons !== 0 && updateStick(event, stick.origin)}
        onPointerUp={endStick}
        onPointerCancel={endStick}
      >
        <div
          className={`touch-stick${stick ? ' touch-stick--active' : ''}`}
          style={stick ? { left: stick.origin.left, top: stick.origin.top } : undefined}
        >
          <div
            className="touch-stick-knob"
            style={{ transform: `translate(${stick?.knob.x ?? 0}px, ${stick?.knob.y ?? 0}px)` }}
          />
        </div>
      </div>

      <div className="touch-buttons">
        <HoldButton label={<Icon name="sword" />} ariaLabel="Ataque básico" className="touch-btn--attack" field="attack" />
        <HoldButton
          label={<Icon name="burst" />}
          ariaLabel={chargedReady ? 'Ataque cargado' : `Ataque cargado (${chargedPct}%)`}
          className={`touch-btn--charged${chargedReady ? ' touch-btn--ready' : ''}`}
          style={{ '--cooldown': `${chargedPct}%` }}
          field="charged"
        />
        <HoldButton label={<Icon name="dash" />} ariaLabel="Dash" className="touch-btn--dash" field="dash" />
        {arms.count > 1 && (
          <button
            type="button"
            className="touch-btn touch-btn--weapon"
            aria-label={`Cambiar arma (${arms.weapon.name})`}
            onPointerDown={(event) => {
              event.preventDefault();
              touchInput.cycleWeapon = true;
            }}
          >
            {arms.weapon.icon ? <img src={arms.weapon.icon} alt="" /> : <Glyph value={arms.weapon.glyph} />}
          </button>
        )}
        {downed ? null : (
          <button
            type="button"
            className="touch-btn touch-btn--ability"
            aria-label={abilityFor(getMyPlayerState()?.role).name}
            onPointerDown={(event) => {
              event.preventDefault();
              touchInput.ability = true;
            }}
          >
            <Glyph value={abilityFor(getMyPlayerState()?.role).icon} />
          </button>
        )}
        {arms.canReload && (
          <button
            type="button"
            className="touch-btn touch-btn--reload"
            aria-label="Recargar"
            onPointerDown={(event) => {
              event.preventDefault();
              touchInput.reload = true;
            }}
          >
            <Icon name="reload" />
          </button>
        )}
        <button
          type="button"
          className="touch-btn touch-btn--e"
          aria-label="Interactuar o inventario"
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            // E se mantiene apretada mientras el dedo siga encima (para revivir).
            eHeldRef.current = true;
            keyEvent('keydown', 'e', 69);
          }}
          onPointerUp={() => {
            if (!eHeldRef.current) return;
            eHeldRef.current = false;
            keyEvent('keyup', 'e', 69);
          }}
          onPointerCancel={() => {
            if (!eHeldRef.current) return;
            eHeldRef.current = false;
            keyEvent('keyup', 'e', 69);
          }}
        >
          E
        </button>
      </div>
    </div>
  );
}
