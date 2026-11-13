// Cuanto se agranda el juego segun la pantalla, para que se vea igual en una ventana
// del navegador, en F11 y en monitores grandes. La referencia es una laptop de
// 1366x768 en pantalla completa: ahi la camara y la interfaz van a escala 1.

// Alto (px) que se ve del mapa en la referencia.
const VIEW_REFERENCE_PX = 768;
// En pantallas chicas (celular) la camara se aleja para que se vea mas mapa alrededor:
// con zoom 1 el personaje ocupaba casi la mitad del alto en horizontal.
const SMALL_REFERENCE_PX = 620;
const MIN_CAMERA_ZOOM = 0.6;
const MAX_CAMERA_ZOOM = 3;

const UI_REFERENCE = { width: 1366, height: 768 };
const MIN_UI_SCALE = 0.75;
const MAX_UI_SCALE = 2;

const steps = (value) => Math.round(value * 20) / 20;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Zoom de la camara del juego. Entre 620 y 768 px de lado corto va a 1; por encima
 * acerca para mostrar lo mismo que en la referencia (en un monitor de 1080 o 1440 el
 * personaje ya no se ve diminuto); por debajo aleja, como antes.
 */
export function cameraZoomFor(width, height) {
  const shortSide = Math.min(width, height);
  if (shortSide > VIEW_REFERENCE_PX) return Math.min(MAX_CAMERA_ZOOM, steps(shortSide / VIEW_REFERENCE_PX));
  if (shortSide >= SMALL_REFERENCE_PX) return 1;
  return Math.max(MIN_CAMERA_ZOOM, steps(shortSide / SMALL_REFERENCE_PX));
}

/**
 * Escala de la interfaz (menus, HUD, misiones). Se ajusta a lo que mas limite, el alto
 * o el ancho, asi en una ventana con barras del navegador todo sigue cabiendo. En
 * pantallas tactiles queda en 1: el celular tiene su propio diseno.
 */
export function uiScaleFor(width, height, touch = false) {
  if (touch) return 1;
  const fit = Math.min(height / UI_REFERENCE.height, width / UI_REFERENCE.width);
  return clamp(steps(fit), MIN_UI_SCALE, MAX_UI_SCALE);
}

/** Mantiene --ui-scale en <html> al dia con el tamano de la ventana. */
export function watchUiScale(win = window) {
  const root = win.document.documentElement;
  const touch = win.matchMedia?.('(pointer: coarse)');
  const apply = () => {
    const scale = uiScaleFor(win.innerWidth, win.innerHeight, Boolean(touch?.matches));
    root.style.setProperty('--ui-scale', String(scale));
  };
  apply();
  win.addEventListener('resize', apply);
  touch?.addEventListener?.('change', apply);
  return () => {
    win.removeEventListener('resize', apply);
    touch?.removeEventListener?.('change', apply);
  };
}
