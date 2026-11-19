import { expect, test } from '@playwright/test';
import { skipIntro, startSoloGame } from './helpers.js';

test('en celular el menu no se sale de la pantalla y la partida muestra los controles tactiles', async ({ page }) => {
  await page.goto('/');
  await skipIntro(page);
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole('button', { name: /Jugar/ })).toBeInViewport();

  await startSoloGame(page);
  await expect(page.locator('.touch-btn--attack')).toBeVisible();
  await expect(page.locator('.touch-btn--ability')).toBeVisible();
  const zoom = await page.evaluate(() => window.__phaserGame.scene.getScene('MainScene').cameras.main.zoom);
  expect(zoom).toBeLessThan(1);
});
