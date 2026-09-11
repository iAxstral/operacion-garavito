/**
 * Tests for the pure rule modules. They run on Node's built-in runner
 * (`npm test`) with no bundler and no test framework, which is possible
 * precisely because nothing here imports Phaser.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AXE_COST, canAfford, createEconomy, earn, spend } from './economy.js';
import { WAVE_REST_MS, rollZombieHealth, rollZombieSpeed, waveBlueprint } from './waves.js';
import { MISSIONS, activeMission, advance, createMissions } from './missions.js';
import { createEventBus } from './eventBus.js';
import { createGameState } from './gameState.js';

describe('economy', () => {
  it('acumula Garavitos y recuerda el total ganado', () => {
    const after = earn(earn(createEconomy(), 3), 2);
    assert.equal(after.garavitos, 5);
    assert.equal(after.totalEarned, 5);
  });

  it('no deja el saldo en negativo', () => {
    const { state, ok } = spend(createEconomy(4), 10);
    assert.equal(ok, false);
    assert.equal(state.garavitos, 4);
  });

  it('descuenta pero no altera el total ganado', () => {
    const { state, ok } = spend(createEconomy(10), AXE_COST);
    assert.equal(ok, true);
    assert.equal(state.garavitos, 0);
    assert.equal(state.totalEarned, 10);
    assert.equal(canAfford(state, 1), false);
  });

  it('ignora montos no positivos', () => {
    const start = createEconomy(5);
    assert.equal(earn(start, 0), start);
    assert.equal(earn(start, -3), start);
  });
});

describe('waves', () => {
  it('sube la cantidad de zombis y baja la cadencia en cada oleada', () => {
    for (let wave = 1; wave < 12; wave += 1) {
      const current = waveBlueprint(wave);
      const next = waveBlueprint(wave + 1);
      assert.ok(next.total > current.total, `oleada ${wave + 1} no trae más zombis`);
      assert.ok(
        next.spawnIntervalMs <= current.spawnIntervalMs,
        `oleada ${wave + 1} spawnea más lento`,
      );
    }
  });

  it('nunca hace a los zombis más rápidos que el jugador', () => {
    const PLAYER_MAX_SPEED = 180;
    for (let wave = 1; wave < 50; wave += 1) {
      assert.ok(waveBlueprint(wave).speedRange.max < PLAYER_MAX_SPEED);
    }
  });

  it('no manda zombis tesos en las primeras tres oleadas', () => {
    [1, 2, 3].forEach((wave) => {
      const blueprint = waveBlueprint(wave);
      assert.equal(blueprint.toughChance, 0);
      assert.equal(rollZombieHealth(blueprint, 0), 2);
      assert.equal(rollZombieHealth(blueprint, 0.99), 2);
    });
    assert.equal(rollZombieHealth(waveBlueprint(4), 0), 4);
  });

  it('mantiene la velocidad sorteada dentro del rango de la oleada', () => {
    const blueprint = waveBlueprint(3);
    assert.equal(rollZombieSpeed(blueprint, 0), blueprint.speedRange.min);
    assert.ok(rollZombieSpeed(blueprint, 0.999) < blueprint.speedRange.max);
  });

  it('deja un respiro entre oleadas', () => {
    assert.ok(WAVE_REST_MS > 0);
  });
});

describe('missions', () => {
  it('solo cuenta el evento que la misión activa escucha', () => {
    const start = createMissions();
    assert.equal(activeMission(start).id, 'primer-contacto');

    const ignored = advance(start, 'zombie:killed', {});
    assert.equal(ignored.state, start, 'un evento ajeno no debería mover el progreso');
    assert.equal(ignored.completed, null);
  });

  it('no completa "primer-contacto" con una oleada que no sea la 1', () => {
    const { completed } = advance(createMissions(), 'wave:cleared', { wave: 2 });
    assert.equal(completed, null);
  });

  it('avanza a la siguiente misión al completar una', () => {
    const { state, completed } = advance(createMissions(), 'wave:cleared', { wave: 1 });
    assert.equal(completed.id, 'primer-contacto');
    assert.deepEqual(state.completed, ['primer-contacto']);
    assert.equal(state.progress, 0);
    assert.equal(activeMission(state).id, 'armate');
  });

  it('acumula progreso parcial en misiones con contador', () => {
    let state = { index: 2, progress: 0, completed: [] };
    const target = MISSIONS[2].target;

    for (let kill = 1; kill < target; kill += 1) {
      const result = advance(state, 'zombie:killed', {});
      state = result.state;
      assert.equal(result.completed, null);
      assert.equal(state.progress, kill);
    }

    assert.equal(advance(state, 'zombie:killed', {}).completed.id, 'limpieza');
  });

  it('se queda sin misión activa al terminar el catálogo', () => {
    const end = { index: MISSIONS.length, progress: 0, completed: [] };
    assert.equal(activeMission(end), null);
    assert.equal(advance(end, 'zombie:killed', {}).completed, null);
  });
});

describe('gameState', () => {
  const setup = () => {
    const bus = createEventBus();
    return { bus, state: createGameState(bus) };
  };

  it('paga 1 Garavito por zombi, una sola vez por muerte', () => {
    const { bus, state } = setup();
    const seen = [];
    bus.on('garavitos:changed', (payload) => seen.push(payload.garavitos));

    bus.emit('zombie:killed', {});
    bus.emit('zombie:killed', {});

    assert.equal(state.snapshot().garavitos, 2);
    assert.deepEqual(seen, [1, 2], 'cada muerte debe pagar exactamente un Garavito');
  });

  it('el hacha no se puede reclamar antes de completar la misión 1', () => {
    const { state } = setup();
    assert.equal(state.canClaimAxe(), false);
    assert.deepEqual(state.claimAxe(), { ok: false, reason: 'locked' });
  });

  it('completar la oleada 1 paga justo lo que cuesta el hacha', () => {
    const { bus, state } = setup();
    bus.emit('wave:cleared', { wave: 1 });

    assert.equal(state.snapshot().garavitos, AXE_COST);
    assert.equal(state.canClaimAxe(), true);
    assert.deepEqual(state.snapshot().unlocked, ['hacha']);
  });

  it('reclamar el hacha la equipa, cobra el costo y cierra la misión 2', () => {
    const { bus, state } = setup();
    const equipped = [];
    bus.on('weapon:equipped', (payload) => equipped.push(payload.weapon));

    bus.emit('wave:cleared', { wave: 1 });
    assert.deepEqual(state.claimAxe(), { ok: true });

    assert.deepEqual(equipped, ['hacha']);
    assert.equal(state.snapshot().garavitos, 0);
    assert.equal(state.hasWeapon(), true);
    assert.equal(state.snapshot().mission.id, 'limpieza');
  });

  it('no cobra dos veces si se reclama el hacha de nuevo', () => {
    const { bus, state } = setup();
    bus.emit('wave:cleared', { wave: 1 });
    state.claimAxe();
    bus.emit('zombie:killed', {});

    assert.deepEqual(state.claimAxe(), { ok: false, reason: 'already-owned' });
    assert.equal(state.snapshot().garavitos, 1);
  });

  it('la recompensa de la misión 1 alcanza exacto para el hacha', () => {
    // Hoy no hay forma de gastar Garavitos antes del puesto de seguridad, así
    // que la rama 'not-enough-garavitos' de claimAxe es inalcanzable: queda
    // como guarda para cuando la tienda tenga más de un artículo. Lo que sí se
    // fija acá es la premisa que la vuelve inalcanzable.
    const { bus, state } = setup();
    bus.emit('wave:cleared', { wave: 1 });

    assert.equal(state.snapshot().garavitos, AXE_COST);
    assert.deepEqual(state.claimAxe(), { ok: true });
    assert.equal(state.snapshot().garavitos, 0);
  });

  it('reset devuelve la partida al estado inicial', () => {
    const { bus, state } = setup();
    bus.emit('wave:cleared', { wave: 1 });
    state.claimAxe();
    bus.emit('zombie:killed', {});

    state.reset();

    const snapshot = state.snapshot();
    assert.equal(snapshot.garavitos, 0);
    assert.equal(snapshot.weapon, null);
    assert.deepEqual(snapshot.unlocked, []);
    assert.equal(snapshot.mission.id, 'primer-contacto');
  });
});

describe('eventBus', () => {
  it('permite que un handler se desuscriba durante su propio emit', () => {
    const bus = createEventBus();
    const calls = [];

    const off = bus.on('tick', () => {
      calls.push('primero');
      off();
    });
    bus.on('tick', () => calls.push('segundo'));

    bus.emit('tick');
    bus.emit('tick');

    assert.deepEqual(calls, ['primero', 'segundo', 'segundo']);
  });
});
