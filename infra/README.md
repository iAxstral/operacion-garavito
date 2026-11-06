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

# 3. Infraestructura: primero ver que cambia, despues desplegar
cd infra; npm install; npx cdk diff; npx cdk deploy
```

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

### Comprobar que quedo bien

```bash
curl -i https://www.operaciongaravito.me/api/ping                  # 200
curl https://www.operaciongaravito.me/api/estado                   # 200
curl "https://www.operaciongaravito.me/api/ranking?building=G"     # partidas restauradas
curl -i https://www.operaciongaravito.me/ws/info                   # 200 (WebSocket)
```

Un 504 en `/api/*` casi siempre es la maquina apagada o el backend aun arrancando
(tarda uno o dos minutos despues de encenderla o desplegar).

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
