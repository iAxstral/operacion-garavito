
import { socketService } from '../services/socketService';

const CLIENT_ID = Math.random().toString(36).slice(2, 10);
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const EVENT_TIMEOUT_MS = 6000;

let gameId = null;
// Secreto de este jugador para volver a su puesto si se cae la conexion o recarga.
let seatToken = null;
const SEAT_KEY = 'garavito.seat';

function saveSeat() {
  try {
    sessionStorage.setItem(SEAT_KEY, JSON.stringify({ gameId, role: myRole, token: seatToken, building: myBuilding }));
  } catch {
    // Sin almacenamiento no se puede volver tras recargar, pero si tras un corte.
  }
}

function loadSeat() {
  try {
    return JSON.parse(sessionStorage.getItem(SEAT_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function clearSeat() {
  try {
    sessionStorage.removeItem(SEAT_KEY);
  } catch {
    // nada que limpiar
  }
}

function newToken() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('');
}
let myRole = 'SEGURIDAD';
let currentFloor = 1;
// Edificio de la sala. Lo decide quien la crea; quien entra con un codigo adopta el
// que devuelve el servidor, porque mapa, grillas y misiones dependen de el.
let myBuilding = 'F';

function emptyState() {
  return { players: [], claimedItemIds: [], lastEvent: null, zombies: [], wave: null, doors: [], lobby: null, boss: null, projectiles: [], barricades: [] };
}

let latestState = emptyState();
const eventWaiters = new Set();

const MOVE_REPORT_MS = 100;
const MOVE_REPORT_MIN_PX = 4;
let lastMoveSentAt = 0;
let lastSentX = null;
let lastSentY = null;
const listeners = new Set();
// Cada evento del servidor, uno por uno y en orden. `latestState.lastEvent` solo guarda
// el ultimo: si dos jugadores actuan casi a la vez, React puede ver solo el segundo.
const eventListeners = new Set();
let joined = false;
let topicSubscription = null;

let nearVendor = null;
const vendorListeners = new Set();

let nearMission = null;
const missionListeners = new Set();

let inputLocked = false;

let nearDoor = null;
const doorListeners = new Set();

let nearStairs = null;

// Compañero caido al lado (solo lo usa Biomedica para revivir con E).
let nearDowned = null;
const downedListeners = new Set();

// Barricada al lado (solo la usa Infraestructura para repararla con E).
let nearBarricade = null;

// Paneles de habilidad abiertos: 'phone' (Seguridad), 'treasury' (Economia) o null.
let abilityPanel = null;
const abilityPanelListeners = new Set();

// A quien sigue la camara mientras este jugador esta caido.
let spectateTarget = null;
const spectateListeners = new Set();

function notify() {
  listeners.forEach((callback) => callback(latestState));
}

export function getGameId() {
  return gameId;
}

export function getMyRole() {
  return myRole;
}

export function getMyBuilding() {
  return myBuilding;
}

export const touchInput = { moveX: 0, moveY: 0, attack: false, dash: false, charged: false, reload: false, cycleWeapon: false, ability: false };

export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function getCurrentFloor() {
  return currentFloor;
}

export function getLatestState() {
  return latestState;
}

export function getMyPlayerState() {
  return latestState.players.find((p) => p.playerId === myRole) ?? null;
}

export function onStateChange(callback) {
  listeners.add(callback);
  callback(latestState);
  return () => listeners.delete(callback);
}

/** Llama a `callback(evento)` por cada evento nuevo que llegue del servidor. */
export function onGameEvent(callback) {
  eventListeners.add(callback);
  return () => eventListeners.delete(callback);
}

function awaitEvent(predicate) {
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve };
    eventWaiters.add(waiter);
    setTimeout(() => {
      if (eventWaiters.delete(waiter)) reject(new Error('timeout'));
    }, EVENT_TIMEOUT_MS);
  });
}

function handleMessage(body) {
  latestState = {
    ...body,
    lastEvent: body.lastEvent ?? latestState.lastEvent,
  };
  if (body.lastEvent) {
    eventListeners.forEach((callback) => callback(body.lastEvent));
    eventWaiters.forEach((waiter) => {
      if (waiter.predicate(body.lastEvent)) {
        eventWaiters.delete(waiter);
        waiter.resolve(body.lastEvent);
      }
    });
  }
  notify();
}

export function generateLobbyCode() {
  return Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
}

export async function openLobby(code, create, building) {
  await socketService.whenConnected();
  resetLocalState();
  gameId = code;
  topicSubscription = socketService.subscribe(`/topic/game/${code}`, handleMessage);

  const reply = awaitEvent((event) => event.playerId === CLIENT_ID
    && (event.type === 'LOBBY_OK' || event.type === 'LOBBY_REJECTED'));
  socketService.publish(`/app/game/${code}/lobby`, { clientId: CLIENT_ID, create, building });

  let event;
  try {
    event = await reply;
  } catch (error) {
    closeTopic();
    throw error;
  }
  if (event.type === 'LOBBY_REJECTED') {
    closeTopic();
    throw new Error(event.reason);
  }
  myBuilding = latestState.lobby?.building ?? building ?? 'F';
  return code;
}

export async function joinAs(role) {
  const token = newToken();
  const reply = awaitEvent((event) => (event.type === 'JOIN_OK' && event.itemId === CLIENT_ID)
    || (event.type === 'JOIN_REJECTED' && event.playerId === CLIENT_ID));
  socketService.publish(`/app/game/${gameId}/join`, { role, clientId: CLIENT_ID, token });

  const event = await reply;
  if (event.type === 'JOIN_REJECTED') throw new Error(event.reason);
  myRole = role;
  seatToken = token;
  joined = true;
  saveSeat();
  return role;
}

function sendRejoin() {
  socketService.publish(`/app/game/${gameId}/rejoin`, { role: myRole, clientId: CLIENT_ID, token: seatToken });
}

// Al reconectarse el socket (corte de Wi-Fi, celular que se bloqueo) la suscripcion
// anterior ya no existe: se vuelve a suscribir y a reclamar el puesto.
function handleReconnect() {
  if (!joined || !gameId || !seatToken) return;
  topicSubscription = socketService.subscribe(`/topic/game/${gameId}`, handleMessage);
  sendRejoin();
}
socketService.connect({ onConnect: handleReconnect });

/**
 * Al abrir la pagina: si en esta pestaña habia una partida (se recargo), intenta
 * volver al mismo puesto. Devuelve { started } o null si no habia o ya vencio.
 */
export async function resumeSession() {
  const seat = loadSeat();
  if (!seat?.gameId || !seat?.token) return null;
  await socketService.whenConnected();
  resetLocalState();
  gameId = seat.gameId;
  myRole = seat.role;
  myBuilding = seat.building ?? 'F';
  seatToken = seat.token;
  topicSubscription = socketService.subscribe(`/topic/game/${gameId}`, handleMessage);

  const reply = awaitEvent((event) => (event.type === 'REJOIN_OK' && event.itemId === CLIENT_ID)
    || (event.type === 'REJOIN_REJECTED' && event.playerId === CLIENT_ID));
  sendRejoin();
  let event;
  try {
    event = await reply;
  } catch {
    event = null;
  }
  if (!event || event.type === 'REJOIN_REJECTED') {
    closeTopic();
    clearSeat();
    resetLocalState();
    return null;
  }
  joined = true;
  myBuilding = latestState.lobby?.building ?? myBuilding;
  return { started: Boolean(latestState.lobby?.started) };
}

export function startGame() {
  socketService.publish(`/app/game/${gameId}/start`, { playerId: myRole });
}

export function getLobbyCode() {
  return gameId;
}

function closeTopic() {
  try {
    topicSubscription?.unsubscribe();
  } catch {
    // La conexion ya se habia caido: no hay nada que desuscribir.
  }
  topicSubscription = null;
  gameId = null;
  joined = false;
}

function resetLocalState() {
  latestState = emptyState();
  eventWaiters.clear();
  lastMoveSentAt = 0;
  lastSentX = null;
  lastSentY = null;
  currentFloor = 1;
  inputLocked = false;
  setNearVendor(null);
  setNearMission(null);
  setNearDoor(null);
  setNearStairs(null);
  setNearDowned(null);
  setSpectateTarget(null);
  setNearBarricade(null);
  setAbilityPanel(null);
}

export function leaveGame() {
  if (joined && socketService.isConnected()) {
    socketService.publish(`/app/game/${gameId}/leave`, { playerId: myRole });
  }
  clearSeat();
  seatToken = null;
  closeTopic();
  resetLocalState();
  notify();
}

export function reportPosition(x, y, now) {
  if (!joined || !socketService.client?.connected) return;
  if (now - lastMoveSentAt < MOVE_REPORT_MS) return;
  if (lastSentX !== null
    && Math.abs(x - lastSentX) < MOVE_REPORT_MIN_PX
    && Math.abs(y - lastSentY) < MOVE_REPORT_MIN_PX) return;

  lastMoveSentAt = now;
  lastSentX = x;
  lastSentY = y;
  socketService.publish(`/app/game/${gameId}/move`, { playerId: myRole, floor: currentFloor, x, y });
}

export function changeFloor(floor, x, y) {
  currentFloor = floor;
  lastSentX = x;
  lastSentY = y;
  if (!joined || !socketService.client?.connected) return;
  socketService.publish(`/app/game/${gameId}/move`, { playerId: myRole, floor, x, y });
}

export function requestAttack(type, x, y, facing) {
  if (!joined || !socketService.isConnected()) return;
  socketService.publish(`/app/game/${gameId}/attack`, { playerId: myRole, type, x, y, facing });
}

/** Equipa un arma del inventario (null = guardarla y pelear a puños). */
export function requestEquip(itemId) {
  if (!joined || !socketService.isConnected()) return;
  socketService.publish(`/app/game/${gameId}/equip`, { playerId: myRole, itemId });
}

export function requestReload() {
  if (!joined || !socketService.isConnected()) return;
  socketService.publish(`/app/game/${gameId}/reload`, { playerId: myRole });
}

export function requestReviveStart(targetId) {
  if (!joined || !socketService.isConnected()) return;
  socketService.publish(`/app/game/${gameId}/revive/start`, { playerId: myRole, targetId });
}

export function requestReviveCancel() {
  if (!joined || !socketService.isConnected()) return;
  socketService.publish(`/app/game/${gameId}/revive/cancel`, { playerId: myRole });
}

export function requestPlaceBarricade(x, y, facing) {
  if (!joined || !socketService.isConnected()) return;
  socketService.publish(`/app/game/${gameId}/barricade/place`, { playerId: myRole, x, y, facing });
}

export function requestRepairBarricade(barricadeId) {
  if (!joined || !socketService.isConnected()) return;
  socketService.publish(`/app/game/${gameId}/barricade/repair`, { playerId: myRole, barricadeId });
}

export function requestTransfer(targetId, amount) {
  if (!joined || !socketService.isConnected()) return;
  socketService.publish(`/app/game/${gameId}/transfer`, { playerId: myRole, targetId, amount });
}

/** Evento del Kinder en curso ({ id, type: 'BLACKOUT'|'SUPPLY', room, floor, x, y, endsInMs }) o null. */
export function getKinderEvent() {
  return latestState.event ?? null;
}

export function requestEventInteract() {
  if (!joined || !socketService.isConnected()) return;
  socketService.publish(`/app/game/${gameId}/event/interact`, { playerId: myRole });
}

let nearEvent = false;

export function setNearEvent(near) {
  nearEvent = near;
}

export function getNearEvent() {
  return nearEvent;
}

/** Barricadas de Infraestructura ({ id, ownerId, floor, col, row, health, maxHealth }). */
export function getBarricades() {
  return latestState.barricades ?? [];
}

export function setNearBarricade(barricade) {
  nearBarricade = barricade;
}

export function getNearBarricade() {
  return nearBarricade;
}

export function getAbilityPanel() {
  return abilityPanel;
}

export function setAbilityPanel(panel) {
  if (abilityPanel === panel) return;
  abilityPanel = panel;
  abilityPanelListeners.forEach((callback) => callback(abilityPanel));
}

export function onAbilityPanelChange(callback) {
  abilityPanelListeners.add(callback);
  callback(abilityPanel);
  return () => abilityPanelListeners.delete(callback);
}

export function setNearDowned(player) {
  if (nearDowned?.playerId === player?.playerId) return;
  nearDowned = player;
  downedListeners.forEach((callback) => callback(nearDowned));
}

export function getNearDowned() {
  return nearDowned;
}

export function onNearDownedChange(callback) {
  downedListeners.add(callback);
  callback(nearDowned);
  return () => downedListeners.delete(callback);
}

export function setSpectateTarget(playerId) {
  if (spectateTarget === playerId) return;
  spectateTarget = playerId;
  spectateListeners.forEach((callback) => callback(spectateTarget));
}

export function getSpectateTarget() {
  return spectateTarget;
}

export function onSpectateChange(callback) {
  spectateListeners.add(callback);
  callback(spectateTarget);
  return () => spectateListeners.delete(callback);
}

/** Compañeros vivos a los que se puede mirar en modo espectador, en orden estable. */
export function spectatableTeammates() {
  return latestState.players
    .filter((p) => p.playerId !== myRole && p.lifeState !== 'DOWNED')
    .sort((a, b) => a.playerId.localeCompare(b.playerId));
}

export function requestUseItem(itemId) {
  socketService.publish(`/app/game/${gameId}/use`, { playerId: myRole, itemId });
}

export function getZombies() {
  return latestState.zombies ?? [];
}

/** Bolas de acido de los escupidores ({ id, floor, x, y, angle }). */
export function getProjectiles() {
  return latestState.projectiles ?? [];
}

export function getWave() {
  return latestState.wave ?? null;
}

/** El jefe del Kinder 5 ({ id, name, floor, x, y, health, maxHealth, state }) o null. */
export function getBoss() {
  return latestState.boss ?? null;
}

export function requestPickup(itemId, x, y) {
  socketService.publish(`/app/game/${gameId}/pickup`, { playerId: myRole, itemId, x, y });
}

export function purchaseItem(itemId, x, y) {
  socketService.publish(`/app/game/${gameId}/purchase`, { playerId: myRole, itemId, x, y });
}

export function requestMissionComplete(missionId, x, y) {
  socketService.publish(`/app/game/${gameId}/mission/complete`, { playerId: myRole, missionId, x, y });
}

export function requestMissionStart(missionId) {
  socketService.publish(`/app/game/${gameId}/mission/start`, { playerId: myRole, missionId });
}

export function requestMissionCancel(missionId) {
  socketService.publish(`/app/game/${gameId}/mission/cancel`, { playerId: myRole, missionId });
}

export function setNearMission(mission) {
  if (nearMission?.missionId === mission?.missionId) return;
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

export function requestDoorToggle(doorId, x, y) {
  socketService.publish(`/app/game/${gameId}/door/toggle`, { playerId: myRole, doorId, x, y });
}

export function setNearDoor(door) {
  if (nearDoor?.doorId === door?.doorId) return;
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

export function setNearStairs(stairs) {
  if (nearStairs?.kind === stairs?.kind) return;
  nearStairs = stairs;
}

export function getNearStairs() {
  return nearStairs;
}

export function getDoors() {
  return latestState.doors ?? [];
}

export function setNearVendor(vendor) {
  if (nearVendor?.vendorId === vendor?.vendorId) return;
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

if (import.meta.env.DEV) {
  window.__gameSync = {
    getLatestState,
    getMyPlayerState,
    joinAs,
    openLobby,
    startGame,
    leaveGame,
    requestPickup,
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
    requestUseItem,
    requestEquip,
    requestReload,
    changeFloor,
    reportPosition,
    getZombies,
    getBoss,
    getWave,
    // Solo para revisar pantallas a mano o en pruebas: dispara un evento como si
    // viniera del servidor (p. ej. { type: 'TEAM_WIPED' }).
    emitEventForTest: (event) => eventListeners.forEach((callback) => callback(event)),
  };
}
