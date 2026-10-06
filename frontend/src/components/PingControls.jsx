import { useEffect, useRef, useState } from 'react';
import {
  getLatestState,
  getMyPlayerState,
  getMyRole,
  isInputLocked,
  isTouchDevice,
  onGameEvent,
  requestChat,
  requestPing,
} from '../game/gameSync';
import { CHAT_PHRASES, EMOTES, PING_KINDS, speakChat, speakPing } from '../game/voice';
import { displayName } from '../game/profile';
import { playSfx } from '../game/sfx';
import Icon from './Icon';

// Avisos al equipo: boton con el menu de avisos (y teclas directas en el computador),
// la lista de los ultimos avisos arriba al centro y la voz de quien aviso. Al lado, el
// chat rapido (tecla T): frases fijas que se dicen en voz alta y emotes.
const COOLDOWN_MS = 1500;
const FEED_MS = 5000;
const KEYS = Object.fromEntries(Object.entries(PING_KINDS).map(([kind, info]) => [info.key.toLowerCase(), kind]));

function isTyping(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

export default function PingControls() {
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
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

  // El servidor ya limita el chat a una frase por segundo.
  const sendChat = (phrase) => {
    requestChat(phrase);
    setChatOpen(false);
  };

  // Teclas directas: Z zombis, X ayuda, V revivir, G vamos, B municion.
  useEffect(() => {
    const onKey = (event) => {
      if (event.repeat || isTyping(event.target) || isInputLocked()) return;
      if (event.key.toLowerCase() === 't') {
        event.preventDefault();
        setChatOpen((value) => !value);
        setOpen(false);
        return;
      }
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
    if (event.type === 'CHAT' && event.reason === 'CHAT' && CHAT_PHRASES[event.itemId]) {
      const player = getLatestState().players.find((p) => p.playerId === event.playerId);
      speakChat(event.itemId, player?.role ?? event.playerId);
      const id = `${event.playerId}-${Date.now()}`;
      setFeed((items) => [...items.slice(-2), {
        id,
        kind: 'CHAT',
        icon: 'megaphone',
        text: CHAT_PHRASES[event.itemId],
        who: displayName(player ?? { role: event.playerId }),
        mine: event.playerId === getMyRole(),
        floor: null,
      }]);
      setTimeout(() => setFeed((items) => items.filter((item) => item.id !== id)), FEED_MS);
      return;
    }
    if (event.type !== 'PING' || !PING_KINDS[event.itemId]) return;
    const player = getLatestState().players.find((p) => p.playerId === event.playerId);
    const floor = Number(String(event.reason ?? '').split(',')[0]);
    const myFloor = getMyPlayerState()?.floor;
    speakPing(event.itemId, player?.role ?? event.playerId);
    const id = `${event.playerId}-${Date.now()}`;
    setFeed((items) => [...items.slice(-2), {
      id,
      kind: event.itemId,
      icon: PING_KINDS[event.itemId].icon,
      text: PING_KINDS[event.itemId].label,
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
              <Icon name={item.icon} />
              <strong>{item.mine ? 'Tú' : item.who}:</strong> {item.text}
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
        {chatOpen && (
          <div className="ping-menu chat-menu" role="menu">
            <div className="chat-emotes">
              {Object.entries(EMOTES).map(([emote, glyph]) => (
                <button key={emote} type="button" role="menuitem" className="chat-emote" aria-label={emote.toLowerCase()} onClick={() => sendChat(emote)}>
                  {glyph}
                </button>
              ))}
            </div>
            {Object.entries(CHAT_PHRASES).map(([phrase, text]) => (
              <button key={phrase} type="button" role="menuitem" className="ping-option" onClick={() => sendChat(phrase)}>
                <span>{text}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className={`hud-icon-btn ping-toggle chat-toggle${chatOpen ? ' ping-toggle--open' : ''}`}
          aria-label="Chat rápido"
          aria-expanded={chatOpen}
          title="Chat rápido (T)"
          onClick={() => {
            playSfx('click');
            setChatOpen((value) => !value);
            setOpen(false);
          }}
        >
          <Icon name="chat" />
        </button>
        <button
          type="button"
          className={`hud-icon-btn ping-toggle${open ? ' ping-toggle--open' : ''}`}
          aria-label="Avisar al equipo"
          aria-expanded={open}
          title="Avisar al equipo (Z, X, V, G, B)"
          onClick={() => {
            playSfx('click');
            setOpen((value) => !value);
            setChatOpen(false);
          }}
        >
          <Icon name="megaphone" />
        </button>
      </div>
    </>
  );
}
