/**
 * Wave pacing. Pure: `waveBlueprint(n)` is the single source of truth for how
 * hard wave `n` is, so the difficulty curve can be read (and tuned) without
 * opening any Phaser code.
 */

/** Breather between one wave being cleared and the next one starting. */
export const WAVE_REST_MS = 6000;

export const ZOMBIE_BASE_HEALTH = 2;
export const ZOMBIE_TOUGH_HEALTH = 4;

/** Tough zombies only start showing up once the player is armed and warmed up. */
const FIRST_TOUGH_WAVE = 4;

export function waveBlueprint(wave) {
  return {
    wave,
    total: 5 + 3 * (wave - 1),
    spawnIntervalMs: Math.max(350, 1250 - 150 * (wave - 1)),
    toughChance: wave < FIRST_TOUGH_WAVE
      ? 0
      : Math.min(0.5, 0.25 + 0.05 * (wave - FIRST_TOUGH_WAVE)),
    // Zombies get slightly faster each wave, but never fast enough to
    // out-run the player's 180 px/s — being cornered should be a positioning
    // mistake, not an unavoidable outcome.
    speedRange: {
      min: Math.min(120, 55 + 4 * (wave - 1)),
      max: Math.min(150, 75 + 4 * (wave - 1)),
    },
  };
}

/** Health of the next zombie to spawn, given a [0,1) roll. */
export function rollZombieHealth(blueprint, roll) {
  return roll < blueprint.toughChance ? ZOMBIE_TOUGH_HEALTH : ZOMBIE_BASE_HEALTH;
}

/** Speed of the next zombie to spawn, given a [0,1) roll. */
export function rollZombieSpeed(blueprint, roll) {
  const { min, max } = blueprint.speedRange;
  return min + roll * (max - min);
}
