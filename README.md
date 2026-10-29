# Operación Garavito

Juego cooperativo de decisión bajo presión, ambientado en la ECI — Proyecto ARSW 2026-2.

**Wiki del proyecto (Azure DevOps):** https://dev.azure.com/OperacionGaravito/OperacionGaravito/_wiki/wikis/OperacionGaravito.wiki

**Squad:** Tribu Transmilenio Bogotá
**Integrantes:** Tomás Olaya Díaz · Isaac Burgos · Javier Romero

## Estructura

- backend/ — Spring Boot · Java 21 · WebSocket/STOMP
- frontend/ — React · Vite
- docs/ESCALABILIDAD.md — mediciones de carga y propuesta para escalar
- docs/k6, docs/prometheus, docs/grafana — pruebas de carga y monitoreo, con capturas y resultados
- k6/ — script de prueba de carga · monitoring/ — Prometheus y Grafana con los tableros ya configurados

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

`docker compose -f monitoring/docker-compose.yml up -d` levanta Prometheus (`:9090`) y
Grafana (`:3000`, admin / garavito) con dos tableros: el servidor en vivo y la prueba
de carga de k6. Detalles en [`docs/prometheus`](docs/prometheus/README.md),
[`docs/grafana`](docs/grafana/README.md) y [`docs/k6`](docs/k6/README.md).

GitHub Actions corre backend, frontend y e2e en cada push y PR (`.github/workflows/ci.yml`).
