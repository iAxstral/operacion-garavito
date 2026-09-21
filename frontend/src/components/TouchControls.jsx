import { useRef, useState } from 'react';
import { isTouchDevice, touchInput } from '../game/gameSync';

const JOYSTICK_RADIUS = 52;
const KEY_TAP_MS = 90;

function tapKey(key, keyCode) {
  const init = { key, keyCode, which: keyCode, bubbles: true };
  window.dispatchEvent(new KeyboardEvent('keydown', init));
  setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', init)), KEY_TAP_MS);
}

function HoldButton({ label, className, field }) {
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
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {label}
    </button>
  );
}

export default function TouchControls() {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const baseRef = useRef(null);

  if (!isTouchDevice()) return null;

  const updateStick = (event) => {
    const rect = baseRef.current.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(distance, JOYSTICK_RADIUS);
    const x = (dx / distance) * clamped;
    const y = (dy / distance) * clamped;
    setKnob({ x, y });
    touchInput.moveX = x / JOYSTICK_RADIUS;
    touchInput.moveY = y / JOYSTICK_RADIUS;
  };

  const startStick = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateStick(event);
  };

  const endStick = () => {
    setKnob({ x: 0, y: 0 });
    touchInput.moveX = 0;
    touchInput.moveY = 0;
  };

  return (
    <div className="touch-controls">
      <div
        ref={baseRef}
        className="touch-stick"
        onPointerDown={startStick}
        onPointerMove={(event) => event.buttons !== 0 && updateStick(event)}
        onPointerUp={endStick}
        onPointerCancel={endStick}
      >
        <div className="touch-stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>

      <div className="touch-buttons">
        <button type="button" className="touch-btn touch-btn--e" onPointerDown={(event) => { event.preventDefault(); tapKey('e', 69); }}>
          E
        </button>
        <HoldButton label="Dash" className="touch-btn--dash" field="dash" />
        <HoldButton label="C" className="touch-btn--c" field="charged" />
        <HoldButton label="Q" className="touch-btn--q" field="attack" />
      </div>
    </div>
  );
}
