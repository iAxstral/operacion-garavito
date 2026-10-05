import { test, expect } from '@playwright/test';
import { openLobbyScreen } from './helpers';

// Para ver capturas al revisar a mano: SHOT_DIR=carpeta npx playwright test avisos
async function shot(page, name) {
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${name}.png` });
}

test('el apodo se ve en la sala y un aviso llega al compañero con su nombre y su voz', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  // Registra lo que se pide decir en voz alta (en el navegador de prueba no hay voces).
  await guest.addInitScript(() => {
    window.__spoken = [];
    if (window.speechSynthesis) {
      window.speechSynthesis.speak = (utterance) => window.__spoken.push({ text: utterance.text, pitch: utterance.pitch });
    }
  });

  await openLobbyScreen(host, 'F');
  await host.getByRole('button', { name: 'Crear' }).click();
  await host.waitForSelector('.role-card');
  await host.getByPlaceholder(/Opcional/).fill('  Lina\tla Vigilante de la noche ');
  const code = (await host.locator('.main-menu-kicker').textContent()).match(/Sala (\w+)/)[1];
  await host.locator('.role-card', { hasText: 'Seguridad' }).click();

  await openLobbyScreen(guest, 'F');
  await guest.getByLabel('Código de la sala').fill(code);
  await guest.getByRole('button', { name: 'Entrar' }).click();
  await guest.locator('.role-card', { hasText: 'Biomédica' }).click();

  // El apodo se limpia (16 caracteres, sin tabulador) y se ve en la sala de espera.
  await expect(guest.locator('.waiting-slot-nick')).toHaveText('Lina la Vigilant');
  await shot(guest, 'avisos-espera');

  await host.getByRole('button', { name: /Comenzar/ }).click();
  await expect(guest.locator('.hud-weapon')).toBeVisible();
  await expect.poll(() => host.evaluate(() => Boolean(window.__phaserGame?.scene.getScene('MainScene')?.pingLayer)),
    { timeout: 30_000 }).toBe(true);

  // Z = "¡Zombis aquí!": el compañero lo ve en la lista con el apodo y se le dice en voz.
  await host.keyboard.press('z');
  await expect(guest.locator('.ping-feed-item')).toContainText('Lina la Vigilant');
  await expect(guest.locator('.ping-feed-item')).toContainText('¡Zombis aquí!');
  await expect.poll(() => guest.evaluate(() => window.__spoken.length)).toBeGreaterThan(0);
  const spoken = await guest.evaluate(() => window.__spoken[0]);
  expect(spoken.pitch).toBeLessThan(1); // Seguridad habla grave
  await shot(guest, 'avisos-compañero');

  // Desde el menu del megafono (pasado el enfriamiento de 1,5 s entre avisos).
  await host.waitForTimeout(1600);
  await host.getByRole('button', { name: 'Avisar al equipo' }).click();
  await host.getByRole('menuitem', { name: /Necesito ayuda/ }).click();
  await expect(guest.locator('.ping-feed-item', { hasText: 'Necesito ayuda' })).toBeVisible();
  await shot(host, 'avisos-propio');
});
