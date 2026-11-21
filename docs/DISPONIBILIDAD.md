# Disponibilidad y escalabilidad

Escenarios de calidad: [ED-1](ESCENARIOS_DE_CALIDAD.md#ed-1--disponibilidad-se-cae-un-nodo)
(se cae un nodo) y [ED-2](ESCENARIOS_DE_CALIDAD.md#ed-2--escalabilidad-crece-la-demanda)
(crece la demanda).

## 1. Arquitectura distribuida

El backend escala horizontalmente: cada sala vive en un nodo; los nodos comparten
Redis (registro sala → nodo) y PostgreSQL (historial y ranking), y un balanceador
reparte las conexiones. Si un jugador pide una sala que vive en otro nodo, el servidor
responde `LOBBY_REDIRECT` y el cliente se reconecta a ese nodo.

### Despliegue distribuido en AWS (`infra/lib/distribuido-stack.ts`, stack `OperacionGaravitoDistribuido`)

**Desplegado el 20-11-2026:** https://d207yv243tya3v.cloudfront.net (Grafana en `/grafana/`).
Los dos nodos pasan el chequeo de salud del ALB y las pruebas de k6 contra él están en
[RENDIMIENTO.md](RENDIMIENTO.md) §4b.

```
                         ┌──────────────── CloudFront (HTTPS, red global) ────────────────┐
Navegador ──HTTPS──────▶ │ /*        /ws/*, /api/*           /n1/*  /n2/*      /grafana/* │
                         └──┬──────────────┬───────────────────┬──────┬────────────┬──────┘
                            ▼              ▼                   │      │            ▼
                     S3 (frontend)   ALB (balanceador,         │      │     EC2 monitoreo
                                      2 zonas)                 │      │   (Prometheus+Grafana)
                                     ┌──────┴──────┐           │      │            │ lee :9091
                                     ▼             ▼           ▼      ▼            │
                              EC2 nodo-1     EC2 nodo-2  ◀─── directo por nodo ────┘
                              (us-east-2a)   (us-east-2b)   (sala en ese nodo)
                                     │             │
                         ┌───────────┴──────┬──────┴──────────┐
                         ▼                  ▼                 
                 RDS PostgreSQL      ElastiCache Redis      
                 (historial,         (sala → nodo,          
                  ranking)            SETNX + TTL)          
```

| Componente | Servicio | Dónde | Por qué así |
|---|---|---|---|
| Frontend | S3 + CloudFront | Global | Archivos estáticos cerca del jugador |
| Balanceador | Application Load Balancer | 2 zonas de disponibilidad | Reparte las conexiones; saca un nodo que no pasa el chequeo de salud (`/actuator/health` cada 10 s) |
| Backend | 2 × EC2 t4g.small, misma imagen | Una en cada zona | Escalado horizontal; si cae una, la otra sigue |
| Tiempo real | WebSocket/STOMP en cada nodo; Redis como registro compartido | — | La sala (estado del juego) vive en la memoria de un nodo por rendimiento (tick de 66 ms) |
| Base de datos | RDS PostgreSQL 16 | Servidor administrado aparte | Copias automáticas, credenciales en Secrets Manager |
| Registro de salas | ElastiCache Redis | Servidor administrado aparte | `SETNX` atómico para que dos nodos no tomen el mismo código |
| Observabilidad | EC2 con Prometheus y Grafana | Máquina aparte | Monitorear no le quita CPU a los nodos (en la máquina única Prometheus, Grafana y PostgreSQL se llevaban ~48 % de la CPU en el estrés) |

Cada componente acepta solo a quien lo usa (Security Groups): el ALB solo a CloudFront,
los nodos solo al ALB, a CloudFront (rutas `/n1`, `/n2`) y a Prometheus, y la base y
Redis solo a los nodos. El actuator de los nodos escucha en otro puerto (9091) que solo
ven el ALB y Prometheus.

### Despliegue que está publicado hoy (`infra/lib/garavito-stack.ts`)

`www.operaciongaravito.me` corre en **una sola EC2** con backend, PostgreSQL,
Prometheus y Grafana. Es el despliegue de los sprints anteriores: barato y simple, pero
monolítico en un servidor. El despliegue distribuido de arriba lo reemplaza para el
Release 2 y es un stack aparte, así desplegarlo no toca el juego publicado ni su base.

### En local (`docker-compose.cluster.yml`)

La misma topología en contenedores: frontend (nginx), balanceador nginx, 2 nodos,
Redis, PostgreSQL, Prometheus y Grafana. Sirve para probar y para la demo de caída de
un nodo, **no como prueba de distribución física** (todo corre en un host).

## 2. SLA publicados por el proveedor

| Componente | Servicio AWS | SLA publicado (mensual) | Fuente |
|---|---|---|---|
| CDN | Amazon CloudFront | 99,9 % = 0,999 | aws.amazon.com/cloudfront/sla |
| Frontend | Amazon S3 Standard | 99,9 % = 0,999 | aws.amazon.com/s3/sla |
| Balanceador | Elastic Load Balancing (ALB) | 99,99 % = 0,9999 | aws.amazon.com/elasticloadbalancing/sla |
| Cada nodo | Amazon EC2, una instancia | 99,5 % = 0,995 (nivel instancia) | aws.amazon.com/compute/sla |
| Base de datos | Amazon RDS Single-AZ / Multi-AZ | 99,5 % / 99,95 % | aws.amazon.com/rds/sla |
| Registro de salas | ElastiCache, 1 nodo / Multi-AZ | sin SLA (se asume 99,5 %, como una instancia) / 99,9 % | aws.amazon.com/elasticache/sla |

## 3. Componentes en serie y en paralelo; puntos únicos de falla

No todos los componentes son necesarios para todo. Por caso de uso:

| Caso de uso | Componentes en serie | En paralelo |
|---|---|---|
| **Jugar** (entrar a una sala y jugar) | CloudFront → S3 (cargar el juego) → ALB → **nodos** → Redis (crear/buscar sala) | Nodo-1 ∥ nodo-2 |
| **Ranking / historial** | CloudFront → S3 → ALB → **nodos** → RDS | Nodo-1 ∥ nodo-2 |
| Monitoreo | CloudFront → EC2 de monitoreo | — (no afecta al juego) |

Una partida ya empezada solo necesita CloudFront, el ALB (o la ruta directa `/nX`) y
su nodo: Redis se usa al crear o buscar una sala y PostgreSQL al terminar la partida.

**Puntos únicos de falla:**

| Punto | En el despliegue actual (1 EC2) | En el distribuido | Mitigación |
|---|---|---|---|
| Servidor del backend | **Sí** (todo en una EC2) | No: 2 nodos en 2 zonas | — |
| Base de datos | **Sí** (PostgreSQL en la misma EC2) | **Sí** (RDS Single-AZ) | `multiAz: true` en `distribuido-stack.ts` (+~US$12/mes) |
| Redis | No existe | **Sí** (1 nodo) | Replication group Multi-AZ |
| Balanceador | No hay | No (ALB administrado en 2 zonas) | — |
| CloudFront / S3 | Administrados, globales | Igual | — |
| Estado de una partida | En la memoria de la EC2 | En la memoria de un nodo: si cae, esas partidas se pierden | Decisión de diseño (ver ED-1) |

## 4. Cálculo de disponibilidad

Fórmulas: serie `A = ∏ Aᵢ`; paralelo `A = 1 − ∏(1 − Aᵢ)`; downtime mensual
`(1 − A) × 30 días`; anual `(1 − A) × 365 días`.

**Capa del backend** (lo que cambió con el escalado):

- Actual: una EC2 → **A = 0,995**.
- Distribuido: ALB en serie con dos nodos en paralelo →
  `A = 0,9999 × [1 − (1 − 0,995)²] = 0,9999 × 0,999975 = 0,999875` → **99,9875 %**.

| Escenario | A | % | "Nueves" | Downtime mensual | Downtime anual |
|---|---|---|---|---|---|
| Backend, 1 EC2 (actual) | 0,995 | 99,5 % | 2,3 | 216 min (3,6 h) | 43,8 h |
| **Backend, ALB + 2 nodos** | 0,999875 | **99,9875 %** | **3,9** | **5,4 min** | **1,1 h** |
| Jugar, actual: `0,999 × 0,999 × 0,995` | 0,993011 | 99,30 % | 2,2 | 302 min (5,0 h) | 61,2 h (2,6 d) |
| Jugar, distribuido: `0,999 × 0,999 × 0,9999 × 0,999975 × 0,995` | 0,992887 | 99,29 % | 2,2 | 307 min (5,1 h) | 62,3 h (2,6 d) |
| Jugar, distribuido con Redis Multi-AZ (0,999) | 0,996878 | **99,69 %** | 2,5 | **135 min (2,2 h)** | 27,3 h |
| Ranking, distribuido (RDS Single-AZ) | 0,992887 | 99,29 % | 2,2 | 307 min | 62,3 h |
| Ranking, distribuido con RDS Multi-AZ (0,9995) | 0,997377 | **99,74 %** | 2,6 | 113 min (1,9 h) | 23,0 h |

**Interpretación:**

- El escalado horizontal le sube a la capa del backend **más de un "nueve"**: de 99,5 %
  (3,6 h de caída al mes) a 99,9875 % (5 minutos al mes). Con dos nodos, para que el
  backend se caiga tienen que fallar los dos a la vez.
- **El total no mejora igual porque el eslabón débil se mueve:** el sistema entero no
  puede ser más disponible que su componente en serie más débil. Con los nodos
  redundantes, lo que manda son CloudFront y S3 (99,9 % cada uno) y los datos en una
  sola zona (Redis y RDS a 99,5 %). Con Redis y RDS en una sola zona, el
  distribuido queda prácticamente igual que la EC2 única (99,29 % vs 99,30 %): se
  cambió un punto único de falla (la EC2) por otros dos (Redis y RDS).
- **Para el SLA objetivo de ≥ 99,5 % hay que poner los datos en Multi-AZ:** jugar sube
  a 99,69 % (2,2 h al mes) y el ranking a 99,74 %. Es la acción de mejora siguiente
  (+~US$25/mes); no se activó por costo, porque la cuenta tiene créditos limitados.
- "Dos nueves y medio" (99,5–99,7 %) es razonable para un juego académico; tres nueves
  exigirían además otro origen para el frontend (por ejemplo, S3 en dos regiones con
  *origin failover* de CloudFront).

## 5. Contraste con lo observado en el prototipo

El cálculo es teórico (probabilidades de los SLA). Lo medido, con sus límites:

| Observación | Resultado | Dónde |
|---|---|---|
| Caída de un nodo con 45 jugadores (compose, `kill -9`) | 2 de 221 conexiones fallaron justo en la caída (99 %); 207 de 207 entraron después; latencia sin cambio (estado p95 132 ms); 12 sesiones del nodo caído se cortaron | [escalado/README.md](escalado/README.md) §4 |
| 200 jugadores en un nodo, pico de 20 → 200 en 10 s | 0 errores HTTP, 100 % de entradas, 0 sesiones cortadas, tick p99 28 ms | [RENDIMIENTO.md](RENDIMIENTO.md) |
| `up` y salud de cada nodo | Alerta "Backend caído" (sobre `up` de cada nodo) y panel "Salas y jugadores por nodo" en Grafana (Prometheus cada 5 s) | `monitoring/grafana/provisioning/alerting/reglas.yml` |

**Limitaciones:** las pruebas duran minutos, no meses, así que no miden el SLA real; la
caída de un nodo se probó en un solo host (compose); y una sola corrida no da
estadística de fallas raras (zonas de AWS caídas).

## 6. Cómo desplegarlo y probar la caída en AWS

```powershell
cd backend; .\mvnw.cmd -B package -DskipTests; cd ..
cd frontend; $env:VITE_WS_URL='/ws'; npm run build; cd ..
cd infra; npm install
$env:GARAVITO_ORIGIN_SECRET = Get-Content $HOME\.garavito-origin-secret
npx cdk deploy OperacionGaravitoDistribuido --exclusively
```

Salidas: `Url` (el juego), `GrafanaUrl`, `NodosIds`, `BalanceadorDns`. Para la demo:

```powershell
# Carga contra el despliegue distribuido (k6 en el portatil, backend en AWS)
k6 run -e BASE_URL=<Url> -e PERFIL=carga k6/partidas.js
# Mientras corre: apagar un nodo y mirar Grafana (<GrafanaUrl>)
aws ec2 stop-instances --region us-east-2 --instance-ids <id del nodo 2>
```

Costo aproximado del stack: ~US$3,3 por día (3 t4g.small, ALB, RDS t4g.micro,
ElastiCache t4g.micro, IPs públicas). Para borrarlo:
`npx cdk destroy OperacionGaravitoDistribuido` (RDS deja una copia final).
