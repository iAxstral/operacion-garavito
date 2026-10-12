import { expect, test } from '@playwright/test';
import { openLobbyScreen, voteBuilding } from './helpers.js';

test('tres jugadores votan a la vez el edificio y la partida empieza en el mas votado', async ({ browser }) => {
  const pages = await Promise.all([0, 1, 2].map(async () => (await browser.newContext()).newPage()));
  const [host, guestA, guestB] = pages;

  await openLobbyScreen(host);
  await host.getByRole('button', { name: 'Crear' }).click();
  await host.waitForSelector('.role-card');
  const code = (await host.locator('.main-menu-kicker').textContent()).match(/Sala (\w+)/)[1];
  await host.locator('.role-card', { hasText: 'Seguridad' }).click();

  for (const [guest, role] of [[guestA, 'Biomédica'], [guestB, 'Economía']]) {
    await openLobbyScreen(guest);
    await guest.getByLabel('Código de la sala').fill(code);
    await guest.getByRole('button', { name: 'Entrar' }).click();
    await guest.locator('.role-card', { hasText: role }).click();
    await guest.waitForSelector('.vote-card');
  }

  // Los tres votan en el mismo instante: 2 por el B y 1 por la Biblioteca.
  await Promise.all([
    voteBuilding(host, 'BIBLIOTECA'),
    voteBuilding(guestA, 'B'),
    voteBuilding(guestB, 'B'),
  ]);
  for (const page of pages) {
    await expect(page.locator('.vote-panel .main-menu-kicker')).toHaveText(/3\/3 votos/);
    await expect(page.locator('.vote-card--leading')).toContainText('Edificio B');
  }

  await host.getByRole('button', { name: /Comenzar en Edificio B/ }).click();
  // Antes de que cargue Phaser (tres a la vez en el mismo navegador se comen la CPU).
  for (const page of pages) {
    await expect.poll(() => page.evaluate(() => window.__gameSync.getMyBuilding())).toBe('B');
  }
  for (const page of pages) {
    await expect(page.locator('.hud-weapon')).toBeVisible({ timeout: 30_000 });
  }
});
