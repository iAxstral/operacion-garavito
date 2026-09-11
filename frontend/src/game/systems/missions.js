/**
 * Mission catalog and progress. Pure.
 *
 * Missions are sequential: exactly one is active at a time, and it advances by
 * counting events the game already emits, so adding a mission never means
 * touching gameplay code — only this list.
 */

// Extensions are explicit throughout `systems/` so these modules also load
// under plain Node (`npm test`), not just through Vite's resolver.
import { AXE_COST } from './economy.js';

export const MISSIONS = [
  {
    id: 'primer-contacto',
    title: 'Primer contacto',
    // No weapon yet: the only way through wave 1 is dodging.
    description: 'Sobrevive la oleada 1 sin arma',
    target: 1,
    on: 'wave:cleared',
    counts: (payload) => payload.wave === 1,
    reward: { garavitos: AXE_COST, unlocks: 'hacha' },
  },
  {
    id: 'armate',
    title: 'Ármate',
    description: `Reclama el hacha en el puesto de seguridad (${AXE_COST} Garavitos)`,
    target: 1,
    on: 'weapon:equipped',
    counts: (payload) => payload.weapon === 'hacha',
    reward: {},
  },
  {
    id: 'limpieza',
    title: 'Limpieza',
    description: 'Elimina 10 zombis',
    target: 10,
    on: 'zombie:killed',
    counts: () => true,
    reward: { garavitos: 15 },
  },
];

export function createMissions() {
  return { index: 0, progress: 0, completed: [] };
}

export function activeMission(state) {
  return MISSIONS[state.index] ?? null;
}

/**
 * Feeds one event to the active mission.
 *
 * Returns `completed: null` while the mission is still in progress, and the
 * mission itself on the tick that finishes it — the caller pays the reward, so
 * this module stays free of economy side effects.
 */
export function advance(state, event, payload) {
  const mission = activeMission(state);
  if (!mission || mission.on !== event || !mission.counts(payload)) {
    return { state, completed: null };
  }

  const progress = state.progress + 1;
  if (progress < mission.target) {
    return { state: { ...state, progress }, completed: null };
  }

  return {
    state: {
      index: state.index + 1,
      progress: 0,
      completed: [...state.completed, mission.id],
    },
    completed: mission,
  };
}
