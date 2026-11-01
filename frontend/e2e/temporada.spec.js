import { expect, test } from '@playwright/test';
import { openLobbyScreen, skipIntro } from './helpers.js';

const temporadaDe = (page) => page.evaluate(() => document.documentElement.dataset.temporada);

test('Navidad es la temporada por defecto y Halloween se elige desde el menu', async ({ page }) => {
  await page.goto('/');
  await skipIntro(page);
  expect(await temporadaDe(page)).toBe('navidad');
  await expect(page.locator('.start-kicker')).toContainText('Nochebuena');

  await page.getByRole('radio', { name: /Halloween/ }).click();
  expect(await temporadaDe(page)).toBe('halloween');
  await expect(page.locator('.start-kicker')).toContainText('Halloween');

  // La eleccion se recuerda al volver a entrar.
  await page.reload();
  await skipIntro(page);
  expect(await temporadaDe(page)).toBe('halloween');
});

test('quien entra a una sala ve la temporada de la sala, no la suya', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  await host.goto('/');
  await skipIntro(host);
  await host.getByRole('radio', { name: /Halloween/ }).click();
  await openLobbyScreen(host, 'F');
  await host.getByRole('button', { name: 'Crear' }).click();
  await host.waitForSelector('.role-card');
  const code = (await host.locator('.main-menu-kicker').textContent()).match(/Sala (\w+)/)[1];

  // El invitado nunca eligio nada: su temporada es Navidad.
  const guest = await (await browser.newContext()).newPage();
  await openLobbyScreen(guest, 'F');
  expect(await temporadaDe(guest)).toBe('navidad');
  await guest.getByLabel('Código de la sala').fill(code);
  await guest.getByRole('button', { name: 'Entrar' }).click();
  await guest.waitForSelector('.role-card');
  await expect.poll(() => temporadaDe(guest)).toBe('halloween');

  // Al salir de la sala vuelve a su temporada.
  await guest.getByRole('button', { name: /Salir de la sala/ }).click();
  await expect.poll(() => temporadaDe(guest)).toBe('navidad');
});
