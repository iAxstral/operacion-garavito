// Prueba de carga con k6: cada usuario virtual (VU) es un jugador que se conecta por
// WebSocket + STOMP como el frontend, entra a una sala, juega (camina y ataca) y mide
// cada cuanto le llega el estado del juego y cuanto tarda en ver reflejado su movimiento.
// Cada 4 VUs comparten sala: el primero que llega la crea, los otros entran, y se
// inicia cuando estan los 4 (o a los 15 s si falta alguno).
//
//   k6 run k6/partidas.js
//   k6 run -e BASE_URL=http://192.168.1.20:8080 -e PERFIL=estres k6/partidas.js
//   k6 run -e BASE_URL=http://localhost:8080 k6/partidas.js   (balanceador del cluster)
//
// Para ver las metricas de k6 en Grafana junto a las del servidor (ver docs/k6):
//   K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
//   K6_PROMETHEUS_RW_TREND_STATS="p(50),p(95),p(99),avg,max" \
//   k6 run -o experimental-prometheus-rw --tag testid=partidas k6/partidas.js
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws/websocket';
const PERFIL = __ENV.PERFIL || 'carga';
// Lo que dura la sesion de cada jugador antes de desconectarse y volver a entrar.
const SESION_S = Number(__ENV.SESION_S || 60);

const ROLES = ['SEGURIDAD', 'SALUD', 'ECONOMIA', 'INFRAESTRUCTURA'];
const EDIFICIOS = ['F', 'C', 'G', 'A'];
const JUGADORES_POR_SALA = 4;

const PERFILES = {
  // Humo: una sala, para comprobar que todo responde antes de cargar.
  humo: [
    { duration: '10s', target: 4 },
    { duration: '30s', target: 4 },
    { duration: '5s', target: 0 },
  ],
  // Carga: lo que esperamos un dia de clase (hasta 20 salas, 80 jugadores).
  carga: [
    { duration: '30s', target: 40 },
    { duration: '1m', target: 40 },
    { duration: '30s', target: 80 },
    { duration: '1m', target: 80 },
    { duration: '20s', target: 0 },
  ],
  // Estres: subir hasta ver donde se degrada (hasta 50 salas, 200 jugadores).
  estres: [
    { duration: '1m', target: 80 },
    { duration: '1m', target: 160 },
    { duration: '1m', target: 200 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
};

export const options = {
  scenarios: {
    jugadores: {
      executor: 'ramping-vus',
      exec: 'jugador',
      startVUs: 0,
      stages: PERFILES[PERFIL],
      gracefulRampDown: `${SESION_S + 10}s`,
      gracefulStop: `${SESION_S + 10}s`,
    },
    // Quien mira el ranking en la pantalla de inicio: carga HTTP de fondo.
    ranking: {
      executor: 'constant-arrival-rate',
      exec: 'ranking',
      rate: 5,
      timeUnit: '1s',
      duration: PERFIL === 'humo' ? '40s' : '4m',
      preAllocatedVUs: 5,
    },
  },
  thresholds: {
    // Casi todos los jugadores logran entrar a su sala.
    entrada_exitosa: ['rate>0.95'],
    // El servidor emite estado cada ~125 ms: el p95 no debe pasar de 250 ms.
    intervalo_estado_ms: ['p(95)<250'],
    // Ver reflejado el propio movimiento: p95 por debajo de 300 ms.
    ida_y_vuelta_movimiento_ms: ['p(95)<300'],
    // El ranking (HTTP) responde rapido y sin errores.
    'http_req_duration{endpoint:ranking}': ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

const conexionStomp = new Trend('conexion_stomp_ms', true);
const intervaloEstado = new Trend('intervalo_estado_ms', true);
const idaYVuelta = new Trend('ida_y_vuelta_movimiento_ms', true);
const tamanoEstado = new Trend('tamano_estado_bytes');
const estadosRecibidos = new Counter('estados_recibidos');
const correcciones = new Counter('correcciones_de_posicion');
const redirecciones = new Counter('redirecciones_de_nodo');
// Conexiones que se cerraron antes de terminar la sesion sin ser una redireccion
// (por ejemplo, porque se cayo el nodo donde estaba la sala).
const sesionesCortadas = new Counter('sesiones_cortadas');
const entradaExitosa = new Rate('entrada_exitosa');
const entradaRechazada = new Counter('entrada_rechazada');

// --- STOMP minimo sobre el WebSocket crudo (/ws/websocket de SockJS) ---
const frame = (command, headers, body = '') =>
  `${command}\n${Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n')}\n\n${body}\0`;

function parseFrame(raw) {
  const sep = raw.indexOf('\n\n');
  if (sep < 0) return { command: raw.trim(), body: '' };
  return { command: raw.slice(0, raw.indexOf('\n')), body: raw.slice(sep + 2).replace(/\0\s*$/, '') };
}

// Sala de este VU: los VUs 1-4 van a la sala 0, 5-8 a la 1, etc. Cada iteracion
// (cada vez que el jugador vuelve a entrar) usa una sala nueva.
function salaDe(vu, iter) {
  const sala = Math.floor((vu - 1) / JUGADORES_POR_SALA);
  return `K${sala.toString(36).toUpperCase().padStart(3, '0')}${iter.toString(36).toUpperCase().padStart(2, '0')}`;
}

export function jugador() {
  const puesto = (__VU - 1) % JUGADORES_POR_SALA;
  const rol = ROLES[puesto];
  const codigo = salaDe(__VU, __ITER);
  const edificio = EDIFICIOS[Math.floor((__VU - 1) / JUGADORES_POR_SALA) % EDIFICIOS.length];
  const clientId = `k6-${__VU}-${__ITER}`;
  const token = `tok-${__VU}-${__ITER}-${Date.now()}`;
  const nombre = `k6-${__VU}-${__ITER}`;

  // Con varios nodos detras de un balanceador, la sala puede vivir en otro nodo: el
  // servidor responde LOBBY_REDIRECT y el jugador se reconecta alla (una sola vez).
  let url = WS_URL;
  let redirigirA = null;
  let res;
  for (let intento = 0; intento < 2; intento += 1) {
    redirigirA = null;
    const inicio = Date.now();
    res = ws.connect(url, {}, (socket) => {
      let salaOk = false;
      let entro = false;
      let empezo = false;
      let pidioConSalaLlena = false;
      let ultimoEstado = 0;
      let pendiente = null;
      let x = 608 + puesto * 40;
      let dir = 1;

      const enviar = (destino, cuerpo) =>
        socket.send(frame('SEND', { destination: `/app/game/${codigo}/${destino}`, 'content-type': 'application/json' }, JSON.stringify(cuerpo)));
      // Todos piden iniciar; el servidor solo le hace caso al anfitrion (el primero que entro).
      const iniciar = () => {
        if (!empezo) enviar('start', { playerId: rol });
      };
      // Primero intenta crear la sala; si ya existe (code_taken), entra a la existente.
      let crear = intento === 0;
      const pedirSala = () => enviar('lobby', { clientId, create: crear, building: edificio, mode: 'NORMAL' });

      socket.on('open', () => {
        socket.send(frame('CONNECT', { 'accept-version': '1.2', host: 'localhost', 'heart-beat': '0,0' }));
      });

      socket.on('message', (raw) => {
        if (raw === '\n') return; // latido
        const { command, body } = parseFrame(raw);
        if (command === 'CONNECTED') {
          conexionStomp.add(Date.now() - inicio);
          socket.send(frame('SUBSCRIBE', { id: 'sub-0', destination: `/topic/game/${codigo}` }));
          // Spring puede atender el SUBSCRIBE y el primer SEND en hilos distintos: se espera
          // un momento para no perder la respuesta, y se reintenta si igual no llega.
          socket.setTimeout(pedirSala, 500);
          socket.setInterval(() => {
            if (!salaOk) pedirSala();
          }, 3000);
          return;
        }
        if (command !== 'MESSAGE') return;

        const estado = JSON.parse(body);
        const evento = estado.lastEvent;
        if (evento) {
          if (evento.type === 'LOBBY_OK' && evento.playerId === clientId && !salaOk) {
            salaOk = true;
            enviar('join', { role: rol, clientId, token, name: nombre });
          } else if (evento.type === 'LOBBY_REJECTED' && evento.playerId === clientId) {
            if (evento.reason === 'code_taken') {
              crear = false;
              pedirSala();
            } else {
              socket.setTimeout(pedirSala, 1000);
            }
          } else if (evento.type === 'LOBBY_REDIRECT' && evento.playerId === clientId) {
            // La sala vive en otro nodo (modo cluster): se cierra y se reconecta alla.
            redirigirA = evento.reason;
            socket.close();
          } else if (evento.type === 'JOIN_REJECTED' && evento.playerId === clientId) {
            entradaRechazada.add(1, { motivo: evento.reason || 'desconocido' });
          } else if (evento.type === 'POSITION_CORRECTED' && evento.playerId === rol) {
            correcciones.add(1);
          }
        }
        if (!estado.players) return; // rechazo suelto, sin estado

        // Entro si el servidor lo confirma o si ya aparece en la sala con su nombre.
        if (!entro && ((evento && evento.type === 'JOIN_OK' && evento.itemId === clientId)
            || estado.players.some((p) => p.playerId === rol && p.name === nombre))) {
          entro = true;
          // Si no se completa la sala, se inicia igual a los 15 s.
          socket.setTimeout(iniciar, 15000);
          socket.setTimeout(iniciar, 20000);
        }

        const ahora = Date.now();
        estadosRecibidos.add(1);
        tamanoEstado.add(body.length);
        if (estado.lobby && estado.lobby.started && !empezo) {
          empezo = true;
          ultimoEstado = 0; // el intervalo se mide desde que arranca la partida
        }
        // Apenas estan los 4 jugadores se pide iniciar (una vez por jugador).
        if (entro && !pidioConSalaLlena && estado.players.length >= JUGADORES_POR_SALA) {
          pidioConSalaLlena = true;
          iniciar();
        }
        if (empezo && ultimoEstado) intervaloEstado.add(ahora - ultimoEstado);
        ultimoEstado = ahora;

        const yo = estado.players.find((p) => p.playerId === rol);
        if (pendiente && yo && Math.abs(yo.x - pendiente.x) < 2) {
          idaYVuelta.add(ahora - pendiente.enviado);
          pendiente = null;
        }
      });

      // Camina de lado a lado por el vestibulo a una velocidad que el servidor acepta.
      socket.setInterval(() => {
        if (!empezo) return;
        if (pendiente && Date.now() - pendiente.enviado > 2000) pendiente = null; // sin respuesta: se descarta
        x += dir * 14;
        if (x > 1500 || x < 500) dir *= -1;
        if (!pendiente) pendiente = { x, enviado: Date.now() };
        enviar('move', { playerId: rol, floor: 1, x, y: 800 });
        if (Math.random() < 0.3) enviar('attack', { playerId: rol, type: 'BASIC', x, y: 800, facing: 0 });
      }, 100);

      let termino = false;
      socket.on('close', () => {
        if (!termino && !redirigirA) sesionesCortadas.add(1);
      });

      socket.setTimeout(() => {
        termino = true;
        entradaExitosa.add(entro);
        enviar('leave', { playerId: rol });
        // El servidor atiende el leave por el puesto de esta conexion: se cierra un
        // momento despues para que no llegue el cierre antes que el leave.
        socket.setTimeout(() => socket.close(), 1000);
      }, SESION_S * 1000);
    });
    if (!redirigirA) break;
    redirecciones.add(1);
    url = redirigirA.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws/websocket';
  }

  check(res, { 'WebSocket abierto (101)': (r) => r && r.status === 101 });
  sleep(1);
}

export function ranking() {
  const edificio = EDIFICIOS[Math.floor(Math.random() * EDIFICIOS.length)];
  const res = http.get(`${BASE_URL}/api/ranking?building=${edificio}`, { tags: { endpoint: 'ranking' } });
  check(res, { 'ranking 200': (r) => r.status === 200 });
}
