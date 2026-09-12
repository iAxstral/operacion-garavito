# Arquitectura — Operación Garavito

> **Nota:** este documento vive en el repo como fuente de verdad técnica. También
> debe reflejarse manualmente en la Wiki de Azure DevOps del equipo — eso lo
> hace el dueño del repo; no hay integración automática entre este archivo y
> la Wiki.

## Cambio de arquitectura (Sprint 1)

El "Cliente Jugador" **dejó de ser un dashboard de tarjetas** (React renderizando
tarjetas de estado/acciones) y pasó a ser **un cliente de juego 2D top-down**
construido con **Phaser 3**, embebido dentro de la misma app React/Vite. React
ya no dibuja la UI del juego directamente: monta el canvas de Phaser y aloja
UI periférica (paneles de estado, HUD futuro) alrededor de él.

El cliente mantiene, además, una **conexión WebSocket/STOMP** independiente
del ciclo de render de Phaser, para hablar con el backend (Game Service).

```
┌───────────────────────────────────────────────┐
│              Cliente Jugador (React)           │
│                                                 │
│   App.jsx                                      │
│    ├── GameCanvas.jsx ── monta ──▶ Phaser.Game  │
│    │                      └── MainScene         │
│    │                            (mapa, input,   │
│    │                             pickup, puertas)│
│    ├── Hud.jsx ─────┐   ── usa ──▶ socketService.js
│    ├── MainScene ───┤ gameSync.js   │ STOMP/SockJS
│    └── ConnectionStatus.jsx ─┘      │
└──────────────────────────────────────┼─────────┘
                                        ▼
                               /ws (SockJS fallback)
                                        │
┌───────────────────────────────────────┼─────────┐
│              Backend (Spring Boot)     │         │
│                                        │          │
│   WebSocketConfig ── registra ──▶ /ws (STOMP)    │
│                       habilita ──▶ /topic/** │    │
│   GameController ── @MessageMapping           │   │
│     /game/{id}/join, /pickup, /decide         │   │
│     ── difunde ──▶ /topic/game/{id}           │   │
│   GameSessionService / GameSession / Player   │   │
│     (vida + inventario, ver mas abajo)        │   │
│   RoundCoordinator (uno por GameSession)      │   │
│     (barrera de sincronizacion, ver mas abajo)│   │
│   TestSocketController (echo de prueba, /game/test) │
└────────────────────────────────────────────────┘
```

Este diagrama es de alto nivel; el detalle de cada pieza nueva (mapa,
animación, puertas, vida/inventario) está en sus propias secciones abajo.

## Componentes (frontend)

| Componente | Ruta | Responsabilidad |
|---|---|---|
| `GameCanvas.jsx` | `frontend/src/game/GameCanvas.jsx` | Monta/destruye una instancia de `Phaser.Game` dentro de un `useEffect`, tamaño fijo 800×600 (viewport — el mundo es más grande, ver "Mapa" abajo). Expone `window.__phaserGame` solo en dev, para depurar cámara/escena desde la consola. |
| `MainScene.js` | `frontend/src/game/MainScene.js` | Única escena de Phaser. Construye el mapa del piso a partir de `mapLayout.js`, carga el atlas real de Seguridad, define animaciones de caminata, procesa input (flechas/WASD), colisiones, puertas por proximidad, y la detección de pickup de items (ver secciones abajo). |
| `mapLayout.js` | `frontend/src/game/mapLayout.js` | Describe la geometría del piso en tiles (`buildFloorLayout`) — que celda es piso/pared/vidrio/escalera/etc, puertas, columnas, mobiliario placeholder. No sabe nada de Phaser; `MainScene` es quien la renderiza. |
| `itemCatalog.js` | `frontend/src/game/itemCatalog.js` | Catálogo de items recolectables (los 4 FOOD placeholder de la Cafetería). **Duplicado a propósito** con `WorldItemCatalog.java` del backend — ver "Vida e inventario". |
| `gameSync.js` | `frontend/src/game/gameSync.js` | Puente entre React (`Hud.jsx`) y Phaser (`MainScene.js`) para el estado de vida/inventario/ronda: ambos importan este módulo en vez de pasarse props/callbacks. Expone `ensureJoined`, `requestPickup`, `submitDecision`, `onStateChange`. Bridge de dev en `window.__gameSync`. |
| `spriteConfig.js` | `frontend/src/game/spriteConfig.js` | Config del spritesheet placeholder (ya no se usa activamente — ver "Animación" abajo; el atlas real de Seguridad reemplazó este mecanismo). |
| `socketService.js` | `frontend/src/services/socketService.js` | Wrapper sobre `@stomp/stompjs` + `sockjs-client`. **Singleton compartido** por `ConnectionStatus`, `Hud` y `gameSync` — soporta múltiples listeners de `onConnect` porque varios componentes independientes llaman a `connect()`. Usa `client.connected` (no `client.active`) como señal de "listo para publish/subscribe": `active` se pone en `true` casi de inmediato al llamar `activate()`, mucho antes de que el handshake STOMP realmente termine — usar `active` como guardia causaba un `TypeError: There is no underlying STOMP connection` intermitente. |
| `Hud.jsx` | `frontend/src/components/Hud.jsx` | HUD fijo (vida + 5 slots de inventario propios + número de ronda) + botón "Decidir" (placeholder, una sola acción fija) + panel de equipo (Tab/M) con vida/inventario de los otros jugadores + banner "¡Ronda N resuelta!". Toda la data viene de `gameSync`, ninguna la inventa localmente. |
| `ConnectionStatus.jsx` | `frontend/src/components/ConnectionStatus.jsx` | Panel de diagnóstico: confirma conexión y hace ping/echo de prueba. **No** desconecta el socket en su cleanup — el socket es compartido, desconectarlo ahí rompía a `Hud`/`gameSync` cuando React StrictMode desmonta/remonta en dev. |

## Mapa (piso 1, layout tipo "Among Us")

Un único tilemap continuo — vestíbulo central + salas conectadas por puertas,
sin escenas ni pantallas de carga entre ellas. `buildFloorLayout()` en
`mapLayout.js` genera la geometría (grid de tiles + decoraciones + mobiliario
placeholder); `MainScene` la renderiza con las texturas reales en
`frontend/public/tiles/` (`v2_floor_terrazo*`, `v2_wall_concreto`,
`v2_vidrio_lamas`, `v2_columna`, `v2_door_madera[_open]`, `v2_banca`,
`v2_baranda`, `v2_escalera`).

Mundo: 2560×1920px (40×30 tiles de 64px), cámara con `startFollow` sobre un
viewport fijo de 800×600. Salas: Aula F-104, Terraza, Cafetería, y una "zona
de baños" (pasillo lateral corto sin sala real detrás). El vestíbulo tiene 4
filas de piso caminable (antes 2) para que quepan 4 jugadores sin
amontonarse.

**Escalera**: bloque de 3 columnas × 4 filas de `v2_escalera` + un "rellano"
de 2×4 (piso normal con tinte celeste, `LANDING_TINT`) antes de la
transición, con un indicador `▲`/`▼` semitransparente encima. Solo marca la
zona de overlap por ahora (`updateStairsZones` en `MainScene`) — el cambio
de piso real (Piso 2/3, transición de cámara) **no está implementado
todavía**.

**Puertas por proximidad**: cada puerta cambia de textura (`v2_door_madera`
↔ `v2_door_madera_open`) según la distancia al jugador (90px), puramente
visual — las puertas siempre fueron caminables, no hay física de bisagra.

## Animación de Seguridad

Los ciclos de caminata se redujeron de 8 a 6 frames por dirección
(`down`/`right`/`up` en `MainScene.createAnimations()`), descartando los que
rompían la fluidez:

- `right`, `up`: frames 2-7 (se descartan 0-1, que están de frente/espalda
  en vez de perfil/espalda consistente).
- `down`: frames `[0,1,2,3,5,6]` (se descarta el 4, ángulo distinto, y el 7,
  que muestra al personaje de espaldas).

Causa raíz: la lámina fuente (`imagenes/personajes/Sin fondo/`) es una hoja
de referencia de personaje con distintos ángulos de cámara, no un ciclo de
caminata diseñado para animar — algunos de los 32 recortes automáticos caen
en un ángulo distinto al resto de su grupo de 8. `left` sigue sin ser una
animación propia: reutiliza los frames de `right` con `setFlipX`.

## Vida e inventario

Sistema nuevo, sincronizado con el backend por el **mismo topic**
`/topic/game/{gameId}` que a futuro usará el `RoundCoordinator` — un campo
más en el payload (`players`), no un canal aparte.

### Modelo de datos (backend, en memoria — no es una entidad JPA)

```
GameSessionService              (Map<gameId, GameSession>, @Service)
  └── GameSession(gameId)
        ├── players: Map<playerId, Player>       (playerId == rol)
        ├── worldItems: Map<itemId, WorldItem>    (catálogo fijo, sembrado al crear la sesión)
        └── claimedItems: Map<itemId, playerId>   (que se reclamó, para la carrera de concurrencia)

Player(role)
  ├── health: int (0-100, empieza en 100, sube con FOOD hasta el tope)
  └── inventory: List<InventorySlot>  (máx 5 — Player.MAX_INVENTORY_SLOTS)
```

`playerId == role` (`SEGURIDAD`/`SALUD`/`ECONOMIA`/`INFRAESTRUCTURA`): cada
partida tiene exactamente 4 roles fijos y únicos, así que el rol ya sirve
como identificador sin necesitar un sistema de cuentas. `gameId` está fijado
a `"default"` en el frontend (`gameSync.js`) — no hay lobby/matchmaking
todavía; el modelo ya soporta `gameId` variable si se necesita más adelante.

### Mensajes

- `/app/game/{gameId}/join` ⟵ `{ role }`
- `/app/game/{gameId}/pickup` ⟵ `{ playerId, itemId, x, y }` (`x,y` = posición
  actual del jugador, para una validación laxa de proximidad)
- `/topic/game/{gameId}` ⟶ `{ players: [...], claimedItemIds: [...], lastEvent }`
  — `lastEvent` (`JOIN_OK`/`JOIN_REJECTED`/`PICKUP_SUCCESS`/`PICKUP_REJECTED`,
  con `reason` en los rechazos) lo reciben todos los clientes, pero solo el
  jugador con `playerId` propio le presta atención (ej. mostrar "Inventario
  lleno"); el resto lo ignora.

### Concurrencia: dos jugadores recogiendo el mismo item

`GameSession.attemptPickup` resuelve la carrera con
`claimedItems.putIfAbsent(itemId, playerId)` — atómico, sin locks explícitos:
el primer hilo en llamarlo para un `itemId` dado es, por definición, el
único que puede recibir `null` como retorno. Si la validación posterior
(distancia o inventario lleno) falla, se libera el reclamo con el `remove`
condicional de 2 argumentos (también atómico) para no dejar el item perdido
para siempre — el siguiente jugador sí puede intentarlo.

Verificado con evidencia real (dos clientes STOMP reales, no mocks): el
perdedor de una carrera por el mismo item recibe `already_claimed`; un
pickup inválido (`too_far`, `inventory_full`) libera el reclamo
correctamente para un reintento válido posterior.

### Catálogo de items duplicado (deuda conocida)

`frontend/src/game/itemCatalog.js` y
`backend/.../game/WorldItemCatalog.java` tienen las mismas 4 posiciones/IDs
a mano. Si el catálogo crece o cambia seguido, vale la pena moverlo a un
JSON compartido — por ahora, para 4 items placeholder, no se justificó la
inversión.

## RoundCoordinator (barrera de sincronización)

Implementado en `backend/.../game/RoundCoordinator.java` — este es el
mecanismo de concurrencia central del proyecto (documentado antes en la
Wiki como pseudo-código aislado; esto es la implementación real,
integrada con `GameSession`/`Player`, y reemplaza esa versión).

**Patrón**: mismo concepto que un `CyclicBarrier` — todas las partes
"llegan" antes de que se dispare la acción, y esta se dispara una sola vez
— pero adaptado a mensajería asíncrona por WebSocket en vez de hilos
bloqueados en `await()`: "llegar a la barrera" es publicar `/decide`, y la
ronda se resuelve desde el hilo que entrega la 4ª decisión, o desde un
hilo del scheduler si se agota el timeout. Nunca hay un hilo esperando
bloqueado.

**Estructura**:
```
RoundCoordinator (uno por GameSession)
  ├── decisions: ConcurrentHashMap<role, action>   (put es atomico, sin lock)
  ├── schoolState: SchoolState                     (mutable, solo se toca dentro del lock de resolucion)
  └── resolveLock: Object                          (synchronized SOLO en tryResolve)

SchoolState: budget, population, infrastructureHealth, security, happiness
  (los mismos 5 campos documentados en la Wiki de arquitectura)
```

**Por qué el mapa concurrente no alcanza solo**: `decisions.put(role, action)`
es atómico por entrada, pero "¿ya llegaron las 4?" es una condición sobre
el mapa completo — comprobarla y actuar sobre ella (resolver + limpiar)
no es atómico por sí solo. Dos hilos podrían ver `size()==4` a la vez y
ambos intentar resolver. Por eso el único `synchronized` está en
`tryResolve`, con un doble chequeo *dentro* del lock (`currentRoundResolved`
y `decisions.size()`) — el mismo patrón de "chequear, entrar al lock,
re-chequear" que evita la doble resolución sin bloquear nada mientras
las decisiones van llegando una por una.

**Timeout (30s, `RoundCoordinator.TIMEOUT_SECONDS`)**: cada ronda programa
su propio timeout al crearse y al resolverse (`scheduleTimeout`). Si se
agota antes de tener las 4 decisiones, `tryResolve(forcedByTimeout=true)`
completa los roles faltantes con `DEFAULT_ACTION` ("no_action") y resuelve
igual — este es el manejo de desconexión ya documentado en la Wiki, ahora
real. El mismo `tryResolve` atiende ambos disparadores (4ª decisión o
timeout) bajo el mismo lock, así que no importa cuál llegue primero: el
otro es un no-op.

**Efecto sobre `SchoolState`** (`SchoolState.applyDecisions`, placeholder
de balance — el diseño real de efectos por acción queda fuera de alcance):
una decisión real cuesta presupuesto pero sube seguridad/felicidad; una
decisión por defecto no cuesta presupuesto pero deteriora la
infraestructura. Alcanza para demostrar que el efecto se aplica al estado
compartido; los valores/reglas exactas son ajustables después.

### Mensajes

- `/app/game/{gameId}/decide` ⟵ `{ playerId, action }` (`playerId` == rol;
  `action` hoy es un string libre — el catálogo de acciones por rol es un
  cambio aparte).
- `/topic/game/{gameId}` ⟶ el mismo `GameStateMessage` de vida/inventario,
  con un campo `round: { number, schoolState, resolved }` agregado —
  **no** un canal nuevo. `resolved` es una bandera "esto se resolvió justo
  en este mensaje": en broadcasts de join/pickup siempre va en `false`
  (solo informan el número/estado actual); en el broadcast que dispara el
  propio `RoundCoordinator` al resolver (por decisiones completas o por
  timeout) va en `true`. `/decide` no difunde nada por sí mismo — ver el
  javadoc de clase de `GameController` para el porqué (un solo camino de
  broadcast para "se resolvió la ronda", cubre ambos disparadores).

### Verificado con evidencia real

- **Concurrencia** (`frontend/scripts`-style test con 4 clientes STOMP
  reales, no mocks): 4 conexiones distintas enviando `/decide` casi
  simultáneamente para la misma ronda → exactamente 1 mensaje
  `round.resolved=true` visto por los 4 suscriptores, con el **mismo**
  `schoolState` en los 4 (no hay resoluciones duplicadas ni estados
  divergentes). Repetido 3 veces, consistente las 3.
- **Timeout**: solo 2 de 4 roles deciden; a los ~30s se resuelve solo, con
  `DEFAULT_ACTION` aplicado a los 2 faltantes — el `schoolState` resultante
  coincidió exactamente con el cálculo esperado (2 decisiones reales + 2
  default).
- **Frontend real**: HUD muestra "Ronda N" en vivo; al llegar
  `round.resolved=true`, aparece un banner "¡Ronda N resuelta!" —
  confirmado leyendo el DOM en el mismo instante del broadcast (con un
  round-trip de verificación separado, el banner ya se había autoocultado
  a los 3s — el mecanismo en sí funciona, solo hay que revisarlo rápido).

### HU del Backlog cubiertas

- **HU-01 (ver evento simultáneo)**: demostrable — cualquier jugador
  conectado a `/topic/game/{gameId}` ve la ronda resolverse (HUD: "Ronda N"
  + banner), sin importar quién disparó la resolución.
- **HU-02 (resolución consistente de decisiones concurrentes)**:
  demostrable — verificado arriba con 4 clientes reales, una sola
  resolución, mismo estado para todos.
- **HU-03 (votación)**: fuera de alcance de este cambio, como se acordó.

## Sistema de pisos (pendiente)

Se diseñó (bloque de escalera con `hasUpStairs`/`hasDownStairs` en
`buildFloorLayout`) pero **no se implementó el cambio de piso real**: al
pisar la escalera solo se muestra un mensaje placeholder
(`updateStairsZones` en `MainScene.js`). Falta: Piso 2/3 (reutilizando
`buildFloorLayout`), fade de cámara, swap del tilemap activo, reposicionar
al jugador en la escalera correspondiente del piso destino, y escalera de
bajada en pisos 2/3.

## Datasource: PostgreSQL (default) + H2 en desarrollo local

`application.properties` (default) apunta a PostgreSQL vía variables de
entorno (`SPRING_DATASOURCE_URL`, etc.), pensado para despliegue (Railway o
similar). Para desarrollo local sin Postgres instalado, hay un perfil `dev`
(`application-dev.properties`) respaldado por H2 en memoria — se activa con
`--spring.profiles.active=dev` (ver `backend/README.md` para el detalle).

## Fuera de alcance (explícito)

- Selección de edificio/zona.
- Múltiples roles/personajes jugables simultáneos (solo Seguridad tiene
  atlas real; el resto de los 4 roles existen en el modelo del backend pero
  no en el cliente Phaser).
- Sistema de misiones.
- Sincronización multijugador de posición/movimiento (cada cliente solo ve
  su propio personaje moviéndose; vida/inventario/ronda sí se sincronizan).
- Catálogo real de acciones por rol para `/decide` (hoy es un placeholder
  de una sola acción fija) y HU-03 (votación).
- Cambio de piso real (ver "Sistema de pisos" arriba).
- Lobby/matchmaking (`gameId` fijo en `"default"`).

## Nota sobre assets

Las imágenes en `imagenes/personajes/Sin fondo/` son hojas de referencia de
personaje (múltiples ángulos de cámara), no spritesheets ni ciclos de
caminata diseñados para animar. `frontend/scripts/build_sprite_atlases.py`
detecta cada pose por componentes conectados (flood-fill sobre el canal
alfa) y las empaca en un atlas Phaser real (`frontend/public/sprites/*.png`
+ `.json`) — ver el script para el detalle de cómo se resolvieron los casos
de poses que quedaron unidas en el recorte de fondo. El mapeo de frames a
nombres con sentido (`down_idle_N`, `right_N`, etc.) está documentado en el
propio script (`FRAME_NAMES`). El placeholder de cápsula de color generado
en código (`spriteConfig.js` / los métodos comentados al final de
`MainScene.js`) sigue disponible como fallback rápido de debug, pero ya no
es el camino activo.
