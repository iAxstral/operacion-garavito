// Energia para correr (0..1). La lleva la escena y la muestra el HUD.

let value = 1;
let exhausted = false;
const listeners = new Set();

export function getStamina() {
  return { value, exhausted };
}

export function setStamina(next, nextExhausted) {
  const changed = Math.abs(next - value) >= 0.01 || nextExhausted !== exhausted || (next === 1 && value !== 1);
  value = next;
  exhausted = nextExhausted;
  if (changed) listeners.forEach((callback) => callback(getStamina()));
}

export function onStaminaChange(callback) {
  listeners.add(callback);
  callback(getStamina());
  return () => listeners.delete(callback);
}
