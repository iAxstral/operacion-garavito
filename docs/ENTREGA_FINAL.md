# Entrega final (Release 2): dónde está cada requisito

| Req. | Qué | Dónde verlo |
|---|---|---|
| — | Escenarios de calidad (uno o más por atributo) | [ESCENARIOS_DE_CALIDAD.md](ESCENARIOS_DE_CALIDAD.md) |
| 2.1 | Disponibilidad: balanceador, escalado horizontal, despliegue distribuido, SLA, serie y paralelo, cálculo de disponibilidad | [DISPONIBILIDAD.md](DISPONIBILIDAD.md), `infra/lib/distribuido-stack.ts`, `docker-compose.cluster.yml`, [escalado/README.md](escalado/README.md) |
| 2.2 | Seguridad: 3 escenarios con tácticas y validación ejecutable | [ESCENARIOS_DE_CALIDAD.md](ESCENARIOS_DE_CALIDAD.md) (ES-1 a ES-3), [SEGURIDAD.md](SEGURIDAD.md), `backend/src/test/.../security/`, `frontend/scripts/pentest.mjs` |
| 2.3 | Mantenibilidad: SonarQube, reusable workflows, cobertura ≥ 80 % | [MANTENIBILIDAD.md](MANTENIBILIDAD.md), `.github/workflows/`, https://d1nb9719430frc.cloudfront.net |
| 2.4 | Portabilidad: escenario Cloud → On-Premise, Docker y Compose | [PORTABILIDAD.md](PORTABILIDAD.md), `frontend/Dockerfile`, `backend/Dockerfile`, `docker-compose.cluster.yml` |
| 2.5 | Rendimiento: carga, estrés y picos con k6; TPS y TPM | [RENDIMIENTO.md](RENDIMIENTO.md), `k6/partidas.js`, `k6/correr_pruebas.sh`, `docs/k6/resultados/`, `docs/k6/reporte-*.html` |
| 2.6 | Observabilidad: Prometheus, Grafana, alertas y correlación con k6 | [grafana/README.md](grafana/README.md), [prometheus/README.md](prometheus/README.md), `monitoring/`, gráficas en `docs/k6/img/*-servidor.png` |
| 2.7 | Concurrencia y tiempo real | [CONCURRENCIA.md](CONCURRENCIA.md), `ConcurrenciaTest`, `MissionBoardTest`, e2e `partida.spec.js` |
| 3.1 | Código, README, CI, Azure DevOps | [README.md](../README.md), https://dev.azure.com/OperacionGaravito/OperacionGaravito |
| 3 | Diagramas UML: contexto, componentes, clases, ER, secuencia, despliegue y actividades | [DIAGRAMAS.md](DIAGRAMAS.md) |
| 2.8 / 3.1 | Contribuciones individuales y uso de IA | [CONTRIBUCIONES.md](CONTRIBUCIONES.md) |

**Despliegue distribuido en AWS:** https://d207yv243tya3v.cloudfront.net · Grafana:
https://d207yv243tya3v.cloudfront.net/grafana/ (ver [DISPONIBILIDAD.md](DISPONIBILIDAD.md)).
