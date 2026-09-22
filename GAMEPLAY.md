# Gameplay — Oleadas de zombis (servidor autoritativo)

> Complementa a [`ARCHITECTURE.md`](ARCHITECTURE.md). Ese documento describe
> cómo está montado el sistema; este describe la oleada de zombis y cómo se
> engancha con lo que el backend ya resuelve.

## Punto de partida

El backend ya es dueño de la lógica de juego: `GameSession` administra
jugadores, vida, Garavitos, inventario, items del mundo, misiones por zona y
tienda; `RoundCoordinator` sincroniza las rondas. Los zombis entran **ahí**, no
en el cliente.

Eso obliga a resolver antes un hueco: **hoy el servidor no sabe dónde está
nadie.** Las posiciones solo llegan dentro de un `PickupRequest` o
`MissionCompleteRequest` puntual. Un zombi que persigue necesita la posición
del jugador de forma continua.

## 1. Posición de los jugadores

Se agrega `/app/game/{gameId}/move` con `{ playerId, x, y }`. El cliente lo
publica **a 10 Hz y solo si se movió** más de 4 px desde el último envío
(parado no gasta mensajes). `Player` guarda `x`, `y` y `lastSeenAt`.

Este endpoint **no difunde nada**: es el único mensaje entrante de alta
frecuencia, y responder con un broadcast por cada uno multiplicaría el tráfico
por el número de jugadores. Las posiciones viajan en el broadcast del tick.

> **Fuera de alcance:** el servidor *cree* la posición que le reporta el
> cliente; no valida velocidad ni atraviesa-paredes. Para este sprint es
> deliberado — el anti-cheat no es el objetivo y validar movimiento exigiría
> subir la colisión del mapa al backend.

## 2. El tick

`GameSession` gana un bucle propio sobre el `ScheduledExecutorService` que ya
recibe en el constructor (el mismo que usa `RoundCoordinator` para sus
timeouts).

| | Frecuencia | Por qué |
|---|---|---|
| Simulación | 15 Hz (66 ms) | Suficiente para que la persecución se vea continua sin quemar CPU |
| Broadcast | 8 Hz (125 ms) | El cliente interpola entre paquetes; mandar los 15 no se nota y casi duplica el tráfico |

El tick arranca cuando entra el primer jugador y se detiene cuando la sesión
queda vacía, para que una partida abandonada no siga simulando para nadie.

**Concurrencia:** el tick corre en un hilo del scheduler mientras los mensajes
STOMP llegan en hilos de Tomcat. La lista de zombis se mantiene en una
`ConcurrentHashMap` y las mutaciones de un zombi (daño, muerte) se hacen con
`compute`, siguiendo el mismo criterio que ya usa `attemptPickup` con
`putIfAbsent`: reclamo atómico en vez de check-then-act.

## 3. Curva de oleadas

Portada a `WaveCurve.java`, con pruebas JUnit. Una sola fórmula, no una tabla:

| Parámetro | Fórmula | Oleadas 1-4 |
|---|---|---|
| Zombis | `5 + 3(n−1)` | 5, 8, 11, 14 |
| Cadencia de spawn | `max(350, 1250 − 150(n−1))` ms | 1250, 1100, 950, 800 |
| Vida | 2; desde la oleada 4 un 25% son "tesos" con 4 | |
| Velocidad | `min(120, 55 + 4(n−1))` a `min(150, 75 + 4(n−1))` px/s | |

La velocidad está topada **por debajo** de los 160 px/s del jugador: quedar
acorralado tiene que ser un error de posicionamiento, no algo inevitable.

Entre oleadas hay 6 s de respiro. Los zombis aparecen en un anillo a 560 px del
jugador más cercano, recortado contra el área caminable del piso; los
candidatos que quedan a menos de 320 px se descartan, porque el recorte puede
arrastrar el punto hacia el jugador cuando está pegado a un muro.

## 4. Combate

Se agrega `/app/game/{gameId}/attack` con `{ playerId, x, y, facing }`. El
servidor valida y resuelve; el cliente solo pide y anima.

| Parámetro | Valor |
|---|---|
| Arma inicial | **Hacha**, ítem de tienda (ver §5) |
| Daño | 2 — mata de un golpe a un zombi normal |
| Alcance | 46 px, arco de 90° hacia donde mira el jugador |
| Cooldown | 400 ms, validado en el servidor |
| Empuje | 280 px/s, para que el jugador no quede atrapado en un abrazo |

El golpe se rechaza si el jugador no tiene un arma en el inventario. Los
rechazos viajan como `LastEvent`, igual que `pickup` y `purchase`.

**Daño por contacto:** 10 de vida, con cooldown de 600 ms **por zombi**,
aplicado en el tick. Cuando un jugador llega a 0 queda `DOWNED`: deja de ser
objetivo válido y no puede atacar, hasta que otro jugador lo levante o termine
la oleada.

## 5. Garavitos y el hacha

- **1 Garavito por zombi eliminado**, vía el `addGaravitos` que `Player` ya
  tiene. Entra a la misma economía que las misiones — no hay una paralela.
- El **hacha** se agrega a `ShopCatalog` en la máquina expendedora, a **25
  Garavitos**, que es exactamente lo que paga una misión de rol.

Eso hace que la progresión pedida caiga sola sobre lo que ya existe: completas
tu primera misión, cobras 25 Garavitos, y eso te alcanza justo para el hacha en
la expendedora. No hace falta una máquina de desbloqueos aparte.

## 6. Qué se difunde

`GameStateMessage` gana dos campos, manteniendo la regla de **un solo topic por
partida** que ya fijó `GameController`:

```
zombies: [{ id, x, y, health, tough }]
wave:    { number, remaining, restingSeconds }
```

Los `PlayerState` ganan `x`, `y` y `state` (`ALIVE` / `DOWNED`).

> **Costo:** a 8 Hz con 20 zombis el mensaje ronda los 2-3 KB, o sea ~20 KB/s
> por cliente. Es aceptable para 4 jugadores en una partida de clase, pero es
> el primer lugar donde mirar si algo se siente lento. La optimización obvia
> —mandar deltas en vez del estado completo— queda fuera de alcance.

## 7. Cliente

`MainScene` deja de decidir nada sobre zombis: los dibuja desde el estado que
llega y **interpola** hacia la última posición conocida, para que 8 Hz se vean
fluidos a 60 fps. La textura del zombi se genera por código, igual que el
placeholder del personaje, hasta que haya arte real.

La movilidad del jugador sigue siendo local y sin cambios de autoridad. Se
recuperan de la rama anterior las mejoras que no dependían del campus
generado: **entrada normalizada** (la diagonal deja de ir 41% más rápido) y
**dash con `Shift`/`Espacio`** con invulnerabilidad breve, que es el único
recurso defensivo antes del hacha.

## Fuera de alcance

- Validación de movimiento en el servidor (anti-cheat).
- Deltas o compresión binaria en el broadcast.
- Navegación de zombis con pathfinding: persiguen en línea recta con
  separación entre ellos, sin rodear muros.
- Reanimar a un jugador `DOWNED` por otro jugador (por ahora solo revive al
  terminar la oleada).
- Zombis en pisos distintos del que está el jugador.
