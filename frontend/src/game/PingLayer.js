// Marcas de los avisos del equipo en el mapa: un anillo que late donde estaba quien
// aviso, con el texto del aviso, y una flecha en el borde de la pantalla cuando la
// marca queda fuera de la vista. Solo se dibujan las del piso actual.

export const PING_COLORS = {
  ZOMBIES: 0xff3a2a,
  HELP: 0xff9a2a,
  REVIVE: 0x6dff7a,
  GO: 0x3fd8ff,
  AMMO: 0xffd23a,
};

const LIFETIME_MS = 6000;
const EDGE_MARGIN = 34;
const DEPTH = 5800;

export default class PingLayer {
  constructor(scene) {
    this.scene = scene;
    this.pings = [];
    this.arrows = scene.add.graphics().setDepth(DEPTH + 1);
  }

  add({ kind, x, y, label }) {
    const color = PING_COLORS[kind] ?? 0xffffff;
    const ring = this.scene.add.graphics().setDepth(DEPTH);
    const text = this.scene.add
      .text(x, y - 46, label, {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: 'rgba(10,4,6,0.8)',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH);
    this.pings.push({ kind, x, y, color, ring, text, born: this.scene.time.now });
  }

  update(time) {
    const camera = this.scene.cameras.main;
    this.arrows.clear();
    this.pings = this.pings.filter((ping) => {
      const age = time - ping.born;
      if (age > LIFETIME_MS) {
        ping.ring.destroy();
        ping.text.destroy();
        return false;
      }
      const fade = age > LIFETIME_MS - 800 ? (LIFETIME_MS - age) / 800 : 1;
      const pulse = (age % 900) / 900;
      ping.ring.clear();
      ping.ring.lineStyle(3, ping.color, 0.9 * fade);
      ping.ring.strokeCircle(ping.x, ping.y, 18);
      ping.ring.lineStyle(2, ping.color, (1 - pulse) * 0.8 * fade);
      ping.ring.strokeCircle(ping.x, ping.y, 18 + pulse * 46);
      ping.ring.fillStyle(ping.color, 0.25 * fade);
      ping.ring.fillCircle(ping.x, ping.y, 10);
      ping.text.setAlpha(fade);

      // Fuera de la vista: flecha en el borde, apuntando a la marca.
      const view = camera.worldView;
      if (!view.contains(ping.x, ping.y)) this.drawArrow(camera, ping, fade);
      return true;
    });
  }

  // Se dibuja en coordenadas del mundo (no de pantalla) para que el zoom del celular
  // no la descuadre: un punto cerca del borde de lo que muestra la camara.
  drawArrow(camera, ping, fade) {
    const view = camera.worldView;
    const zoom = camera.zoom || 1;
    const cx = view.centerX;
    const cy = view.centerY;
    const angle = Math.atan2(ping.y - cy, ping.x - cx);
    const halfW = view.width / 2 - EDGE_MARGIN / zoom;
    const halfH = view.height / 2 - EDGE_MARGIN / zoom;
    const reach = Math.min(halfW / Math.abs(Math.cos(angle) || 1e-6), halfH / Math.abs(Math.sin(angle) || 1e-6));
    const ax = cx + Math.cos(angle) * reach;
    const ay = cy + Math.sin(angle) * reach;
    const size = 14 / zoom;
    const tip = { x: ax + Math.cos(angle) * size, y: ay + Math.sin(angle) * size };
    const left = { x: ax + Math.cos(angle + 2.5) * size, y: ay + Math.sin(angle + 2.5) * size };
    const right = { x: ax + Math.cos(angle - 2.5) * size, y: ay + Math.sin(angle - 2.5) * size };
    this.arrows.fillStyle(ping.color, 0.95 * fade);
    this.arrows.fillTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
    this.arrows.lineStyle(2 / zoom, 0x000000, 0.7 * fade);
    this.arrows.strokeTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
  }

  destroy() {
    this.pings.forEach((ping) => {
      ping.ring.destroy();
      ping.text.destroy();
    });
    this.pings = [];
    this.arrows.destroy();
  }
}
