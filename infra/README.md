# Despliegue en AWS (CDK)

El juego corre en **https://www.operaciongaravito.me**.

```
Navegador ──HTTPS──▶ CloudFront (www.operaciongaravito.me)
                        ├── /*      → S3 (frontend estatico)
                        ├── /ws/*   → EC2 :8080 (WebSocket)
                        ├── /api/*         → EC2 :8080
                        ├── /grafana/*     → EC2 :3000 (Grafana)
                        └── /prometheus/*  → EC2 :9090 (Prometheus, con clave)
EC2 t4g.small: backend (Java 21) + PostgreSQL 16 + Prometheus + Grafana
               (Prometheus lee /actuator/prometheus por localhost)

GitHub Actions ──HTTPS──▶ CloudFront (d1nb9719430frc.cloudfront.net)
                             └── /*  → EC2 :9000 (SonarQube, stack aparte)
EC2 t4g.small: SonarQube 10.7 + PostgreSQL 16 (Docker)
```

- Region: **us-east-2** (la organizacion de la cuenta solo permite esa).
- Costo aproximado: **US$17,50/mes** encendido, **US$5,30/mes** con la instancia apagada.
- Sin SSH: se entra a la maquina con SSM Session Manager.

## Requisitos

AWS CLI con sesion iniciada, Node y Java 21. No hace falta Docker.

La sesion vence cada pocas horas. Si un comando dice `Your session has expired`,
hay que volver a correr `aws login` y seguir.

## Desplegar o actualizar

```powershell
# 1. Backend (con pruebas)
cd backend; .\mvnw.cmd -B package; cd ..

# 2. Frontend (el WebSocket va por el mismo dominio)
cd frontend; npm ci; npm run lint; npm test; $env:VITE_WS_URL='/ws'; npm run build; cd ..

# 3. Infraestructura: primero ver que cambia, despues desplegar
cd infra; npm install; npx cdk diff OperacionGaravito; npx cdk deploy OperacionGaravito --exclusively
```

Hay dos stacks: `OperacionGaravito` (el juego) y `OperacionGaravitoSonar` (SonarQube,
ver [SonarQube](#sonarqube)). Nombrar siempre el stack con `--exclusively`, asi
desplegar uno nunca toca el otro.

Si `cdk diff` dice `There were no differences`, lo desplegado ya es el codigo actual
y no hace falta `cdk deploy`. Si el juego no responde, puede que la maquina este
apagada (ver [Ahorrar](#ahorrar)).

### Cuidado: un `.jar` nuevo borra la base

Un `.jar` nuevo **recrea la maquina**, y con ella PostgreSQL: se pierden el
historial y el ranking. Basta con volver a compilar, aunque el codigo no cambie,
porque el archivo sale distinto. En `cdk diff` se ve como
`AWS::EC2::Instance Backend ... destroy`. Cambiar solo el frontend no borra nada.
Lo mismo pasa al cambiar algo en `monitoring/` (tableros, alertas, `prometheus.aws.yml`):
la maquina se recrea y con ella la base y el historial de Prometheus.

Para conservar los datos, respaldar antes de `cdk deploy` y restaurar despues.
Sirve mientras no haya migraciones nuevas en `backend/src/main/resources/db/migration`
(si las hay, restaurar puede fallar). Los comandos son para **Git Bash**:

```bash
# Id de la maquina actual
ID=$(aws cloudformation describe-stacks --region us-east-2 --stack-name OperacionGaravito \
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" --output text)

# Respaldo: solo los datos (la estructura la crea Flyway en la maquina nueva)
CID=$(aws ssm send-command --region us-east-2 --instance-ids $ID --document-name AWS-RunShellScript \
  --parameters 'commands=["sudo -u postgres pg_dump -d operaciongaravito --data-only --exclude-table=flyway_schema_history --inserts"]' \
  --query Command.CommandId --output text)
sleep 5
aws ssm get-command-invocation --region us-east-2 --command-id $CID --instance-id $ID \
  --query StandardOutputContent --output text > respaldo.sql
```

Despues de `cdk deploy`, esperar a que `/api/ping` responda 200 y restaurar en la
maquina nueva (el id cambia, por eso se vuelve a leer):

```bash
ID=$(aws cloudformation describe-stacks --region us-east-2 --stack-name OperacionGaravito \
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" --output text)
B64=$(base64 -w0 respaldo.sql)
aws ssm send-command --region us-east-2 --instance-ids $ID --document-name AWS-RunShellScript \
  --parameters "commands=[\"echo $B64 | base64 -d > /tmp/b.sql\",\"sudo -u postgres psql -v ON_ERROR_STOP=1 -d operaciongaravito -f /tmp/b.sql\",\"rm /tmp/b.sql\"]"
```

El respaldo viaja por la salida de SSM, que admite unos 24 KB. Si la base crece mas
que eso, hay que mover el respaldo por S3.

### Comprobar que quedo bien

```bash
curl -i https://www.operaciongaravito.me/api/ping                  # 200
curl https://www.operaciongaravito.me/api/estado                   # 200
curl "https://www.operaciongaravito.me/api/ranking?building=G"     # partidas restauradas
curl -i https://www.operaciongaravito.me/ws/info                   # 200 (WebSocket)
```

Un 504 en `/api/*` casi siempre es la maquina apagada o el backend aun arrancando
(tarda uno o dos minutos despues de encenderla o desplegar).

## Monitoreo (Prometheus y Grafana)

Corren en la misma EC2 y se instalan solos al crear la maquina, con los mismos
tableros y alertas de `monitoring/grafana` que el entorno local.

- **Grafana:** https://www.operaciongaravito.me/grafana/ (con la barra final). Los
  tableros se ven sin iniciar sesion; para editar, usuario `admin`.
- **Prometheus:** https://www.operaciongaravito.me/prometheus/ (usuario `garavito`).
  En *Status → Targets* el destino `garavito` debe estar `UP`.

Las claves se generan en la maquina (`/opt/garavito/monitoring.env`) y cambian cada
vez que se recrea. Para verlas:

```powershell
.\k6\nube.ps1 -SoloClaves
```

`/actuator` no se publica: Prometheus lo lee por `localhost` dentro de la maquina.

### Pruebas de carga contra el despliegue

Requiere k6 (`winget install k6`) y la sesion de AWS iniciada. El script lee la clave
de Prometheus por SSM y le manda las metricas de k6, asi en Grafana se ven juntas la
carga y la respuesta del servidor:

```powershell
.\k6\nube.ps1 -Perfil humo        # 4 jugadores, ~45 s: comprobar que todo responde
.\k6\nube.ps1 -Perfil carga       # hasta 80 jugadores, ~3,5 min
.\k6\nube.ps1 -Perfil estres      # hasta 200 jugadores, ~5 min
.\k6\nube.ps1 -Perfil estres -Reporte   # ademas deja docs/k6/reporte-nube-estres.html
```

Mientras corre, abrir en Grafana **Prueba de carga (k6)** (elegir la corrida en el
selector **Corrida**) y **Operación Garavito** (jugadores, salas, tick, CPU y memoria
del servidor). Los perfiles y umbrales estan en [`docs/k6`](../docs/k6/README.md).

A diferencia de la corrida local, aqui la latencia incluye el viaje hasta Ohio y por
CloudFront, y la maquina es una t4g.small (2 vCPU con creditos, 2 GB), asi que el
perfil `estres` sirve para ver hasta donde aguanta el despliegue real.

#### Resultado del 07-11-2026 (k6 desde Bogota, corrida `estres-nube-1107-0842`)

| Umbral | Local (docs/k6) | AWS t4g.small | |
|---|---|---|---|
| Entrada exitosa > 95 % | 100 % | **95,4 %** (497 de 521) | ✅ por poco |
| Intervalo de estado p95 < 250 ms | 133 ms | **957 ms** | ❌ |
| Ida y vuelta del movimiento p95 < 300 ms | 101 ms | **1,76 s** | ❌ |
| Ranking p95 < 300 ms | 16,6 ms | **5,9 s** | ❌ |
| Errores HTTP < 1 % | 0 % | **0 %** | ✅ |

El servidor (Prometheus) llego a **195 jugadores en 68 salas**, con tick p99 de 13 ms
(de 66 ms disponibles). El limite es la maquina: la CPU total llego a **90 %**, de la
cual el backend usaba 42 % y el resto Prometheus, Grafana y PostgreSQL. No es falta de
creditos: la instancia esta en modo `unlimited`. Con `humo` (4 jugadores) todos los
umbrales pasan (estado p95 145 ms, movimiento p95 223 ms).

## SonarQube

El analisis de calidad del CI (job `sonar` de `.github/workflows/ci.yml`) se manda a
un SonarQube propio en **https://d1nb9719430frc.cloudfront.net**, en su propia EC2
t4g.small y su propia distribucion de CloudFront (`lib/sonar-stack.ts`). Es un stack
aparte para que desplegarlo, apagarlo o borrarlo nunca recree la maquina del juego.

- Costo aproximado: **US$17/mes** encendido (maquina, IP fija y disco).
- La maquina instala Docker, levanta SonarQube y PostgreSQL, cambia la clave por
  defecto `admin/admin` y genera un token para el CI. Todo queda en
  `/opt/sonar/sonar.env` y cambia si se recrea la maquina.
- 2 GB alcanzan porque el analisis corre en GitHub Actions; la memoria de cada
  proceso de SonarQube esta ajustada y hay 2 GB de swap.

```powershell
cd infra; npx cdk diff OperacionGaravitoSonar; npx cdk deploy OperacionGaravitoSonar --exclusively
```

Para ver la clave de `admin` y el token del CI (por SSM, sin entrar a la maquina):

```powershell
$id = aws ssm send-command --region us-east-2 --instance-ids <SonarInstanceId> `
  --document-name AWS-RunShellScript --parameters 'commands=["cat /opt/sonar/sonar.env"]' `
  --query Command.CommandId --output text
aws ssm get-command-invocation --region us-east-2 --instance-id <SonarInstanceId> `
  --command-id $id --query StandardOutputContent --output text
```

En GitHub (*Settings → Secrets and variables → Actions*) van dos secretos:

| Secreto | Valor |
|---|---|
| `SONAR_HOST_URL` | `https://d1nb9719430frc.cloudfront.net` |
| `SONAR_TOKEN` | el `SONAR_TOKEN` de `/opt/sonar/sonar.env` |

Los proyectos `operacion-garavito-backend` y `operacion-garavito-frontend` se crean
solos con el primer analisis.

## Ahorrar

```powershell
# El id sale en la salida InstanceId de cdk deploy (cambia cada vez que se recrea la maquina)
aws ec2 stop-instances  --region us-east-2 --instance-ids <id>
aws ec2 start-instances --region us-east-2 --instance-ids <id>
```

Apagar y encender no borra la base; solo recrear la maquina lo hace.

SonarQube se apaga igual con su id (salida `SonarInstanceId`); con la maquina
apagada solo cuestan la IP y el disco (~US$5/mes), pero el job `sonar` del CI falla
hasta encenderla. Para quitarlo del todo: `npx cdk destroy OperacionGaravitoSonar`.

Para borrar todo: `npx cdk destroy --all` dentro de `infra/`. El certificado de ACM
(us-east-1) se creo con la CLI y se borra aparte en la consola de ACM.

## Dominio

DNS en Namecheap (dominio del GitHub Student Pack):

| Tipo  | Host | Valor |
|-------|------|-------|
| CNAME | `www` | dominio de CloudFront (salida `CloudFrontDomain`) |
| CNAME | `_3c77f49e98416203e252255c792a2b5d.www` | validacion del certificado de ACM |
