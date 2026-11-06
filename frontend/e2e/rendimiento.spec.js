import { expect, test } from '@playwright/test';
import { startSoloGame } from './helpers.js';

const SETTINGS_KEY = 'garavito.settings.v1';

test('el indicador muestra los FPS y el ping del servidor', async ({ page }) => {
  // Sin calidad automatica: en CI (sin GPU) el juego va lento y la activaria.
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ showStats: true, autoPerf: false })), SETTINGS_KEY);
  await startSoloGame(page);
  const overlay = page.locator('.stats-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText(/\d+ FPS/, { timeout: 10_000 });
  await expect(overlay).toContainText(/\d+ ms/, { timeout: 10_000 });
});

test('el indicador esta apagado por defecto', async ({ page }) => {
  await startSoloGame(page);
  await expect(page.locator('.stats-overlay')).toHaveCount(0);
});

test('el modo de rendimiento se aplica en la partida sin cambiar de piso', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ autoPerf: false })), SETTINGS_KEY);
  await startSoloGame(page);
  const lighting = () => page.evaluate(() => {
    const scene = window.__phaserGame.scene.getScene('MainScene');
    return { lowPerf: scene.lighting.lowPerf, fog: scene.lighting.fog.length, snow: Boolean(scene.snow) };
  });
  expect(await lighting()).toEqual(expect.objectContaining({ lowPerf: false, snow: true }));
  expect((await lighting()).fog).toBeGreaterThan(0);

  // Desde la configuracion de la partida (Esc), como lo haria el jugador.
  await page.keyboard.press('Escape');
  await page.locator('.settings-toggle')
    .filter({ has: page.locator('.settings-row-label', { hasText: /^Modo de rendimiento$/ }) })
    .click();
  await expect.poll(lighting).toEqual({ lowPerf: true, fog: 0, snow: false });
});
