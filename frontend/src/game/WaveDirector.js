import Phaser from 'phaser';

import { PLAY_AREA } from './world/campus';
import {
  WAVE_REST_MS,
  rollZombieHealth,
  rollZombieSpeed,
  waveBlueprint,
} from './systems/waves.js';

/**
 * Drives waves in the scene. All the *pacing* decisions live in
 * `systems/waves.js`; this class only turns them into spawns at the right time
 * and place, and reports wave boundaries on the bus.
 */

/** Half the viewport diagonal is 500px, so this keeps spawns just off-screen. */
const SPAWN_DISTANCE = 560;
const MIN_SPAWN_DISTANCE = 320;
const EDGE_MARGIN = 48;

const STATE = { RESTING: 'resting', SPAWNING: 'spawning', CLEARING: 'clearing' };

export default class WaveDirector {
  constructor(scene, bus, onSpawn) {
    this.scene = scene;
    this.bus = bus;
    this.onSpawn = onSpawn;
    this.reset();
  }

  reset() {
    this.wave = 0;
    this.blueprint = null;
    this.spawned = 0;
    this.state = STATE.RESTING;
    this.nextEventAt = 0;
  }

  start(delayMs = 1500) {
    this.reset();
    this.nextEventAt = this.scene.time.now + delayMs;
  }

  get restingSecondsLeft() {
    if (this.state !== STATE.RESTING) return 0;
    return Math.max(0, Math.ceil((this.nextEventAt - this.scene.time.now) / 1000));
  }

  /** Zombies still owed for this wave: on the field plus not yet spawned. */
  remaining(living) {
    if (!this.blueprint) return 0;
    return living + (this.blueprint.total - this.spawned);
  }

  update(living, player) {
    const now = this.scene.time.now;

    if (this.state === STATE.RESTING) {
      if (now >= this.nextEventAt) this.startWave(this.wave + 1);
      return;
    }

    if (this.state === STATE.SPAWNING) {
      if (now >= this.nextEventAt) {
        this.spawnOne(player);
        this.nextEventAt = now + this.blueprint.spawnIntervalMs;
      }
      if (this.spawned >= this.blueprint.total) this.state = STATE.CLEARING;
      return;
    }

    if (living === 0) {
      this.bus.emit('wave:cleared', { wave: this.wave });
      this.state = STATE.RESTING;
      this.nextEventAt = now + WAVE_REST_MS;
    }
  }

  startWave(wave) {
    this.wave = wave;
    this.blueprint = waveBlueprint(wave);
    this.spawned = 0;
    this.state = STATE.SPAWNING;
    this.nextEventAt = this.scene.time.now;
    this.bus.emit('wave:started', { wave, total: this.blueprint.total });
  }

  spawnOne(player) {
    const point = this.pickSpawnPoint(player);
    this.spawned += 1;
    this.onSpawn(point.x, point.y, {
      health: rollZombieHealth(this.blueprint, Math.random()),
      speed: rollZombieSpeed(this.blueprint, Math.random()),
    });
  }

  /**
   * Picks a point on a ring around the player, clamped into the play area.
   * Clamping can drag a point back toward the player (when they are hugging a
   * wall), so candidates that end up too close are rejected — a zombie must
   * never materialise on top of the player.
   */
  pickSpawnPoint(player) {
    let fallback = null;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const x = Phaser.Math.Clamp(
        player.x + Math.cos(angle) * SPAWN_DISTANCE,
        PLAY_AREA.x + EDGE_MARGIN,
        PLAY_AREA.right - EDGE_MARGIN,
      );
      const y = Phaser.Math.Clamp(
        player.y + Math.sin(angle) * SPAWN_DISTANCE,
        PLAY_AREA.y + EDGE_MARGIN,
        PLAY_AREA.bottom - EDGE_MARGIN,
      );

      const distance = Phaser.Math.Distance.Between(player.x, player.y, x, y);
      if (distance >= MIN_SPAWN_DISTANCE) return { x, y };
      if (!fallback || distance > fallback.distance) fallback = { x, y, distance };
    }

    return fallback;
  }
}
