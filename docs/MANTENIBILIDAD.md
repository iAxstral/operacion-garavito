# Mantenibilidad: inspección continua con SonarQube

Escenario de calidad: [EM-1](ESCENARIOS_DE_CALIDAD.md#em-1--mantenibilidad-inspección-continua).

## 1. Pipeline (GitHub Actions con reusable workflows)

`.github/workflows/ci.yml` llama a cuatro workflows reutilizables (`workflow_call`):

| Reusable | Qué hace | Lo usan |
|---|---|---|
| `reusable-maven.yml` | Pruebas Java + cobertura JaCoCo (tabla en la página del job) | `backend` |
| `reusable-node.yml` | `npm audit`, lint, pruebas con cobertura (lcov), build | `frontend` |
| `reusable-backend-vivo.yml` | Levanta el backend con unos perfiles y corre un comando contra él | `ataques` (pentest), `carga` (k6) |
| `reusable-sonar.yml` | Pruebas con cobertura + análisis + **Quality Gate** (`sonar.qualitygate.wait=true`: si sale rojo, el job falla) | `sonar-backend`, `sonar-frontend` |

Además corren Trivy (dependencias del backend) y Playwright (e2e).

Para que el análisis llegue a SonarQube, el repositorio necesita los secretos
`SONAR_HOST_URL` y `SONAR_TOKEN` (ver `infra/README.md#sonarqube`).

## 2. Servidor

SonarQube 10.7 en AWS: **https://d1nb9719430frc.cloudfront.net**. Tiene dos
proyectos: `operacion-garavito-backend` y `operacion-garavito-frontend`.

## 3. Cobertura (medida el 20-11-2026)

| Capa | Pruebas | Cobertura (fórmula de Sonar: líneas + ramas) | Detalle |
|---|---|---|---|
| Backend | 322 (JUnit) | **86,9 %** | 92,7 % de líneas, 77,0 % de ramas (JaCoCo) |
| Frontend | 110 (ejecutor de Node) | **97,1 %** de la lógica | 98,2 % de líneas, 92,0 % de ramas |

**Qué mide el frontend:** `sonar.coverage.exclusions` (en `frontend/sonar-project.properties`)
saca **solo de la cobertura** el código que corre en un navegador real:

- escenas y capas de Phaser;
- arte, audio y componentes React;
- el cliente del WebSocket.

Son unas 15 000 de 18 300 líneas. Ese código lo prueban las e2e de Playwright, y el
ejecutor de Node no puede medir su cobertura. Sonar igual lo analiza para buscar bugs,
vulnerabilidades y code smells.

La cobertura del 97,1 % es de la lógica: reglas, catálogos, mapas, estadísticas,
repeticiones y mezcla de mensajes. Para recalcularla igual que Sonar:

```bash
cd frontend && npm run test:coverage && node scripts/cobertura-sonar.mjs
```

**Pruebas nuevas de esta entrega:**

- `mapLayout.test.js` comprueba que **los 15 pisos del cliente coinciden con las
  grillas del servidor** (paredes y puertas).
- `catalogs.test.js` y `profile.test.js` (frontend).
- `GameControllerTest`, `ConcurrenciaTest` y `DoorToggleTest` (backend).

## 4. Controles de calidad aplicados

- Quality Gate de SonarQube con espera: el pipeline falla si queda rojo.
- Lint sin errores, `npm audit` (vulnerabilidades altas) y Trivy.
- Pentest automático contra el backend en configuración de producción.
- k6 con umbrales: el job falla si no se cumplen.
