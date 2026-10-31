import { expect, test } from '@playwright/test';
import { skipIntro, startSoloGame } from './helpers.js';

test('el panel "Servidor en vivo" muestra la partida que otro jugador está jugando', async ({ browser }) => {
  const player = await (await browser.newContext()).newPage();
  await startSoloGame(player, { building: 'G' });

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto('/');
  await skipIntro(visitor);
  await visitor.getByRole('button', { name: /Servidor en vivo/ }).click();

  const panel = visitor.getByRole('dialog', { name: 'Estado del servidor' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('tbody tr', { hasText: 'Edificio G' })).toContainText('1/4');
  // Las cifras de arriba son salas, jugadores, zombis y tick: al menos una sala y un jugador.
  const [salas, jugadores] = await panel.locator('.estado-valor').allTextContents();
  expect(Number(salas)).toBeGreaterThanOrEqual(1);
  expect(Number(jugadores)).toBeGreaterThanOrEqual(1);

  await visitor.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});
