# Seguridad de las APIs

Este documento explica contra qué se defiende el backend de Operación Garavito, qué
controles tiene, con qué prueba se demuestra cada uno, qué se decidió no hacer y qué
riesgos quedan. Las pruebas de ataque están en
[`backend/src/test/java/co/eci/operaciongaravito/security`](../backend/src/test/java/co/eci/operaciongaravito/security)
y corren en cada push (`./mvnw test`).

## 1. Modelo de amenazas

**No hay cuentas.** Cualquiera abre el juego, elige un apodo y juega. Por eso la
seguridad no se basa en "quién eres", sino en tres ideas:

1. **Autorización por asiento.** La conexión WebSocket que se sienta en un rol es la
   única que puede actuar como ese rol. El `playerId` que trae un mensaje se ignora:
   el servidor usa el puesto ligado a la conexión (`GameSessionService.seatRole`). Para
   volver tras un corte hay que presentar el token secreto del puesto.
2. **Servidor autoritativo.** El cliente propone (me muevo a x,y; ataco hacia allá;
   compro esto) y el servidor decide con sus propias reglas: velocidad máxima y
   paredes, alcance del arma desde su posición, precio y distancia al vendedor, tiempo
   mínimo de una misión. Los Garavitos, la vida y los zombis solo existen en el servidor.
3. **Límites de abuso.** Lo que un cliente honesto nunca hace (cientos de mensajes por
   segundo, miles de salas, suscribirse a salas ajenas, frames gigantes) se corta.

**Quién ataca y cómo:**

| Actor | Qué intenta | Por dónde |
|---|---|---|
| Jugador con un script (el caso del profesor) | Hacer trampa, suplantar a otro, tumbar el servidor | STOMP (`/ws`) y REST (`/api`) directo, sin el navegador |
| Un sitio web malicioso | Usar el navegador de la víctima para abrir el WebSocket | Cross-Site WebSocket Hijacking |
| Un tercero con su propia distribución de CloudFront | Llegar al EC2 saltándose nuestro CloudFront (p. ej. a `/actuator`) | La prefix list de CloudFront del Security Group es la de **todas** las cuentas |
| Alguien que lee el repositorio público | Encontrar secretos o detalles internos | Código, respuestas de error, `/api/estado` |

**Qué se protege:** la integridad de las partidas, la disponibilidad del único EC2
(t4g.small con PostgreSQL local), el ranking y las métricas internas.

## 2. Controles implementados

### Canal STOMP (`/ws`)

| Control | Dónde | Prueba |
|---|---|---|
| Solo `SUBSCRIBE` a `/topic/game/{código}` exacto o a la cola privada `/user/queue/eventos`. Un comodín (`/topic/**`, que antes leía **todas** las salas) o cualquier otro destino corta la conexión | `StompGuardInterceptor` | `CanalStompSecurityTest.wildcardSubscribeIsRejected`, `otherSubscriptionsAreRejected` |
| Solo `SEND` a `/app/game/...`. Antes se podía publicar directo en `/topic/game/{sala}` y mandarles un estado falso a todos los jugadores | `StompGuardInterceptor` | `CanalStompSecurityTest.cannotPublishToBrokerTopic` |
| Tope de suscripciones por conexión (4) | `StompGuardInterceptor` | `subscriptionsAreCapped` |
| Token bucket por conexión: 40 mensajes/s sostenidos, ráfaga de 80. Lo que sobra se descarta; si sigue, se corta | `StompGuardInterceptor` | `floodIsRateLimited`, y `normalClientIsNotLimited` (movimiento a 10 Hz más acciones no se corta) |
| Frames de máximo 8 KB, buffer y tiempo de envío acotados. **Ya pasaba** por el buffer de 8 KB que Tomcat trae por defecto; ahora queda explícito y configurable | `WebSocketConfig` | `oversizedFrameIsRejected`, `JuegoSecurityTest.hugeTokenIsRejected` (60 KB) |
| Una conexión que no manda el `CONNECT` de STOMP en 10 s se cierra (revisión propia cada segundo: la de Spring solo corre si hay tráfico de salida) | `SesionesWebSocket` | `idleConnectionIsClosed` |
| Máximo 50 conexiones a la vez por IP (alto a propósito: un salón entero puede salir por la misma IP de la universidad). Sin esto, una sola máquina abre cientos y prueba códigos de sala en paralelo | `SesionesWebSocket` | `JuegoSecurityTest.connectionsPerIpAreCapped` |
| `Origin` del handshake: solo el dominio propio (antes también `*.cloudfront.net`, es decir, páginas en CloudFront de cualquiera) | `WebSocketConfig`, `infra/lib/garavito-stack.ts` | `foreignOriginIsRejected`, `infra/test/verificar-stack.ts` |

### Salas

| Control | Dónde | Prueba |
|---|---|---|
| El **servidor** genera el código con `SecureRandom` (6 caracteres de un alfabeto de 32: unos 1.070 millones de combinaciones) y se lo responde solo a quien creó la sala. Antes lo inventaba el navegador con `Math.random`: 4 letras, unas 330 mil combinaciones | `GameController.createRoom`, `GameSessionService.createWithServerCode` | `SalasSecurityTest.serverGeneratesTheCode`, `clientCannotPickTheCode` |
| Tope de salas por nodo (200), por conexión (3) y por IP (20 cada 10 min) | `GameSessionService.atRoomCap`, `LimiteSalas` | `roomsPerNodeAreCapped`, `roomsPerConnectionAreCapped`, `roomsPerIpAreCapped` |
| Una sala sin jugadores más de 60 s se borra y se cancela su tick. Antes una sala creada y nunca usada vivía para siempre (miles de salas = memoria y CPU agotadas) | `GameSessionService.startTicking/closeRoom` | `emptyRoomExpires` |
| Los rechazos (sala no existe, puesto tomado, token malo) van solo a quien los causó. Antes salían en el topic público: confirmaban qué códigos existen y mostraban el `clientId` | `GameSessionService.reply` | `rejectionsArePrivate` |
| Una conexión ocupa un solo puesto (reserva atómica: los `join` de una conexión llegan en paralelo) | `GameSessionService.reserveSeat` | `oneSeatPerConnection` |

### Trampas desde un cliente con script

Estas defensas ya existían (servidor autoritativo); ahora tienen prueba contra el
servidor real:

| Ataque | Prueba |
|---|---|
| Mandar acciones con el `playerId` de otro (moverlo, sacarlo, gastarle la plata) | `JuegoSecurityTest.spoofedPlayerIdIsIgnored`, `SeatOwnershipTest` |
| Actuar sin haberse sentado (iniciar la partida, comprar, sacar a alguien) | `actionsWithoutJoinAreIgnored` |
| Ocupar un rol ya tomado | `takenRoleIsRejected` |
| Volver a un puesto con un token válido pero adivinado | `rejoinWithWrongTokenFails` |
| Speed hack: salto de 1500 px | `speedhackIsCorrected` |
| Transferencias negativas, de cero, mayores al saldo o con desbordamiento | `negativeTransferIsRejected` |
| 2000 pedidos de sala desde 4 conexiones | `thousandsOfCreatesAreCapped` |
| Suscribirse a una sala sin conocer su código | `unknownRoomSubscriptionGetsNothing` |

### Validación de entrada

| Control | Dónde | Prueba |
|---|---|---|
| Los 28 `@MessageMapping` validan antes de tocar la sala: cuerpo `null`, ids (`[a-z0-9-]{1,48}`), constantes (`[A-Z_]{1,32}`), `clientId`, apodo (máx. 64, luego se limpia y recorta a 16), piso y coordenadas finitas | `GameController`, `Entrada` | `EntradaSecurityTest.brokenBodiesAreRejected`, `badIdentifiersAreRejected` |
| **Exploit real arreglado:** Jackson convierte el texto `"NaN"` en `Double.NaN`, y toda comparación con NaN da `false`. Un ataque con `x/y/facing = "NaN"` mataba a **todos los zombis del piso**, en cualquier dirección. Ahora se rechaza en el controlador y otra vez en `GameSession` | `GameController.attack`, `GameSession.attemptAttack` | `CoordenadasNoFinitasTest`, `EntradaSecurityTest.nanAttackDoesNotHitEverything`, `nanMoveIsRejected` |
| Token del puesto con formato (`[A-Za-z0-9-]{16,64}`) y comparado en tiempo constante (`MessageDigest.isEqual`) | `GameController.join/rejoin`, `GameSession.rejoin` | `EntradaSecurityTest.badTokensAreRejected`, `ReconnectTest` |
| `@MessageExceptionHandler`: un cuerpo roto se cuenta y se descarta sin volcar una traza al log por cada intento | `GameController.onBadMessage` | `brokenBodiesAreRejected` |

### REST (`/api/**`) y actuator

| Control | Dónde | Prueba |
|---|---|---|
| **Filtro de origen**: con `SECURITY_ORIGIN_SECRET`, toda petición (HTTP y el handshake de `/ws`) sin el header `X-Origin-Verify` correcto recibe 403. CloudFront lo agrega; una distribución ajena no lo conoce | `OrigenVerificadoFilter`, `infra/lib/garavito-stack.ts` | `OrigenSecurityTest`, `infra/test/verificar-stack.ts` |
| Actuator en producción: solo `health` y `prometheus`, en `127.0.0.1:9091` (el Security Group solo abre 8080) | `application.properties` | `ActuatorProduccionTest` |
| Límite por IP en `/api/**`: 10 peticiones/s, ráfaga de 30; lo que sobra recibe 429 | `ApiRateLimitFilter` | `ApiRateLimitTest` |
| Ranking con caché corta (8 s, se vacía al guardar una partida) y sin N+1: de 13 consultas a 4 para 10 partidas. Índice sobre la llave foránea `match_player(match_id)` (migración V4) | `MatchHistoryService`, `MatchRecord`, `V4__indice_jugadores_por_partida.sql` | `RankingRendimientoTest` |
| Errores sin traza, mensaje, clases ni versión de Tomcat; sin header `Server`. **Ya salían limpios** con los valores de Spring Boot 4: ahora queda fijo y probado | `application.properties` | `ApiRestSecurityTest.errorsRevealNothing` |
| POST/PUT/DELETE en todas las APIs → 405; parámetros con SQL, `%00` o gigantes → respuesta por defecto, nunca 500. **Ya se cumplía** (todo es GET y los parámetros pasan por `parseOrDefault`) | Controladores | `ApiRestSecurityTest` |
| `/api/estado` muestra el nombre del nodo (`NODE_NAME`), no su URL interna | `GameSessionService.estado` | `EstadoTest.estadoDoesNotLeakNodeUrl` |
| `application.properties` se carga de verdad (un separador `#---` mal escrito hacía que Spring ignorara el archivo entero sin avisar) | — | `ConfiguracionCargadaTest` |

### Llaves foráneas: de la entidad al controlador

- `match_player.match_id → match_record(id)` existe y es `NOT NULL` (migración V1).
- Ningún controlador devuelve una entidad JPA: `/api/ranking` responde con los records
  `Ranking` y `RankedMatch`. No hay endpoints que escriban en la base, así que no hay
  asignación masiva ni forma de tocar una llave foránea desde afuera. El historial lo
  escribe solo el servidor, al terminar una corrida.
- El apodo (lo único que viene del cliente y se guarda) se limpia y se recorta a 16
  caracteres, por debajo de los 24 de la columna.
- Lo que sí había: la relación era `EAGER` y sin índice. Era N+1 (una consulta por
  partida) y cada una recorría toda la tabla `match_player`. Arreglado arriba.

### Infraestructura (CloudFront)

| Control | Prueba |
|---|---|
| `X-Origin-Verify` desde CloudFront hacia el EC2; el secreto se pasa al desplegar y nunca va en el repositorio (sin él, el stack no sintetiza) | `infra/test/verificar-stack.ts` |
| HSTS (1 año), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y una CSP (`infra/lib/encabezados.json`) en todas las rutas | `infra/test/verificar-stack.ts`; `frontend/scripts/probar-csp.mjs` juega una partida con esa CSP: 0 violaciones |

### Observabilidad

Cada rechazo se cuenta en `garavito.rejected{reason=...}` (en Prometheus,
`garavito_rejected_total`). El tablero de Grafana tiene el panel **"Ataques
detectados"**, con los rechazos por segundo de cada razón:

| `reason` | Significa |
|---|---|
| `rate_limit` | Mensajes STOMP de más |
| `bad_subscribe` | Suscripción a un destino prohibido (comodín, sala ajena con formato raro, cola de otro) |
| `bad_destination` | `SEND` fuera de `/app/game/...` |
| `bad_payload` | Cuerpo inválido (null, JSON roto, ids o coordenadas fuera de formato) |
| `bad_token` | Token de puesto con formato inválido o equivocado |
| `room_cap` / `seat_cap` | Intentó crear salas de más u ocupar más de un puesto |
| `idle` | Conexión que nunca mandó el `CONNECT` |
| `bad_origin` | Petición sin el header de CloudFront |
| `api_rate_limit` | REST en bucle |
| `conn_cap` | Demasiadas conexiones a la vez desde una IP |

### Dependencias

- CI: `npm audit --audit-level=high` en el frontend y Trivy sobre `backend/pom.xml`
  (equivalente a OWASP dependency-check): fallan con vulnerabilidades altas o críticas.
- `.github/dependabot.yml` propone las actualizaciones cada semana.
- Se aplicó `npm audit fix` (sin cambios incompatibles): las 4 vulnerabilidades altas eran
  de herramientas de desarrollo (vite, eslint). Quedan 4 moderadas en eslint (arreglarlas
  pide una versión incompatible) y 2 moderadas en `aws-cdk-lib` (solo se usa al desplegar).
  Lo que llega al navegador (`react`, `phaser`, `@stomp/stompjs`, `sockjs-client`) sale
  sin vulnerabilidades en `npm audit --omit=dev`.

## 3. Configuración

Todo en `backend/src/main/resources/application.properties`, con los valores de
producción:

| Propiedad | Por defecto | Para qué |
|---|---|---|
| `security.ratelimit.enabled` / `.messages-per-second` / `.burst` / `.max-violations` | `true` / 40 / 80 / 200 | Token bucket STOMP por conexión |
| `security.stomp.max-subscriptions` | 4 | Suscripciones por conexión |
| `security.ws.message-size-limit` / `.time-to-first-message-ms` | 8192 / 10000 | Transporte |
| `security.ws.max-connections-per-ip` | 50 | Conexiones WebSocket a la vez por IP |
| `security.rooms.max-per-node` / `.max-per-connection` / `.max-per-ip` | 200 / 3 / 20 | Topes de salas |
| `security.rooms.empty-ttl-ms` | 60000 | Vida de una sala vacía |
| `security.rooms.client-codes-allowed` | `false` | Modo heredado: el cliente elige el código |
| `security.api.ratelimit-enabled` / `.requests-per-second` / `.burst` | `true` / 10 / 30 | Límite REST por IP |
| `security.origin-secret` (`SECURITY_ORIGIN_SECRET`) | vacío (sin filtro) | Filtro de origen |
| `security.trust-forwarded-for` (`SECURITY_TRUST_FORWARDED_FOR`) | `false` | Tomar la IP real de `X-Forwarded-For` detrás de CloudFront |

**Perfil `carga`** (`application-carga.properties`): apaga los límites de abuso y deja
que el cliente elija el código. Lo necesitan k6 y `frontend/scripts/load-test.mjs`,
cuyos jugadores falsos se encuentran eligiendo el mismo código y salen todos de la misma
máquina. Se usa junto a otro perfil: `--spring.profiles.active=dev,carga`. **Nunca en
producción.**

## 4. Controles descartados

| Idea | Por qué no |
|---|---|
| Cuentas de usuario (login, JWT, OAuth) | El juego es anónimo a propósito. Suplantar un puesto ya está cubierto: autorización por conexión más token secreto del puesto |
| Spring Security completo | No hay usuarios ni roles que autenticar. Los filtros e interceptores propios cubren el origen, los límites y los destinos, con menos piezas |
| Permitir `SUBSCRIBE` a una sala solo a quien ya está sentado | El cliente necesita suscribirse **antes** de entrar para recibir `LOBBY_OK` y el estado inicial. A cambio: códigos al azar de 6 caracteres, límites por conexión y rechazos privados |
| Caffeine y Bucket4j | El ranking tiene como mucho una llave por edificio y modo (enums), y el token bucket son unas 40 líneas probadas. Una dependencia nueva no aportaba nada |
| Guardar el secreto de origen en Secrets Manager | Los headers personalizados de CloudFront no pueden leer un secreto en tiempo de ejecución: el valor tiene que estar en la plantilla |
| AWS WAF y TLS entre CloudFront y el EC2 | Propuestas con costo y pasos en [`infra/README.md`](../infra/README.md#propuestas-que-no-estan-aplicadas) |

## 5. Riesgos que quedan

- **Adivinar un código de sala sigue siendo posible, pero caro.** A 40 intentos por
  segundo por conexión, una sola conexión tarda unos 310 días en recorrer los mil
  millones de códigos. Desde una IP (máximo 50 conexiones), con 10 salas abiertas,
  encontrar una toma unas 15 horas; con muchas IPs, menos. Quien la encuentra solo puede
  ocupar un puesto libre o mirar: no puede actuar como otro jugador sin su token.
- **Un solo EC2.** Los límites protegen la aplicación, pero una inundación a nivel de red
  o miles de conexiones desde muchas IPs pueden saturar la máquina. Lo cubriría WAF
  (propuesta).
- **El secreto de origen queda en la plantilla de CloudFormation** (lo ve quien tenga
  lectura en la cuenta de AWS) y en `infra/cdk.out/` local (ignorado por git).
- **CloudFront → EC2 va por HTTP** dentro de la red de AWS (propuesta: TLS al origen).
- **Los límites viven en la memoria de cada nodo.** En el clúster, cada nodo cuenta por
  su lado (el tope por IP se multiplica por el número de nodos).
- **El perfil `dev`** acepta cualquier `Origin` y trae la consola de H2: es solo para
  desarrollo. El despliegue de `infra/` arranca el `.jar` sin perfil.
- **Trampas dentro de las reglas:** un bot que juega mejor que una persona (apunta solo,
  se mueve justo a la velocidad máxima) no se distingue de un jugador hábil.
- **Dependencias:** quedan vulnerabilidades moderadas en herramientas de desarrollo y
  despliegue (ver arriba).

## 6. Cómo comprobarlo

### Contra el sitio desplegado

`frontend/scripts/pentest.mjs` corre 18 ataques por STOMP y REST contra una URL y dice
cuáles defendió. Es liviano (crea 4 salas que se borran solas, inunda solo su propia
conexión y manda unas 50 peticiones REST), así que se puede lanzar contra el juego en
línea antes de la entrega:

```bash
cd frontend && node scripts/pentest.mjs https://www.operaciongaravito.me
```

Resultado contra el backend de este cambio (configuración de producción, local):
**18/18 defendidos**. El mismo script contra `main` antes del cambio defendió 6 de 18:
`/topic/**` leía todas las salas, el cliente elegía el código, no había límite de
mensajes, el actuator respondía en el puerto del juego y la API REST no tenía límite.
Los ataques que necesitan una sala creada por el servidor no se pudieron correr allí
(`/app/game/create` no existía), y uno de los 6 (W13, salas sin límite) salió bien solo
por eso; ahora el script lo cuenta como no concluyente.
El CI lo corre en cada push (job *Ataques*).

### Pruebas automáticas

```bash
# Todas las pruebas, incluidas las de ataque
cd backend && ./mvnw test

# El stack de CloudFront (sin desplegar)
cd infra && npx ts-node test/verificar-stack.ts

# El build del frontend con la CSP real (con un backend en :8080)
cd frontend && VITE_WS_URL=/ws npm run build && node scripts/probar-csp.mjs --backend 8080
```
