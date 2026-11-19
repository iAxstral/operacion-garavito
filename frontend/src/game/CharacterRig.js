import Phaser from 'phaser';

// Personaje dibujado en 16 direcciones (cada 22,5°), cuerpo completo: mira hacia donde
// apunta y camina con los pasos ligados a la distancia recorrida. Es solo lo que se
// ve: el sprite con fisica del jugador sigue igual (mismas texturas, mismo cuerpo de
// colision) pero no se dibuja, y este rig copia cada cuadro su posicion, visibilidad,
// transparencia, tinte y si esta tirado en el piso.
//
// Atlas y poses: public/characters/<nombre>/ (scripts/build_characters_16dir.py). Cada
// pose es [cuadro, espejo]: el script ya corrigio las que el paquete traia mirando al
// lado contrario. Direccion d = 0..15, angulo = d * 22,5°, 0 = derecha y en sentido
// horario (y crece hacia abajo). Pies en (ancho/2, footY) de cada celda.
//
// Gorro de Santa: el atlas trae un gorro (hat_*) hecho para cada direccion y cuadro, y
// cada pose dice cual usar y donde queda la punta: [cuadro, espejo, gorro, espejoGorro,
// puntaX, puntaY]. El pompon es aparte y cuelga de la punta con un resorte.

const TAU = Math.PI * 2;
const SECTORS = 16;
const SECTOR = TAU / SECTORS;
const wrap = (a) => ((a % TAU) + TAU) % TAU;
const angDiff = (from, to) => {
  const d = wrap(to - from);
  return d > Math.PI ? d - TAU : d;
};

/** Personaje de 16 direcciones de cada spritePrefix del catalogo de roles. */
export const RIG_CHARACTER = {
  seguridad: 'seguridad',
  biomedica: 'cientifica',
  economia: 'economia',
  infraestructura: 'infraestructura',
};

const textureKey = (character) => `rig_${character}`;
const animsKey = (character) => `rig_${character}_anims`;
// Subirlo al regenerar el atlas o los *_anims.json: el navegador no reusa una copia vieja.
const POSES_VERSION = 4;
const POMPOM_KEY = 'rig_pompom';

export function preloadCharacterRigs(scene) {
  Object.values(RIG_CHARACTER).forEach((character) => {
    const path = `/characters/${character}/${character}`;
    if (!scene.textures.exists(textureKey(character))) {
      scene.load.atlas(textureKey(character), `${path}.png?v=${POSES_VERSION}`, `${path}.json?v=${POSES_VERSION}`);
    }
    if (!scene.cache.json.exists(animsKey(character))) {
      scene.load.json(animsKey(character), `${path}_anims.json?v=${POSES_VERSION}`);
    }
  });
}

const OPTIONS = {
  // px recorridos por ciclo de caminata (4 cuadros): los pies no patinan a ninguna velocidad.
  strideLength: 56,
  // Por debajo de esta velocidad (px/s) se queda quieto.
  minWalkSpeed: 8,
  // Suavizado del apuntado (1/s) antes de elegir la direccion.
  turnSpeed: 18,
  // Al girar, el cuerpo avanza de a una direccion (22,5°) cada esto: siempre pasa por
  // todas las poses intermedias, aunque el mouse salte al otro lado. El arma no espera.
  turnStepMs: 24,
  // Fraccion de sector extra antes de cambiar de pose (evita parpadeo en el borde).
  hysteresis: 0.12,
  // Caminando a mas de este angulo de hacia donde mira, los pasos van hacia atras.
  backpedalDeg: 110,
  dashGhostEveryMs: 22,
  dashGhostLifeMs: 260,
  dashTint: 0x9fd8ff,
  // Fases del dash: anticipacion al inicio y recuperacion al final (ms).
  dashWindupMs: 40,
  dashRecoverMs: 70,
  // Polvo al pisar solo corriendo (caminando ensucia la pantalla).
  dustMinSpeed: 185,
  // Resorte del pompon: reacciona a la aceleracion del cuerpo y al rebote de los pasos.
  pomStiffness: 260,
  pomDamping: 13,
  pomMax: 4,
};

// Pompon blanco esponjoso de 13x13 (pixel art).
function bakePompom(scene) {
  if (scene.textures.exists(POMPOM_KEY)) return;
  const rows = ['....0.0.0....', '...0101010...', '..011411110..', '.01441111120.', '0114111111120', '.11111121122.', '0111111111220', '.11112112222.', '0111111122230', '.01121122230.', '..022222330..', '...0303030...', '....0.0.0....'];
  const palette = { 0: 0x1e0c14, 1: 0xf0f2f4, 2: 0xd6dee6, 3: 0xb2bece, 4: 0xffffff };
  const g = scene.make.graphics({ add: false });
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (palette[c] === undefined) return;
    g.fillStyle(palette[c]);
    g.fillRect(x, y, 1, 1);
  }));
  g.generateTexture(POMPOM_KEY, 13, 13);
  g.destroy();
}

// Mitad del largo del cuerpo tirado en el piso (para centrarlo donde estaba).
const LYING_HALF = 56;

export default class CharacterRig {
  /**
   * @param {Phaser.Scene} scene
   * @param {string} spritePrefix  el de roleCatalog (seguridad, biomedica, ...)
   */
  constructor(scene, spritePrefix, x = 0, y = 0) {
    this.scene = scene;
    this.character = RIG_CHARACTER[spritePrefix] ?? 'seguridad';
    this.texture = textureKey(this.character);
    this.data = scene.cache.json.get(animsKey(this.character));
    this.footY = this.data.footY;

    this.aimVisual = null;
    this.dir = null;
    this.walkPhase = 0;
    this.idleT = 0;
    this.lastStep = -1;
    this.dashT = 0;
    this.dashDur = 0;
    this.dashDir = 0;
    this.ghostT = 0;
    this.ghosts = [];
    this.head = { x: 0, top: -this.footY, flip: false };
    this.feet = { x, y };

    const [name] = this.pose(4, 'idle', 0);
    this.body = scene.add.image(0, 0, this.texture, name).setOrigin(0.5, this.footY / this.data.cell[1]);
    const parts = [this.body];

    // Gorro de Santa sincronizado con la pose (solo si el atlas lo trae).
    this.hasHat = Boolean(this.data.hatPad != null && this.pose(4, 'idle', 0)[2]);
    this.hatOn = this.hasHat;
    this.pomOff = { x: 0, y: 0 };
    this.pomVel = { x: 0, y: 0 };
    this.prevVel = { x: 0, y: 0 };
    this.prevBob = 0;
    if (this.hasHat) {
      const pad = this.data.hatPad;
      bakePompom(scene);
      this.hat = scene.add.image(0, 0, this.texture, this.pose(4, 'idle', 0)[2])
        .setOrigin(0.5, (this.footY + pad) / (this.data.cell[1] + pad));
      this.pom = scene.add.image(0, 0, POMPOM_KEY);
      parts.push(this.hat, this.pom);
    }
    this.root = scene.add.container(x, y, parts).setDepth(y);
  }

  /** Pone o saca el gorro de Santa (p. ej. si lleva un disfraz en la cabeza). */
  setHat(on) {
    const want = this.hasHat && Boolean(on);
    if (want === this.hatOn) return;
    this.hatOn = want;
    this.hat?.setVisible(want);
    this.pom?.setVisible(want);
  }

  get depth() {
    return this.root.depth;
  }

  get isDashing() {
    return this.dashT > 0;
  }

  pose(dir, anim, index) {
    const list = this.data.poses[String(dir)][anim];
    return list[((index % list.length) + list.length) % list.length];
  }

  // Pone un cuadro [nombre, espejo, gorro...] y guarda donde quedo la cabeza (para el disfraz).
  show(pose, y = 0) {
    const [name, mirrored] = pose;
    const flip = Boolean(mirrored);
    this.body.setFrame(name).setFlipX(flip).setY(y);
    this.hatPose = pose;
    this.hatY = y;
    const anchor = this.data.head?.[name];
    this.head.x = anchor ? (flip ? -anchor[0] : anchor[0]) : 0;
    this.head.top = y + (anchor ? anchor[1] : -this.footY);
    return name;
  }

  /** Empieza la animacion del dash hacia `angle` (la fisica del dash es la del juego). */
  dash(angle, durationMs) {
    this.dashDur = Math.max(90, durationMs) / 1000;
    this.dashT = this.dashDur;
    this.dashDir = Math.round(wrap(angle) / SECTOR) % SECTORS;
    this.ghostT = 0;
    this.burst(angle);
  }

  quantize(angle, current) {
    const idx = Math.round(wrap(angle) / SECTOR) % SECTORS;
    if (current == null) return idx;
    if (Math.abs(angDiff(current * SECTOR, angle)) < SECTOR * (0.5 + OPTIONS.hysteresis)) return current;
    return idx;
  }

  /**
   * Un cuadro. `host` es el sprite con fisica (o el del compañero remoto).
   * @param {number} dtMs
   * @param {object} p  x, y = pies; vx, vy = velocidad (px/s); aim = angulo de apuntado.
   */
  update(dtMs, host, { x, y, vx, vy, aim }) {
    const dt = Math.min(dtMs / 1000, 0.05);
    const visible = host.visible;
    this.root.setVisible(visible);
    this.root.setAlpha(host.alpha);
    this.applyTint(host);
    this.feet.x = x;
    this.feet.y = y;
    this.updateGhosts();
    if (!visible) return;

    // Tirado en el piso (caido o espectando): el cuerpo quieto acostado donde estaba.
    if (Math.abs(host.angle) > 45) {
      this.dashT = 0;
      this.show(this.pose(this.dir ?? 4, 'idle', 0));
      this.head.flip = false;
      this.placeHat(dt, 0, 0);
      this.root.setAngle(90).setPosition(Math.round(host.x - LYING_HALF), Math.round(host.y + 6)).setDepth(y);
      return;
    }
    this.root.setAngle(0);

    if (this.aimVisual == null) this.aimVisual = wrap(aim);
    if (this.isDashing) this.updateDash(dt);
    else this.updateWalk(dt, vx, vy, aim);
    this.placeHat(dt, vx, vy);
    this.root.setPosition(Math.round(x), Math.round(y)).setDepth(y);
  }

  applyTint(host) {
    const tint = host.tintTopLeft ?? 0xffffff;
    if (tint === this.lastTint) return;
    this.lastTint = tint;
    [this.body, this.hat, this.pom].forEach((part) => {
      if (!part) return;
      if (tint === 0xffffff) part.clearTint();
      else part.setTint(tint);
    });
  }

  // Gorro del cuadro que se esta dibujando y pompon con resorte colgando de su punta.
  placeHat(dt, vx, vy) {
    if (!this.hatOn || !this.hatPose?.[2]) return;
    const [, , frame, flip, tipX, tipY] = this.hatPose;
    const bob = this.hatY ?? 0;
    this.hat.setFrame(frame).setFlipX(Boolean(flip)).setY(bob);
    const o = OPTIONS;
    const step = Math.max(dt, 1e-3);
    const ax = (vx - this.prevVel.x) / step;
    const ay = (vy - this.prevVel.y) / step;
    const bobKick = (bob - this.prevBob) / step;
    this.prevVel.x = vx;
    this.prevVel.y = vy;
    this.prevBob = bob;
    const fx = -o.pomStiffness * this.pomOff.x - o.pomDamping * this.pomVel.x - ax * 0.012;
    const fy = -o.pomStiffness * this.pomOff.y - o.pomDamping * this.pomVel.y - ay * 0.008 - bobKick * 0.5;
    this.pomVel.x += fx * dt;
    this.pomVel.y += fy * dt;
    this.pomOff.x += this.pomVel.x * dt;
    this.pomOff.y += this.pomVel.y * dt;
    const len = Math.hypot(this.pomOff.x, this.pomOff.y);
    if (len > o.pomMax) {
      this.pomOff.x *= o.pomMax / len;
      this.pomOff.y *= o.pomMax / len;
    }
    this.pom.setPosition(Math.round(tipX + this.pomOff.x), Math.round(tipY + bob + this.pomOff.y));
  }

  updateWalk(dt, vx, vy, aim) {
    const o = OPTIONS;
    const speed = Math.hypot(vx, vy);
    const moving = speed > o.minWalkSpeed;

    // Apuntado suavizado por el camino corto: gira pasando por las poses intermedias.
    this.aimVisual = wrap(this.aimVisual + angDiff(this.aimVisual, aim) * (1 - Math.exp(-o.turnSpeed * dt)));
    this.turnTowards(this.quantize(this.aimVisual, this.targetDir ?? this.dir), dt);
    this.head.flip = Math.cos(this.dir * SECTOR) < -0.2;

    if (moving) {
      const backwards = Math.abs(angDiff(this.aimVisual, Math.atan2(vy, vx))) > (o.backpedalDeg * Math.PI) / 180;
      this.walkPhase += ((speed * dt) / o.strideLength) * (backwards ? -1 : 1);
      this.idleT = 0;
      const step = Math.floor((((this.walkPhase % 1) + 1) % 1) * 4);
      // Cuadros 1 y 3 son el paso de pasada: el cuerpo sube 1 px.
      this.show(this.pose(this.dir, 'walk', step), step % 2 === 1 ? -1 : 0);
      if (step % 2 === 0 && step !== this.lastStep && speed >= o.dustMinSpeed) this.dust(vx);
      this.lastStep = step;
    } else {
      // Quieto respira (1 px) y la proxima caminata empieza con el pie adelante.
      this.idleT += dt;
      this.walkPhase = 0;
      this.show(this.pose(this.dir, 'idle', 0), Math.sin(this.idleT * 2.6) > 0.6 ? 1 : 0);
      this.lastStep = -1;
    }
  }

  // Gira la pose de a un paso de 22,5° por el camino corto hasta `target`.
  turnTowards(target, dt) {
    this.targetDir = target;
    if (this.dir == null) {
      this.dir = target;
      this.turnT = 0;
      return;
    }
    if (this.dir === target) {
      this.turnT = 0;
      return;
    }
    this.turnT = (this.turnT ?? 0) - dt * 1000;
    if (this.turnT > 0) return;
    const delta = ((target - this.dir + SECTORS + SECTORS / 2) % SECTORS) - SECTORS / 2;
    this.dir = (this.dir + Math.sign(delta || 1) + SECTORS) % SECTORS;
    this.turnT = OPTIONS.turnStepMs;
  }

  updateDash(dt) {
    const o = OPTIONS;
    this.dashT = Math.max(0, this.dashT - dt);
    const elapsed = (this.dashDur - this.dashT) * 1000;
    const remaining = this.dashT * 1000;
    // anticipacion → impulso → recuperacion
    const phase = elapsed < o.dashWindupMs ? 0 : (remaining < o.dashRecoverMs ? 2 : 1);
    const frame = this.pose(this.dashDir, 'dash', phase);
    this.show(frame);
    this.head.flip = Math.cos(this.dashDir * SECTOR) < -0.2;

    this.ghostT -= dt * 1000;
    if (this.ghostT <= 0 && phase > 0) {
      this.ghostT = o.dashGhostEveryMs;
      const ghost = this.scene.add.image(Math.round(this.feet.x), Math.round(this.feet.y), this.texture, frame[0])
        .setOrigin(this.body.originX, this.body.originY)
        .setFlipX(Boolean(frame[1]))
        .setTint(o.dashTint)
        .setTintMode(Phaser.TintModes.FILL)
        .setAlpha(0.45 * this.root.alpha);
      ghost.footY = this.feet.y;
      this.ghosts.push(ghost);
      this.updateGhosts();
      this.scene.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: o.dashGhostLifeMs,
        onComplete: () => {
          ghost.destroy();
          this.ghosts.splice(this.ghosts.indexOf(ghost), 1);
        },
      });
    }
    if (this.dashT === 0) {
      // Al salir del dash vuelve a girar hacia el apuntado desde la direccion del dash.
      this.aimVisual = this.dashDir * SECTOR;
      this.dir = this.dashDir;
      this.targetDir = this.dashDir;
      this.turnT = 0;
    }
  }

  // La estela siempre detras del personaje, tambien en los dash hacia arriba.
  updateGhosts() {
    this.ghosts.forEach((ghost) => ghost.setDepth(Math.min(ghost.footY, this.feet.y) - 0.5));
  }

  /**
   * Punto del mundo `below` px por debajo de la coronilla, centrado en la cabeza.
   * Sigue la pose de cada direccion y el cuerpo acostado.
   */
  headPoint(below) {
    const lx = this.head.x;
    const ly = this.head.top + below;
    const r = this.root.rotation;
    return {
      x: this.root.x + lx * Math.cos(r) - ly * Math.sin(r),
      y: this.root.y + lx * Math.sin(r) + ly * Math.cos(r),
      flip: this.head.flip,
      angle: this.root.angle,
    };
  }

  // Nube de polvo hacia atras al arrancar el dash.
  burst(angle) {
    const { x, y } = this.feet;
    for (let i = 0; i < 8; i += 1) {
      const a = angle + Math.PI + (Math.random() - 0.5) * 1.6;
      const p = this.scene.add.rectangle(x, y - 2, 3, 3, 0xd8ccb2, 0.85).setDepth(y - 1);
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(a) * (14 + Math.random() * 16),
        y: y - 2 + Math.sin(a) * 8 - 4,
        alpha: 0,
        scale: 2.2,
        duration: 260 + Math.random() * 120,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  dust(vx) {
    const { x, y } = this.feet;
    const p = this.scene.add.rectangle(x + (Math.random() * 10 - 5), y - 1, 3, 3, 0xcbbfa6, 0.6).setDepth(y - 1);
    this.scene.tweens.add({
      targets: p, y: p.y - 5, x: p.x - vx * 0.04, alpha: 0, scale: 2, duration: 320, onComplete: () => p.destroy(),
    });
  }

  destroy() {
    this.ghosts.forEach((ghost) => ghost.destroy());
    this.ghosts = [];
    this.root.destroy();
  }
}

/** El sprite sigue existiendo (fisica, luz, camara) pero ya no se dibuja. */
export function hideHostSprite(sprite) {
  sprite.willRender = () => false;
  return sprite;
}

/** Distancia del centro del sprite viejo a los pies (constante por personaje). */
export function footOffsetFor(scene, spritePrefix) {
  const source = scene.textures.get(`${spritePrefix}_down`)?.getSourceImage();
  // Los pies del dibujo viejo quedaban 2 px por encima del borde de la textura.
  return source?.height ? source.height / 2 - 2 : 60;
}
