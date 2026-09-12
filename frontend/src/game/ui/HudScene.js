import Phaser from 'phaser';

import { PLAYER } from '../entities/Player';

/**
 * HUD as its own scene, rendered on top of MainScene.
 *
 * Keeping it separate means it is never affected by the world camera's scroll
 * or zoom, and MainScene never has to remember to pin UI to the viewport.
 */

const PANEL = 0x11151c;
const ACCENT = 0xffd166;
const FONT = 'monospace';

export default class HudScene extends Phaser.Scene {
  constructor() {
    super('HudScene');
  }

  init(data) {
    this.bus = data.bus;
    this.gameState = data.gameState;
  }

  create() {
    const { width, height } = this.scale;
    this.main = this.scene.get('MainScene');

    this.healthBar = this.add.graphics();
    this.dashBar = this.add.graphics();

    this.add.text(16, 14, 'INTEGRIDAD', { fontFamily: FONT, fontSize: '10px', color: '#8b96a5' });

    this.garavitosText = this.add.text(width - 16, 16, '0 Garavitos', {
      fontFamily: FONT, fontSize: '16px', color: '#ffd166',
    }).setOrigin(1, 0);

    this.waveText = this.add.text(width / 2, 16, '', {
      fontFamily: FONT, fontSize: '15px', color: '#e6ebf2',
    }).setOrigin(0.5, 0);

    this.missionPanel = this.add.graphics();
    this.missionTitle = this.add.text(22, height - 74, '', {
      fontFamily: FONT, fontSize: '13px', color: '#ffd166',
    });
    this.missionBody = this.add.text(22, height - 56, '', {
      fontFamily: FONT, fontSize: '11px', color: '#c6cedb', wordWrap: { width: 300 },
    });

    this.hintText = this.add.text(width / 2, height - 28, '', {
      fontFamily: FONT, fontSize: '13px', color: '#0d1117',
      backgroundColor: '#ffd166', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setVisible(false);

    this.toast = this.add.text(width / 2, 120, '', {
      fontFamily: FONT, fontSize: '17px', color: '#ffffff',
      backgroundColor: '#1d6f42', padding: { x: 14, y: 8 }, align: 'center',
    }).setOrigin(0.5).setAlpha(0);

    this.deathOverlay = this.buildDeathOverlay(width, height);

    this.bindBus();
    this.renderMission(this.gameState.snapshot().mission);
    this.renderGaravitos(0);
    this.renderHealth(PLAYER.maxHealth);
  }

  buildDeathOverlay(width, height) {
    const container = this.add.container(0, 0).setVisible(false);
    const shade = this.add.rectangle(0, 0, width, height, 0x05070d, 0.82).setOrigin(0);
    const title = this.add.text(width / 2, height / 2 - 34, 'TE ALCANZARON', {
      fontFamily: FONT, fontSize: '30px', color: '#e05a5a',
    }).setOrigin(0.5);
    this.deathDetail = this.add.text(width / 2, height / 2 + 8, '', {
      fontFamily: FONT, fontSize: '13px', color: '#c6cedb',
    }).setOrigin(0.5);
    const retry = this.add.text(width / 2, height / 2 + 46, 'R para reintentar', {
      fontFamily: FONT, fontSize: '15px', color: '#ffd166',
    }).setOrigin(0.5);

    container.add([shade, title, this.deathDetail, retry]);
    return container;
  }

  bindBus() {
    this.bus.on('garavitos:changed', ({ garavitos }) => this.renderGaravitos(garavitos));
    this.bus.on('player:damaged', ({ health }) => this.renderHealth(health));
    this.bus.on('player:healed', ({ health }) => this.renderHealth(health));
    this.bus.on('mission:progress', (mission) => this.renderMission(mission));

    this.bus.on('mission:completed', ({ title }) => {
      this.showToast(`Misión completada\n${title}`, 0x1d6f42);
    });
    this.bus.on('weapon:unlocked', () => {
      this.showToast('Hacha desbloqueada\nReclámala en el puesto de seguridad', 0x8a6d1f);
    });
    this.bus.on('weapon:equipped', () => {
      this.showToast('Hacha equipada\nClick o J para atacar', 0x1d6f42);
    });

    this.bus.on('wave:cleared', ({ wave }) => {
      this.showToast(`Oleada ${wave} superada`, 0x2b5f8a);
    });

    this.bus.on('hint:show', ({ text }) => this.hintText.setText(text).setVisible(true));
    this.bus.on('hint:hide', () => this.hintText.setVisible(false));

    this.bus.on('player:died', () => {
      this.deathDetail.setText(`Llegaste a la oleada ${this.main.waveDirector.wave}`);
      this.deathOverlay.setVisible(true);
    });
    this.bus.on('game:restarted', () => {
      this.deathOverlay.setVisible(false);
      this.renderHealth(PLAYER.maxHealth);
    });
  }

  renderGaravitos(garavitos) {
    this.garavitosText.setText(`${garavitos} Garavito${garavitos === 1 ? '' : 's'}`);
    // A quick pop is the cheapest way to make the reward register.
    this.tweens.add({
      targets: this.garavitosText, scale: { from: 1.25, to: 1 }, duration: 200, ease: 'Back.easeOut',
    });
  }

  renderHealth(health) {
    const ratio = Phaser.Math.Clamp(health / PLAYER.maxHealth, 0, 1);
    const width = 200;

    this.healthBar.clear();
    this.healthBar.fillStyle(PANEL, 0.85);
    this.healthBar.fillRoundedRect(14, 26, width + 4, 18, 4);
    this.healthBar.fillStyle(ratio > 0.5 ? 0x4fae6a : ratio > 0.25 ? 0xd8a23c : 0xd85050, 1);
    this.healthBar.fillRoundedRect(16, 28, Math.max(0, width * ratio), 14, 3);
  }

  renderMission(mission) {
    this.missionPanel.clear();
    if (!mission) {
      this.missionTitle.setText('');
      this.missionBody.setText('Todas las misiones completadas');
      return;
    }

    this.missionPanel.fillStyle(PANEL, 0.78);
    this.missionPanel.fillRoundedRect(14, this.scale.height - 82, 320, 70, 6);
    this.missionPanel.fillStyle(ACCENT, 1);
    this.missionPanel.fillRect(14, this.scale.height - 82, 3, 70);

    const counter = mission.target > 1 ? `  (${mission.progress}/${mission.target})` : '';
    this.missionTitle.setText(`MISIÓN · ${mission.title}${counter}`);
    this.missionBody.setText(mission.description);
  }

  showToast(text, color) {
    this.toast.setText(text).setBackgroundColor(`#${color.toString(16).padStart(6, '0')}`);
    this.tweens.killTweensOf(this.toast);
    this.toast.setAlpha(0).setY(110);
    this.tweens.add({
      targets: this.toast,
      alpha: { from: 0, to: 1 },
      y: { from: 110, to: 124 },
      duration: 240,
      hold: 1900,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  update() {
    const director = this.main?.waveDirector;
    const player = this.main?.player;
    if (!director || !player) return;

    const resting = director.restingSecondsLeft;
    this.waveText.setText(
      resting > 0
        ? `Oleada ${director.wave + 1} en ${resting}…`
        : `Oleada ${director.wave}  ·  ${director.remaining(this.main.livingZombies())} zombis`,
    );

    const ratio = player.dashCooldownRatio;
    this.dashBar.clear();
    this.dashBar.fillStyle(PANEL, 0.85);
    this.dashBar.fillRoundedRect(14, 48, 204, 8, 3);
    this.dashBar.fillStyle(ratio >= 1 ? 0x7ec8ff : 0x3d5a72, 1);
    this.dashBar.fillRoundedRect(16, 50, 200 * ratio, 4, 2);
  }
}
