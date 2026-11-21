# Robustez en concurrencia y tiempo real

Escenario de calidad: [EC-1](ESCENARIOS_DE_CALIDAD.md#ec-1--concurrencia-la-misma-acción-a-la-vez).

## 1. De dónde viene la concurrencia

Cada sala (`GameSession`) vive en la memoria de un nodo y la tocan varios hilos a la vez:

| Hilo | Qué hace | Frecuencia |
|---|---|---|
| Hilos del broker STOMP (`clientInboundChannel`) | Aplican las acciones de los jugadores: moverse, atacar, recoger, comprar, completar misiones, transferir | Cada jugador manda su posición a 10 Hz más sus acciones; dos jugadores casi nunca caen en el mismo hilo |
| Hilo del tick (`ScheduledExecutorService` de `GameSessionService`) | Mueve los zombis (A*), resuelve mordidas, oleadas, eventos, revividas, y difunde el estado | Cada 66 ms por sala |
| Hilo de difusión | Codifica el estado (`DeltaEncoder`) y lo publica en `/topic/game/{sala}` | Cada ~125 ms |

Sin control, dos mensajes del mismo instante podrían leer el mismo estado y pisarse
(dos jugadores con el mismo objeto, una misión pagada dos veces, dinero que aparece o
desaparece, un tick que lee a un jugador a medio mover).

## 2. Mecanismos de sincronización

| Caso de uso | Mecanismo | Dónde | Garantía |
|---|---|---|---|
| Todas las acciones y el tick de una sala | Monitor de la sala: los métodos que cambian estado son `synchronized` sobre la misma `GameSession`; el tick también (commit `1064a2e` unificó el candado de acciones y tick) | `GameSession` | Cada acción y cada tick ven un estado completo, nunca a medias; orden total por sala |
| Recoger un objeto | `claimedItems.putIfAbsent(itemId, playerId)` (atómico) y `remove(itemId, playerId)` condicional si la validación falla | `GameSession.attemptPickup` | Un objeto tiene un solo dueño; si el ganador no podía (lejos, inventario lleno) se libera para el siguiente |
| Completar una misión | "chequear pendiente → marcar → pagar" bajo el monitor de `MissionBoard` | `MissionBoard.complete` | Se paga exactamente una vez (doble clic, reintento de red) |
| Barrera del Kinder | Barrera sin bloqueo: los jugadores "llegan" en hilos de STOMP y el tick evalúa `allDone()` | `MissionBoard`, `WaveDirector` | El Kinder se pasa una sola vez y solo cuando todos los vivos terminaron |
| Ocupar un rol | `joinPlayer` `synchronized` + reserva atómica del puesto por conexión | `GameSession.joinPlayer`, `GameSessionService.reserveSeat` | Un rol, un ocupante; una conexión, un puesto |
| Dinero (Garavitos) | `Player.tryTakeGaravitos` / `addGaravitos` `synchronized`; la transferencia completa bajo el monitor de la sala | `Player`, `GameSession.attemptTransfer` | El saldo nunca queda negativo y el total se conserva |
| Estado de cada jugador | Campos `volatile` y métodos `synchronized` en `Player` | `Player` | La difusión lee valores publicados, no copias viejas |
| Mapas de salas y jugadores | `ConcurrentHashMap` | `GameSessionService`, `GameSession` | Crear/borrar salas y buscarlas desde varios hilos sin bloqueo global |
| Salas entre nodos | `SETNX` con TTL en Redis (`setIfAbsent`) | `RedisRoomRegistry` | Dos nodos no pueden quedarse con el mismo código de sala |
| Orden de eventos en el cliente | Cada evento llega en su propio mensaje y el cliente los procesa en orden (`onGameEvent`); los estados "delta" se completan con el último estado completo | `gameSync.js`, `deltaMerge.js` | Dos eventos simultáneos ya no se pisan (antes `lastEvent` se sobrescribía) |

**Servidor autoritativo:** el cliente solo propone; el servidor decide con sus reglas
(velocidad máxima, paredes, alcance, precios). Por eso la consistencia se resuelve en
un solo lugar.

## 3. Pruebas reproducibles con operaciones simultáneas

Todas corren en cada push (`cd backend && ./mvnw test`).

| Prueba | Qué hace | Resultado esperado | Qué demuestra |
|---|---|---|---|
| `ConcurrenciaTest.sameRoleHasOneOccupant` (×5) | 16 hilos piden el rol SEGURIDAD en el mismo instante (`CountDownLatch`) | 1 lo ocupa, 15 reciben `role_taken`, 1 jugador en la sala | **Sin duplicación** de puestos |
| `ConcurrenciaTest.sameItemHasOneOwner` (×5) | 4 jugadores junto a la misma comida la recogen a la vez | 1 éxito, 3 `already_claimed`, el objeto está en un solo inventario y el estado difundido lo marca reclamado | **Sin duplicación** de objetos y **actualización de estado** consistente |
| `ConcurrenciaTest.concurrentTransfersConserveMoney` | 32 transferencias simultáneas de 5 Garavitos con saldo 100 | Exactamente 20 aceptadas, saldo 0, total conservado | **Sin pérdida ni creación** de dinero |
| `ConcurrenciaTest.movesDuringTicksKeepConsistentState` | 4 hilos mandan 50 movimientos cada uno mientras otro hilo corre 200 ticks y lee el estado difundido | 0 excepciones, 200 ticks, la posición difundida es la del último movimiento aceptado | **Orden de eventos**: el último movimiento gana; el tick nunca ve estados a medias |
| `MissionBoardTest.concurrentCompletionPaysOnce` | 32 tareas en 8 hilos completan la misma misión | Se paga 1 vez | **Sin duplicación** de recompensas |
| `SalasSecurityTest.oneSeatPerConnection` | Una conexión STOMP real manda 4 `join` seguidos (llegan en paralelo) | 1 puesto | Reserva atómica por conexión |
| `GameSessionZombieTest` | Tick real con scheduler mientras los jugadores actúan | Zombis y jugadores consistentes | Tick y acciones con el mismo candado |
| e2e `partida.spec.js` "dos jugadores en la misma sala se ven y comparten el avance de misiones" | Dos navegadores reales en la misma sala | Cada uno ve al otro moverse y el avance de misiones del equipo | **Tiempo real** de punta a punta |
| k6 (`k6/partidas.js`) | Hasta 200 jugadores en 50 salas, 10 movimientos/s cada uno | Movimiento confirmado p95 y 0 sesiones cortadas (RENDIMIENTO.md) | Concurrencia sostenida bajo carga |

Para correr solo las de concurrencia:

```bash
cd backend
./mvnw test -Dtest='ConcurrenciaTest,MissionBoardTest,GameSessionZombieTest'
```

## 4. Qué pasa con pérdida, duplicación, orden y estado

- **Pérdida:** ninguna acción aceptada se pierde: las acciones se aplican dentro del
  monitor antes de responder. Los mensajes de movimiento sí pueden "perderse" por
  diseño: si llegan dos posiciones casi juntas, vale la última (el cliente manda 10
  por segundo y solo importa la más reciente). Lo que sí se pierde es una partida si
  se cae el nodo que la tenía (el estado vive en memoria; ver DISPONIBILIDAD.md).
- **Duplicación:** imposible para objetos, puestos, misiones y dinero (pruebas arriba).
  Un mensaje repetido (doble clic, reintento) se rechaza con un motivo
  (`already_claimed`, `role_taken`, misión ya hecha).
- **Orden de eventos:** dentro de una sala el monitor da un orden total; el cliente
  procesa cada evento en el orden en que llega por el mismo WebSocket (STOMP sobre TCP
  conserva el orden por conexión).
- **Actualización de estado:** cada difusión es una foto consistente tomada dentro del
  monitor; los estados "delta" (solo lo que cambió) se completan en el cliente con el
  último estado completo (`deltaMerge.js`, con pruebas).
