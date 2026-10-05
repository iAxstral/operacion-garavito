import { defineConfig, devices } from '@playwright/test';

// Pruebas de punta a punta: levantan el backend (perfil dev, H2) y el frontend en
// puertos propios para no chocar con los que se usan al desarrollar.
const BACKEND_PORT = 8099;
const FRONTEND_PORT = 5199;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'list' : 'line',
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] }, testIgnore: /celular\.spec\.js/ },
    { name: 'celular', use: { ...devices['Pixel 7'] }, testMatch: /celular\.spec\.js/ },
  ],
  webServer: [
    {
      command: `node scripts/start-backend-e2e.mjs ${BACKEND_PORT}`,
      url: `http://localhost:${BACKEND_PORT}/api/ranking`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${FRONTEND_PORT}`,
      env: { VITE_WS_URL: `http://localhost:${BACKEND_PORT}/ws` },
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
