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

let latestState = { players: [], claimedItemIds: [], lastEvent: null, zombies: [], wave: null, doors: [] };

// Cadencia del reporte de posicion. 10 Hz alcanza para que los zombis
// persigan de forma continua; el umbral en pixeles evita gastar mensajes
// mientras el jugador esta quieto, que es buena parte del tiempo.
const MOVE_REPORT_MS = 100;
const MOVE_REPORT_MIN_PX = 4;
let lastMoveSentAt = 0;
let lastSentX = null;
let lastSentY = null;
const listeners = new Set();
let joined = false;
let topicSubscription = null;

// Vendedor cercano (proximidad, igual patron que las puertas): lo escribe
// MainScene.js en su loop de update, lo lee Hud.jsx para mostrar "Presiona
// E" y el menu correspondiente. No es parte de latestState porque es
// puramente local del cliente (no viene del backend).
let nearVendor = null;
const vendorListeners = new Set();

// Zona de mision con tarea propia (por ahora solo Seguridad) en rango: mismo
// patron que nearVendor, lo escribe MainScene.js y lo lee el componente del
// popup para saber cuando ofrecer "Presiona E".
let nearMission = null;
const missionListeners = new Set();

// Mientras hay una tarea de mision abierta el jugador no debe poder moverse
// ni atacar (ver SecurityMission.jsx) — MainScene.js lo consulta en cada
// frame de update().
let inputLocked = false;

// Puerta en rango de interaccion (mismo patron que nearVendor/nearMission):
// lo escribe MainScene.js, lo lee Hud.jsx para el hint de "Presiona E".
let nearDoor = null;
const doorListeners = new Set();

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

  topicSubscription = socketService.subscribe(`/topic/game/${GAME_ID}`, (body) => {
    // El tick de zombis difunde 8 veces por segundo con lastEvent en null, así
    // que tomar el payload tal cual borraba cualquier aviso ("inventario
    // lleno", "muy lejos") a los 125 ms — antes de que el HUD alcanzara a
    // mostrarlo. Un evento se conserva hasta que llegue OTRO evento real; se
    // mantiene la misma referencia para que los efectos de React no lo
    // vuelvan a disparar.
    latestState = {
      ...body,
      lastEvent: body.lastEvent ?? latestState.lastEvent,
    };
    notify();
  });
  socketService.publish(`/app/game/${GAME_ID}/join`, { role: MY_ROLE });
}

/**
 * Vuelve al estado "todavia no me uni": se llama al salir al menu principal
 * (ver App.jsx), para que la proxima vez que se entre a jugar ensureJoined()
 * mande un /join real de nuevo — eso es lo que hace que el backend reinicie
 * la partida (ver GameController.join / GameSession.resetGame). El socket
 * STOMP en si no se desconecta: es un singleton compartido con
 * ConnectionStatus.jsx, no hace falta tirarlo abajo solo para volver al menu.
 */
export function leaveGame() {
  topicSubscription?.unsubscribe();
  topicSubscription = null;
  joined = false;
  latestState = { players: [], claimedItemIds: [], lastEvent: null, zombies: [], wave: null, doors: [] };
  lastMoveSentAt = 0;
  lastSentX = null;
  lastSentY = null;
  inputLocked = false;
  setNearVendor(null);
  setNearMission(null);
  setNearDoor(null);
  notify();
}

/**
 * Reporta la posicion al servidor, que la necesita para que los zombis
 * persigan. Se llama en cada frame; este modulo decide si toca mandar.
 */
export function reportPosition(x, y, now) {
  if (!joined || !socketService.client?.connected) return;
  if (now - lastMoveSentAt < MOVE_REPORT_MS) return;
  if (lastSentX !== null
    && Math.abs(x - lastSentX) < MOVE_REPORT_MIN_PX
    && Math.abs(y - lastSentY) < MOVE_REPORT_MIN_PX) return;

  lastMoveSentAt = now;
  lastSentX = x;
  lastSentY = y;
  socketService.publish(`/app/game/${GAME_ID}/move`, { playerId: MY_ROLE, x, y });
}

/** `facing` en radianes. El servidor valida arma, cooldown, alcance y arco. */
export function requestAttack(x, y, facing) {
  if (!socketService.client?.connected) return;
  socketService.publish(`/app/game/${GAME_ID}/attack`, { playerId: MY_ROLE, x, y, facing });
}

export function getZombies() {
  return latestState.zombies ?? [];
}

export function getWave() {
  return latestState.wave ?? null;
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

export function purchaseItem(itemId, x, y) {
  socketService.publish(`/app/game/${GAME_ID}/purchase`, { playerId: MY_ROLE, itemId, x, y });
}

export function requestMissionComplete(missionId, x, y) {
  socketService.publish(`/app/game/${GAME_ID}/mission/complete`, { playerId: MY_ROLE, missionId, x, y });
}

/** Abre la tarea: el backend valida rol/cooldown y, si esta libre, vuelve al jugador inmune. */
export function requestMissionStart(missionId) {
  socketService.publish(`/app/game/${GAME_ID}/mission/start`, { playerId: MY_ROLE, missionId });
}

/** Cierra la tarea sin completarla — el backend le quita la inmunidad igual. */
export function requestMissionCancel(missionId) {
  socketService.publish(`/app/game/${GAME_ID}/mission/cancel`, { playerId: MY_ROLE, missionId });
}

/** Llamado por MainScene en cada frame con la zona de mision en rango, o null. */
export function setNearMission(mission) {
  if (nearMission?.missionId === mission?.missionId) return; // sin cambios, no molestar a los listeners
  nearMission = mission;
  missionListeners.forEach((callback) => callback(nearMission));
}

export function getNearMission() {
  return nearMission;
}

export function onNearMissionChange(callback) {
  missionListeners.add(callback);
  callback(nearMission);
  return () => missionListeners.delete(callback);
}

export function setInputLocked(locked) {
  inputLocked = locked;
}

export function isInputLocked() {
  return inputLocked;
}

/** x/y: posicion del jugador, para que el backend valide que este cerca de esa puerta. */
export function requestDoorToggle(doorId, x, y) {
  socketService.publish(`/app/game/${GAME_ID}/door/toggle`, { playerId: MY_ROLE, doorId, x, y });
}

/** Llamado por MainScene en cada frame con la puerta en rango, o null. */
export function setNearDoor(door) {
  if (nearDoor?.doorId === door?.doorId) return; // sin cambios, no molestar a los listeners
  nearDoor = door;
  doorListeners.forEach((callback) => callback(nearDoor));
}

export function getNearDoor() {
  return nearDoor;
}

export function onNearDoorChange(callback) {
  doorListeners.add(callback);
  callback(nearDoor);
  return () => doorListeners.delete(callback);
}

export function getDoors() {
  return latestState.doors ?? [];
}

/** Llamado por MainScene en cada frame con el vendedor en rango, o null. */
export function setNearVendor(vendor) {
  if (nearVendor?.vendorId === vendor?.vendorId) return; // sin cambios, no molestar a los listeners
  nearVendor = vendor;
  vendorListeners.forEach((callback) => callback(nearVendor));
}

export function getNearVendor() {
  return nearVendor;
}

export function onNearVendorChange(callback) {
  vendorListeners.add(callback);
  callback(nearVendor);
  return () => vendorListeners.delete(callback);
}

// Conveniencia de dev: inspeccionar el estado sincronizado desde la consola
// del navegador, igual que window.__phaserGame en GameCanvas.jsx.
if (import.meta.env.DEV) {
  window.__gameSync = {
    getLatestState,
    getMyPlayerState,
    ensureJoined,
    leaveGame,
    requestPickup,
    submitDecision,
    purchaseItem,
    requestMissionComplete,
    requestMissionStart,
    requestMissionCancel,
    getNearVendor,
    getNearMission,
    requestDoorToggle,
    getNearDoor,
    getDoors,
    requestAttack,
    reportPosition,
    getZombies,
    getWave,
  };
}
