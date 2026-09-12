# Arquitectura — Operación Garavito

> **Nota:** este documento vive en el repo como fuente de verdad técnica. También
> debe reflejarse manualmente en la Wiki de Azure DevOps del equipo — eso lo
> hace el dueño del repo; no hay integración automática entre este archivo y
> la Wiki.

## Cambio de arquitectura (Sprint 1)

El "Cliente Jugador" **dejó de ser un dashboard de tarjetas** (React renderizando
tarjetas de estado/acciones) y pasó a ser **un cliente de juego 2D top-down**
construido con **Phaser 4** (`phaser@4.2.1`), embebido dentro de la misma app React/Vite. React
ya no dibuja la UI del juego directamente: monta el canvas de Phaser y aloja
UI periférica (paneles de estado, HUD futuro) alrededor de él.

El cliente mantiene, además, una **conexión WebSocket/STOMP** independiente
del ciclo de render de Phaser, para hablar con el backend (Game Service).

El gameplay (oleadas, Garavitos, misiones) está especificado aparte en
[`GAMEPLAY.md`](GAMEPLAY.md).

```
┌─────────────────────────────────────────────┐
│                Cliente Jugador (React)       │
│                                               │
│   App.jsx                                    │
│    ├── GameCanvas.jsx  ── monta ──▶  Phaser.Game
│    │                                  ├── MainScene (mundo + entidades)
│    │                                  │    ├── entities/Player, Zombie
│    │                                  │    ├── world/campus
│    │                                  │    └── WaveDirector
│    │                                  │         │ eventos
│    │                                  │         ▼
│    │                                  │    systems/  (reglas puras,
│    │                                  │     economy · waves · missions
│    │                                  │     gameState · eventBus)
│    │                                  └── HudScene (UI fija al viewport)
│    └── ConnectionStatus.jsx ── usa ──▶ socketService.js
│                                          │ STOMP sobre SockJS
└──────────────────────────────────────────┼───┘
                                            ▼
                                   /ws (SockJS fallback)
                                            │
┌───────────────────────────────────────────┼───┐
│              Backend (Spring Boot)          │
│                                              │
│   WebSocketConfig  ── registra ──▶ /ws (STOMP endpoint)
│                        habilita  ──▶ /topic/** (broker simple)
│   TestSocketController ── @MessageMapping("/game/test")
│                            @SendTo("/topic/game/test")
│                                              │
│   (pendiente) RoundCoordinator, GameService  │
└──────────────────────────────────────────────┘
```

## Componentes nuevos (frontend)

| Componente | Ruta | Responsabilidad |
|---|---|---|
| `GameCanvas.jsx` | `frontend/src/game/GameCanvas.jsx` | Monta/destruye una instancia de `Phaser.Game` dentro de un `useEffect`, tamaño fijo 800×600. Único punto de entrada de Phaser en el árbol de React. |
| `MainScene.js` | `frontend/src/game/MainScene.js` | Escena de gameplay. Arma el mundo, crea al jugador y a los zombis, resuelve colisiones, ataque y la interacción del puesto de seguridad, y publica todo lo relevante en el bus de eventos. Sigue generando el spritesheet del personaje (placeholder o real según `spriteConfig.js`). |
| `systems/` | `frontend/src/game/systems/` | **Reglas puras, sin Phaser**: `economy` (Garavitos), `waves` (curva de dificultad), `missions` (catálogo y progreso), `gameState` (orquestador) y `eventBus`. Es la capa pensada para mudarse al backend cuando exista el `RoundCoordinator`. Cubierta por `npm test`. |
| `entities/` | `frontend/src/game/entities/` | `Player.js` (movilidad con aceleración, dash con i-frames, golpe de hacha) y `Zombie.js` (persecución, separación, daño por contacto). |
| `world/campus.js` | `frontend/src/game/world/` | Genera la zona por código: suelo, muros con altura falsa, props con colisión, puesto de seguridad y viñeta. Define el orden por Y y el tamaño del mundo (1600×1200). |
| `WaveDirector.js` | `frontend/src/game/WaveDirector.js` | Traduce la curva de `systems/waves.js` en spawns reales y anuncia el inicio y el fin de cada oleada. |
| `ui/HudScene.js` | `frontend/src/game/ui/` | Escena de UI superpuesta: vida, Garavitos, oleada, misión activa, cooldown del dash y pantalla de derrota. |
| `spriteConfig.js` | `frontend/src/game/spriteConfig.js` | Configuración del spritesheet del rol Seguridad (dimensiones de frame, orden de filas por dirección, flag `USE_REAL_SPRITESHEET`). Punto único de cambio para reemplazar el placeholder por el arte real. |
| `socketService.js` | `frontend/src/services/socketService.js` | Wrapper delgado sobre `@stomp/stompjs` + `sockjs-client`. Expone `connect`, `disconnect`, `subscribe`, `publish`. Sin lógica de juego todavía. |
| `ConnectionStatus.jsx` | `frontend/src/components/ConnectionStatus.jsx` | Panel mínimo de UI que confirma visualmente que el cliente está conectado al backend (se suscribe a `/topic/game/test` y puede publicar un ping a `/app/game/test`). |

## Componentes nuevos (backend)

| Componente | Ruta | Responsabilidad |
|---|---|---|
| `WebSocketConfig.java` | `backend/src/main/java/co/eci/operaciongaravito/config/` | Habilita STOMP sobre WebSocket (`@EnableWebSocketMessageBroker`), registra el endpoint `/ws` con fallback SockJS, habilita el broker simple en `/topic` y el prefijo de aplicación `/app`. |
| `TestSocketController.java` | `backend/src/main/java/co/eci/operaciongaravito/websocket/` | Controlador de prueba: recibe en `/app/game/test`, responde (echo) en `/topic/game/test`. Solo para confirmar conectividad; se retira o reemplaza cuando exista el protocolo real de decisiones. |

## Cómo se conectan con el Game Service (a futuro)

Por ahora el "Game Service" del backend no existe como tal — solo hay el
andamiaje STOMP. El flujo previsto para sprints siguientes:

1. El jugador entra a una partida → el cliente se conecta por WebSocket y se
   suscribe a un topic por partida (`/topic/game/{gameId}`).
2. Cada acción/decisión del jugador se publica a `/app/game/{gameId}/decision`.
3. El `RoundCoordinator` (backend, aún no implementado) actúa como barrera de
   sincronización: espera las decisiones de los 4 roles antes de resolver la
   ronda y publicar el resultado a `/topic/game/{gameId}`.
4. `MainScene` reacciona a esos mensajes actualizando el estado visual del
   mapa/personajes. La posición/movimiento del personaje **no** se sincroniza
   todavía entre jugadores — eso es explícitamente fuera de alcance de este
   sprint.

## Datasource: PostgreSQL (default) + H2 en desarrollo local

`application.properties` (default) apunta a PostgreSQL vía variables de
entorno (`SPRING_DATASOURCE_URL`, etc.), pensado para despliegue (Railway o
similar). Para desarrollo local sin Postgres instalado, hay un perfil `dev`
(`application-dev.properties`) respaldado por H2 en memoria — se activa con
`--spring.profiles.active=dev` (ver `backend/README.md` para el detalle).

## Fuera de alcance en este sprint (explícito)

- Selección de edificio/zona.
- Múltiples roles/personajes simultáneos en pantalla.
- Sincronización multijugador de posición/movimiento.
- Lógica de juego en el servidor: oleadas, Garavitos y misiones corren hoy en
  el cliente, aislados en `systems/` justamente para poder mudarlos después
  (ver `GAMEPLAY.md`).
- `RoundCoordinator` y protocolo de decisiones real.
- Spritesheet real recortado en grilla (ver nota de assets abajo).

## Nota sobre assets

Las imágenes en `/imagenes` (`SeguridadOperacionGaravito.jpeg`, etc.) son
láminas de referencia/concept art con poses en distintos ángulos, **no**
spritesheets recortados en una grilla uniforme (columnas de ancho desigual,
sin canal alfa, personaje no alineado por celda). Usarlas tal cual en Phaser
produce animaciones desalineadas.

Por eso `MainScene.js` genera un spritesheet placeholder en tiempo de
ejecución (un personaje de color sólido con un indicador de dirección),
numerado exactamente igual a como Phaser numera un spritesheet cargado desde
archivo (fila por dirección, columnas de izquierda a derecha). Cuando exista
un spritesheet real recortado (ej. con Aseprite/Piskel/TexturePacker,
transparente, incluso número de frames por fila), el cambio es:

1. Colocar el archivo en `frontend/public/sprites/seguridad.png` (o la ruta
   que se defina en `spriteConfig.js`).
2. Ajustar `frameWidth`, `frameHeight` y `rowOrder` en `spriteConfig.js` si
   difieren del placeholder.
3. Cambiar `USE_REAL_SPRITESHEET` a `true`.

Ningún código de animación o movimiento debería necesitar cambios.
