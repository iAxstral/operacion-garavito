# Operación Garavito

Juego cooperativo de decisión bajo presión, ambientado en la ECI — Proyecto ARSW 2026-2.

**Wiki del proyecto (Azure DevOps):** https://dev.azure.com/OperacionGaravito/OperacionGaravito/_wiki/wikis/OperacionGaravito.wiki

**Squad:** Tribu Transmilenio Bogotá
**Integrantes:** Tomás Olaya Díaz · Isaac Burgos · Javier Romero

## Estructura

- backend/ — Spring Boot · Java 21 · WebSocket/STOMP
- frontend/ — React · Vite
- docs/ESCALABILIDAD.md — mediciones de carga y propuesta para escalar

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

GitHub Actions corre backend, frontend, e2e y análisis SonarQube en cada push y PR (`.github/workflows/ci.yml`).

## Calidad de código (SonarQube)

SonarQube corre localmente junto al stack de monitoreo:

```bash
docker compose -f monitoring/docker-compose.yml up -d
# SonarQube en http://localhost:9000 (admin / admin al primer inicio)
```

Una vez levantado, genera un token en **Administración → Seguridad → Tokens** y analiza:

```bash
# Backend (también genera reporte de cobertura JaCoCo)
cd backend && ./mvnw verify sonar:sonar -Dsonar.token=<TOKEN>

# Frontend
cd frontend && npx sonar-scanner -Dsonar.token=<TOKEN>
```

En CI se usan los secretos del repositorio `SONAR_TOKEN` y `SONAR_HOST_URL` (configúralos en *Settings → Secrets and variables → Actions*).
