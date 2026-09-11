/**
 * Orchestrator: wires economy and missions to the event bus.
 *
 * This is the piece that becomes the server-side session when the
 * RoundCoordinator lands — it holds the player's progression and nothing about
 * rendering. Still no Phaser import (see GAMEPLAY.md).
 */

import { AXE_COST, ZOMBIE_BOUNTY, createEconomy, earn, spend } from './economy.js';
import { MISSIONS, activeMission, advance, createMissions } from './missions.js';

export function createGameState(bus) {
  let economy = createEconomy();
  let missions = createMissions();
  let unlocked = new Set();
  let weapon = null;

  const setEconomy = (next) => {
    if (next === economy) return;
    economy = next;
    bus.emit('garavitos:changed', { garavitos: economy.garavitos });
  };

  const missionSnapshot = () => {
    const mission = activeMission(missions);
    if (!mission) return null;
    return {
      id: mission.id,
      title: mission.title,
      description: mission.description,
      progress: missions.progress,
      target: mission.target,
    };
  };

  const feedMissions = (event, payload) => {
    const { state, completed } = advance(missions, event, payload);
    if (state === missions) return;
    missions = state;

    if (completed) {
      if (completed.reward.garavitos) {
        setEconomy(earn(economy, completed.reward.garavitos));
      }
      if (completed.reward.unlocks) {
        unlocked.add(completed.reward.unlocks);
        bus.emit('weapon:unlocked', { weapon: completed.reward.unlocks });
      }
      bus.emit('mission:completed', { id: completed.id, title: completed.title });
    }

    bus.emit('mission:progress', missionSnapshot());
  };

  bus.on('zombie:killed', (payload) => {
    setEconomy(earn(economy, ZOMBIE_BOUNTY));
    feedMissions('zombie:killed', payload);
  });

  // Every other event some mission listens for. 'zombie:killed' is excluded
  // because it is already handled above (it also pays the bounty); subscribing
  // twice would advance that mission by two per kill.
  new Set(MISSIONS.map((mission) => mission.on))
    .forEach((event) => {
      if (event === 'zombie:killed') return;
      bus.on(event, (payload) => feedMissions(event, payload));
    });

  return {
    snapshot: () => ({
      garavitos: economy.garavitos,
      weapon,
      unlocked: [...unlocked],
      mission: missionSnapshot(),
    }),

    hasWeapon: () => weapon !== null,

    /** True once the player may buy the axe but has not paid for it yet. */
    canClaimAxe: () => weapon === null && unlocked.has('hacha'),

    /**
     * Pays for the axe at the puesto de seguridad. Returns a reason instead of
     * throwing so the scene can show the player why nothing happened.
     */
    claimAxe() {
      if (weapon === 'hacha') return { ok: false, reason: 'already-owned' };
      if (!unlocked.has('hacha')) return { ok: false, reason: 'locked' };

      const result = spend(economy, AXE_COST);
      if (!result.ok) return { ok: false, reason: 'not-enough-garavitos' };

      setEconomy(result.state);
      weapon = 'hacha';
      bus.emit('weapon:equipped', { weapon });
      return { ok: true };
    },

    reset() {
      economy = createEconomy();
      missions = createMissions();
      unlocked = new Set();
      weapon = null;
      bus.emit('garavitos:changed', { garavitos: economy.garavitos });
      bus.emit('mission:progress', missionSnapshot());
    },
  };
}
