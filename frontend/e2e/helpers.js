import { expect } from '@playwright/test';

/** Salta la intro si se esta mostrando (en la misma sesion solo sale la primera vez). */
export async function skipIntro(page) {
  const skip = page.getByText('Saltar');
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.getByRole('button', { name: /Jugar/ })).toBeVisible();
}

/** Desde la pantalla de inicio hasta la de crear o unirse a sala. */
export async function openLobbyScreen(page) {
  await page.goto('/');
  await page.waitForSelector('.start-screen');
  await page.waitForTimeout(300);
  await skipIntro(page);
  await page.getByRole('button', { name: /Jugar/ }).click();
}

/** En la sala de espera: vota el edificio y espera a que el servidor cuente el voto. */
export async function voteBuilding(page, building) {
  const label = building === 'BIBLIOTECA' ? 'Biblioteca' : `Edificio ${building}`;
  await page.locator('.vote-card', { hasText: label }).click();
  await expect(page.locator('.vote-card--mine', { hasText: label })).toBeVisible();
}

/** Espera a que la escena de Phaser (que se carga aparte) tenga al jugador. */
export async function waitForScene(page) {
  await expect.poll(() => page.evaluate(() => Boolean(window.__phaserGame?.scene.getScene('MainScene')?.lighting)), {
    timeout: 30_000,
  }).toBe(true);
}

/** Crea una sala, elige rol y la inicia. Devuelve el codigo de la sala. */
export async function startSoloGame(page, { building = 'F', role = 'Seguridad' } = {}) {
  await openLobbyScreen(page);
  await page.getByRole('button', { name: 'Crear' }).click();
  await page.waitForSelector('.role-card');
  const kicker = await page.locator('.main-menu-kicker').textContent();
  const code = kicker.match(/Sala (\w+)/)[1];
  await page.locator('.role-card', { hasText: role }).click();
  await voteBuilding(page, building);
  await page.getByRole('button', { name: /Comenzar/ }).click();
  await expect(page.locator('.hud-weapon')).toBeVisible();
  await waitForScene(page);
  return code;
}

/** Estado del jugador local segun el servidor (puente de desarrollo window.__gameSync). */
export function myState(page) {
  return page.evaluate(() => window.__gameSync.getMyPlayerState());
}
