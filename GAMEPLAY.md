# Gameplay — Supervivencia, economía y misiones (Sprint 1+)

> Complementa a [`ARCHITECTURE.md`](ARCHITECTURE.md). Ese documento describe
> *cómo* está montado el cliente; este describe *qué hace el juego*.

## Decisión de arquitectura

Toda la lógica de oleadas, economía y misiones corre **en el cliente** por
ahora, pero vive en módulos **puros** (`frontend/src/game/systems/`) que **no
importan Phaser**: reciben estado y eventos, devuelven estado nuevo. Phaser solo
los alimenta con eventos y pinta el resultado.

El motivo es que cuando exista el `RoundCoordinator` en Spring, esos módulos se
mueven al backend casi tal cual (misma forma de estado, mismos eventos) sin
tener que reescribir reglas de juego enredadas con sprites. Mientras tanto el
juego es **de un solo jugador**: no hay sincronización de posición ni de
economía entre clientes. Eso es deliberado y sigue fuera de alcance.

```
   Phaser (render + input)              systems/ (lógica pura, portable)
┌───────────────────────────┐        ┌──────────────────────────────────┐
│ MainScene                 │        │  gameState.js   (orquestador)    │
│  ├── Player.js            │ evento │    ├── waves.js                  │
│  ├── Zombie.js            │───────▶│    ├── economy.js                │
│  ├── WaveDirector.js      │        │    └── missions.js               │
│  └── HudScene.js          │◀───────│                                  │
└───────────────────────────┘ estado └──────────────────────────────────┘
                                              │
                                     (a futuro) se muda a Spring
```

## 1. Movilidad

El movimiento actual pone velocidad directa (`setVelocity`) desde las teclas.
Eso tiene dos problemas: en diagonal el personaje va ~41% más rápido, y el
arranque/frenado es instantáneo, lo que se siente rígido.

El controlador nuevo vive en `entities/Player.js` y está **parametrizado por
rol**, así que aplica igual a los cuatro personajes cuando existan (Seguridad,
Biomédica, Economía, Infraestructura) — cada rol solo cambia sus números.

| Parámetro | Valor | Nota |
|---|---|---|
| Velocidad máxima | 180 px/s | Igual en diagonal: el input se normaliza |
| Aceleración | 1200 px/s² | Arranque con peso, no instantáneo |
| Fricción (drag) | 1400 px/s² | Frena rápido pero derrapa un poco |
| Dash | +420 px/s, 180 ms | Tecla `Shift` o `Espacio` |
| Cooldown de dash | 1.2 s | Con feedback visual en el HUD |

Además:

- El cuerpo de colisión se reduce a los **pies** del sprite (32×48 → 20×16 con
  offset), que es lo estándar en top-down: evita que el personaje choque con
  paredes "por la cabeza".
- La animación se elige por la **velocidad real** del cuerpo, no por la tecla
  pulsada, así el dash y el derrape animan correctamente.
- Durante el dash el jugador es brevemente invulnerable (i-frames), que es lo
  que lo vuelve una herramienta de defensa y no solo de velocidad.

## 2. Profundidad visual

El mapa hoy es un rectángulo plano con una grilla encima. Lo que lo aplana no
es la falta de arte, es la falta de **capas** y de **cámara**. En orden de
impacto:

1. **Mundo más grande que la pantalla** (1600×1200 contra un viewport de
   800×600) con la cámara siguiendo al jugador con suavizado. Por sí solo es el
   cambio que más quita la sensación de tablero estático.
2. **Orden por Y** (`setDepth(y)`): jugador, zombis y props se dibujan según su
   posición vertical, así el personaje pasa por detrás de una matera cuando
   está arriba de ella y por delante cuando está abajo.
3. **Sombras**: una elipse oscura semitransparente bajo cada entidad. Es lo que
   despega los sprites del suelo.
4. **Muros con cara frontal**: cada muro se pinta con una cara superior y una
   frontal más oscura, en vez de un rectángulo plano. Falsea altura sin 3D.
5. **Suelo con variación**: baldosas con ruido de tono y manchas, en vez de una
   grilla uniforme.
6. **Props del campus con colisión**: bancas, materas, columnas y escritorios
   volcados. Rompen la línea de visión y dan al mapa lectura de "lugar".
7. **Viñeta + tinte ambiental** nocturno. Encuadra la escena y da tono.

Todo esto se genera por código en `world/campus.js`; no requiere assets nuevos
y no toca el camino de reemplazo por arte real descrito en `ARCHITECTURE.md`.

## 3. Oleadas de zombis

Definidas en `systems/waves.js` (puro), ejecutadas por `WaveDirector.js`.

- Los zombis aparecen en puntos de spawn **fuera del viewport**, nunca encima
  del jugador.
- Persecución directa hacia el jugador, con separación básica entre zombis para
  que no se apilen en una sola columna.
- Atacan por contacto: 10 de daño, con cooldown de 0.6 s **por zombi**.
- El jugador tiene 100 de vida. Al llegar a 0 → pantalla de derrota y reinicio
  desde la oleada 1.

| Oleada | Zombis | Cadencia de spawn | Vida del zombi |
|---|---|---|---|
| 1 | 5 | 1200 ms | 2 |
| 2 | 8 | 1000 ms | 2 |
| 3 | 12 | 850 ms | 2 |
| n ≥ 4 | `5 + 3(n−1)` | `max(350, 1300 − 90n)` | 2, y 4 para un 25% "tesos" |

Entre oleadas hay 6 s de respiro, anunciados en el HUD.

## 4. Economía: Garavitos

`systems/economy.js`. El **Garavito** es la moneda del juego.

- **1 Garavito por zombi eliminado.**
- Las misiones pagan Garavitos extra al completarse.
- El saldo se muestra en el HUD y es la única fuente de verdad para compras.

Antes de tener arma no se puede matar, así que el saldo arranca en 0 y el
primer ingreso real viene de la misión 1. Esa es la curva: sobrevives
desarmado, te armas, y recién ahí empiezas a generar ingresos.

## 5. Misiones

`systems/missions.js`. Una misión es un objetivo con progreso que escucha los
mismos eventos que ya emite el juego (`zombie:killed`, `wave:cleared`, …), y
una recompensa.

| # | Id | Objetivo | Recompensa |
|---|---|---|---|
| 1 | `primer-contacto` | Sobrevive la oleada 1 **sin arma** | 10 Garavitos + desbloquea el hacha |
| 2 | `armate` | Reclama el hacha en el puesto de seguridad (cuesta 10 Garavitos) | Hacha equipada |
| 3 | `limpieza` | Elimina 10 zombis | 15 Garavitos |

> **Decisión a confirmar.** Interpreté *"la primera misión que completen les va
> a dar **para** una hacha"* como que la misión paga lo justo para comprarla, no
> que la regale. Por eso son dos misiones: la 1 paga 10 Garavitos y desbloquea
> el hacha, y la 2 es ir al **puesto de seguridad** (un punto marcado del mapa)
> y reclamarla con `E` por esos mismos 10 Garavitos. Eso deja la economía
> funcionando desde el minuto uno y el hacha se siente ganada.
>
> Si la idea era simplemente que la misión 1 **entregue** el hacha, se colapsan
> en una sola y desaparece el puesto de seguridad — es un cambio de dos líneas
> en `missions.js`.

El puesto de seguridad es además el gancho natural para la tienda completa de
sprints siguientes (mejores armas, botiquines, barricadas).

## 6. El hacha

Primera arma de defensa.

| Parámetro | Valor |
|---|---|
| Daño | 2 (mata de un golpe a un zombi normal) |
| Alcance | 46 px |
| Arco | 90° al frente, en la dirección que mira el jugador |
| Cooldown | 400 ms |
| Tecla | Click izquierdo o `J` |

El golpe empuja al zombi hacia atrás (knockback), que es lo que evita que el
jugador quede atrapado en un abrazo de varios zombis.

## 7. HUD

Escena de Phaser aparte (`ui/HudScene.js`) superpuesta a `MainScene`, fija a la
cámara. Muestra: barra de vida, saldo de Garavitos, oleada actual con zombis
restantes, misión activa con su progreso, y el estado del dash.

## 8. Eventos

Contrato entre la capa Phaser y los módulos puros. Es a propósito el mismo
vocabulario que tendrían los mensajes STOMP cuando esto se mude al backend.

| Evento | Emitido por | Consumido por |
|---|---|---|
| `zombie:killed` | `MainScene` | `economy`, `missions` |
| `wave:started` / `wave:cleared` | `WaveDirector` | `missions`, HUD |
| `player:damaged` / `player:died` | `Player` | HUD, `gameState` |
| `garavitos:changed` | `economy` | HUD |
| `mission:progress` / `mission:completed` | `missions` | HUD |
| `weapon:unlocked` / `weapon:equipped` | `gameState` | `Player`, HUD |

## Fuera de alcance (sigue vigente)

- Sincronización multijugador de posición, economía o misiones.
- `RoundCoordinator` y protocolo real de decisiones.
- Selección de edificio/zona.
- Spritesheet real recortado (ver nota de assets en `ARCHITECTURE.md`).
- Tienda completa más allá del hacha.
