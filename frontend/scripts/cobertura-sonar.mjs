// Calcula la cobertura del frontend como la reporta Sonar: solo los archivos que no
// estan en sonar.coverage.exclusions, y los que ninguna prueba carga cuentan como 0 %.
//   npm run test:coverage && node scripts/cobertura-sonar.mjs
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

const props = readFileSync('sonar-project.properties', 'utf8').replace(/\\\r?\n\s*/g, '');
const exclusiones = (props.match(/^sonar\.coverage\.exclusions=(.*)$/m)?.[1] ?? '').split(',').map((g) => g.trim()).filter(Boolean);
const aRegex = (glob) => new RegExp(`^${glob
  .replace(/[.+^${}()|[\]\\]/g, '\\$&')
  .replace(/\*\*/g, '\u0000')
  .replace(/\*/g, '[^/]*')
  .replace(/\u0000/g, '.*')}$`);
const patrones = exclusiones.map(aRegex);
const excluido = (f) => patrones.some((r) => r.test(f));

const medidos = new Map();
for (const bloque of readFileSync('coverage/lcov.info', 'utf8').split('end_of_record')) {
  const sf = bloque.match(/^SF:(.*)$/m)?.[1];
  if (!sf) continue;
  const rel = path.relative(process.cwd(), sf).split(path.sep).join('/');
  const n = (k) => Number(bloque.match(new RegExp(`^${k}:(\\d+)$`, 'm'))?.[1] ?? 0);
  medidos.set(rel, { lf: n('LF'), lh: n('LH'), brf: n('BRF'), brh: n('BRH') });
}

let lf = 0; let lh = 0; let brf = 0; let brh = 0;
const sinPruebas = [];
for (const f of globSync('src/**/*.{js,jsx}').map((p) => p.split(path.sep).join('/'))) {
  if (f.includes('.test.') || excluido(f)) continue;
  const m = medidos.get(f);
  if (!m) {
    // Lineas de codigo aproximadas (sin vacias ni comentarios), todas sin cubrir.
    lf += readFileSync(f, 'utf8').split('\n').filter((l) => l.trim() && !/^\s*(\/\/|\*|\/\*)/.test(l)).length;
    sinPruebas.push(f);
    continue;
  }
  lf += m.lf; lh += m.lh; brf += m.brf; brh += m.brh;
}
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '100.0');
console.log(`Lineas: ${pct(lh, lf)} % (${lh}/${lf}) · Ramas: ${pct(brh, brf)} % (${brh}/${brf})`);
console.log(`Cobertura combinada (formula de Sonar): ${pct(lh + brh, lf + brf)} %`);
if (sinPruebas.length) console.log(`Archivos medidos sin ninguna prueba (${sinPruebas.length}):`, sinPruebas.join(', '));
