
import { socketService } from '../services/socketService';

const CLIENT_ID = Math.random().toString(36).slice(2, 10);
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const EVENT_TIMEOUT_MS = 6000;

let gameId = null;
let myRole = 'SEGURIDAD';
let currentFloor = 1;
// Edificio elegido en BuildingSelect ('F' o 'C'). Solo se usa del lado del cliente:
// el backend comparte el mismo mapa para ambos, pero el Edificio C es mas chico
// (2 pisos) asi que MainScene usa esto para no dejar subir al piso 3 jugando ahi.
let myBuilding = 'F';

function emptyState() {
  return { players: [], claimedItemIds: [], lastEvent: null, zombies: [], wave: null, doors: [], lobby: null };
}

let latestState = emptyState();
const eventWaiters = new Set();

const MOVE_REPORT_MS = 100;
const MOVE_REPORT_MIN_PX = 4;
let lastMoveSentAt = 0;
let lastSentX = null;
let lastSentY = null;
const listeners = new Set();
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

function notify() {
  listeners.forEach((callback) => callback(latestState));
}

export function getGameId() {
  return gameId;
}

export function getMyRole() {
  return myRole;
}

export function setMyBuilding(building) {
  myBuilding = building === 'C' ? 'C' : 'F';
}

export function getMyBuilding() {
  return myBuilding;
}

export const touchInput = { moveX: 0, moveY: 0, attack: false, dash: false, charged: false };

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

export async function openLobby(code, create) {
  await socketService.whenConnected();
  resetLocalState();
  gameId = code;
  topicSubscription = socketService.subscribe(`/topic/game/${code}`, handleMessage);

  const reply = awaitEvent((event) => event.playerId === CLIENT_ID
    && (event.type === 'LOBBY_OK' || event.type === 'LOBBY_REJECTED'));
  socketService.publish(`/app/game/${code}/lobby`, { clientId: CLIENT_ID, create });

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
  return code;
}

export async function joinAs(role) {
  const reply = awaitEvent((event) => (event.type === 'JOIN_OK' && event.itemId === CLIENT_ID)
    || (event.type === 'JOIN_REJECTED' && event.playerId === CLIENT_ID));
  socketService.publish(`/app/game/${gameId}/join`, { role, clientId: CLIENT_ID });

  const event = await reply;
  if (event.type === 'JOIN_REJECTED') throw new Error(event.reason);
  myRole = role;
  joined = true;
  return role;
}

export function startGame() {
  socketService.publish(`/app/game/${gameId}/start`, { playerId: myRole });
}

export function getLobbyCode() {
  return gameId;
}

function closeTopic() {
  topicSubscription?.unsubscribe();
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
}

export function leaveGame() {
  if (joined && socketService.isConnected()) {
    socketService.publish(`/app/game/${gameId}/leave`, { playerId: myRole });
  }
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

export function requestUseItem(itemId) {
  socketService.publish(`/app/game/${gameId}/use`, { playerId: myRole, itemId });
}

export function getZombies() {
  return latestState.zombies ?? [];
}

export function getWave() {
  return latestState.wave ?? null;
}

export function requestPickup(itemId, x, y) {
  socketService.publish(`/app/game/${gameId}/pickup`, { playerId: myRole, itemId, x, y });
}

export function submitDecision(action) {
  socketService.publish(`/app/game/${gameId}/decide`, { playerId: myRole, action });
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
    requestUseItem,
    changeFloor,
    reportPosition,
    getZombies,
    getWave,
  };
}
