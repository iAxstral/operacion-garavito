import Phaser from 'phaser';
import { BOLA_BARRO, BOLA_NIEVE, DUENDE, RENO, bakePixelArt } from './travesurasArt';
import { mudSplat, snowBlind } from './screenFx';
import { playSfx } from './sfx';

/**
 * Dibuja las travesuras de Navidad que manda el servidor (ver Travesuras.java):
 * duendes y renos que salen de una nube de nieve, tiran y se esfuman; sus bolas en el
 * aire; y, si la bola le pego a este jugador, el efecto en su pantalla (ceguera blanca
 * o barro). Como el resto de capas, no decide nada: solo sigue al estado.
 */

const TEXTURES = { DUENDE: 'xm_duende', RENO: 'xm_reno' };
const BALL_TEXTURES = { DUENDE: 'xm_bola_nieve', RENO: 'xm_bola_barro' };
const SCALE = { DUENDE: 3, RENO: 3.2 };
const BALL_SCALE = 3;
const LERP_PER_SECOND = 18;
const TAUNTS = { DUENDE: ['¡Jijiji!', '¡Toma!', '¡Feliz Navidad!'], RENO: ['¡Brrr!', '¡Grrr!'] };
/** Golpes ya mostrados (el servidor los repite unos ticks por si se pierde un mensaje). */
const SEEN_TTL_MS = 3000;

export default class TravesurasLayer {
  constructor(scene) {
    this.scene = scene;
    this.creatures = new Map();
    this.balls = new Map();
    this.seenHits = new Map();
    bakePixelArt(scene, TEXTURES.DUENDE, DUENDE);
    bakePixelArt(scene, TEXTURES.RENO, RENO);
    bakePixelArt(scene, BALL_TEXTURES.DUENDE, BOLA_NIEVE);
    bakePixelArt(scene, BALL_TEXTURES.RENO, BOLA_BARRO);
  }

  /**
   * @param state  { bromistas, bolas, golpes } del servidor (o null)
   * @param floor  piso que se esta mirando
   * @param myId   playerId de este jugador (los golpes a el se ven en su pantalla)
   * @param delta  ms desde el cuadro anterior
   */
  sync(state, floor, myId, delta) {
    const now = this.scene.time.now;
    const bromistas = (state?.bromistas ?? []).filter((b) => b.floor === floor);
    const bolas = (state?.bolas ?? []).filter((b) => b.floor === floor);

    const seen = new Set();
    bromistas.forEach((b) => {
      seen.add(b.id);
      let entry = this.creatures.get(b.id);
      if (!entry) {
        entry = this.spawnCreature(b);
        this.creatures.set(b.id, entry);
      }
      if (b.tiro && !entry.threw) {
        entry.threw = true;
        this.throwPose(entry, b);
      }
    });
    this.creatures.forEach((entry, id) => {
      if (!seen.has(id)) {
        this.vanish(entry);
        this.creatures.delete(id);
      }
    });

    const flying = new Set();
    const t = Math.min(1, (delta / 1000) * LERP_PER_SECOND);
    bolas.forEach((b) => {
      flying.add(b.id);
      let ball = this.balls.get(b.id);
      if (!ball) {
        ball = this.scene.add
          .image(b.x, b.y - 28, BALL_TEXTURES[b.tipo] ?? BALL_TEXTURES.DUENDE)
          .setScale(BALL_SCALE)
          .setDepth(b.y + 40);
        ball.tipo = b.tipo;
        this.balls.set(b.id, ball);
      }
      // La bola va algo por encima del suelo (se tira desde la mano) y gira en el aire.
      ball.x += (b.x - ball.x) * t;
      ball.y += (b.y - 28 - ball.y) * t;
      ball.rotation += delta * 0.012;
      ball.setDepth(b.y + 40);
    });
    this.balls.forEach((ball, id) => {
      if (!flying.has(id)) {
        this.burst(ball.x, ball.y, ball.tipo);
        ball.destroy();
        this.balls.delete(id);
      }
    });

    (state?.golpes ?? []).forEach((golpe) => {
      if (this.seenHits.has(golpe.id)) return;
      this.seenHits.set(golpe.id, now);
      if (golpe.playerId === myId) {
        if (golpe.tipo === 'RENO') {
          mudSplat();
          playSfx('splash', 1.4);
        } else {
          snowBlind();
          playSfx('splash');
        }
      }
    });
    this.seenHits.forEach((at, id) => {
      if (now - at > SEEN_TTL_MS) this.seenHits.delete(id);
    });
  }

  spawnCreature(b) {
    const scale = SCALE[b.tipo] ?? 3;
    const sprite = this.scene.add
      .image(b.x, b.y, TEXTURES[b.tipo] ?? TEXTURES.DUENDE)
      .setOrigin(0.5, 1)
      .setScale(scale * 0.2, scale * 1.4)
      .setAlpha(0)
      .setDepth(b.y);
    // El reno esta dibujado mirando a la izquierda: se voltea si su victima esta a la derecha.
    const facesRight = Math.cos(b.angle) > 0;
    sprite.setFlipX(b.tipo === 'RENO' ? facesRight : !facesRight);
    this.scene.tweens.add({
      targets: sprite,
      scaleX: scale,
      scaleY: scale,
      alpha: 1,
      duration: 240,
      ease: 'Back.easeOut',
    });
    this.puff(b.x, b.y - 20, 14);
    // Aviso: un "!" sobre la cabeza mientras se prepara, para alcanzar a moverse.
    const warn = this.scene.add
      .text(b.x, b.y - sprite.height * scale - 14, '!', {
        fontFamily: 'sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#a3121c',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(b.y + 1);
    this.scene.tweens.add({ targets: warn, scale: 1.3, yoyo: true, repeat: 2, duration: 150 });
    playSfx('warn', 0.8);
    return { sprite, warn, tipo: b.tipo, threw: false, x: b.x, y: b.y };
  }

  throwPose(entry, b) {
    entry.warn?.destroy();
    entry.warn = null;
    this.scene.tweens.add({ targets: entry.sprite, angle: Math.cos(b.angle) > 0 ? 14 : -14, yoyo: true, duration: 120 });
    playSfx(b.tipo === 'RENO' ? 'spit' : 'swing', 0.8);
    const taunts = TAUNTS[b.tipo] ?? TAUNTS.DUENDE;
    const text = this.scene.add
      .text(entry.x, entry.y - entry.sprite.displayHeight - 10, taunts[Math.floor(Math.random() * taunts.length)], {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: b.tipo === 'RENO' ? '#ffd2a8' : '#c8ffd2',
        stroke: '#12090a',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(entry.y + 2);
    this.scene.tweens.add({ targets: text, y: text.y - 26, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }

  vanish(entry) {
    entry.warn?.destroy();
    this.puff(entry.x, entry.y - 20, 10);
    this.scene.tweens.add({
      targets: entry.sprite,
      scaleX: 0,
      scaleY: entry.sprite.scaleY * 1.5,
      alpha: 0,
      duration: 220,
      onComplete: () => entry.sprite.destroy(),
    });
  }

  /** Nube de nieve donde aparece o se va un bicho. */
  puff(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const flake = this.scene.add
        .circle(x, y, 3 + Math.random() * 4, 0xeef4ff, 0.9)
        .setDepth(y + 60);
      this.scene.tweens.add({
        targets: flake,
        x: x + Math.cos(angle) * (24 + Math.random() * 30),
        y: y + Math.sin(angle) * (16 + Math.random() * 22),
        alpha: 0,
        scale: 0.3,
        duration: 420 + Math.random() * 200,
        onComplete: () => flake.destroy(),
      });
    }
  }

  /** La bola se deshace al chocar (con una pared o con alguien). */
  burst(x, y, tipo) {
    const color = tipo === 'RENO' ? 0x4a2c16 : 0xf2f6ff;
    for (let i = 0; i < 9; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const bit = this.scene.add.circle(x, y, 2 + Math.random() * 3, color, 1).setDepth(y + 60);
      this.scene.tweens.add({
        targets: bit,
        x: x + Math.cos(angle) * Phaser.Math.Between(14, 34),
        y: y + Math.sin(angle) * Phaser.Math.Between(8, 22) + 10,
        alpha: 0,
        duration: 360,
        onComplete: () => bit.destroy(),
      });
    }
  }

  destroy() {
    this.creatures.forEach((entry) => {
      entry.sprite.destroy();
      entry.warn?.destroy();
    });
    this.balls.forEach((ball) => ball.destroy());
    this.creatures.clear();
    this.balls.clear();
  }
}
