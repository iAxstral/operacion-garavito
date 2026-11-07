# Despliegue en AWS (CDK)

El juego corre en **https://www.operaciongaravito.me**.

```
Navegador ──HTTPS──▶ CloudFront (www.operaciongaravito.me)
                        ├── /*      → S3 (frontend estatico)
                        ├── /ws/*   → EC2 :8080 (WebSocket)
                        └── /api/*  → EC2 :8080
EC2 t4g.small: backend (Java 21) + PostgreSQL 16 en la misma maquina
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

# 3. Infraestructura: primero ver que cambia, despues desplegar (con el secreto de origen)
cd infra; npm install; npx ts-node test/verificar-stack.ts
$env:GARAVITO_ORIGIN_SECRET = Get-Content $HOME\.garavito-origin-secret
npx cdk diff; npx cdk deploy
```

### Secreto de origen (obligatorio)

CloudFront le agrega al backend el header `X-Origin-Verify` y el backend responde 403 a
todo lo que no lo trae (ver `docs/SEGURIDAD.md`). Sin ese secreto, `cdk diff` y
`cdk deploy` se niegan a correr. **Nunca va en el repositorio.** Se genera una sola vez
y se guarda fuera del proyecto; hay que usar el mismo en cada despliegue (si cambia,
cambia la maquina y se pierde la base, ver abajo):

```bash
openssl rand -hex 32 > ~/.garavito-origin-secret      # una sola vez
chmod 600 ~/.garavito-origin-secret
export GARAVITO_ORIGIN_SECRET=$(cat ~/.garavito-origin-secret)
```

Queda guardado en la plantilla de CloudFormation (lo ve quien tenga acceso de lectura
a la cuenta de AWS) y en `infra/cdk.out/` (ignorada por git). Ver los riesgos que quedan
en `docs/SEGURIDAD.md`.

Si `cdk diff` dice `There were no differences`, lo desplegado ya es el codigo actual
y no hace falta `cdk deploy`. Si el juego no responde, puede que la maquina este
apagada (ver [Ahorrar](#ahorrar)).

### Cuidado: un `.jar` nuevo borra la base

Un `.jar` nuevo **recrea la maquina**, y con ella PostgreSQL: se pierden el
historial y el ranking. Basta con volver a compilar, aunque el codigo no cambie,
porque el archivo sale distinto. En `cdk diff` se ve como
`AWS::EC2::Instance Backend ... destroy`. Cambiar solo el frontend no borra nada.

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

La migracion `V4__indice_jugadores_por_partida.sql` solo agrega un indice: no cambia
las tablas, asi que este respaldo de datos se restaura igual en la maquina nueva.

### Comprobar que quedo bien

```bash
curl -i https://www.operaciongaravito.me/api/ping                  # 200
curl https://www.operaciongaravito.me/api/estado                   # 200
curl "https://www.operaciongaravito.me/api/ranking?building=G"     # partidas restauradas
curl -i https://www.operaciongaravito.me/ws/info                   # 200 (WebSocket)
```

Un 504 en `/api/*` casi siempre es la maquina apagada o el backend aun arrancando
(tarda uno o dos minutos despues de encenderla o desplegar).

Comprobar los encabezados de seguridad y que el backend exige el secreto:

```bash
curl -sI https://www.operaciongaravito.me/ | grep -iE "strict-transport|content-security|x-frame|x-content-type|referrer"
# Dentro de la maquina (por SSM): sin el header el backend responde 403,
# y el actuator solo esta en 127.0.0.1:9091.
aws ssm send-command --region us-east-2 --instance-ids $ID --document-name AWS-RunShellScript \
  --parameters 'commands=["curl -s -o /dev/null -w %{http_code} localhost:8080/api/ping; echo; curl -s localhost:9091/actuator/health"]'
```

Y antes de la entrega, correr los ataques contra el sitio desplegado (no carga la
maquina; ver `docs/SEGURIDAD.md`):

```bash
cd frontend && node scripts/pentest.mjs https://www.operaciongaravito.me
```

## Propuestas que no estan aplicadas

- **AWS WAF con una regla rate-based** en CloudFront: cortaria inundaciones desde una
  IP antes de llegar al EC2. Para CloudFront el WebACL se crea en `us-east-1`, y la
  organizacion de esta cuenta no permite CloudFormation alli (por eso el certificado se
  creo con la CLI). Se podria crear con la CLI (`aws wafv2 create-web-acl --scope
  CLOUDFRONT --region us-east-1`) y asociarlo con `webAclId` en la `Distribution`.
  Cuesta unos USD 5/mes mas USD 1 por regla. El backend ya limita por conexion y por
  IP, asi que es una capa extra, no la unica.
- **TLS entre CloudFront y el EC2** (hoy `HTTP_ONLY`): el trafico va por la red de AWS,
  pero sin cifrar. Para usar `HTTPS_ONLY`, CloudFront exige un certificado publico
  valido en el origen: un subdominio (p. ej. `origen.operaciongaravito.me`) apuntando a
  la IP elastica con un certificado de Let's Encrypt en la maquina, o un ALB con ACM
  delante del EC2 (~USD 16/mes). Con el header secreto, un tercero no puede usar el
  origen aunque vaya por HTTP.

## Ahorrar

```powershell
# El id sale en la salida InstanceId de cdk deploy (cambia cada vez que se recrea la maquina)
aws ec2 stop-instances  --region us-east-2 --instance-ids <id>
aws ec2 start-instances --region us-east-2 --instance-ids <id>
```

Apagar y encender no borra la base; solo recrear la maquina lo hace.

Para borrar todo: `npx cdk destroy` dentro de `infra/`. El certificado de ACM
(us-east-1) se creo con la CLI y se borra aparte en la consola de ACM.

## Dominio

DNS en Namecheap (dominio del GitHub Student Pack):

| Tipo  | Host | Valor |
|-------|------|-------|
| CNAME | `www` | dominio de CloudFront (salida `CloudFrontDomain`) |
| CNAME | `_3c77f49e98416203e252255c792a2b5d.www` | validacion del certificado de ACM |
