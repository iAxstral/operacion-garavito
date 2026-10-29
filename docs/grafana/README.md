# Grafana — tableros de monitoreo

Grafana dibuja lo que guarda Prometheus (ver [`docs/prometheus`](../prometheus/README.md)).
El proyecto trae **dos tableros ya configurados** que se cargan solos al levantar
Grafana, sin hacer clic en nada:

| Tablero | Para qué | Archivo |
|---|---|---|
| **Operación Garavito** | El servidor en vivo: salas, jugadores, zombis, tick, mensajes, CPU y memoria. | `monitoring/grafana/dashboards/garavito.json` |
| **Operación Garavito — Prueba de carga (k6)** | Una prueba de k6 junto a lo que ve el servidor en ese momento. | `monitoring/grafana/dashboards/k6.json` |

Las capturas son de una corrida real del perfil `carga` de k6 (hasta 80 jugadores en
20 salas) del 29-10-2026. El backend, Prometheus, Grafana y k6 corrieron en la misma
máquina: Linux, 4 núcleos, 16 GB y JDK 21.

## 1. Cómo levantarlo

```bash
# Backend en el puerto 8080
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

```bash
# Prometheus (:9090) + Grafana (:3000)
docker compose -f monitoring/docker-compose.yml up -d
```

Abrir `http://localhost:3000`. Para mirar no hace falta entrar: el acceso anónimo está
habilitado en modo lectura. Para editar, el usuario es `admin` y la contraseña
`garavito`.

## 2. Configuración como código (provisioning)

Nada se configura a mano en la interfaz. Grafana lee al arrancar los archivos de
`monitoring/grafana/`, que el `docker-compose.yml` monta en el contenedor:

```
monitoring/grafana/
├── provisioning/
│   ├── datasources/prometheus.yml   ← fuente de datos "Prometheus" (http://prometheus:9090)
│   └── dashboards/garavito.yml      ← "carga los JSON de /var/lib/grafana/dashboards"
└── dashboards/
    ├── garavito.json                ← tablero del servidor
    └── k6.json                      ← tablero de la prueba de carga
```

`provisioning/datasources/prometheus.yml`:

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    uid: prometheus          # los paneles la referencian por este uid
    type: prometheus
    access: proxy            # el navegador le pide a Grafana y Grafana a Prometheus
    url: http://prometheus:9090   # nombre del servicio en docker compose
    isDefault: true
```

Con esto la fuente de datos aparece marcada como *provisioned*: no se puede romper
desde la interfaz.

![Fuente de datos Prometheus provisionada](img/05-datasource.png)

Los tableros quedan en la carpeta **Operación Garavito**:

![Carpeta con los dos tableros](img/06-carpeta-tableros.png)

Las ventajas para el equipo: los tableros viven en Git, se revisan en los PR como
cualquier código y cualquiera los tiene iguales con un `docker compose up`. Si alguien
mejora un tablero en la interfaz, lo exporta (Share → Export → JSON) y reemplaza el
archivo.

## 3. Tablero "Operación Garavito" (servidor)

![Tablero del servidor durante la prueba](img/01-tablero-servidor.png)

*Corrida `carga`. Los cuatro indicadores de arriba muestran el **valor actual** (aquí 0,
porque la ventana termina después de la prueba) y, de fondo, cómo evolucionó. En vivo
muestran las salas, jugadores y zombis del momento.*

| Panel | Consulta | Cómo leerlo |
|---|---|---|
| Salas activas | `sum(garavito_rooms)` | Salas abiertas ahora. |
| Jugadores conectados | `sum(garavito_players)` | Debe seguir a la carga; si se queda abajo, la gente no está entrando. |
| Zombis vivos | `sum(garavito_zombies)` | Lo que tiene que simular el servidor en cada tick. |
| Mensajes livianos (%) | `100 * delta / total` | Porcentaje de estados enviados como delta. Verde desde el 80 %: en la prueba fue ~93 %. |
| Duración del tick de una sala | `garavito_tick_seconds` p50 y p99 | El tick se repite cada 66 ms. En la prueba el p99 no pasó de ~0,4 ms. |
| Mensajes por segundo | `rate(garavito_messages_total[1m])` por `kind` | Crece con los jugadores. Casi todo es `delta`. |
| Salas y jugadores por nodo | `garavito_rooms`, `garavito_players` por `node` | Con varios nodos, muestra si la carga se reparte. |
| CPU y memoria del JVM | `process_cpu_usage`, heap usado / máximo | En la prueba, CPU ≤ 12 % y heap ≈ 3 %. |

## 4. Tablero "Prueba de carga (k6)"

Junta en una sola pantalla lo que **mide k6 desde el cliente** y lo que **reporta el
servidor**, para ver causa y efecto. El selector **Corrida** de arriba filtra por la
etiqueta `testid` de k6, así que se pueden comparar corridas distintas.

![Tablero de k6 durante la corrida "carga"](img/02-tablero-k6.png)

| Panel | De dónde sale | Qué buscar |
|---|---|---|
| Máximo de jugadores virtuales | k6 (`k6_vus`) | El pico de la prueba (82 incluye los VUs del escenario de ranking). |
| Jugadores que entraron a su sala | k6 (`entrada_exitosa`) | Umbral ≥ 95 %. Dio 100 %: 212 de 212 sesiones. |
| Checks OK | k6 (`checks`) | WebSocket abierto (101) y ranking 200. |
| Errores HTTP | k6 (`http_req_failed`) | Umbral < 1 %. Dio 0 %. |
| Carga generada vs. lo que ve el servidor | k6 + backend | Las curvas de VUs y de jugadores en el servidor deben ir juntas. |
| Cada cuánto llega el estado del juego | k6 (`intervalo_estado_ms`) | Umbral p95 < 250 ms (línea roja). Dio p95 = 132 ms. |
| Ida y vuelta de un movimiento | k6 (`ida_y_vuelta_movimiento_ms`) | Umbral p95 < 300 ms. Dio p95 = 99 ms. |
| Duración del tick en el servidor | backend | Confirma que el servidor no se esfuerza mientras sube la carga. |
| Mensajes WebSocket por segundo | k6 | Tráfico que recibe y envía el generador. |
| Tamaño del mensaje de estado | k6 | p50 ≈ 2,5 KB y p95 ≈ 4,4 KB. |
| Ranking (HTTP) | k6 (`http_req_duration`) | Umbral p95 < 300 ms. Dio p95 ≈ 5 ms. |
| CPU y memoria del backend | backend | Recursos del servidor durante la prueba. |

### Paneles en detalle

**Carga vs. servidor.** Los jugadores que reporta el backend (amarillo) siguen a los VUs
de k6 (verde) en las dos rampas, 40 y 80. Las salas (azul) llegan a ~24: son las 20
llenas más las que se están cerrando mientras los jugadores cambian de ronda.

![Carga generada vs. servidor](img/04-panel-vus-vs-servidor.png)

**Intervalo entre estados.** El p95 y el p99 se quedan planos en ~132 ms con 40 y con
80 jugadores, muy lejos de la línea roja (250 ms). El servidor emite estado cada
125 ms y, con más jugadores, no se atrasa.

![Intervalo entre estados](img/03-panel-intervalo-estado.png)

## 5. Qué conclusiones sacamos

- Con 80 jugadores simultáneos el servidor está desocupado: el tick p99 es menor a
  0,5 ms (de 66 ms disponibles) y el CPU ronda el 11 %.
- Lo que siente el jugador también está bien: el estado llega cada ~125 ms y su
  movimiento se refleja en menos de 100 ms el 95 % de las veces.
- La prueba de estrés, hasta 200 jugadores, y dónde empieza a degradarse están en
  [`docs/k6`](../k6/README.md).

## 6. Problemas comunes

| Síntoma | Solución |
|---|---|
| Paneles con *No data* | En Prometheus → Targets el backend debe estar UP. Ajustar el rango de tiempo (arriba a la derecha). |
| El tablero de k6 está vacío | k6 se corrió sin `-o experimental-prometheus-rw` (ver `docs/k6`). |
| Cambié un JSON y no se ve | Grafana relee los archivos cada pocos segundos; si no, `docker compose -f monitoring/docker-compose.yml restart grafana`. |
| No puedo editar un panel | Entrar como `admin` / `garavito`. Los cambios hechos en la interfaz a un tablero provisionado no se guardan en el archivo: hay que exportar el JSON. |
