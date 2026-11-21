import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { cleanNickname, getNickname, setNickname, displayName, nameWithRole, MAX_NICKNAME } = await import('./profile.js');
const { getStamina, setStamina, onStaminaChange } = await import('./stamina.js');
const tutorial = await import('./tutorial.js');

beforeEach(() => store.clear());

test('el apodo quita caracteres de control, espacios repetidos y se corta en 16', () => {
  assert.equal(cleanNickname('  Ana\u0007\tMaria  '), 'Ana Maria ');
  assert.equal(cleanNickname('x'.repeat(30)).length, MAX_NICKNAME);
  assert.equal(cleanNickname(null), '');
});

test('el apodo se guarda en el navegador y sin almacenamiento no falla', () => {
  setNickname('  Javi  ');
  assert.equal(getNickname(), 'Javi');
  const original = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  assert.equal(getNickname(), '');
  assert.doesNotThrow(() => setNickname('x'));
  globalThis.localStorage = original;
});

test('en pantalla se muestra el apodo o el rol', () => {
  assert.equal(displayName({ name: 'Javi', role: 'SALUD' }), 'Javi');
  assert.equal(displayName({ playerId: 'SALUD' }), 'Biomédica');
  assert.equal(displayName(null), '');
  assert.equal(nameWithRole({ name: 'Javi', role: 'ECONOMIA' }), 'Javi (Economía)');
  assert.equal(nameWithRole({ role: 'ECONOMIA' }), 'Economía');
  assert.equal(nameWithRole(undefined), '');
});

test('la energia avisa solo cuando cambia de verdad', () => {
  const vistos = [];
  const quitar = onStaminaChange((s) => vistos.push(s.value));
  setStamina(0.5, false);
  setStamina(0.505, false); // menos de 0,01: no avisa
  setStamina(0.2, true);
  setStamina(1, false);
  quitar();
  setStamina(0.3, false);
  assert.deepEqual(vistos, [1, 0.5, 0.2, 1]);
  assert.deepEqual(getStamina(), { value: 0.3, exhausted: false });
});

test('las ayudas se ven una vez, se guardan y se pueden reiniciar', () => {
  assert.equal(tutorial.hasSeen('move'), false);
  tutorial.markSeen('move');
  assert.equal(tutorial.hasSeen('move'), true);
  assert.deepEqual(JSON.parse(store.get('garavito.tutorial.v1')), ['move']);
  tutorial.resetTutorial();
  assert.equal(tutorial.hasSeen('move'), false);
});

test('cada ayuda decide cuando sale y adapta el texto a celular o teclado', () => {
  const ctx = {
    inGame: true, secondsInGame: 30, missions: 3, nearMission: true, zombieWindingUp: true, garavitos: 25,
    hasWeapon: true, health: 30, allyDown: true, isMedic: true, abilityName: 'Revivir', abilityHint: 'Mantén E',
  };
  for (const touch of [true, false]) {
    for (const isMedic of [true, false]) {
      tutorial.TIPS.forEach((tip) => {
        assert.equal(tip.when({ ...ctx, touch, isMedic }), true, tip.id);
        assert.ok(tip.text({ ...ctx, touch, isMedic }).length > 10, tip.id);
      });
    }
  }
  assert.match(tutorial.TIPS.find((t) => t.id === 'low_health').text({ touch: false }), /Tab/);
  const quieto = { inGame: false, secondsInGame: 0, missions: 0, garavitos: 0, health: 100 };
  assert.equal(tutorial.TIPS.filter((tip) => tip.when(quieto)).length, 0);
});
