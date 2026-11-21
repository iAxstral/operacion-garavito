// Prueba el frontend construido con la misma Content-Security-Policy que pone CloudFront
// (infra/lib/encabezados.json): sirve dist/ con ese header, reenvia /ws y /api al
// backend (como CloudFront) y juega una partida en Chromium anotando cada violacion de
// la CSP y cada error de consola.
//
//   # backend en otra terminal: cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
//   cd frontend && VITE_WS_URL=/ws npm run build
//   node scripts/probar-csp.mjs --backend 8080
//
// Sale con codigo 1 si hubo alguna violacion.
import { readFileSync, existsSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
const BACKEND = Number(args.backend ?? 8080);
const PORT = Number(args.port ?? 4319);
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const ENCABEZADOS = fileURLToPath(new URL('../../infra/lib/encabezados.json', import.meta.url));

// La CSP real, con el dominio cambiado por este servidor local.
const { csp } = JSON.parse(readFileSync(ENCABEZADOS, 'utf8'));
const policy = Object.entries(csp)
  .map(([directive, values]) => `${directive} ${values.join(' ')
    .replaceAll('wss://__DOMINIO__', `ws://localhost:${PORT}`)
    .replaceAll('https://__DOMINIO__', `http://localhost:${PORT}`)}`)
  .join('; ');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  if (req.url.startsWith('/ws') || req.url.startsWith('/api')) {
    const upstream = request({ host: 'localhost', port: BACKEND, path: req.url, method: req.method, headers: req.headers },
      (answer) => {
        res.writeHead(answer.statusCode, answer.headers);
        answer.pipe(res);
      });
    upstream.on('error', () => res.writeHead(502).end());
    req.pipe(upstream);
    return;
  }
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, path);
  if (!existsSync(file) || path.endsWith('/')) file = join(DIST, 'index.html');
  res.setHeader('Content-Security-Policy', policy);
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
  res.end(readFileSync(file));
});
// WebSocket: se pasa el upgrade tal cual al backend.
server.on('upgrade', (req, socket, head) => {
  const upstream = connect(BACKEND, 'localhost', () => {
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on('error', () => socket.destroy());
});
await new Promise((resolve) => server.listen(PORT, resolve));
console.log(`dist/ en http://localhost:${PORT} con la CSP:\n  ${policy}\n`);

const browser = await chromium.launch();
const page = await browser.newPage();
const violations = [];
const errors = [];
await page.exposeFunction('__cspViolation', (v) => violations.push(v));
await page.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__cspViolation(`${e.violatedDirective} bloqueo ${e.blockedURI || '(inline)'} en ${e.sourceFile}:${e.lineNumber}`);
  });
});
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

let resultado = 'la partida arranco';
try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(1500);
  const skip = page.getByText('Saltar');
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.getByRole('button', { name: /Jugar/ }).click();
  await page.locator('[aria-label="Edificio F"]').first().click();
  await page.getByRole('button', { name: 'Crear' }).click();
  await page.waitForSelector('.role-card', { timeout: 15000 });
  await page.locator('.role-card', { hasText: 'Seguridad' }).click();
  await page.getByRole('button', { name: /Comenzar/ }).click();
  await page.locator('.hud-weapon').waitFor({ timeout: 20000 });
  // Un rato jugando: musica, sonidos, texturas generadas, service worker.
  await page.keyboard.down('d');
  await page.waitForTimeout(3000);
  await page.keyboard.up('d');
  await page.waitForTimeout(2000);
} catch (err) {
  resultado = `no se pudo completar la partida: ${err.message.split('\n')[0]}`;
}
await browser.close();
server.close();

console.log(resultado);
console.log(`violaciones de la CSP: ${violations.length}`);
violations.forEach((v) => console.log(`  - ${v}`));
const cspErrors = errors.filter((e) => /Content Security Policy|Refused to/i.test(e));
if (cspErrors.length) cspErrors.forEach((e) => console.log(`  consola: ${e}`));
process.exit(violations.length || cspErrors.length || resultado !== 'la partida arranco' ? 1 : 0);
