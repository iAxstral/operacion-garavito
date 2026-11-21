# Contribuciones individuales y uso de IA

## 1. Contribuciones (historial de git verificable)

Datos de `git shortlog -sne --no-merges` y `git log --shortstat` al 20-11-2026.
Incluyen archivos generados, como imágenes, reportes y `package-lock.json`, así que
las líneas son una medida gruesa.

| Integrante | Usuario de git | Commits (sin merges) | Líneas + / − | Aportes principales |
|---|---|---|---|---|
| Tomás Olaya Díaz | `Tomas` | 235 | +61 038 / −7 291 | Backend autoritativo: oleadas, zombis, A\*, jefe, misiones, escape, modos y ranking; temporada de Navidad; escalado a varios nodos con Redis; k6, Prometheus, Grafana y alertas; seguridad y pentest |
| Isaac Burgos | `Isaac1805BC` | 142 | +12 702 / −4 349 | Minijuegos y accesibilidad; barricadas, pantalla completa y salir de la partida; rendimiento (luces, calidad automática, FPS y ping); logros; juego solo en Navidad; integración de SonarQube |
| Javier Romero | `Deathkiz` | 25 | +10 085 / −452 | Despliegue en AWS con CDK (EC2, S3, CloudFront y dominio); Prometheus y Grafana en AWS; k6 contra AWS; personajes en 16 direcciones y retratos; ajuste a la ventana. En esta entrega: puertas e inventario, SonarQube en AWS, despliegue distribuido, reusable workflows, pruebas de cobertura y concurrencia, prueba de picos y documentación de los atributos de calidad |

Para comprobarlo: `git shortlog -sne --no-merges` y `git log --author=<usuario>`.
El tablero de Azure DevOps tiene las historias por sprint:
https://dev.azure.com/OperacionGaravito/OperacionGaravito

## 2. Uso de inteligencia artificial

| Herramienta | Objetivo | Artefacto | Validación humana | Mejora obtenida |
|---|---|---|---|---|
| Claude Code (Anthropic) | Diagnosticar el bug de las puertas | Distancia medida desde los pies, colisión de una casilla, `DoorToggleTest` | Se probó jugando en local hasta que se veía bien (3 ajustes pedidos por el equipo) | Las puertas se abren desde los dos lados y sin dejar a nadie atrapado |
| Claude Code | Infraestructura | `infra/lib/sonar-stack.ts` y `distribuido-stack.ts` | Revisión del `cdk diff`, solo recursos nuevos; prueba de cada ruta y del *health* de los nodos tras desplegar | SonarQube y el despliegue distribuido sin tocar el juego publicado |
| Claude Code | CI/CD y calidad | Reusable workflows, pruebas de `GameController`, de concurrencia y de mapas contra las grillas del servidor | Las pruebas fallan con el código viejo y pasan con el nuevo; e2e completas | Cobertura del backend de 79 % a 87 % |
| Claude Code | Rendimiento | Perfil de picos, TPS/TPM y registro y gráficas del servidor | Corridas reales; diagnóstico de la saturación del generador | Informe comparativo con causas reales, no solo metas |
| Claude Code | Documentación | Escenarios de calidad, disponibilidad, concurrencia, portabilidad y diagramas | Revisión de cada cifra contra el código, las pruebas y las mediciones | Evidencia trazable de cada requisito |
| Gemini (Nano Banana) | Arte | Retratos de los personajes | Selección y ajuste por el equipo | — |

Ningún prompt incluyó credenciales: los secretos (origen de CloudFront, RDS y SonarQube)
se generan en las máquinas o en Secrets Manager y no están en el repositorio. Los
integrantes deben poder explicar el código asistido; cada cambio quedó en commits
pequeños con su explicación.
