// Efectos sobre toda la pantalla del jugador (no del mundo): una capa HTML encima del
// juego, asi no depende del zoom ni del movimiento de la camara de Phaser.

const LAYER_ID = 'screen-fx';

function layer() {
  let el = document.getElementById(LAYER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = LAYER_ID;
    el.className = 'screen-fx';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  return el;
}

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Bola de nieve en la cara: todo blanco un instante y se aclara de a poco. */
export function snowBlind() {
  const el = document.createElement('div');
  el.className = 'screen-fx-snow';
  if (reducedMotion()) el.classList.add('screen-fx-snow--soft');
  for (let i = 0; i < 9; i += 1) {
    const flake = document.createElement('span');
    flake.style.setProperty('--x', `${10 + Math.random() * 80}%`);
    flake.style.setProperty('--y', `${10 + Math.random() * 80}%`);
    flake.style.setProperty('--s', `${0.6 + Math.random() * 1.2}`);
    el.appendChild(flake);
  }
  layer().appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

/** Barro con carbon del reno: manchas que escurren y tardan en caerse. */
export function mudSplat() {
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement('div');
    el.className = 'screen-fx-mud';
    el.style.setProperty('--x', `${8 + Math.random() * 74}%`);
    el.style.setProperty('--y', `${8 + Math.random() * 66}%`);
    el.style.setProperty('--size', `${120 + Math.random() * 160}px`);
    el.style.setProperty('--rot', `${Math.random() * 360}deg`);
    el.style.setProperty('--delay', `${i * 60}ms`);
    for (let d = 0; d < 3; d += 1) {
      const drip = document.createElement('span');
      drip.style.setProperty('--dx', `${15 + Math.random() * 70}%`);
      drip.style.setProperty('--len', `${30 + Math.random() * 70}px`);
      el.appendChild(drip);
    }
    layer().appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }
}

/** Quita lo que haya (al salir de la partida). */
export function clearScreenFx() {
  document.getElementById(LAYER_ID)?.replaceChildren();
}
