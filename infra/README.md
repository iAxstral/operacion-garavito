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

AWS CLI con sesion iniciada (`aws login`), Node y Java 21. No hace falta Docker.

## Desplegar o actualizar

```powershell
# 1. Backend
cd backend; .\mvnw.cmd -B package -DskipTests; cd ..

# 2. Frontend (el WebSocket va por el mismo dominio)
cd frontend; $env:VITE_WS_URL='/ws'; npm run build; cd ..

# 3. Infraestructura
cd infra; npm install; npx cdk deploy
```

Un `.jar` nuevo **recrea la maquina**, y con ella se borran el historial y el
ranking de PostgreSQL. Cambiar solo el frontend no borra nada.

## Ahorrar

```powershell
# El id sale en la salida InstanceId de cdk deploy
aws ec2 stop-instances  --region us-east-2 --instance-ids <id>
aws ec2 start-instances --region us-east-2 --instance-ids <id>
```

Para borrar todo: `npx cdk destroy` dentro de `infra/`. El certificado de ACM
(us-east-1) se creo con la CLI y se borra aparte en la consola de ACM.

## Dominio

DNS en Namecheap (dominio del GitHub Student Pack):

| Tipo  | Host | Valor |
|-------|------|-------|
| CNAME | `www` | dominio de CloudFront (salida `CloudFrontDomain`) |
| CNAME | `_3c77f49e98416203e252255c792a2b5d.www` | validacion del certificado de ACM |
