/**
 * Puente compartido entre React (Hud.jsx) y Phaser (MainScene.js) para el
 * estado de vida/inventario: ambos importan este modulo en vez de pasarse
 * props/callbacks entre un componente React y una escena de Phaser.
 *
 * Un solo topic (/topic/game/{gameId}) para join y pickup — el mismo que
 * usara a futuro el RoundCoordinator, con un campo `lastEvent` mas en el
 * payload en vez de un canal aparte.
 */
import { socketService } from '../services/socketService';

const GAME_ID = 'default';
const MY_ROLE = 'SEGURIDAD'; // unico rol jugable en este sprint

let latestState = { players: [], claimedItemIds: [], lastEvent: null };
const listeners = new Set();
let joined = false;

function notify() {
  listeners.forEach((callback) => callback(latestState));
}

export function getGameId() {
  return GAME_ID;
}

export function getMyRole() {
  return MY_ROLE;
}

export function getLatestState() {
  return latestState;
}

export function getMyPlayerState() {
  return latestState.players.find((p) => p.playerId === MY_ROLE) ?? null;
}

/** Se llama con el estado actual inmediatamente, y de nuevo en cada broadcast. */
export function onStateChange(callback) {
  listeners.add(callback);
  callback(latestState);
  return () => listeners.delete(callback);
}

/** Idempotente: solo se une/suscribe una vez, sin importar cuantas veces se llame. */
export function ensureJoined() {
  if (joined) return;
  // client.active se pone en true casi de inmediato al llamar activate(),
  // antes de que el handshake STOMP realmente termine — connected es la
  // senal real. Si todavia no esta listo, se reintenta desde connect's
  // onConnect (que solo dispara cuando connected pasa a true).
  if (!socketService.client?.connected) return;
  joined = true;

  socketService.subscribe(`/topic/game/${GAME_ID}`, (body) => {
    latestState = body;
    notify();
  });
  socketService.publish(`/app/game/${GAME_ID}/join`, { role: MY_ROLE });
}

export function requestPickup(itemId, x, y) {
  socketService.publish(`/app/game/${GAME_ID}/pickup`, { playerId: MY_ROLE, itemId, x, y });
}

/**
 * Envia la decision de este jugador para la ronda actual al
 * RoundCoordinator del backend. `action` es un placeholder de texto libre
 * por ahora (ej. 'placeholder_action') — el catalogo real de acciones por
 * rol todavia no esta definido.
 */
export function submitDecision(action) {
  socketService.publish(`/app/game/${GAME_ID}/decide`, { playerId: MY_ROLE, action });
}

// Conveniencia de dev: inspeccionar el estado sincronizado desde la consola
// del navegador, igual que window.__phaserGame en GameCanvas.jsx.
if (import.meta.env.DEV) {
  window.__gameSync = { getLatestState, getMyPlayerState, ensureJoined, requestPickup, submitDecision };
}
