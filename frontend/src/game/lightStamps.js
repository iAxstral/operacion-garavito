// "Sellos" de luz: los degradados de la capa de oscuridad horneados una sola vez en un
// canvas fuera de pantalla. Antes cada luz creaba su createRadialGradient en cada cuadro;
// ahora se estampa este canvas con drawImage. Con destination-out el alfa del sello se
// multiplica por globalAlpha, asi que estampar con globalAlpha = fuerza da lo mismo que
// el degradado con sus paradas multiplicadas por la fuerza.

/** Radio (px) de los sellos: suficiente para que el cono mas largo no se vea pixelado. */
export const STAMP_RADIUS = 256;

function canvas(size) {
  const element = document.createElement('canvas');
  element.width = size;
  element.height = size;
  return element;
}

/** Halo redondo: el mismo degradado que usaba `punch` (1 → 0,6 → 0, nucleo de 12%). */
export function makeHaloStamp(radius = STAMP_RADIUS) {
  const element = canvas(radius * 2);
  const ctx = element.getContext('2d');
  const g = ctx.createRadialGradient(radius, radius, radius * 0.12, radius, radius, radius);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.6)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.fill();
  return element;
}

/**
 * Sector de linterna apuntando a la derecha (angulo 0), con el degradado de
 * `punchCone` (1 → 0,75 → 0). El centro del sello es el centro del canvas.
 */
export function makeConeStamp(halfAngle, radius = STAMP_RADIUS) {
  const element = canvas(radius * 2);
  const ctx = element.getContext('2d');
  const g = ctx.createRadialGradient(radius, radius, radius * 0.05, radius, radius, radius);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.75)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(radius, radius);
  ctx.arc(radius, radius, radius, -halfAngle, halfAngle);
  ctx.closePath();
  ctx.fill();
  return element;
}
