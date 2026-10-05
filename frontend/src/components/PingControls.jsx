import { useEffect, useRef, useState } from 'react';
import {
  getLatestState,
  getMyPlayerState,
  getMyRole,
  isInputLocked,
  isTouchDevice,
  onGameEvent,
  requestPing,
} from '../game/gameSync';
import { PING_KINDS, speakPing } from '../game/voice';
import { displayName } from '../game/profile';
import { playSfx } from '../game/sfx';
import Icon from './Icon';

// Avisos al equipo: boton con el menu de avisos (y teclas directas en el computador),
// la lista de los ultimos avisos arriba al centro y la voz de quien aviso.
const COOLDOWN_MS = 1500;
const FEED_MS = 5000;
const KEYS = Object.fromEntries(Object.entries(PING_KINDS).map(([kind, info]) => [info.key.toLowerCase(), kind]));

function isTyping(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

export default function PingControls() {
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState([]);
  const [cooling, setCooling] = useState(false);
  const coolingRef = useRef(0);
  const touch = isTouchDevice();

  const send = (kind) => {
    const now = Date.now();
    if (now < coolingRef.current) return;
    coolingRef.current = now + COOLDOWN_MS;
    setCooling(true);
    setTimeout(() => setCooling(false), COOLDOWN_MS);
    requestPing(kind);
    setOpen(false);
  };

  // Teclas directas: Z zombis, X ayuda, V revivir, G vamos, B municion.
  useEffect(() => {
    const onKey = (event) => {
      if (event.repeat || isTyping(event.target) || isInputLocked()) return;
      const kind = KEYS[event.key.toLowerCase()];
      if (!kind) return;
      event.preventDefault();
      send(kind);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Cada aviso que llega (tambien el propio) se dice en voz alta y se anota en la lista.
  useEffect(() => onGameEvent((event) => {
    if (event.type !== 'PING' || !PING_KINDS[event.itemId]) return;
    const player = getLatestState().players.find((p) => p.playerId === event.playerId);
    const floor = Number(String(event.reason ?? '').split(',')[0]);
    const myFloor = getMyPlayerState()?.floor;
    speakPing(event.itemId, player?.role ?? event.playerId);
    const id = `${event.playerId}-${Date.now()}`;
    setFeed((items) => [...items.slice(-2), {
      id,
      kind: event.itemId,
      who: displayName(player ?? { role: event.playerId }),
      mine: event.playerId === getMyRole(),
      floor: Number.isFinite(floor) && floor !== myFloor ? floor : null,
    }]);
    setTimeout(() => setFeed((items) => items.filter((item) => item.id !== id)), FEED_MS);
  }), []);


  return (
    <>
      {feed.length > 0 && (
        <div className="ping-feed" aria-live="polite">
          {feed.map((item) => (
            <div key={item.id} className={`ping-feed-item ping-feed-item--${item.kind.toLowerCase()}`}>
              <Icon name={PING_KINDS[item.kind].icon} />
              <strong>{item.mine ? 'Tú' : item.who}:</strong> {PING_KINDS[item.kind].label}
              {item.floor && <small> · Piso {item.floor}</small>}
            </div>
          ))}
        </div>
      )}

      <div className={`ping-controls${touch ? ' ping-controls--touch' : ''}`}>
        {open && (
          <div className="ping-menu" role="menu">
            {Object.entries(PING_KINDS).map(([kind, info]) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                className={`ping-option ping-option--${kind.toLowerCase()}`}
                disabled={cooling}
                onClick={() => send(kind)}
              >
                <Icon name={info.icon} />
                <span>{info.label}</span>
                {!touch && <kbd>{info.key}</kbd>}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className={`hud-icon-btn ping-toggle${open ? ' ping-toggle--open' : ''}`}
          aria-label="Avisar al equipo"
          aria-expanded={open}
          title="Avisar al equipo (Z, X, V, G, B)"
          onClick={() => {
            playSfx('click');
            setOpen((value) => !value);
          }}
        >
          <Icon name="megaphone" />
        </button>
      </div>
    </>
  );
}
