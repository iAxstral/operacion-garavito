// Cuadros de caminar generados a partir del sprite quieto de cada direccion: las
// piernas se separan en mitad izquierda y derecha y se levanta una u otra. Los atlas
// que venian con los personajes no sirven para esto (en una misma secuencia el
// personaje cambia de direccion), asi que se arman aqui con la misma imagen.

export const WALK_FRAME_COUNT = 4;
export const WALK_FPS = 9;
// Fraccion de la altura del sprite donde empiezan las piernas.
const LEG_START = 0.7;
const LIFT_PX = 5;
// Cuadro: cuanto se levanta cada pierna [izquierda, derecha].
const FRAMES = [[0, 0], [LIFT_PX, 0], [0, 0], [0, LIFT_PX]];

export function walkKey(prefix, direction, frame) {
  return `${prefix}_${direction}_w${frame}`;
}

/** Crea (una vez) los cuadros de caminar de `${prefix}_${direction}`. */
export function bakeWalkFrames(scene, prefix, direction) {
  const base = `${prefix}_${direction}`;
  if (!scene.textures.exists(base) || scene.textures.exists(walkKey(prefix, direction, 0))) return;
  const source = scene.textures.get(base).getSourceImage();
  const w = source.width;
  const h = source.height;
  const legTop = Math.round(h * LEG_START);
  const half = Math.floor(w / 2);

  FRAMES.forEach(([liftLeft, liftRight], frame) => {
    const texture = scene.textures.createCanvas(walkKey(prefix, direction, frame), w, h);
    const ctx = texture.context;
    ctx.imageSmoothingEnabled = false;
    // Primero las piernas (la que se levanta queda medio tapada por el cuerpo)...
    ctx.drawImage(source, 0, legTop, half, h - legTop, 0, legTop - liftLeft, half, h - legTop);
    ctx.drawImage(source, half, legTop, w - half, h - legTop, half, legTop - liftRight, w - half, h - legTop);
    // ...y encima el cuerpo, hasta un pixel mas abajo para que no quede costura.
    ctx.drawImage(source, 0, 0, w, legTop + 1, 0, 0, w, legTop + 1);
    texture.refresh();
  });
}

export function bakeAllWalkFrames(scene, prefixes) {
  prefixes.forEach((prefix) => ['down', 'up', 'left', 'right'].forEach((direction) => bakeWalkFrames(scene, prefix, direction)));
}

/** Cuadro que toca segun cuanto lleva caminando (ms). */
export function walkFrameAt(ms) {
  return Math.floor((ms / 1000) * WALK_FPS) % WALK_FRAME_COUNT;
}
