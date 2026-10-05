import { expect, test } from '@playwright/test';
import { myState, openLobbyScreen, startSoloGame } from './helpers.js';

test('la pantalla de inicio muestra el video, Jugar y Configuracion', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('video.start-video')).toBeAttached();
  await page.getByText('Saltar').click();
  await expect(page.getByRole('button', { name: /Jugar/ })).toBeVisible();
  await page.getByRole('button', { name: /Configuración/ }).click();
  await expect(page.getByRole('dialog', { name: 'Configuración' })).toBeVisible();
  await expect(page.locator('input[type=range]')).toHaveCount(6);
});

test('una partida arranca con 3 misiones y se puede caminar sin correcciones', async ({ page }) => {
  await startSoloGame(page);
  const me = await myState(page);
  expect(me.missions).toHaveLength(3);
  await expect(page.locator('.hud-missions')).toContainText('Misiones 0/3');

  // Se mantiene la tecla hasta que el servidor ve el avance (en CI, sin GPU, el juego
  // corre a pocos cuadros por segundo y tarda mas en recorrer lo mismo).
  await page.keyboard.down('d');
  await expect.poll(async () => (await myState(page)).x, { timeout: 15_000 }).toBeGreaterThan(me.x + 100);
  await page.keyboard.up('d');
  const corrections = await page.evaluate(() => window.__phaserGame.scene.getScene('MainScene').corrections ?? 0);
  expect(corrections).toBe(0);
});

test('el servidor corrige un teletransporte', async ({ page }) => {
  await startSoloGame(page);
  await page.waitForTimeout(1000);
  const before = await myState(page);
  await page.evaluate(() => {
    const scene = window.__phaserGame.scene.getScene('MainScene');
    scene.player.setPosition(scene.player.x + 1200, scene.player.y);
  });
  await expect.poll(() => page.evaluate(() => window.__phaserGame.scene.getScene('MainScene').corrections ?? 0)).toBe(1);
  const after = await myState(page);
  expect(Math.abs(after.x - before.x)).toBeLessThan(100);
});

test('al recargar la pagina se vuelve al mismo puesto', async ({ page }) => {
  await startSoloGame(page, { building: 'C', role: 'Economía' });
  const before = await myState(page);
  await page.reload();
  await expect(page.locator('.hud-weapon')).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await myState(page))?.role).toBe('ECONOMIA');
  const after = await myState(page);
  expect(after.role).toBe('ECONOMIA');
  expect(after.missions.map((m) => m.missionId)).toEqual(before.missions.map((m) => m.missionId));
});

test('dos jugadores en la misma sala se ven y comparten el avance de misiones', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  await openLobbyScreen(host, 'F');
  await host.getByRole('button', { name: 'Crear' }).click();
  await host.waitForSelector('.role-card');
  const code = (await host.locator('.main-menu-kicker').textContent()).match(/Sala (\w+)/)[1];
  await host.locator('.role-card', { hasText: 'Biomédica' }).click();

  await openLobbyScreen(guest, 'F');
  await guest.getByLabel('Código de la sala').fill(code);
  await guest.getByRole('button', { name: 'Entrar' }).click();
  await guest.locator('.role-card', { hasText: 'Infraestructura' }).click();

  await host.getByRole('button', { name: /Comenzar/ }).click();
  await expect(guest.locator('.hud-weapon')).toBeVisible();
  await expect.poll(async () => (await guest.evaluate(() => window.__gameSync.getWave()))?.teamMissionsRequired).toBe(6);
  const roles = await guest.evaluate(() => window.__gameSync.getLatestState().players.map((p) => p.role).sort());
  expect(roles).toEqual(['INFRAESTRUCTURA', 'SALUD']);
});
