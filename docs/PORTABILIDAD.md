# Portabilidad: de AWS a on-premise

Escenario de calidad: [EP-1](ESCENARIOS_DE_CALIDAD.md#ep-1--portabilidad-de-aws-a-on-premise).

## 1. Todo en contenedores

| Componente | Imagen | Archivo |
|---|---|---|
| Frontend | `node:24-alpine` (build) → `nginx:1.27-alpine`; reenvía `/ws` y `/api` al backend | `frontend/Dockerfile`, `frontend/nginx/default.conf.template` |
| Backend (cada nodo) | `eclipse-temurin:21-jdk` (build) → `eclipse-temurin:21-jre` | `backend/Dockerfile` |
| Balanceador | `nginx:1.27-alpine` | `cluster/nginx.conf` |
| Base de datos | `postgres:16-alpine` (Flyway crea las tablas al arrancar) | — |
| Registro de salas | `redis:7-alpine` | — |
| Observabilidad | `prom/prometheus:v2.54.1`, `grafana/grafana:11.2.0` | `monitoring/` |

Todo se levanta con `docker-compose.cluster.yml`.

## 2. Equivalencias AWS → on-premise

| En AWS | On-premise | Configuración |
|---|---|---|
| CloudFront + S3 | Contenedor `frontend` (nginx) | `BACKEND_UPSTREAM` |
| ALB | Contenedor `lb` (nginx, `hash consistent`) | `cluster/nginx.conf` |
| EC2 nodos | Contenedores `node1`, `node2` | `SPRING_PROFILES_ACTIVE=cluster`, `NODE_PUBLIC_URL`, `NODE_NAME` |
| RDS PostgreSQL | Contenedor `postgres` | `SPRING_DATASOURCE_URL/USERNAME/PASSWORD` |
| ElastiCache Redis | Contenedor `redis` | `REDIS_HOST`, `REDIS_PORT` |
| EC2 de monitoreo | Contenedores `prometheus`, `grafana` | `monitoring/prometheus.cluster.yml`, `GRAFANA_ADMIN_PASSWORD` |
| Secrets Manager | Variables de entorno o `.env` fuera del repo | — |

El código no cambia: toda la configuración entra por variables de entorno.

## 3. Instrucciones reproducibles

```powershell
$env:GRAFANA_ADMIN_PASSWORD = '<clave>'
docker compose -f docker-compose.cluster.yml up --build
```

| Servicio | URL |
|---|---|
| Juego | http://localhost:8000 |
| Balanceador | http://localhost:8080 |
| Nodos | http://localhost:8081, http://localhost:8082 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3000 |

**Migrar los datos** (ranking e historial) desde AWS:

```bash
pg_dump --data-only -h <origen> -U garavito operaciongaravito > datos.sql
docker compose -f docker-compose.cluster.yml exec -T postgres psql -U postgres operaciongaravito < datos.sql
```

Redis no se migra: solo guarda salas en curso, con un vencimiento de 2 minutos.

## 4. Validación (20-11-2026)

Se construyó la imagen del frontend (117 MB) y se corrió contra un backend local:

- `nginx -t` correcto.
- `/` y las rutas de la SPA responden 200, con `X-Frame-Options` y `X-Content-Type-Options`.
- `/api/ping` responde **200** y `/ws/info` (SockJS) **200**, ambos a través de nginx.
- El upgrade del WebSocket (`/ws/websocket`) responde **101**.

Este compose sirve como entorno de prueba y on-premise. **No demuestra distribución
física**: todo corre en un host. La distribución física es el despliegue en AWS
(DISPONIBILIDAD.md).
