// Zombis en pixel art dibujados con codigo (no hay imagenes de zombis en el proyecto).
// Cada tipo tiene una hoja con 6 cuadros: 4 de caminar (piernas alternadas, cabeza que
// se mece, brazos estirados) y 2 de ataque (brazos arriba y zarpazo). Se dibujan en una
// cuadricula chica y se agrandan sin suavizar, con contorno oscuro de un pixel.

export const ZOMBIE_FRAMES = { walk: [0, 1, 2, 3], windup: 4, strike: 5 };
const FRAME_COUNT = 6;
const SCALE = 3;

const TYPES = {
  zombie: {
    w: 15, h: 22, headW: 7, headH: 6, torsoW: 9, torsoH: 7, legW: 3, legH: 6,
    skin: '#7f9a63', skinDark: '#5b7446', shirt: '#45577a', shirtDark: '#2f3c56', pants: '#3a2f27',
    eyes: '#ffe14a', hair: '#2b241c', blood: '#7a1010',
  },
  'zombie-teso': {
    w: 19, h: 25, headW: 8, headH: 7, torsoW: 13, torsoH: 9, legW: 4, legH: 6,
    skin: '#a0705e', skinDark: '#764c3e', shirt: '#6e2626', shirtDark: '#4a1818', pants: '#2c2622',
    eyes: '#ff3a2a', hair: '#1c1612', blood: '#5a0808', bulky: true,
  },
  'zombie-corredor': {
    w: 13, h: 21, headW: 6, headH: 6, torsoW: 7, torsoH: 7, legW: 2, legH: 6,
    skin: '#93a8b5', skinDark: '#6d808c', shirt: '#2c3440', shirtDark: '#1b2028', pants: '#3a3f48',
    eyes: '#6ff3ff', hair: '#141414', blood: '#6a0f0f', hood: true,
  },
  'zombie-escupidor': {
    w: 19, h: 23, headW: 7, headH: 6, torsoW: 13, torsoH: 9, legW: 3, legH: 5,
    skin: '#7d8f2e', skinDark: '#56651c', shirt: '#5d6e22', shirtDark: '#3e4a14', pants: '#2f3318',
    eyes: '#d8ff5a', hair: '#2a2f14', blood: '#3d6a10', sac: '#c7f05a',
  },
  // Explosivo: hinchado y rojizo, con la panza que brilla naranja y una mecha en la cabeza.
  'zombie-explosivo': {
    w: 19, h: 23, headW: 7, headH: 6, torsoW: 13, torsoH: 9, legW: 3, legH: 5,
    skin: '#b0603a', skinDark: '#7a3a1e', shirt: '#4a2a1a', shirtDark: '#2e1a10', pants: '#2a1e18',
    eyes: '#ffd23a', hair: '#1c1410', blood: '#6a1208', sac: '#ff9a2e', fuse: true,
  },
  // Griton: flaco y palido, con la boca siempre abierta.
  'zombie-griton': {
    w: 14, h: 22, headW: 7, headH: 7, torsoW: 8, torsoH: 7, legW: 2, legH: 6,
    skin: '#c9b8d8', skinDark: '#9a88aa', shirt: '#3a2a4a', shirtDark: '#24182e', pants: '#2a2230',
    eyes: '#e05aff', hair: '#e8e0f0', blood: '#5a0a3a', bigMouth: true,
  },
  // Ciego: gris, alto, con una venda sobre los ojos.
  'zombie-ciego': {
    w: 16, h: 24, headW: 7, headH: 6, torsoW: 10, torsoH: 8, legW: 3, legH: 6,
    skin: '#8a8f8c', skinDark: '#5e6360', shirt: '#2a2c2e', shirtDark: '#18191a', pants: '#2e2a26',
    eyes: '#e8e8e8', hair: '#3a3a3a', blood: '#5a0a0a', blindfold: true,
  },
};

function painter(ctx, ox) {
  return (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + Math.round(x), Math.round(y), w, h);
  };
}

// Un cuadro de un tipo, en coordenadas de la cuadricula (sin escalar).
function drawFrame(ctx, ox, t, frame) {
  const px = painter(ctx, ox);
  const cx = Math.floor(t.w / 2);
  const walk = frame < 4 ? frame : 0;
  const bob = walk === 1 || walk === 3 ? 1 : 0;
  const tilt = walk === 1 ? -1 : walk === 3 ? 1 : 0;
  const legTop = t.h - t.legH;
  const torsoTop = legTop - t.torsoH;
  const headTop = torsoTop - t.headH + 1 + bob;
  const torsoX = cx - Math.floor(t.torsoW / 2);

  // Piernas: se levanta una u otra al caminar.
  const liftL = walk === 1 ? 2 : 0;
  const liftR = walk === 3 ? 2 : 0;
  const legL = cx - 1 - t.legW;
  const legR = cx + 1;
  px(legL, legTop - liftL, t.legW, t.legH, t.pants);
  px(legR, legTop - liftR, t.legW, t.legH, t.pants);
  px(legL, t.h - 1 - liftL, t.legW, 1, '#1a1410');
  px(legR, t.h - 1 - liftR, t.legW, 1, '#1a1410');
  px(legR + t.legW - 1, legTop + 2 - liftR, 1, 2, t.skinDark); // rasgon del pantalon

  // Torso con camisa rota y manchas.
  px(torsoX, torsoTop + bob, t.torsoW, t.torsoH, t.shirt);
  px(torsoX, torsoTop + bob, 2, t.torsoH, t.shirtDark);
  px(torsoX + t.torsoW - 3, torsoTop + 3 + bob, 2, 2, t.skin);
  px(torsoX + 2, torsoTop + t.torsoH - 2 + bob, 2, 1, t.skin);
  px(torsoX + Math.floor(t.torsoW / 2), torsoTop + 2 + bob, 2, 2, t.blood);
  px(torsoX + 1, torsoTop + t.torsoH - 1 + bob, t.torsoW - 2, 1, t.shirtDark);
  if (t.sac) {
    // Escupidor: bolsa de acido que brilla en la panza.
    const sacY = torsoTop + 3 + bob;
    px(cx - 3, sacY, 6, 4, t.sac);
    px(cx - 2, sacY + 1, 2, 1, '#f4ffc0');
    px(cx - 3, sacY + 4, 6, 1, t.skinDark);
  }
  if (t.bulky) {
    px(torsoX - 1, torsoTop + 1 + bob, 1, t.torsoH - 2, t.shirtDark);
    px(torsoX + t.torsoW, torsoTop + 1 + bob, 1, t.torsoH - 2, t.shirtDark);
  }

  // Brazos: estirados hacia adelante al caminar, arriba al preparar el golpe, abajo al pegar.
  const armY = torsoTop + 1 + bob;
  const armL = torsoX - 2;
  const armR = torsoX + t.torsoW;
  if (frame === ZOMBIE_FRAMES.windup) {
    px(armL, armY - 6, 2, 7, t.skin);
    px(armR, armY - 6, 2, 7, t.skin);
    px(armL - 1, armY - 7, 3, 2, t.skinDark);
    px(armR, armY - 7, 3, 2, t.skinDark);
  } else if (frame === ZOMBIE_FRAMES.strike) {
    px(armL + 1, armY + 3, 2, 5, t.skin);
    px(armR - 1, armY + 3, 2, 5, t.skin);
    px(armL + 1, armY + 7, 3, 2, t.blood);
    px(armR - 2, armY + 7, 3, 2, t.blood);
  } else {
    const swingL = walk === 1 ? 1 : 0;
    const swingR = walk === 3 ? 1 : 0;
    px(armL, armY - swingL, 2, 5, t.skin);
    px(armR, armY - swingR, 2, 5, t.skin);
    px(armL, armY + 4 - swingL, 2, 1, t.skinDark);
    px(armR, armY + 4 - swingR, 2, 1, t.skinDark);
    px(armL, armY - swingL, 2, 1, t.shirtDark);
    px(armR, armY - swingR, 2, 1, t.shirtDark);
  }

  // Cabeza ladeada, con ojos que brillan y boca abierta.
  const headX = cx - Math.floor(t.headW / 2) + tilt;
  px(headX, headTop, t.headW, t.headH, t.skin);
  px(headX, headTop + t.headH - 1, t.headW, 1, t.skinDark);
  px(headX + t.headW - 1, headTop + 1, 1, t.headH - 2, t.skinDark);
  if (t.hood) {
    px(headX - 1, headTop - 1, t.headW + 2, 2, t.shirt);
    px(headX - 1, headTop, 1, t.headH, t.shirt);
    px(headX + t.headW, headTop, 1, t.headH, t.shirt);
  } else {
    px(headX, headTop - 1, t.headW, 1, t.hair);
    px(headX + 1, headTop - 2, 2, 1, t.hair);
    px(headX + t.headW - 3, headTop - 2, 1, 1, t.hair);
  }
  const eyeY = headTop + 2;
  px(headX + 1, eyeY, 2, 1, '#120808');
  px(headX + t.headW - 3, eyeY, 2, 1, '#120808');
  px(headX + 1, eyeY, 1, 1, t.eyes);
  px(headX + t.headW - 2, eyeY, 1, 1, t.eyes);
  const open = t.bigMouth ? 3 : frame === ZOMBIE_FRAMES.windup || frame === ZOMBIE_FRAMES.strike ? 2 : 1;
  px(headX + 2, headTop + t.headH - 2 - (open - 1), t.headW - 4, open, '#2a0606');
  px(headX + 2, headTop + t.headH - 2 - (open - 1), 1, 1, '#e8e0c8');
  px(headX + t.headW - 3, headTop + t.headH - 2 - (open - 1), 1, 1, '#e8e0c8');
  px(headX + t.headW - 2, headTop + 3, 1, 2, t.blood);
  if (t.blindfold) {
    px(headX - 1, eyeY - 1, t.headW + 2, 3, '#d8d0c0');
    px(headX + t.headW, eyeY, 2, 1, '#d8d0c0');
  }
  if (t.fuse) {
    px(cx, headTop - 4, 1, 3, '#3a2a18');
    px(cx, headTop - 5, 1, 1, '#ffd23a');
    px(cx + 1, headTop - 6, 1, 1, '#ff6a1a');
  }
}

/** Crea (una vez) la hoja de un tipo con su contorno y la registra con sus cuadros. */
function bakeSheet(scene, key, t) {
  if (scene.textures.exists(key)) return;
  const cellW = t.w + 2;
  const cellH = t.h + 2 + 8; // espacio arriba para los brazos levantados
  const small = document.createElement('canvas');
  small.width = cellW * FRAME_COUNT;
  small.height = cellH;
  const sctx = small.getContext('2d');
  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    sctx.save();
    sctx.translate(1, 9);
    drawFrame(sctx, frame * cellW, t, frame);
    sctx.restore();
  }

  // Contorno: la silueta en oscuro corrida un pixel a cada lado, debajo del dibujo.
  const outline = document.createElement('canvas');
  outline.width = small.width;
  outline.height = small.height;
  const octx = outline.getContext('2d');
  [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => octx.drawImage(small, dx, dy));
  octx.globalCompositeOperation = 'source-in';
  octx.fillStyle = '#0d0608';
  octx.fillRect(0, 0, outline.width, outline.height);
  octx.globalCompositeOperation = 'source-over';
  octx.drawImage(small, 0, 0);

  const texture = scene.textures.createCanvas(key, outline.width * SCALE, outline.height * SCALE);
  const ctx = texture.context;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(outline, 0, 0, outline.width * SCALE, outline.height * SCALE);
  texture.refresh();
  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    texture.add(frame, 0, frame * cellW * SCALE, 0, cellW * SCALE, cellH * SCALE);
  }
}

export function bakeZombieSheets(scene) {
  Object.entries(TYPES).forEach(([key, type]) => bakeSheet(scene, key, type));
}
