import Phaser from 'phaser';
import { playSample } from './audioBank';

// Cosas que asustan pero no hacen daño (solo en este cliente): murcielagos y fantasmas
// que salen de algunas habitaciones al azar, y sustos sueltos: las luces que fallan,
// un fantasma que cruza el pasillo frente al jugador o un portazo lejano.

const BAT_KEY = 'haunt_bat';
const GHOST_KEY = 'haunt_ghost';
const DEPTH = 5003; // encima de la oscuridad: se ven aunque no haya luz

// Cada cuanto sale algo de una habitacion, y cada cuanto un susto suelto (ms).
const ROOM_EVERY = [9000, 20000];
const SCARE_EVERY = [40000, 80000];
// Fraccion de habitaciones "embrujadas" (las demas nunca sueltan nada).
const HAUNTED_SHARE = 0.6;

function between([min, max]) {
  return min + Math.random() * (max - min);
}

function bakeTextures(scene) {
  if (!scene.textures.exists(BAT_KEY)) {
    // Dos cuadros: alas arriba y alas abajo.
    const texture = scene.textures.createCanvas(BAT_KEY, 64, 24);
    const ctx = texture.context;
    ctx.fillStyle = '#0c0608';
    [0, 1].forEach((frame) => {
      const ox = frame * 32;
      const wingY = frame === 0 ? 2 : 16;
      ctx.beginPath();
      ctx.moveTo(ox + 16, 12);
      ctx.lineTo(ox + 2, wingY);
      ctx.lineTo(ox + 7, 13);
      ctx.lineTo(ox + 4, 18);
      ctx.lineTo(ox + 13, 15);
      ctx.lineTo(ox + 16, 19);
      ctx.lineTo(ox + 19, 15);
      ctx.lineTo(ox + 28, 18);
      ctx.lineTo(ox + 25, 13);
      ctx.lineTo(ox + 30, wingY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff3b1f';
      ctx.fillRect(ox + 14, 11, 1, 1);
      ctx.fillRect(ox + 17, 11, 1, 1);
      ctx.fillStyle = '#0c0608';
    });
    texture.refresh();
    texture.add(0, 0, 0, 0, 32, 24);
    texture.add(1, 0, 32, 0, 32, 24);
  }
  if (!scene.textures.exists(GHOST_KEY)) {
    // Sabana blanca con ojos huecos y borde ondulado.
    const texture = scene.textures.createCanvas(GHOST_KEY, 48, 60);
    const ctx = texture.context;
    const g = ctx.createLinearGradient(0, 0, 0, 60);
    g.addColorStop(0, 'rgba(235,240,255,0.95)');
    g.addColorStop(1, 'rgba(200,210,255,0.15)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(4, 56);
    ctx.lineTo(4, 22);
    ctx.quadraticCurveTo(4, 2, 24, 2);
    ctx.quadraticCurveTo(44, 2, 44, 22);
    ctx.lineTo(44, 56);
    for (let x = 44; x > 4; x -= 8) {
      ctx.quadraticCurveTo(x - 2, 50, x - 4, 56);
      ctx.quadraticCurveTo(x - 6, 60, x - 8, 56);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#120a14';
    [[17, 22, 4, 6], [31, 22, 4, 6], [24, 36, 3, 5]].forEach(([x, y, rx, ry]) => {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    texture.refresh();
  }
}

export default class HauntLayer {
  /**
   * `rooms`: puntos dentro de las habitaciones de este piso ({ x, y }).
   * `getListener()`: { x, y } del jugador (para los sustos cerca de el).
   * `doors`: puertas del piso ({ x, y }) para el portazo lejano.
   */
  constructor(scene, { rooms, floor, lighting, getListener, doors = [], enabled = () => true }) {
    this.scene = scene;
    this.floor = floor;
    this.lighting = lighting;
    this.getListener = getListener;
    this.doors = doors;
    this.enabled = enabled;
    this.rooms = rooms.filter(() => Math.random() < HAUNTED_SHARE);
    if (!this.rooms.length && rooms.length) this.rooms = [rooms[0]];
    this.nextRoomAt = scene.time.now + between(ROOM_EVERY);
    this.nextScareAt = scene.time.now + between(SCARE_EVERY);
    bakeTextures(scene);
  }

  update(time) {
    if (!this.enabled()) return;
    if (time >= this.nextRoomAt && this.rooms.length) {
      this.nextRoomAt = time + between(ROOM_EVERY);
      const room = this.rooms[Math.floor(Math.random() * this.rooms.length)];
      if (Math.random() < 0.6) this.batSwarm(room);
      else this.ghostFrom(room);
    }
    if (time >= this.nextScareAt) {
      this.nextScareAt = time + between(SCARE_EVERY);
      const roll = Math.random();
      if (roll < 0.4) this.lightsFail();
      else if (roll < 0.75) this.ghostCrossing();
      else this.distantSlam();
    }
  }

  at(x, y) {
    return { x, y, floor: this.floor };
  }

  // Bandada de murcielagos que sale de una habitacion hacia un lado, chillando.
  batSwarm(room) {
    const count = 3 + Math.floor(Math.random() * 4);
    const heading = Math.random() * Math.PI * 2;
    playSample('bat', { channel: 'ambient', volume: 0.9, variance: 0.15, at: this.at(room.x, room.y) });
    for (let i = 0; i < count; i += 1) {
      const bat = this.scene.add.sprite(room.x, room.y, BAT_KEY, 0).setDepth(DEPTH).setScale(0.8 + Math.random() * 0.6);
      const flap = this.scene.time.addEvent({ delay: 90 + Math.random() * 40, loop: true, callback: () => bat.setFrame(bat.frame.name === 0 ? 1 : 0) });
      const angle = heading + (Math.random() - 0.5) * 1.2;
      const distance = 500 + Math.random() * 400;
      const midX = room.x + Math.cos(angle) * distance * 0.5 + (Math.random() - 0.5) * 160;
      const midY = room.y + Math.sin(angle) * distance * 0.5 + (Math.random() - 0.5) * 160;
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(room.x, room.y),
        new Phaser.Math.Vector2(midX, midY),
        new Phaser.Math.Vector2(room.x + Math.cos(angle) * distance, room.y + Math.sin(angle) * distance),
      );
      const follower = { t: 0 };
      this.scene.tweens.add({
        targets: follower,
        t: 1,
        delay: i * 90,
        duration: 1600 + Math.random() * 900,
        ease: 'Sine.easeIn',
        onUpdate: () => {
          const point = curve.getPoint(follower.t);
          bat.setPosition(point.x, point.y).setAlpha(follower.t > 0.8 ? (1 - follower.t) * 5 : 1);
        },
        onComplete: () => {
          flap.remove();
          bat.destroy();
        },
      });
      if (i === Math.floor(count / 2)) {
        this.scene.time.delayedCall(500, () => playSample('bat', { channel: 'ambient', volume: 0.7, variance: 0.2, at: this.at(midX, midY) }));
      }
    }
  }

  // Fantasma que se asoma por una habitacion, flota un poco y se desvanece gimiendo.
  ghostFrom(room) {
    const ghost = this.scene.add.image(room.x, room.y + 20, GHOST_KEY)
      .setDepth(DEPTH)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.SCREEN);
    playSample('ghost', { channel: 'ambient', volume: 0.75, at: this.at(room.x, room.y) });
    const driftX = (Math.random() - 0.5) * 260;
    this.scene.tweens.add({ targets: ghost, alpha: 0.75, duration: 700 });
    this.scene.tweens.add({ targets: ghost, x: room.x + driftX, y: room.y - 60, duration: 3200, ease: 'Sine.easeInOut' });
    this.scene.tweens.add({ targets: ghost, angle: { from: -6, to: 6 }, duration: 600, yoyo: true, repeat: 4 });
    this.scene.tweens.add({ targets: ghost, alpha: 0, delay: 2400, duration: 900, onComplete: () => ghost.destroy() });
  }

  // Susto: un fantasma cruza rapido el pasillo frente al jugador.
  ghostCrossing() {
    const me = this.getListener();
    if (!me) return;
    const fromLeft = Math.random() < 0.5;
    const y = me.y - 60 + Math.random() * 120;
    const startX = me.x + (fromLeft ? -520 : 520);
    const ghost = this.scene.add.image(startX, y, GHOST_KEY)
      .setDepth(DEPTH)
      .setAlpha(0.65)
      .setFlipX(!fromLeft)
      .setBlendMode(Phaser.BlendModes.SCREEN);
    playSample('ghost', { channel: 'ambient', volume: 1, rate: 1.2, at: this.at(me.x + (fromLeft ? -150 : 150), y) });
    this.scene.tweens.add({
      targets: ghost,
      x: me.x + (fromLeft ? 520 : -520),
      duration: 1300,
      ease: 'Quad.easeIn',
      onComplete: () => ghost.destroy(),
    });
  }

  // Susto: las luces fallan un par de segundos.
  lightsFail() {
    this.lighting?.failLights?.(1800 + Math.random() * 1200);
    const me = this.getListener();
    if (me) playSample('creak', { channel: 'ambient', volume: 0.5, rate: 0.7, at: this.at(me.x + 300, me.y) });
  }

  // Susto: un portazo en una puerta lejana del piso.
  distantSlam() {
    const me = this.getListener();
    if (!me || !this.doors.length) return;
    // Lejos pero al alcance del oido (el sonido se apaga del todo a ~1100 px).
    const distance = (door) => Math.hypot(door.x - me.x, door.y - me.y);
    const far = [...this.doors].sort((a, b) => Math.abs(distance(a) - 750) - Math.abs(distance(b) - 750))[0];
    playSample('doorClose', { channel: 'ambient', volume: 1, rate: 0.85, at: this.at(far.x, far.y) });
  }
}
