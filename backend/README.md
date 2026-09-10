# Backend — Operación Garavito

Spring Boot 4.1 (Java 21) con Spring Data JPA, WebSocket/STOMP y PostgreSQL.

## Desarrollo local

La configuración por defecto (`application.properties`) apunta a PostgreSQL,
pensada para despliegue (Railway o similar) vía variables de entorno
(`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`,
`SPRING_DATASOURCE_PASSWORD`).

Para desarrollar localmente **sin tener Postgres instalado**, usa el perfil
`dev`, que levanta una base H2 en memoria (`application-dev.properties`):

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

O, corriendo el jar empaquetado:

```bash
./mvnw -DskipTests package
java -jar target/operacion-garavito-0.0.1-SNAPSHOT.jar --spring.profiles.active=dev
```

Con el perfil `dev` puedes inspeccionar la base en memoria en
`http://localhost:8080/h2-console` (JDBC URL: `jdbc:h2:mem:garavito`, usuario
`sa`, sin contraseña).

Sin el perfil `dev`, el backend intentará conectarse a PostgreSQL usando la
URL por defecto (`jdbc:postgresql://localhost:5432/operaciongaravito`) y
fallará al arrancar si no hay una instancia corriendo ahí.

## Endpoints

- `GET /ws/info` — handshake SockJS del endpoint STOMP en `/ws`.
- Tópico de prueba `/topic/game/test`, publicando en `/app/game/test` (ver
  `TestSocketController`) — solo para confirmar conectividad, sin lógica de
  juego todavía.
