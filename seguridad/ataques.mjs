// Simulacion de ataques contra el backend de Operacion Garavito (prueba de penetracion
// propia). Hace lo que haria alguien con un script en vez del navegador: falsifica el
// Origin, se hace pasar por otro jugador, manda posiciones y montos imposibles, inunda
// de mensajes y de salas, y prueba las APIs REST.
//
// Uso (Node 22, sin dependencias):
//   node seguridad/ataques.mjs [http://localhost:8080] [origen-permitido]
//
// SOLO contra un servidor propio (local o de pruebas). Las pruebas de inundacion cargan
// la maquina a proposito: no correrlas contra el juego en linea mientras otros juegan.

const BASE = (process.argv[2] ?? 'http://localhost:8080').replace(/\/$/, '');
const ORIGIN = process.argv[3] ?? 'https://www.operaciongaravito.me';
const WS_URL = `${BASE.replace(/^http/, 'ws')}/ws/websocket`;
const ROLES = ['SEGURIDAD', 'SALUD', 'ECONOMIA', 'INFRAESTRUCTURA'];

const resultados = [];
function anotar(id, ataque, defendido, detalle) {
  resultados.push({ id, ataque, defendido, detalle });
  console.log(`${defendido ? 'DEFENDIDO ' : 'VULNERABLE'}  ${id} ${ataque}\n            ${detalle}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const codigo = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

// ---------- STOMP minimo sobre el WebSocket crudo de SockJS ----------

function frame(command, headers, body = '') {
  const lines = Object.entries(headers).map(([k, v]) => `${k}:${v}`);
  return `${command}\n${lines.join('\n')}\n\n${body}\0`;
}

class Cliente {
  constructor(origin = ORIGIN) {
    this.origin = origin;
    this.mensajes = [];
    this.esperas = [];
    this.subs = 0;
  }

  conectar() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL, { headers: { Origin: this.origin } });
      this.ws.onerror = () => reject(new Error('handshake rechazado'));
      this.ws.onclose = () => { this.cerrado = true; };
      this.ws.onopen = () => this.ws.send(frame('CONNECT', { 'accept-version': '1.2', host: 'localhost', 'heart-beat': '0,0' }));
      this.ws.onmessage = (event) => {
        String(event.data).split('\0').filter(Boolean).forEach((raw) => {
          const [head, ...rest] = raw.replace(/^\n+/, '').split('\n\n');
          const command = head.split('\n')[0];
          if (command === 'CONNECTED') resolve(this);
          if (command === 'MESSAGE') {
            try {
              const body = JSON.parse(rest.join('\n\n'));
              this.mensajes.push(body);
              this.esperas = this.esperas.filter((w) => !(w.test(body) && (w.resolve(body), true)));
            } catch { /* cuerpo no JSON */ }
          }
          if (command === 'ERROR') this.error = raw;
        });
      };
      setTimeout(() => reject(new Error('timeout al conectar')), 5000);
    });
  }

  suscribir(destino) {
    this.ws.send(frame('SUBSCRIBE', { id: `s${this.subs++}`, destination: destino }));
  }

  enviar(destino, cuerpo) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(frame('SEND', { destination: destino, 'content-type': 'application/json' }, typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)));
  }

  esperar(test, ms = 3000) {
    const ya = this.mensajes.find(test);
    if (ya) return Promise.resolve(ya);
    return new Promise((resolve) => {
      const w = { test, resolve };
      this.esperas.push(w);
      setTimeout(() => { this.esperas = this.esperas.filter((x) => x !== w); resolve(null); }, ms);
    });
  }

  /** Ultimo estado completo de la sala que vio este cliente. */
  estado() {
    return [...this.mensajes].reverse().find((m) => Array.isArray(m.players) && m.players.length > 0 && m.full) ??
      [...this.mensajes].reverse().find((m) => Array.isArray(m.players) && m.players.length > 0);
  }

  cerrar() {
    try { this.ws.close(); } catch { /* ya cerrado */ }
  }
}

async function salaConJugador(rol = 'SEGURIDAD') {
  const c = await new Cliente().conectar();
  const code = codigo();
  const clientId = `pentest-${Math.random().toString(36).slice(2)}`;
  c.suscribir(`/topic/game/${code}`);
  await sleep(150);
  c.enviar(`/app/game/${code}/lobby`, { clientId, create: true, building: 'F', mode: 'NORMAL' });
  await c.esperar((m) => m.lastEvent?.type === 'LOBBY_OK');
  c.enviar(`/app/game/${code}/join`, { role: rol, clientId, token: `tok-${clientId}`, name: 'Victima' });
  await c.esperar((m) => m.lastEvent?.type === 'JOIN_OK' && m.lastEvent.playerId === rol);
  return { c, code, clientId };
}

const jugador = (c, rol) => c.estado()?.players?.find((p) => p.playerId === rol);

async function latenciaRest() {
  const t = performance.now();
  await fetch(`${BASE}/api/ping`).catch(() => null);
  return performance.now() - t;
}

// ---------- Ataques ----------

async function a01OrigenAjeno() {
  try {
    const c = await new Cliente('https://atacante.example').conectar();
    c.cerrar();
    anotar('A01', 'WebSocket desde un sitio ajeno (Origin falso)', false, 'el handshake se acepto');
  } catch {
    anotar('A01', 'WebSocket desde un sitio ajeno (Origin falso)', true, 'el servidor rechaza el handshake (403): un sitio malicioso no puede usar el navegador de la victima');
  }
}

async function a02SuplantarJugador() {
  const { c, code } = await salaConJugador('SEGURIDAD');
  c.enviar(`/app/game/${code}/start`, { playerId: 'SEGURIDAD' });
  await sleep(800);
  const antes = jugador(c, 'SEGURIDAD');
  const atacante = await new Cliente().conectar();
  atacante.suscribir(`/topic/game/${code}`);
  await sleep(150);
  // Sin sentarse: manda acciones con el playerId de la victima.
  atacante.enviar(`/app/game/${code}/move`, { playerId: 'SEGURIDAD', floor: antes.floor, x: antes.x + 40, y: antes.y });
  atacante.enviar(`/app/game/${code}/leave`, { playerId: 'SEGURIDAD' });
  atacante.enviar(`/app/game/${code}/purchase`, { playerId: 'SEGURIDAD', itemId: 'shop-arepa', x: antes.x, y: antes.y });
  await sleep(900);
  const despues = jugador(c, 'SEGURIDAD');
  const ok = despues && despues.x === antes.x && despues.connected !== false;
  anotar('A02', 'Mover / sacar / comprar a nombre de otro jugador', ok,
    ok ? 'se ignoran: el servidor usa el puesto ligado a la conexion, no el playerId del mensaje' : `la victima cambio: ${JSON.stringify({ antes: antes?.x, despues: despues?.x })}`);
  atacante.cerrar();
  c.cerrar();
}

async function a03Teletransporte() {
  const { c, code } = await salaConJugador('SEGURIDAD');
  c.enviar(`/app/game/${code}/start`, { playerId: 'SEGURIDAD' });
  await sleep(800);
  const antes = jugador(c, 'SEGURIDAD');
  c.enviar(`/app/game/${code}/move`, { playerId: 'SEGURIDAD', floor: antes.floor, x: antes.x + 1500, y: antes.y + 900 });
  const corregido = await c.esperar((m) => m.lastEvent?.type === 'POSITION_CORRECTED', 2000);
  await sleep(300);
  const despues = jugador(c, 'SEGURIDAD');
  const ok = Boolean(corregido) || Math.hypot(despues.x - antes.x, despues.y - antes.y) < 300;
  anotar('A03', 'Teletransporte / speed hack (posicion imposible)', ok,
    ok ? 'el servidor rechaza el salto y corrige la posicion' : `el servidor acepto el salto a ${despues.x},${despues.y}`);
  // Cambio de piso sin escalera.
  c.enviar(`/app/game/${code}/move`, { playerId: 'SEGURIDAD', floor: antes.floor + 1, x: despues.x, y: despues.y });
  await sleep(500);
  const piso = jugador(c, 'SEGURIDAD').floor;
  anotar('A04', 'Cambiar de piso sin pasar por la escalera', piso === antes.floor,
    piso === antes.floor ? 'rechazado: solo vale saliendo de la escalera' : `quedo en el piso ${piso}`);
  c.cerrar();
}

async function a05Economia() {
  const { c, code } = await salaConJugador('ECONOMIA');
  const victima = await new Cliente().conectar();
  victima.suscribir(`/topic/game/${code}`);
  await sleep(150);
  victima.enviar(`/app/game/${code}/join`, { role: 'SALUD', clientId: 'otro', token: 'tok-otro', name: 'Otro' });
  await victima.esperar((m) => m.lastEvent?.type === 'JOIN_OK' && m.lastEvent.playerId === 'SALUD');
  await sleep(300);
  const saldoSalud = jugador(c, 'SALUD').garavitos;
  const saldoEco = jugador(c, 'ECONOMIA').garavitos;
  // Montos negativos (robar), enormes y desbordamiento de int.
  for (const amount of [-500, 999999, 2147483647, -2147483648]) {
    c.enviar(`/app/game/${code}/transfer`, { playerId: 'ECONOMIA', targetId: 'SALUD', amount });
  }
  c.enviar(`/app/game/${code}/transfer`, '{"playerId":"ECONOMIA","targetId":"SALUD","amount":1e30}');
  await sleep(800);
  const s2 = jugador(c, 'SALUD').garavitos;
  const e2 = jugador(c, 'ECONOMIA').garavitos;
  const ok = s2 <= saldoSalud + saldoEco && e2 >= 0 && s2 >= 0;
  anotar('A05', 'Transferencias negativas, gigantes y con desbordamiento', ok,
    ok ? `rechazadas (saldos ${saldoEco}→${e2} y ${saldoSalud}→${s2})` : `saldos alterados: economia ${e2}, salud ${s2}`);

  // Comprar sin plata y lejos del vendedor.
  const inv = jugador(c, 'SALUD').inventory?.length ?? 0;
  victima.enviar(`/app/game/${code}/purchase`, { playerId: 'SALUD', itemId: 'shop-rifle', x: 0, y: 0 });
  victima.enviar(`/app/game/${code}/purchase`, { playerId: 'SALUD', itemId: 'item-que-no-existe', x: 0, y: 0 });
  await sleep(600);
  const inv2 = jugador(c, 'SALUD').inventory?.length ?? 0;
  anotar('A06', 'Comprar un rifle sin dinero, lejos de la maquina o un objeto inexistente', inv2 === inv,
    inv2 === inv ? 'rechazado por el servidor (precio, distancia y catalogo los valida el)' : 'la compra paso');

  // Completar una mision sin hacerla.
  const misiones = jugador(c, 'SALUD').missions ?? [];
  misiones.forEach((m) => victima.enviar(`/app/game/${code}/mission/complete`, { playerId: 'SALUD', missionId: m.missionId, x: 0, y: 0 }));
  await sleep(600);
  const hechas = (jugador(c, 'SALUD').missions ?? []).filter((m) => m.done).length;
  anotar('A07', 'Marcar misiones como hechas sin empezarlas ni estar en el lugar', hechas === 0,
    hechas === 0 ? 'rechazado: hay que empezarla en el sitio y esperar su tiempo minimo' : `${hechas} misiones quedaron hechas`);
  victima.cerrar();
  c.cerrar();
}

async function a08Inyecciones() {
  const { c, code } = await salaConJugador('SEGURIDAD');
  const xss = '<img src=x onerror=alert(1)>'.repeat(200);
  c.enviar(`/app/game/${code}/rejoin`, { role: 'SEGURIDAD', clientId: 'x', token: 'tok-equivocado', name: xss });
  c.enviar(`/app/game/${code}/chat`, { playerId: 'SEGURIDAD', phrase: '<script>alert(1)</script>' });
  c.enviar(`/app/game/${code}/ping`, { playerId: 'SEGURIDAD', kind: "'; DROP TABLE match_record; --" });
  await sleep(800);
  const chatLibre = c.mensajes.some((m) => m.lastEvent?.type === 'CHAT' && String(m.lastEvent.reason ?? m.lastEvent.itemId ?? '').includes('<script>'));
  anotar('A08', 'Chat con texto libre / HTML (XSS)', !chatLibre,
    !chatLibre ? 'rechazado: el chat solo acepta frases de una lista cerrada' : 'el servidor difundio el texto');
  const nombre = jugador(c, 'SEGURIDAD').name ?? '';
  anotar('A09', 'Robar un puesto con un token equivocado (rejoin) y nombre gigante con HTML', nombre === 'Victima',
    nombre === 'Victima' ? 'rechazado: sin el token del puesto no se recupera ni se renombra' : `nombre cambiado a ${nombre.slice(0, 40)}…`);

  // REST
  const rest = [
    ['/api/ranking?building=%27%20OR%201=1--&mode=NORMAL', 'SQL injection en /api/ranking'],
    ['/api/buildings/..%2F..%2F..%2Fetc%2Fpasswd/hide-spots', 'Path traversal en hide-spots'],
    ['/actuator/env', 'Variables de entorno por actuator'],
    ['/actuator/heapdump', 'Volcado de memoria por actuator'],
    ['/h2-console', 'Consola de la base H2'],
  ];
  for (const [path, nombreAtaque] of rest) {
    const res = await fetch(`${BASE}${path}`).catch(() => null);
    const texto = res ? await res.text() : '';
    const filtra = /root:x:|password|DROP|jdbc:/i.test(texto) || (path.startsWith('/actuator') && res?.status === 200) || (path === '/h2-console' && res?.status === 200);
    anotar('A10', nombreAtaque, !filtra, `HTTP ${res?.status ?? 'sin respuesta'}${filtra ? ' con datos sensibles' : ', sin datos sensibles'}`);
  }
  c.cerrar();
}

async function a11MalFormado() {
  const c = await new Cliente().conectar();
  const code = codigo();
  c.enviar(`/app/game/${code}/lobby`, '{esto no es json');
  c.enviar(`/app/game/${code}/move`, JSON.stringify({ playerId: 'X', floor: 'NaN', x: 'Infinity', y: null }));
  c.enviar(`/app/game/${code}/lobby`, JSON.stringify({ relleno: 'x'.repeat(2_000_000) }));
  await sleep(1000);
  const vivo = (await fetch(`${BASE}/api/ping`).catch(() => null))?.ok;
  anotar('A11', 'JSON roto, tipos imposibles y un mensaje de 2 MB', Boolean(vivo),
    vivo ? `el servidor sigue respondiendo${c.cerrado ? ' (y corto la conexion del atacante)' : ''}` : 'el servidor dejo de responder');
  c.cerrar();
}

async function a12Asientos() {
  const c = await new Cliente().conectar();
  const code = codigo();
  c.suscribir(`/topic/game/${code}`);
  await sleep(150);
  c.enviar(`/app/game/${code}/lobby`, { clientId: 'squat', create: true, building: 'F', mode: 'NORMAL' });
  await c.esperar((m) => m.lastEvent?.type === 'LOBBY_OK');
  for (const role of ROLES) {
    c.enviar(`/app/game/${code}/join`, { role, clientId: 'squat', token: `t-${role}`, name: role });
  }
  await sleep(800);
  const sentados = c.estado()?.players?.length ?? 0;
  anotar('A12', 'Una sola conexion ocupa los 4 puestos de una sala', sentados <= 1,
    sentados <= 1 ? 'solo se acepta un puesto por conexion' : `una conexion ocupo ${sentados} puestos: puede dejar una sala llena sin jugar`);
  c.cerrar();
}

async function a13Enumerar(n = 400) {
  // Se crea una sala "victima" y se adivinan codigos al azar preguntando por el lobby.
  const { c, code } = await salaConJugador('SEGURIDAD');
  const sonda = await new Cliente().conectar();
  const t0 = performance.now();
  const codigos = Array.from({ length: n }, codigo);
  codigos.push(code);
  codigos.forEach((k) => sonda.suscribir(`/topic/game/${k}`));
  await sleep(300);
  codigos.forEach((k) => sonda.enviar(`/app/game/${k}/lobby`, { clientId: 'sonda', create: false, building: 'F', mode: 'NORMAL' }));
  await sleep(1500);
  const seg = (performance.now() - t0) / 1000;
  const encontrados = new Set(sonda.mensajes.filter((m) => m.lastEvent?.type === 'LOBBY_OK').map(() => 'x')).size;
  const porSegundo = Math.round(codigos.length / seg);
  const espacio = 32 ** 4;
  const horas = espacio / porSegundo / 3600;
  const encontro = sonda.mensajes.some((m) => m.lastEvent?.type === 'LOBBY_OK');
  anotar('A13', 'Adivinar codigos de sala por fuerza bruta (4 caracteres)', horas > 24 * 30,
    `~${porSegundo} codigos/s desde una conexion: los ${espacio.toLocaleString('es')} codigos se recorren en ~${horas.toFixed(1)} h (con 10 conexiones, ~${(horas / 10 * 60).toFixed(0)} min). Encontro la sala real: ${encontro ? 'si' : 'no'}`);
  void encontrados;
  sonda.cerrar();
  c.cerrar();
}

async function a14Inundar(segundos = 5) {
  const { c, code } = await salaConJugador('SEGURIDAD');
  c.enviar(`/app/game/${code}/start`, { playerId: 'SEGURIDAD' });
  await sleep(600);
  const base = await latenciaRest();
  const atacantes = await Promise.all(Array.from({ length: 4 }, () => new Cliente().conectar()));
  let enviados = 0;
  const fin = Date.now() + segundos * 1000;
  const lat = [];
  const medir = (async () => { while (Date.now() < fin) { lat.push(await latenciaRest()); await sleep(200); } })();
  while (Date.now() < fin) {
    for (const a of atacantes) {
      for (let i = 0; i < 200; i += 1) {
        a.enviar(`/app/game/${code}/attack`, { playerId: 'SEGURIDAD', type: 'BASIC', x: 0, y: 0, facing: 0 });
        enviados += 1;
      }
    }
    await sleep(10);
  }
  await medir;
  const peor = Math.max(...lat);
  const ok = peor < 1000;
  anotar('A15', `Inundar con mensajes (${Math.round(enviados / segundos).toLocaleString('es')} msg/s desde 4 conexiones)`, ok,
    `latencia de /api/ping: ${base.toFixed(0)} ms normal, peor ${peor.toFixed(0)} ms durante el ataque. No hay limite de mensajes por conexion${ok ? '; esta vez aguanto' : ': el servidor se degrada'}`);
  atacantes.forEach((a) => a.cerrar());
  c.cerrar();
}

async function a16Salas(n = 1500) {
  const antes = await (await fetch(`${BASE}/api/estado`)).json().catch(() => ({}));
  const c = await new Cliente().conectar();
  for (let i = 0; i < n; i += 1) {
    c.enviar(`/app/game/${codigo()}/lobby`, { clientId: 'flood', create: true, building: 'F', mode: 'NORMAL' });
  }
  await sleep(3000);
  const despues = await (await fetch(`${BASE}/api/estado`)).json().catch(() => ({}));
  const creadas = (despues.salas ?? 0) - (antes.salas ?? 0);
  const lat = await latenciaRest();
  anotar('A16', `Crear ${n} salas vacias desde una conexion`, creadas < 50,
    `se crearon ${creadas} salas (ahora hay ${despues.salas}); /api/ping tarda ${lat.toFixed(0)} ms. ${creadas >= 50 ? 'No hay tope de salas por conexion ni global: se puede agotar memoria y CPU del tick' : ''}`);
  c.cerrar();
}

// ---------- Ejecucion ----------

const ataques = [a01OrigenAjeno, a02SuplantarJugador, a03Teletransporte, a05Economia, a08Inyecciones, a11MalFormado,
  a12Asientos, a13Enumerar, a14Inundar, a16Salas];

console.log(`Atacando ${BASE} (Origin usado: ${ORIGIN})\n`);
for (const ataque of ataques) {
  try {
    await ataque();
  } catch (err) {
    anotar('ERR', ataque.name, false, `la prueba fallo: ${err.message}`);
  }
}
const vulnerables = resultados.filter((r) => !r.defendido);
console.log(`\n${resultados.length - vulnerables.length}/${resultados.length} ataques defendidos.`);
if (vulnerables.length) {
  console.log('Pendientes:');
  vulnerables.forEach((r) => console.log(` - ${r.id} ${r.ataque}`));
}
process.exit(vulnerables.length ? 1 : 0);
