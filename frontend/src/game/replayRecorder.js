import { getLatestState, getMyBuilding, onGameEvent, onStateChange } from './gameSync';
import { displayName } from './profile';
import { createRecorder } from './replay';

// Graba la corrida en curso para la repeticion de la mejor jugada (ver replay.js).
const recorder = createRecorder();
let started = false;

export function startReplayRecorder() {
  if (started) return;
  started = true;
  onStateChange((state) => recorder.onState(state, Date.now()));
  onGameEvent((event) => recorder.onEvent(event, Date.now(), (id) => (
    displayName(getLatestState().players.find((p) => p.playerId === id) ?? { role: id })
  )));
}

/** La mejor jugada de la corrida que termino (o null); deja la grabadora lista para la proxima. */
export function takeBestPlay() {
  recorder.flush();
  const best = recorder.best();
  recorder.reset();
  return best ? { ...best, building: getMyBuilding() } : null;
}
