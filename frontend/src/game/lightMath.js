// Cuentas de la capa de oscuridad que no necesitan Phaser ni un canvas: pasar del mundo
// a la textura (que cubre la vista con un margen y a otra resolucion) y saber si una luz
// toca lo que se ve. Viven aparte para poder probarlas en Node.

/**
 * La vista de la capa de oscuridad: esquina superior izquierda en el mundo (`x`, `y`) y
 * cuantos pixeles de textura hay por pixel del mundo (`scale`).
 */
export function darknessView(worldView, zoom, resolution, overscanPx) {
  const margin = overscanPx / zoom;
  return {
    x: worldView.x - margin,
    y: worldView.y - margin,
    scale: zoom * resolution,
  };
}

/** Un punto del mundo en pixeles de la textura de oscuridad. */
export function toTexture(view, x, y) {
  return { sx: (x - view.x) * view.scale, sy: (y - view.y) * view.scale };
}

/** Si un circulo de radio `r` (en pixeles de textura) toca el rectangulo 0..width x 0..height. */
export function circleTouches(sx, sy, r, width, height) {
  return sx >= -r && sy >= -r && sx <= width + r && sy <= height + r;
}

/** Si una luz del mundo (centro y radio) cae dentro de lo que cubre la textura. */
export function lightVisible(view, x, y, radius, width, height) {
  const { sx, sy } = toTexture(view, x, y);
  return circleTouches(sx, sy, radius * view.scale, width, height);
}

/**
 * Matriz (a, b, c, d, e, f) para `setTransform` que dibuja un sello de radio `stampRadius`
 * centrado en (`sx`, `sy`), girado `angle` radianes y escalado a radio `r`.
 */
export function stampTransform(sx, sy, angle, r, stampRadius) {
  const s = r / stampRadius;
  const cos = Math.cos(angle) * s;
  const sin = Math.sin(angle) * s;
  return [cos, sin, -sin, cos, sx, sy];
}
