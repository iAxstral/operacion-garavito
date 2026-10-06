// Prueba de carga: abre muchas salas con bots que se conectan por STOMP como un
// cliente real, juegan (se mueven dentro de las reglas del servidor y atacan) y
// miden lo que reciben. No necesita navegador: usa el WebSocket de Node 22+.
//
//   node scripts/load-test.mjs --url ws://localhost:8081/ws/websocket --rooms 20 --players 4 --seconds 60
//
// Reporta: mensajes por segundo que recibe cada cliente, cada cuanto llega el estado
// (deberia ser ~125 ms), sus percentiles, el tamaño de los mensajes y el tiempo de
// ida y vuelta de una accion (de mandar un movimiento a verlo reflejado).
import { Client } from '@stomp/stompjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
const URL = args.url ?? 'ws://localhost:8081/ws/websocket';
const ROOMS = Number(args.rooms ?? 10);
const PLAYERS = Math.min(4, Number(args.players ?? 4));
const SECONDS = Number(args.seconds ?? 45);
const ROLES = ['SEGURIDAD', 'SALUD', 'ECONOMIA', 'INFRAESTRUCTURA'];
const BUILDINGS = ['F', 'C', 'G', 'A'];
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Bot {
  constructor(code, role, building, create) {
    this.code = code;
    this.role = role;
    this.building = building;
    this.create = create;
    this.clientId = Math.random().toString(36).slice(2, 10);
    this.token = Math.random().toString(36).slice(2);
    this.messages = 0;
    this.bytes = 0;
    this.intervals = [];
    this.lastAt = 0;
    this.roundTrips = [];
    this.pending = null;
    this.x = 608;
    this.y = 800;
    this.dir = 1;
    this.state = null;
    this.started = false;
    this.lostRoundTrips = 0;
    this.corrections = 0;
    this.lobbyOk = false;
    this.joined = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.client = new Client({
        webSocketFactory: () => new WebSocket(URL),
        reconnectDelay: 0,
        heartbeatIncoming: 0,
        heartbeatOutgoing: 0,
        onConnect: () => resolve(),
        onWebSocketError: (error) => reject(error),
        onStompError: (frame) => reject(new Error(frame.headers.message)),
      });
      this.client.activate();
    });
  }

  subscribe() {
    this.client.subscribe(`/topic/game/${this.code}`, (message) => {
      const now = performance.now();
      const body = JSON.parse(message.body);
      const event = body.lastEvent;
      if (event?.type === 'LOBBY_OK' && event.playerId === this.clientId) this.lobbyOk = true;
      if (event?.type === 'JOIN_OK' && event.itemId === this.clientId) this.joined = true;
      if (event?.type === 'POSITION_CORRECTED' && event.playerId === this.role) this.corrections += 1;
      if (!body.players?.length && event) return; // rechazos sueltos
      this.messages += 1;
      this.bytes += message.body.length;
      if (this.started && this.lastAt) this.intervals.push(now - this.lastAt);
      this.lastAt = now;
      this.state = body;
      if (body.lobby?.started) this.started = true;
      const me = body.players?.find((p) => p.playerId === this.role);
      if (this.pending && me && Math.abs(me.x - this.pending.x) < 2) {
        this.roundTrips.push(now - this.pending.sentAt);
        this.pending = null;
      }
    });
  }

  send(destination, body) {
    this.client.publish({ destination: `/app/game/${this.code}/${destination}`, body: JSON.stringify(body) });
  }

  // Camina de lado a lado por el vestibulo (dentro de la velocidad que valida el servidor).
  step() {
    if (!this.started) return;
    // Una medicion sin respuesta en 2 s (jugador caido o movimiento rechazado) se descarta.
    if (this.pending && performance.now() - this.pending.sentAt > 2000) {
      this.lostRoundTrips += 1;
      this.pending = null;
    }
    this.x += this.dir * 14;
    if (this.x > 1500 || this.x < 500) this.dir *= -1;
    if (!this.pending) this.pending = { x: this.x, sentAt: performance.now() };
    this.send('move', { playerId: this.role, floor: 1, x: this.x, y: this.y });
    if (Math.random() < 0.3) this.send('attack', { playerId: this.role, type: 'BASIC', x: this.x, y: this.y, facing: 0 });
  }
}

async function main() {
  console.log(`Prueba de carga: ${ROOMS} salas x ${PLAYERS} jugadores, ${SECONDS}s contra ${URL}`);
  const bots = [];
  for (let r = 0; r < ROOMS; r += 1) {
    const code = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
    const building = BUILDINGS[r % BUILDINGS.length];
    for (let p = 0; p < PLAYERS; p += 1) bots.push(new Bot(code, ROLES[p], building, p === 0));
  }

  const connectStart = performance.now();
  await Promise.all(bots.map((bot) => bot.connect()));
  console.log(`${bots.length} conexiones abiertas en ${Math.round(performance.now() - connectStart)} ms`);
  bots.forEach((bot) => bot.subscribe());

  // Salas: el primero crea, el resto entra; todos eligen rol y el primero inicia.
  const waitFor = async (predicate, label, timeoutMs = 10000) => {
    const until = performance.now() + timeoutMs;
    while (!predicate() && performance.now() < until) await sleep(100);
    if (!predicate()) console.warn(`aviso: ${label} no se completo para todos`);
  };
  const hosts = bots.filter((b) => b.create);
  hosts.forEach((bot) => bot.send('lobby', { clientId: bot.clientId, create: true, building: bot.building }));
  await waitFor(() => hosts.every((b) => b.lobbyOk), 'crear las salas');
  hosts.forEach((bot) => bot.send('join', { role: bot.role, clientId: bot.clientId, token: bot.token }));
  await waitFor(() => hosts.every((b) => b.joined), 'el anfitrion entre');
  const guests = bots.filter((b) => !b.create);
  guests.forEach((bot) => bot.send('join', { role: bot.role, clientId: bot.clientId, token: bot.token }));
  await waitFor(() => guests.every((b) => b.joined), 'los invitados entren');
  hosts.forEach((bot) => bot.send('start', { playerId: bot.role }));
  await waitFor(() => bots.every((b) => b.started), 'empezar las partidas');

  const loop = setInterval(() => bots.forEach((bot) => bot.step()), 100);
  const startedAt = performance.now();
  await sleep(SECONDS * 1000);
  clearInterval(loop);
  const elapsed = (performance.now() - startedAt) / 1000;

  const intervals = bots.flatMap((bot) => bot.intervals);
  const roundTrips = bots.flatMap((bot) => bot.roundTrips);
  const totalMessages = bots.reduce((sum, bot) => sum + bot.messages, 0);
  const totalBytes = bots.reduce((sum, bot) => sum + bot.bytes, 0);
  const started = bots.filter((bot) => bot.started).length;
  const zombies = bots.filter((b) => b.create).reduce((sum, b) => sum + (b.state?.zombies?.length ?? 0), 0);

  const report = {
    salas: ROOMS,
    clientes: bots.length,
    clientesEnPartida: started,
    zombisVivosAlFinal: zombies,
    mensajesPorSegundoPorCliente: +(totalMessages / bots.length / elapsed).toFixed(1),
    tamanoPromedioMensajeKB: +((totalBytes / Math.max(1, totalMessages)) / 1024).toFixed(2),
    salidaTotalServidorKBps: +((totalBytes / 1024) / elapsed).toFixed(0),
    intervaloEstadoMs: { p50: Math.round(percentile(intervals, 50)), p95: Math.round(percentile(intervals, 95)), p99: Math.round(percentile(intervals, 99)) },
    correccionesDeMovimiento: bots.reduce((sum, bot) => sum + bot.corrections, 0),
    medicionesSinRespuesta: bots.reduce((sum, bot) => sum + bot.lostRoundTrips, 0),
    idaYVueltaMovimientoMs: { p50: Math.round(percentile(roundTrips, 50)), p95: Math.round(percentile(roundTrips, 95)), p99: Math.round(percentile(roundTrips, 99)) },
  };
  console.log(JSON.stringify(report, null, 2));
  if (args.out) {
    // Para comparar corridas (p. ej. desde otra maquina): se guarda con fecha y destino.
    const { writeFileSync } = await import('node:fs');
    const { hostname, cpus } = await import('node:os');
    writeFileSync(args.out, JSON.stringify({
      fecha: new Date().toISOString(),
      destino: URL,
      desde: hostname(),
      nucleosGenerador: cpus().length,
      segundos: SECONDS,
      ...report,
    }, null, 2));
    console.log(`reporte guardado en ${args.out}`);
  }
  bots.forEach((bot) => bot.client.deactivate());
  setTimeout(() => process.exit(0), 500);
}

main().catch((error) => {
  console.error('fallo la prueba de carga:', error);
  process.exit(1);
});
