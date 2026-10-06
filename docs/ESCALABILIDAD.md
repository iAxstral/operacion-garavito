# Escalabilidad — Operación Garavito

Mediciones reales del servidor actual y propuesta para atender más salas.
Medido el 2026-10-04 en un portátil Windows 11 (12 núcleos lógicos, JDK 21),
backend con perfil `dev` (H2) y el generador de carga **en la misma máquina**.

## 1. Cómo funciona hoy (un solo nodo)

```
navegador ──STOMP/WebSocket──▶ Spring (SimpleBroker en memoria)
                                  │  /app/game/{sala}/...  (acciones)
                                  ▼
                       GameSessionService ── Map<código, GameSession>
                                  │  tick de cada sala cada 66 ms (pool "game-loop")
                                  │  estado completo cada 125 ms ─▶ /topic/game/{sala}
                                  ▼
                       MatchHistoryService ──(hilo aparte)──▶ PostgreSQL / H2
```

- **Todo el estado de juego vive en la memoria del JVM** (salas, jugadores, zombis,
  misiones). Es rápido y simple, pero ata cada sala a un nodo.
- La base de datos solo guarda el historial (ranking); se escribe en un hilo propio
  para no frenar el tick.
- Cada sala es independiente: no comparte estado con otras. Eso es lo que permite
  repartirlas entre nodos (sección 4).

## 2. Cuánto cuesta el juego (sin red)

`TickCostBenchmarkTest` (se corre aparte:
`./mvnw test -Dtest=TickCostBenchmarkTest -Dbenchmark=true`) simula 50 salas de 4
jugadores con el Kinder 1 activo (≈11 zombis por sala):

| Medida | Promedio | p50 | p99 |
|---|---|---|---|
| Tick de una sala | 0,130 ms | 0,107 ms | 0,329 ms |
| Armar + serializar el estado | 0,142 ms | 0,076 ms | 0,670 ms |

**50 salas en tiempo real ≈ 10 % de un núcleo en ticks + 6 % en estados.** La lógica
del juego (zombis con flow field, misiones, armas) no es el cuello de botella: un
núcleo alcanzaría para cientos de salas.

## 3. Prueba de carga por la red

`frontend/scripts/load-test.mjs` abre N salas con 4 bots cada una que se conectan por
STOMP como un cliente real, se mueven dentro de las reglas del servidor y atacan:

```bash
node scripts/load-test.mjs --url ws://localhost:8081/ws/websocket --rooms 25 --players 4 --seconds 75
```

| Salas | Clientes | Estados recibidos / s por cliente | Intervalo entre estados p50 / p95 | Correcciones de movimiento |
|---|---|---|---|---|
| 10 | 40 | 14,1 | 65 / 167 ms | 0 |
| 25 | 100 | 9,6 | 102 / 189 ms | 0 |
| 50 | 200 | 2,4 – 4,5 | 95–427 / 620–767 ms | 0 |

(Más de 8 por segundo es posible porque, además del estado periódico, cada acción con
respuesta —p. ej. un ataque rechazado por enfriamiento— difunde el estado.)

**Hasta ~25 salas (100 jugadores) el estado llega a tiempo.** Con 50 salas los
clientes reciben bastante menos de lo esperado. Lo que se midió para entender por qué:

1. **No es la CPU del juego**: el benchmark de arriba da ~16 % de un núcleo.
2. **No es el generador de carga**: repartir las 50 salas en dos procesos de Node dio
   el mismo total (~700 mensajes/s).
3. **El servidor no está saturado**: durante la carga el JVM usó ~2,2 de 12 núcleos y
   dos volcados de hilos (`jcmd Thread.print`) muestran los pools `game-loop`,
   `clientInboundChannel` y `clientOutboundChannel` ociosos (esperando trabajo).
4. **Agrandar los pools no cambió nada**: se probó un hilo de juego por núcleo y el
   doble de hilos de salida; mismos números, así que se revirtió.

**Conclusión honesta:** con todo en una sola máquina Windows, el límite está en el
transporte (pila de red local / envío por socket), no en la lógica ni en los hilos del
servidor. Falta confirmarlo corriendo los bots desde otra(s) máquina(s); si con eso
el servidor sostiene 50 salas, el número real es mayor que el medido aquí.

## 4. Propuesta para crecer

### 4.1 Mensajes más livianos (lo más barato y efectivo)

Un estado pesa ~2,3 KB sin zombis y ~3,8 KB con la horda. Se manda completo 8 veces
por segundo a cada jugador aunque casi nada cambie:

| Parte del estado | Bytes (sala de 4, sin zombis) | Cambia… |
|---|---|---|
| `players` | 1 403 | posición: siempre; inventario, misiones, Garavitos: rara vez |
| `doors` | 449 | casi nunca |
| `wave` | 184 | cada segundo |
| zombis (~110 B c/u) | +1 200 con 11 zombis | siempre |

- Mandar **puertas, inventario y misiones solo cuando cambian** (o en un topic aparte)
  y el resto como deltas.
- Redondear posiciones y usar nombres cortos de campos (o un formato binario).
- Estimado: bajar a ~1 KB por estado, ~3–4× menos tráfico.

**Hecho (`DeltaEncoder`, 2026-10-06):** cada sala tiene un codificador que recuerda lo
último enviado. Puertas, sala, barricadas, objetos recogidos, resumen y evento del Kinder
se omiten si no cambiaron (el mensaje los nombra en `unchanged`), y de cada jugador se
omiten inventario, misiones, apodo y disfraz si son iguales (`staticOmitted`). Cada 16
mensajes (2 s) y cuando alguien entra o vuelve va el estado completo, así quien llega
tarde o perdió un mensaje se pone al día. El cliente completa lo omitido
(`frontend/src/game/deltaMerge.js`). Medido en `DeltaEncoderTest` con 4 jugadores
al empezar: **4 328 B → 2 252 B por mensaje (48 % menos)**. Lo que sigue pesando son
las posiciones y los zombis; el siguiente paso sería redondearlas y acortar nombres.

### 4.2 Varios nodos (escalado horizontal)

Las salas no comparten estado, así que se reparten por **código de sala**:

```
                ┌──────────── balanceador (afinidad por código de sala) ────────────┐
navegador ──▶   │  /ws?sala=ABCD  → nodo = hash(ABCD) % N  (o tabla en Redis)       │
                └───────────────┬──────────────────────────────┬────────────────────┘
                            nodo 1                          nodo 2   …  (salas en memoria)
                                │                              │
                                └──── Redis: sala → nodo, tokens de reconexión ────┘
                                └──── PostgreSQL: historial / ranking (compartido) ┘
```

- **Afinidad de sala**: todos los jugadores de una sala van al mismo nodo (el tick
  necesita el estado en memoria). El código ya viaja en la URL de los mensajes.
- **Redis** como registro `sala → nodo` y para los tokens de reconexión, así un
  jugador que vuelve encuentra su nodo aunque cambie la conexión.
- **Broker STOMP externo** (RabbitMQ/ActiveMQ con `enableStompBrokerRelay`) solo si
  se quisiera que un nodo publique en salas de otro; con afinidad no hace falta.
- La API REST del ranking es sin estado: cualquier nodo la atiende.
- Si un nodo cae se pierden sus salas en curso (no el historial). Para tolerarlo
  habría que guardar instantáneas de sala en Redis — no se justifica para este juego.

### 4.3 Siguientes pasos

1. Repetir la prueba de carga con los bots en otra máquina para fijar el techo real.
2. Implementar 4.1 (deltas) y volver a medir.
3. Si se necesitan más de ~100 salas simultáneas, 4.2.
