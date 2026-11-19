import { touchInput } from './gameSync';

// Control de consola (Xbox/PlayStation con el mapeo estandar del navegador). Escribe en
// las mismas entradas que usan los botones tactiles, asi la escena no distingue.
//   Palanca izquierda: moverse (al tope, corre) · Palanca derecha: apuntar
//   A / Cruz: atacar · B / Circulo: dash · X / Cuadrado: E · Y / Triangulo: habilidad
//   RB: ataque cargado · LB: cambiar de arma · LT: correr · RT: atacar
//   Cruceta: avisos (arriba zombis, abajo ayuda, derecha vamos, izquierda municion)
//   Start: configuracion

const DEADZONE = 0.22;
const AIM_DEADZONE = 0.35;
const BUTTONS = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
// Botones que equivalen a una tecla: se simula la pulsacion.
const KEYS = { X: ['e', 69], START: ['Escape', 27], UP: ['z', 90], DOWN: ['x', 88], RIGHT: ['g', 71], LEFT: ['b', 66] };

let previous = {};
let wasActive = false;

function key(type, [name, code]) {
  window.dispatchEvent(new KeyboardEvent(type, { key: name, keyCode: code, which: code, bubbles: true }));
}

function axis(value) {
  return Math.abs(value) < DEADZONE ? 0 : value;
}

/** Hay algun control conectado (para mostrar ayudas). */
export function gamepadConnected() {
  return Boolean(navigator.getGamepads?.().some(Boolean));
}

/**
 * Lee el primer control conectado y actualiza las entradas. Devuelve el angulo de
 * apuntado de la palanca derecha (o null si no se esta usando).
 */
export function pollGamepad() {
  const pad = navigator.getGamepads?.().find(Boolean);
  if (!pad) {
    if (wasActive) {
      Object.assign(touchInput, { moveX: 0, moveY: 0, attack: false, dash: false, charged: false, sprint: false });
      wasActive = false;
    }
    return null;
  }
  const pressed = (name) => Boolean(pad.buttons[BUTTONS[name]]?.pressed);
  const moveX = axis(pad.axes[0] ?? 0);
  const moveY = axis(pad.axes[1] ?? 0);
  const active = moveX !== 0 || moveY !== 0 || pad.buttons.some((b) => b.pressed);
  if (!active && !wasActive) return null;
  wasActive = active;

  touchInput.moveX = moveX;
  touchInput.moveY = moveY;
  touchInput.attack = pressed('A') || pressed('RT');
  touchInput.dash = pressed('B');
  touchInput.charged = pressed('RB');
  touchInput.sprint = pressed('LT');
  if (pressed('Y') && !previous.Y) touchInput.ability = true;
  if (pressed('LB') && !previous.LB) touchInput.cycleWeapon = true;

  Object.entries(KEYS).forEach(([name, mapping]) => {
    if (pressed(name) && !previous[name]) key('keydown', mapping);
    if (!pressed(name) && previous[name]) key('keyup', mapping);
  });
  previous = Object.fromEntries(Object.keys(BUTTONS).map((name) => [name, pressed(name)]));

  const aimX = pad.axes[2] ?? 0;
  const aimY = pad.axes[3] ?? 0;
  return Math.hypot(aimX, aimY) >= AIM_DEADZONE ? Math.atan2(aimY, aimX) : null;
}
