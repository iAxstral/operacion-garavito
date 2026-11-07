# Operación Garavito

Juego cooperativo de decisión bajo presión, ambientado en la ECI — Proyecto ARSW 2026-2.

**Wiki del proyecto (Azure DevOps):** https://dev.azure.com/OperacionGaravito/OperacionGaravito/_wiki/wikis/OperacionGaravito.wiki

**Jugar en línea:** https://www.operaciongaravito.me (AWS, ver [`infra/`](infra/README.md))

**Squad:** Tribu Transmilenio Bogotá
**Integrantes:** Tomás Olaya Díaz · Isaac Burgos · Javier Romero

## Estructura

- backend/ — Spring Boot · Java 21 · WebSocket/STOMP
- frontend/ — React · Vite
- docs/ESCALABILIDAD.md — mediciones de carga y propuesta para escalar
- docs/temporadas — ambientación de Navidad sangrienta, con capturas
- docs/rendimiento — luces más livianas, calidad automática, FPS/ping y logros de Nochebuena
- docs/k6, docs/prometheus, docs/grafana — pruebas de carga y monitoreo, con capturas y resultados
- k6/ — script de prueba de carga · monitoring/ — Prometheus y Grafana con los tableros ya configurados
- infra/ — despliegue en AWS con CDK (EC2, S3 y CloudFront)

## Correr el proyecto

```bash
# Backend (H2 en memoria, puerto 8080)
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
# Frontend (puerto 5173)
cd frontend && npm install && npm run dev
```

O en Windows: `./dev.ps1` abre los dos.

## Pruebas

| Qué | Comando |
|---|---|
| Backend (unitarias + integración con H2) | `cd backend && ./mvnw test` |
| Frontend: lint y unitarias | `cd frontend && npm run lint && npm test` |
| De punta a punta (Playwright: levanta backend y frontend solos) | `cd frontend && npm run test:e2e` |
| Costo del tick (benchmark, sin red) | `cd backend && ./mvnw test -Dtest=TickCostBenchmarkTest -Dbenchmark=true` |
| Carga por la red (bots STOMP) | `cd frontend && node scripts/load-test.mjs --url ws://localhost:8080/ws/websocket --rooms 25` |
| Carga con k6 (umbrales, ver `docs/k6`) | `k6 run k6/partidas.js` (o `-e PERFIL=humo` / `estres`) |

## Monitoreo

`GRAFANA_ADMIN_PASSWORD=<clave> docker compose -f monitoring/docker-compose.yml up -d`
levanta Prometheus (`:9090`) y Grafana (`:3000`, usuario `admin` con esa clave) con dos tableros: el servidor en vivo y la prueba
de carga de k6. Detalles en [`docs/prometheus`](docs/prometheus/README.md),
[`docs/grafana`](docs/grafana/README.md) y [`docs/k6`](docs/k6/README.md).

## Varios nodos

`docker compose -f docker-compose.cluster.yml up --build` levanta dos nodos detrás de un
balanceador (`:8080`), con Redis, PostgreSQL, Prometheus y Grafana. La demo con k6 y el
experimento de caída de un nodo están en [`docs/escalado`](docs/escalado/README.md).

## Despliegue

El juego está publicado en AWS (us-east-2): backend y PostgreSQL en una EC2, frontend
en S3, todo detrás de CloudFront con el dominio `www.operaciongaravito.me`. Cómo
desplegar, actualizar sin perder el ranking y apagar la máquina para ahorrar está en
[`infra/README.md`](infra/README.md).

GitHub Actions corre backend, frontend y e2e en cada push y PR (`.github/workflows/ci.yml`).
