# Escenarios de calidad — Operación Garavito (Release 2)

Cada escenario sigue la plantilla de *Software Architecture in Practice* (Bass,
Clements y Kazman): **fuente → estímulo → artefacto → entorno → respuesta → medida
de la respuesta**. Al final de cada uno está la **validación ejecutable** (prueba,
script o métrica) y dónde se documenta en detalle.

| # | Atributo | Escenario | Detalle |
|---|---|---|---|
| ED-1 | Disponibilidad | Se cae un nodo del backend en plena partida | [DISPONIBILIDAD.md](DISPONIBILIDAD.md) |
| ED-2 | Escalabilidad | La demanda pasa de 80 a 200 jugadores | [DISPONIBILIDAD.md](DISPONIBILIDAD.md), [RENDIMIENTO.md](RENDIMIENTO.md) |
| ES-1 | Seguridad (autorización) | Un jugador con un script intenta actuar como otro | [SEGURIDAD.md](SEGURIDAD.md) |
| ES-2 | Seguridad (resistir ataques) | Inundación de mensajes y de salas desde una máquina | [SEGURIDAD.md](SEGURIDAD.md) |
| ES-3 | Seguridad (integridad y detección) | Entradas maliciosas y acceso directo al servidor saltándose CloudFront | [SEGURIDAD.md](SEGURIDAD.md) |
| EM-1 | Mantenibilidad | Un desarrollador sube código a cualquier rama | [MANTENIBILIDAD.md](MANTENIBILIDAD.md) |
| EP-1 | Portabilidad | Migrar de AWS a un servidor propio (on-premise) | [PORTABILIDAD.md](PORTABILIDAD.md) |
| ER-1 | Rendimiento | 80 jugadores jugando a la vez (operación esperada) | [RENDIMIENTO.md](RENDIMIENTO.md) |
| ER-2 | Rendimiento | Pico brusco de 20 a 200 jugadores en 10 s | [RENDIMIENTO.md](RENDIMIENTO.md) |
| EO-1 | Observabilidad | El servidor se degrada | [grafana/README.md](grafana/README.md) §6, [RENDIMIENTO.md](RENDIMIENTO.md) |
| EC-1 | Concurrencia | Varios jugadores hacen la misma acción en el mismo instante | [CONCURRENCIA.md](CONCURRENCIA.md) |

---

## ED-1 · Disponibilidad: se cae un nodo

| Parte | Valor |
|---|---|
| Fuente | Falla de infraestructura (la EC2 de un nodo se detiene o el proceso muere) |
| Estímulo | Un nodo del backend deja de responder con jugadores conectados |
| Artefacto | Nodos del backend detrás del balanceador (ALB en AWS, nginx en el compose) |
| Entorno | Operación normal, partidas repartidas en los dos nodos |
| Respuesta | El balanceador saca al nodo caído (chequeo de salud cada 10 s, 2 fallos) y manda las conexiones nuevas al nodo vivo. Las salas del nodo vivo siguen sin interrupción. Las partidas que vivían en el nodo caído se pierden (su estado está en memoria, decisión de diseño) y sus jugadores pueden crear otra sala de inmediato; Redis olvida esas salas al vencer su registro (2 min) |
| Medida | ≥ 99 % de conexiones nuevas exitosas durante la caída y 100 % después; latencia de los que siguen jugando sin cambio; disponibilidad del servicio ≥ 99,9 % mensual (cálculo en DISPONIBILIDAD.md) |
| Resultado medido | Compose local: 2 de 221 conexiones fallaron justo en la caída (99 %), 207 de 207 entraron después, estado p95 132 ms antes y después; 12 sesiones del nodo caído cortadas |
| Validación | Experimento de caída con k6 en [escalado/README.md](escalado/README.md) §4 (`docs/escalado/k6-caida-nodo.txt`); en AWS, `aws ec2 stop-instances` sobre un nodo con el tablero de Grafana abierto (DISPONIBILIDAD.md §6) |

## ED-2 · Escalabilidad: crece la demanda

| Parte | Valor |
|---|---|
| Fuente | Usuarios (lanzamiento, una clase entera entra a la vez) |
| Estímulo | Los jugadores concurrentes pasan de 80 a 200 |
| Artefacto | Backend (salas en memoria, tick de 66 ms por sala) |
| Entorno | Operación normal |
| Respuesta | Se agrega un nodo sin cambiar código (otra instancia detrás del balanceador, misma imagen); las salas nuevas se reparten y el registro sala → nodo en Redis redirige a quien busca una sala de otro nodo |
| Medida | Con 200 jugadores: ida y vuelta del movimiento p95 < 300 ms y entrada exitosa > 95 %; escalar = 1 cambio de configuración (`NODOS` en `infra/lib/distribuido-stack.ts` o un servicio más en el compose) |
| Validación | `k6 run -e PERFIL=estres k6/partidas.js` (RENDIMIENTO.md); demo de 2 nodos en escalado/README.md §3 |

## ES-1 · Seguridad (autorización): suplantar a otro jugador

| Parte | Valor |
|---|---|
| Fuente | Jugador malicioso con un cliente STOMP propio (sin el navegador) |
| Estímulo | Manda acciones (`move`, `transfer`, `leave`, `start`) con el `playerId` de otro rol, o intenta volver al puesto de otro adivinando su token |
| Artefacto | `GameController`, `GameSessionService.seatRole`, `GameSession.rejoin` |
| Entorno | Partida en curso, producción |
| Respuesta | El servidor ignora el `playerId` del mensaje y atribuye la acción al puesto ligado a la conexión; sin puesto, la acción se descarta. Volver a un puesto exige el token secreto del puesto (16–64 caracteres, comparado en tiempo constante) |
| Medida | 0 acciones aplicadas sobre un puesto ajeno; 0 reingresos con token equivocado |
| Tácticas (Bass et al.) | *Authenticate actors* (token por puesto), *Authorize actors* (puesto ligado a la conexión), *Validate input* |
| Validación | `SeatOwnershipTest`, `JuegoSecurityTest.spoofedPlayerIdIsIgnored`, `actionsWithoutJoinAreIgnored`, `rejoinWithWrongTokenFails`, `GameControllerTest.strangerCannotAct` |

## ES-2 · Seguridad (resistir ataques): inundación desde una máquina

| Parte | Valor |
|---|---|
| Fuente | Script automatizado (el escenario "el profe nos mete tráfico") |
| Estímulo | Cientos de mensajes STOMP por segundo por conexión, miles de pedidos de sala, cientos de conexiones desde una IP, ráfagas a `/api` |
| Artefacto | `StompGuardInterceptor`, `LimiteSalas`, `SesionesWebSocket`, `ApiRateLimitFilter` |
| Entorno | Producción, con jugadores legítimos en otras salas |
| Respuesta | Token bucket por conexión (40 msg/s, ráfaga 80): lo que sobra se descarta y, si insiste, se corta la conexión. Topes de salas por nodo (200), conexión (3) e IP (20/10 min), de conexiones por IP (50) y de peticiones REST por IP (10/s → 429). Cada rechazo se cuenta en `garavito_rejected_total{reason}` |
| Medida | Un cliente legítimo (10 Hz de movimiento + acciones) nunca se limita; el atacante queda acotado a los topes; el tick p99 de las demás salas no supera 66 ms |
| Tácticas | *Limit access*, *Limit exposure*, *Detect service denial* (métrica + panel "Ataques detectados"), *Revoke access* (cortar la conexión) |
| Validación | `CanalStompSecurityTest.floodIsRateLimited` y `normalClientIsNotLimited`, `SalasSecurityTest.roomsPer*AreCapped`, `JuegoSecurityTest.thousandsOfCreatesAreCapped`, `connectionsPerIpAreCapped`, `ApiRateLimitTest`; `node frontend/scripts/pentest.mjs <url>` (job "Ataques" del CI) |

## ES-3 · Seguridad (integridad y detección): entradas maliciosas y saltarse CloudFront

| Parte | Valor |
|---|---|
| Fuente | Atacante que conoce el código (el repositorio es público) |
| Estímulo | (a) Coordenadas `"NaN"` en un ataque (antes mataba a todos los zombis del piso), cuerpos rotos o frames de 60 KB; (b) peticiones directas al EC2 con su propia distribución de CloudFront para llegar a `/actuator` o al juego sin nuestras protecciones |
| Artefacto | `Entrada`, `GameController`, `GameSession.attemptAttack`, `OrigenVerificadoFilter`, Security Groups |
| Entorno | Producción |
| Respuesta | (a) Validación de formato en los 28 `@MessageMapping` (ids, constantes, números finitos, tamaño) y otra vez dentro de la sala: lo inválido se descarta y se cuenta como `bad_payload`. (b) Toda petición sin el header secreto `X-Origin-Verify` que pone nuestro CloudFront recibe 403 (`bad_origin`); el actuator escucha en otro puerto que el Security Group no abre a internet |
| Medida | 0 zombis afectados por un ataque con NaN; 100 % de peticiones sin el header → 403; los rechazos aparecen en Grafana en ≤ 15 s (scrape de 5 s) |
| Tácticas | *Validate input*, *Verify message integrity* (secreto de origen), *Limit exposure* (actuator aislado), *Detect intrusion* / *Maintain audit trail* (métrica por razón + alertas) |
| Validación | `CoordenadasNoFinitasTest`, `EntradaSecurityTest.nanAttackDoesNotHitEverything`, `brokenBodiesAreRejected`, `OrigenSecurityTest`, `ActuatorProduccionTest`, `infra/test/verificar-stack.ts` |

> **JWT:** el juego no tiene cuentas a propósito (cualquiera entra con un apodo), así
> que no hay identidad que firmar en un JWT. La autenticación necesaria —demostrar que
> eres quien ocupa un puesto— la cumple el token secreto por puesto, comparado en
> tiempo constante. Justificación en [SEGURIDAD.md](SEGURIDAD.md) §4.

## EM-1 · Mantenibilidad: inspección continua

| Parte | Valor |
|---|---|
| Fuente | Desarrollador del equipo |
| Estímulo | Hace push o abre un PR a cualquier rama |
| Artefacto | Código del backend y del frontend; pipeline de GitHub Actions |
| Entorno | Desarrollo |
| Respuesta | El CI (reusable workflows) corre pruebas con cobertura, lint, Trivy, pentest, e2e y k6, y SonarQube analiza las dos capas y aplica el Quality Gate; si el Gate queda en rojo o baja una prueba, el pipeline falla |
| Medida | Cobertura ≥ 80 % por capa, calificación A en confiabilidad/seguridad/mantenibilidad, 0 vulnerabilidades altas; resultado en < 15 min |
| Validación | `.github/workflows/ci.yml` y `reusable-*.yml`; tablero de SonarQube (MANTENIBILIDAD.md) |

## EP-1 · Portabilidad: de AWS a on-premise

| Parte | Valor |
|---|---|
| Fuente | La universidad (o el equipo) decide dejar AWS |
| Estímulo | Migrar el sistema completo a servidores propios |
| Artefacto | Todos los componentes: frontend, balanceador, backend, PostgreSQL, Redis, Prometheus, Grafana |
| Entorno | Servidores Linux con Docker, sin servicios de AWS |
| Respuesta | Todo corre en contenedores con imágenes estándar (nginx, Temurin, postgres, redis, prometheus, grafana); la configuración entra por variables de entorno; los datos se mueven con `pg_dump`/`psql` |
| Medida | Sin cambios de código; el entorno completo se levanta con 1 comando (`docker compose up`) en < 10 min; el ranking se conserva |
| Validación | `docker-compose.cluster.yml`, `frontend/Dockerfile`, `backend/Dockerfile` (PORTABILIDAD.md) |

## ER-1 · Rendimiento: operación esperada

| Parte | Valor |
|---|---|
| Fuente | 80 jugadores en 20 salas |
| Estímulo | Cada uno manda su posición a 10 Hz y ataca; 5 consultas/s al ranking |
| Artefacto | Backend (WebSocket/STOMP, tick de las salas, API REST) |
| Entorno | Operación normal (un nodo) |
| Respuesta | El servidor procesa cada movimiento y difunde el estado de la sala cada ~125 ms |
| Medida | Movimiento confirmado p95 < 300 ms, intervalo de estado p95 < 250 ms, ranking p95 < 300 ms, errores HTTP < 1 %, entrada exitosa > 95 % |
| Validación | `k6 run -e PERFIL=carga k6/partidas.js` (umbrales en el script; resultados en RENDIMIENTO.md) |

## ER-2 · Rendimiento: pico brusco

| Parte | Valor |
|---|---|
| Fuente | Usuarios (todo un curso entra al mismo tiempo) |
| Estímulo | Los jugadores pasan de 20 a 200 en 10 s, se sostienen 1 min y vuelven a 20 |
| Artefacto | Backend |
| Entorno | Operación normal |
| Respuesta | El servidor acepta las conexiones, la latencia sube durante el pico y vuelve a su nivel base cuando la carga baja |
| Medida | Sin caídas ni errores HTTP; latencia de vuelta al valor base en ≤ 30 s tras el pico |
| Validación | `k6 run -e PERFIL=pico k6/partidas.js` con el registro de métricas del servidor (RENDIMIENTO.md) |

## EO-1 · Observabilidad: el servidor se degrada

| Parte | Valor |
|---|---|
| Fuente | Carga excesiva, ataque o falla de un nodo |
| Estímulo | El tick de las salas se acerca a su presupuesto (66 ms), la CPU se satura, un nodo deja de responder o se disparan los rechazos |
| Artefacto | Backend instrumentado (Micrometer), Prometheus, Grafana |
| Entorno | Producción o prueba de carga |
| Respuesta | Prometheus recolecta cada 5 s; Grafana muestra el panel correspondiente y dispara la alerta ("Backend caído", "El tick de una sala tarda más de 10 ms", "CPU del backend sobre 80 %", "Los jugadores reciben el estado tarde"); el panel "Ataques detectados" muestra los rechazos |
| Medida | La condición es visible en ≤ 15 s y la alerta se dispara en ≤ 2 min |
| Validación | `monitoring/grafana/provisioning/alerting/reglas.yml`, prueba en vivo en grafana/README.md §6; correlación k6 ↔ servidor en RENDIMIENTO.md |

## EC-1 · Concurrencia: la misma acción a la vez

| Parte | Valor |
|---|---|
| Fuente | Varios jugadores (o un script con varios hilos) |
| Estímulo | Dos o más jugadores recogen el mismo objeto, completan la misma misión, ocupan el mismo rol o se sientan con la misma conexión en el mismo instante, mientras el tick del servidor corre |
| Artefacto | `GameSession` (monitor), `ConcurrentHashMap`, `GameSessionService.reserveSeat` |
| Entorno | Partida en curso |
| Respuesta | Exactamente uno gana; los demás reciben un rechazo explícito; el estado difundido es consistente para todos |
| Medida | 0 duplicaciones (un objeto, un dueño; una misión pagada una vez), 0 pérdidas, 0 excepciones |
| Validación | `MissionBoardTest` (8 hilos), `GameSessionZombieTest`, `oneSeatPerConnection`, e2e `partida.spec.js` (CONCURRENCIA.md) |
